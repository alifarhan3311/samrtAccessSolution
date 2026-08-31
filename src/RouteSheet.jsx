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

const fmtDate = d => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

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
  const [tickets, setTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('pending'); // 'pending' or 'all'
  const [loading, setLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAgent) {
      json('/users/agents').then(setAgents).catch(() => {});
    }
  }, [isAgent]);

  const loadData = () => {
    const targetAgent = isAgent ? (user.sub || user.id || user._id) : agentId;
    if (!targetAgent) {
      setGroups([]);
      setTickets([]);
      return;
    }

    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    if (!isAgent) qs.set('agentId', targetAgent);
    if (date) qs.set('date', date);

    json(`/route-sheet?${qs.toString()}`)
      .then(data => setGroups(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

    // Load assigned tickets for this agent
    setTicketsLoading(true);
    json(`/tickets?assignedTo=${targetAgent}&limit=100`)
      .then(res => setTickets(res.items || []))
      .catch(() => setTickets([]))
      .finally(() => setTicketsLoading(false));
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
    }
  };

  const handleInputChange = (groupIndex, jobIndex, field, value) => {
    const newGroups = [...groups];
    newGroups[groupIndex].jobs[jobIndex][field] = value;
    setGroups(newGroups);
  };

  const handleTicketStatusChange = async (ticketId, newStatus) => {
    try {
      await json(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setTickets(prev => prev.map(t => t._id === ticketId ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert(err.message);
    }
  };

  let totalRemaining = 0;
  let totalToLoad = 0;
  groups.forEach(g => {
    g.jobs.forEach(j => {
      totalRemaining += Math.floor((j.terminal?.official?.cashBalance || 0) / 20);
      totalToLoad += Math.floor((j.cashToLoad || 0) / 20);
    });
  });

  const displayedTickets = ticketFilter === 'pending'
    ? tickets.filter(t => ['Open', 'In Progress'].includes(t.status))
    : tickets;

  const currentAgentObj = agents.find(a => String(a._id) === String(agentId)) || (isAgent ? user : null);
  const agentDisplayName = currentAgentObj?.name || (isAgent ? user?.name : 'Selected Agent');

  const hasRouteJobs = groups.length > 0;
  const hasTickets = displayedTickets.length > 0;
  const hasAnyData = hasRouteJobs || hasTickets;

  return (
    <div className="route-sheet-page">
      <div className="rs-header no-print">
        <div>
          <p className="eyebrow">PRINTABLE REPORTS</p>
          <h3>Daily Route & Assigned Tickets</h3>
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
            disabled={!hasAnyData || loading}
          >
            🖨 Print Route Sheet
          </button>
        </div>
      </div>

      {error && <p className="error no-print">{error}</p>}
      
      {!agentId && !isAgent ? (
        <p className="aj-empty no-print">Please select an agent to view their route sheet and assigned maintenance tickets.</p>
      ) : loading && ticketsLoading ? (
        <p className="no-print" style={{ padding: '40px', textAlign: 'center' }}>Loading route sheet & tickets...</p>
      ) : !hasAnyData ? (
        <div className="rs-paper">
          <p className="aj-empty" style={{ margin: 0 }}>No cash loading routes or assigned maintenance tickets found for {agentDisplayName} on {date}.</p>
        </div>
      ) : (
        <div className="rs-paper">
          {/* Printable Header */}
          <div className="rs-print-header" style={{ marginBottom: '14px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>SMART ACCESS &middot; DAILY AGENT ROUTE SHEET</h2>
                <span style={{ fontSize: '12px', color: '#444' }}>Agent: <strong>{agentDisplayName}</strong></span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>Date: {date}</span>
              </div>
            </div>
          </div>

          {/* 1. Daily Cash Loading Table */}
          {hasRouteJobs ? (
            <div className="rs-section" style={{ marginBottom: '24px' }}>
              <div className="rs-section-title" style={{ fontWeight: 800, fontSize: '14px', marginBottom: '8px', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💰 ATM Cash Replenishment Route</span>
              </div>
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
          ) : (
            <div className="rs-no-routes-banner no-print" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#64748b', fontSize: '13px' }}>
              ℹ No cash replenishment route scheduled for this date. Check assigned maintenance tickets below.
            </div>
          )}

          {/* 2. Assigned Maintenance & Problem Tickets Section */}
          <div className="rs-tickets-section" style={{ marginTop: hasRouteJobs ? '28px' : '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>
                  🎫 Assigned Maintenance & Problem Tickets
                </span>
                <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                  {displayedTickets.length} {ticketFilter === 'pending' ? 'Pending' : 'Total'}
                </span>
              </div>
              
              <div className="no-print" style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={() => setTicketFilter('pending')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid ' + (ticketFilter === 'pending' ? '#357064' : '#d1d5db'),
                    background: ticketFilter === 'pending' ? '#357064' : '#fff',
                    color: ticketFilter === 'pending' ? '#fff' : '#4b5563',
                    cursor: 'pointer'
                  }}
                >
                  Pending Only
                </button>
                <button 
                  onClick={() => setTicketFilter('all')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid ' + (ticketFilter === 'all' ? '#357064' : '#d1d5db'),
                    background: ticketFilter === 'all' ? '#357064' : '#fff',
                    color: ticketFilter === 'all' ? '#fff' : '#4b5563',
                    cursor: 'pointer'
                  }}
                >
                  All Tickets
                </button>
              </div>
            </div>

            {displayedTickets.length === 0 ? (
              <p className="aj-empty" style={{ margin: 0, padding: '20px', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                No {ticketFilter === 'pending' ? 'pending' : ''} tickets currently assigned to {agentDisplayName}.
              </p>
            ) : (
              <table className="rs-table rs-tickets-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>ATM Terminal / Location</th>
                    <th style={{ width: '40%' }}>Problem Description & Resolution</th>
                    <th style={{ width: '16%' }}>Status</th>
                    <th style={{ width: '22%' }}>Reported Date & Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTickets.map(t => {
                    const term = t.terminal || {};
                    const biz = term.current?.businessName || term.official?.name || '—';
                    const addr = term.current?.address || term.official?.address || '';
                    const city = term.current?.city || term.official?.city || '';

                    return (
                      <tr key={t._id}>
                        <td className="rs-dba-cell">
                          <strong>{t.terminalId}</strong>
                          {biz !== '—' && <><br/><span style={{ fontWeight: 600, color: '#111827' }}>{biz}</span></>}
                          {(addr || city) && (
                            <>
                              <br/>
                              <span style={{ fontSize: '11px', color: '#555' }}>
                                {addr}{addr && city ? ', ' : ''}{city}
                              </span>
                            </>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: t.resolutionNote ? '4px' : '0' }}>
                            {t.problem}
                          </div>
                          {t.resolutionNote && (
                            <div style={{ fontSize: '11px', color: '#15803d', background: '#f0fdf4', padding: '3px 6px', borderRadius: '4px', border: '1px solid #bbf7d0', marginTop: '4px' }}>
                              <strong>Note:</strong> {t.resolutionNote}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <select
                            className="rs-ticket-status-select no-print"
                            value={t.status}
                            onChange={e => handleTicketStatusChange(t._id, e.target.value)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: '1px solid #cbd5e1',
                              background: t.status === 'Open' ? '#fef3c7' : t.status === 'In Progress' ? '#dbeafe' : t.status === 'Resolved' ? '#d1fae5' : '#f3f4f6',
                              color: t.status === 'Open' ? '#92400e' : t.status === 'In Progress' ? '#1e40af' : t.status === 'Resolved' ? '#065f46' : '#374151'
                            }}
                          >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                          </select>
                          <span 
                            className="print-only" 
                            style={{ 
                              display: 'none', 
                              fontWeight: 700, 
                              fontSize: '12px',
                              textTransform: 'uppercase'
                            }}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', color: '#475569' }}>
                          <div><strong>Date:</strong> {fmtDate(t.createdAt)}</div>
                          {t.generatedBy && <div><strong>By:</strong> {t.generatedBy.name}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

