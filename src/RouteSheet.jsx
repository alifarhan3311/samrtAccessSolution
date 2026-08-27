import React, { useState, useEffect } from 'react';
import './route-sheet.css';

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

async function json(path, options = {}) {
  const r = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...auth(), ...options.headers }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}

export default function RouteSheet() {
  const [agents, setAgents] = useState([]);
  
  const token = localStorage.getItem('token');
  const user = token ? JSON.parse(atob(token.split('.')[1])) : null;
  const isAgent = user?.role === 'agent';

  const [agentId, setAgentId] = useState(isAgent ? (user.sub || user.id || user._id) : '');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });
  
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAgent) {
      json('/users/agents').then(setAgents).catch(() => {});
    }
  }, [isAgent]);

  const loadData = () => {
    if (!isAgent && !agentId) return setGroups([]);
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    if (!isAgent) qs.set('agentId', agentId);
    if (date) qs.set('date', date);

    json(`/route-sheet?${qs.toString()}`)
      .then(data => setGroups(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [agentId, date]);

  const handleUpdateJob = async (jobId, field, value) => {
    try {
      await json(`/route-sheet/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value === '' ? null : value })
      });
    } catch (err) {
      console.error('Failed to save', err);
      // Optional: show a toast error
    }
  };

  const handleInputChange = (groupIndex, jobIndex, field, value) => {
    const newGroups = [...groups];
    newGroups[groupIndex].jobs[jobIndex][field] = value;
    setGroups(newGroups);
  };

  let totalRemaining = 0;
  let totalToLoad = 0;
  groups.forEach(g => {
    g.jobs.forEach(j => {
      totalRemaining += Math.floor((j.terminal?.official?.cashBalance || 0) / 20);
      totalToLoad += Math.floor((j.cashToLoad || 0) / 20);
    });
  });

  return (
    <div className="route-sheet-page">
      <div className="rs-header no-print">
        <div>
          <p className="eyebrow">PRINTABLE REPORTS</p>
          <h3>Daily Route</h3>
        </div>
        
        <div className="rs-filters">
          {!isAgent && (
            <label>Agent
              <select value={agentId} onChange={e => setAgentId(e.target.value)}>
                <option value="">Select Agent...</option>
                {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </label>
          )}
          <label>Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <button 
            className="aj-btn-primary" 
            onClick={() => window.print()}
            disabled={!groups.length || loading}
          >
            🖨 Print Route Sheet
          </button>
        </div>
      </div>

      {error && <p className="error no-print">{error}</p>}
      
      {!agentId && !isAgent ? (
        <p className="aj-empty no-print">Please select an agent to view their route sheet.</p>
      ) : loading ? (
        <p className="no-print" style={{ padding: '40px', textAlign: 'center' }}>Loading route sheet...</p>
      ) : groups.length === 0 ? (
        <p className="aj-empty no-print">No assigned jobs found for this date.</p>
      ) : (
        <div className="rs-paper">
          <table className="rs-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>DBA Name and Address</th>
                <th style={{ width: '8%' }}>Terminal<br/>Status</th>
                <th style={{ width: '10%' }}>Bills<br/>Remainin</th>
                <th style={{ width: '11%' }}>Existing<br/>Cash</th>
                <th style={{ width: '10%' }}>To Be<br/>Load</th>
                <th style={{ width: '14%' }}>Cash<br/>Loaded</th>
                <th style={{ width: '12%' }}>Load<br/>Time</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, gIdx) => (
                <React.Fragment key={group.area}>
                  <tr className="rs-area-row">
                    <td colSpan="7" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', background: '#f4f4f4' }}>
                      {group.area.toUpperCase()}
                    </td>
                  </tr>
                  {group.jobs.map((job, jIdx) => {
                    const term = job.terminal || {};
                    const bizName = term.current?.businessName || term.official?.name || job.businessName;
                    const address = term.current?.address || job.address;
                    const city = term.current?.city || term.official?.city || job.city;
                    const status = term.official?.status === 'Inactive' ? 'Down' : 'Up';
                    const remain = Math.floor((term.official?.cashBalance || 0) / 20);
                    const load = Math.floor((job.cashToLoad || 0) / 20);
                    
                    return (
                      <tr key={job._id}>
                        <td className="rs-dba-cell">
                          <strong>{job.terminalId} : {bizName}</strong>
                          <br/>
                          <span style={{ fontSize: '11px', color: '#444' }}>{address} · {city}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{status}</td>
                        <td style={{ textAlign: 'center' }}>{remain}</td>
                        <td className="rs-blank-cell p-0">
                          <input 
                            className="rs-input" 
                            type="number" 
                            value={job.routeExistingCash ?? ''}
                            onChange={e => handleInputChange(gIdx, jIdx, 'routeExistingCash', e.target.value)}
                            onBlur={e => handleUpdateJob(job._id, 'routeExistingCash', e.target.value)}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>{load}</td>
                        <td className="rs-blank-cell p-0">
                          <input 
                            className="rs-input" 
                            type="number" 
                            value={job.routeCashLoaded ?? ''}
                            onChange={e => handleInputChange(gIdx, jIdx, 'routeCashLoaded', e.target.value)}
                            onBlur={e => handleUpdateJob(job._id, 'routeCashLoaded', e.target.value)}
                          />
                        </td>
                        <td className="rs-blank-cell p-0">
                          <input 
                            className="rs-input" 
                            type="text" 
                            placeholder="HH:MM"
                            value={job.routeLoadTime ?? ''}
                            onChange={e => handleInputChange(gIdx, jIdx, 'routeLoadTime', e.target.value)}
                            onBlur={e => handleUpdateJob(job._id, 'routeLoadTime', e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              
              <tr className="rs-total-row">
                <td colSpan="2" style={{ textAlign: 'right', fontWeight: 'bold' }}></td>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalRemaining}</td>
                <td className="rs-blank-cell"></td>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalToLoad}</td>
                <td className="rs-blank-cell"></td>
                <td className="rs-blank-cell"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
