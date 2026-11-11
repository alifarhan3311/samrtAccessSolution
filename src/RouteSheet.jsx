import React, { useState, useEffect, useRef } from 'react';
import './route-sheet.css';
import RouteDispatchTable from './RouteDispatchTable.jsx';

const auth = () => ({  });

async function json(path, options = {}) {
  const r = await fetch('/api' + path, { credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...auth(), ...options.headers }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}

import { getTorontoDateString } from './timezone';

const fmtDate = d => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function RouteSheet() {
  const [agents, setAgents] = useState([]);

  // Use the current profile saved at login. The JWT payload is intentionally
  // minimal and does not always contain the same fields as the profile.
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const isAgent = user?.role === 'agent';
  const ownId = String(user?.id || user?._id || '');
  const canSelectAgent = !isAgent || user?.canViewAllDailyRoutes === true || user?.canEditAllDailyRoutes === true;

  const [agentId, setAgentId] = useState(isAgent ? (user?.id || user?._id) : '');
  const [date, setDate] = useState(() => getTorontoDateString());
  const viewingOtherAgent = isAgent && canSelectAgent && agentId && String(agentId) !== ownId;
  const canEditRouteField = field => !isAgent || user?.canEditAllDailyRoutes === true
    || (!viewingOtherAgent && ['routeExistingCash', 'routeCashLoaded'].includes(field));

  useEffect(() => {
    let cancelled = false;
    const refresh = () => json('/me').then(profile => {
      if (cancelled) return;
      const fresh = {...profile,id:profile._id || profile.id};
      localStorage.setItem('user',JSON.stringify(fresh));
      setUser(fresh);
      if (fresh.role === 'agent' && !fresh.canViewAllDailyRoutes && !fresh.canEditAllDailyRoutes) {
        setAgentId(fresh.id);
      }
    }).catch(() => {});
    refresh(); window.addEventListener('focus', refresh);
    return () => { cancelled = true; window.removeEventListener('focus', refresh); };
  }, []);

  const [groups, setGroups] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('pending'); // 'pending' or 'all'

  // Returns state
  const [returns, setReturns] = useState([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [rForm, setRForm] = useState({ amount: '', note: '', terminalId: '' });
  const [rMsg, setRMsg] = useState({ text: '', ok: false });
  const [rSaving, setRSaving] = useState(false);

  const [loading, setLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [error, setError] = useState('');

  const [reassigningId, setReassigningId] = useState(null);
  const [newAgentId, setNewAgentId] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const loadSequence = useRef(0);

  useEffect(() => {
    if (canSelectAgent) {
      json('/route-sheet/agents').then(setAgents).catch(() => setAgents([]));
    }
  }, [canSelectAgent]);

  const loadData = () => {
    const sequence = ++loadSequence.current;
    const targetAgent = canSelectAgent ? agentId : ownId;
    if (!targetAgent) {
      setGroups([]);
      setTickets([]);
      setReturns([]);
      return;
    }

    setLoading(true);
    setGroups([]); setTickets([]); setReturns([]);
    setError('');
    const qs = new URLSearchParams();
    qs.set('agentId', targetAgent);
    if (date) qs.set('date', date);

    json(`/route-sheet?${qs.toString()}`)
      .then(data => { if(sequence === loadSequence.current) setGroups(data); })
      .catch(err => { if(sequence === loadSequence.current) setError(err.message); })
      .finally(() => { if(sequence === loadSequence.current) setLoading(false); });

    // Load assigned tickets for this agent
    setTicketsLoading(true);
    if (!viewingOtherAgent) json(`/tickets?assignedTo=${targetAgent}&limit=100`)
      .then(res => { if(sequence === loadSequence.current) setTickets(res.items || []); })
      .catch(() => { if(sequence === loadSequence.current) setTickets([]); })
      .finally(() => { if(sequence === loadSequence.current) setTicketsLoading(false); });
    else {setTickets([]);setTicketsLoading(false);}

    // Load cash returns for this agent on this date
    {
      setReturnsLoading(true);
      json(`/cash/returns?agentId=${targetAgent}&from=${date}&to=${date}`)
        .then(async res => {
          const extraPages = await Promise.all(Array.from({ length: Math.max(0, (res.pages || 1) - 1) }, (_, index) =>
            json(`/cash/returns?agentId=${targetAgent}&from=${date}&to=${date}&page=${index + 2}`)));
          if(sequence === loadSequence.current) setReturns([...(res.items || []), ...extraPages.flatMap(page => page.items || [])]);
        })
        .catch(() => { if(sequence === loadSequence.current) setReturns([]); })
        .finally(() => { if(sequence === loadSequence.current) setReturnsLoading(false); });
    }
  };

  useEffect(() => {
    loadData();
    return () => { loadSequence.current++; };
  }, [agentId, date, canSelectAgent]);

  const handleUpdateJob = async (jobId, field, value) => {
    if (!canEditRouteField(field)) return;
    try {
      await json(`/route-sheet/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value === '' ? null : value })
      });
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
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

  const addReturn = async (e) => {
    e.preventDefault();
    const amount = Number(rForm.amount);
    const targetAgent = isAgent ? (user?.id || user?._id) : agentId;
    if (!targetAgent) { setRMsg({ text: 'Select an agent first.', ok: false }); return; }
    if (!amount || amount < 0) { setRMsg({ text: 'Enter a valid amount.', ok: false }); return; }
    setRSaving(true); setRMsg({ text: '', ok: false });
    try {
      await json('/cash/return', {
        method: 'POST',
        body: JSON.stringify({ agentId: targetAgent, amount, note: rForm.note || undefined, terminalId: rForm.terminalId || undefined, date })
      });
      setRMsg({ text: `Recorded: ${amount} returned bills saved.`, ok: true });
      setRForm({ amount: '', note: '', terminalId: '' });
      loadData();
    } catch (err) {
      setRMsg({ text: err.message, ok: false });
    } finally {
      setRSaving(false);
    }
  };

  const delReturn = (id) => {
    setConfirmModal({
      open: true,
      title: 'Delete Record?',
      message: 'This cannot be undone.',
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, open: false });
        try {
          await json(`/cash/returns/${id}`, { method: 'DELETE' });
          loadData();
        } catch (e) { alert(e.message); }
      }
    });
  };

  const cancelJob = (id) => {
    setConfirmModal({
      open: true,
      title: 'Cancel Job?',
      message: 'The ATM will be removed from this route and become available for dispatch again.',
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, open: false });
        try {
          await json(`/route-sheet/${id}`, { method: 'DELETE' });
          loadData();
        } catch (e) { alert(e.message); }
      }
    });
  };

  const saveReassign = async (id) => {
    if (!newAgentId) return alert('Please select a new agent');
    try {
      await json(`/route-sheet/${id}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ agentId: newAgentId })
      });
      setReassigningId(null);
      setNewAgentId('');
      loadData();
    } catch (e) { alert(e.message); }
  };

  const displayedTickets = ticketFilter === 'pending'
    ? tickets.filter(t => ['Open', 'In Progress'].includes(t.status))
    : tickets;

  const currentAgentObj = agents.find(a => String(a._id) === String(agentId)) || (isAgent ? user : null);
  const agentDisplayName = currentAgentObj?.name || (isAgent ? user?.name : 'Selected Agent');

  const hasRouteJobs = groups.length > 0;
  const hasTickets = displayedTickets.length > 0;
  const hasAnyData = hasRouteJobs || hasTickets;

  const renderRouteActions = job => reassigningId === job._id ? <div className="dispatch-action-buttons">
    <select aria-label={`Reassign ${job.terminalId}`} value={newAgentId} onChange={e => setNewAgentId(e.target.value)}>
      <option value="">Select Agent...</option>
      {agents.map(agent => <option key={agent._id} value={agent._id}>{agent.name}</option>)}
    </select>
    <button type="button" disabled={!newAgentId} onClick={() => saveReassign(job._id)}>Save</button>
    <button type="button" onClick={() => {setReassigningId(null);setNewAgentId('');}}>Cancel</button>
  </div> : <div className="dispatch-action-buttons">
    <button type="button" aria-label={`Reassign ${job.terminalId || job.businessName}`} onClick={() => setReassigningId(job._id)}>Reassign</button>
    <button type="button" className="dispatch-remove" aria-label={`Remove ${job.terminalId || job.businessName} from route`} onClick={() => cancelJob(job._id)}>Remove from route</button>
  </div>;

  return (
    <div className="route-sheet-page">
      <div className="rs-header no-print">
        <div>
          <p className="eyebrow">PRINTABLE REPORTS</p>
          <h3>Daily Route & Assigned Tickets</h3>
        </div>

        <div className="rs-filters">
          {canSelectAgent && (
            <label>Agent
              <select value={agentId} onChange={e => setAgentId(e.target.value)}>
                <option value="">Select Agent...</option>
                {agents.map(a => <option key={a._id} value={a._id}>{a.name}{a.active === false ? ' (inactive)' : ''}</option>)}
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

      {!agentId && canSelectAgent ? (
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
          <div className="rs-print-header no-print" style={{ marginBottom: '14px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
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
              <div className="rs-section-title no-print" style={{ fontWeight: 800, fontSize: '14px', marginBottom: '8px', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💰 ATM Cash Replenishment Route</span>
              </div>
              <RouteDispatchTable groups={groups} date={date} agentName={agentDisplayName}
                canEdit={canEditRouteField} onChange={handleInputChange} onSave={handleUpdateJob} returns={returns}
                renderActions={!isAgent ? renderRouteActions : undefined} />
            </div>
          ) : (
            <div className="rs-no-routes-banner no-print" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#64748b', fontSize: '13px' }}>
              ℹ No cash replenishment route scheduled for this date. Check assigned maintenance tickets below.
            </div>
          )}

          {/* 2. Assigned Maintenance & Problem Tickets Section */}
          {!viewingOtherAgent && <div className={`rs-tickets-section${hasRouteJobs ? ' no-print' : ''}`} style={{ marginTop: hasRouteJobs ? '28px' : '0' }}>
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
                          {biz !== '—' && <><br /><span style={{ fontWeight: 600, color: '#111827' }}>{biz}</span></>}
                          {(addr || city) && (
                            <>
                              <br />
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
          </div>}

          {/* 3. Cash Returns Section */}
          {!viewingOtherAgent && (
            <div className="ledger-split no-print" style={{ marginTop: '40px', gap: '20px' }}>
              <div className="ledger-card">
                <p className="eyebrow">RECORD CASH RETURN</p>
                <h3>{isAgent ? 'Submit returned bills' : 'Log unspent cash from agent'}</h3>
                <form onSubmit={addReturn} className="ledger-form" style={{ marginTop: '16px' }}>
                  <label>
                    Bills returned
                    <input type="number" min="0" step="1" required value={rForm.amount} onChange={e => setRForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 25" />
                  </label>
                  <label>
                    Terminal ID (Optional)
                    <input type="text" value={rForm.terminalId} onChange={e => setRForm(p => ({ ...p, terminalId: e.target.value }))} placeholder="e.g. CA101234" />
                  </label>
                  <label>
                    Note (Optional)
                    <input type="text" value={rForm.note} onChange={e => setRForm(p => ({ ...p, note: e.target.value }))} placeholder="Why returned?" />
                  </label>
                  {rMsg.text && <p className={rMsg.ok ? 'success' : 'error'} style={{ margin: 0 }}>{rMsg.text}</p>}
                  <button disabled={rSaving || loading} style={{ marginTop: '8px' }}>{rSaving ? 'Saving...' : (isAgent ? 'Submit returned bills \u2192' : 'Record return \u2192')}</button>
                </form>
                <div className="ledger-summary" style={{ marginTop: '20px' }}>
                  <b>Period total returned: ${(returns.reduce((sum, r) => sum + r.amount, 0)).toLocaleString()}</b>
                  <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{returns.length} records</span>
                </div>
              </div>

              <div className="ledger-card">
                <p className="eyebrow">RETURN HISTORY</p>
                <h3>{agentDisplayName}'s Returns on {date}</h3>
                {returnsLoading ? <p>Loading returns...</p> : returns.length === 0 ? (
                  <p className="muted" style={{ padding: '20px 0' }}>No returns recorded for {agentDisplayName} on {date}.</p>
                ) : (
                  <div className="table-wrap" style={{ border: 'none', borderRadius: 0, overflow: 'visible', marginTop: '16px' }}>
                    <table className="rs-table">
                      <thead>
                        <tr>
                          <th style={{ width: '15%' }}>Time</th>
                          <th style={{ width: '15%' }}>Terminal</th>
                          <th style={{ width: '20%' }}>Amount</th>
                          <th style={{ width: '30%' }}>Note</th>
                          <th style={{ width: '15%' }}>By</th>
                          <th style={{ width: '5%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {returns.map(r => (
                          <tr key={r._id}>
                            <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td><b>{r.terminalId || '—'}</b></td>
                            <td><b style={{ color: '#267249' }}>{(r.amount || 0).toLocaleString()} bills</b></td>
                            <td style={{ fontSize: '12px', color: '#555' }}>{r.note || '—'}</td>
                            <td style={{ fontSize: '12px' }}>{r.recordedBy?.name}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{fontSize:11,color:r.status==='approved'?'#267249':r.status==='rejected'?'#b42318':'#9a6700'}}>{r.status || 'pending'}</span>
                              {!isAgent && <button className="del-btn" title="Delete" onClick={() => delReturn(r._id)}>&#10005;</button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {confirmModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#173e36' }}>{confirmModal.title}</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#4b5563', lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, open: false })} 
                style={{ padding: '8px 16px', background: '#f1f5f3', color: '#4b5563', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmModal.onConfirm} 
                style={{ padding: '8px 16px', background: '#a63e36', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


