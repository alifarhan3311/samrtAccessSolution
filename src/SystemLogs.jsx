import React, { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import './system-logs.css';

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

async function request(path, options = {}) {
  const r = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...auth(), ...options.headers }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}

const money = v => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v || 0);

const ACTION_CONFIG = {
  DAILY_AGENT_DISPATCHED: { label: 'Single Agent Dispatch', color: '#2563eb', bg: '#eff6ff', icon: '↗' },
  AREA_ROUTE_DISPATCHED:  { label: 'Area Route Dispatched', color: '#4f46e5', bg: '#eef2ff', icon: '⌘' },
  TERMINAL_ASSIGNED:     { label: 'ATM Location Assigned', color: '#0284c7', bg: '#f0f9ff', icon: '⌖' },
  AGENT_JOB_UPDATED:     { label: 'Task Status Updated', color: '#d97706', bg: '#fffbeb', icon: '🔄' },
  AGENT_JOB_APPROVED:    { label: 'Task Approved & Completed', color: '#16a34a', bg: '#f0fdf4', icon: '✅' },
  TERMINAL_STATUS_CHANGED:{ label: 'ATM Status Changed', color: '#9333ea', bg: '#faf5ff', icon: '▦' },
  AGENT_CREATED:         { label: 'New Agent Account', color: '#059669', bg: '#ecfdf5', icon: '☺' },
  AGENT_UPDATED:         { label: 'Agent Profile Updated', color: '#0891b2', bg: '#ecfeff', icon: '✏' },
  AGENT_DEACTIVATED:     { label: 'Agent Deactivated', color: '#dc2626', bg: '#fef2f2', icon: '🚫' },
  AGENT_REACTIVATED:     { label: 'Agent Reactivated', color: '#16a34a', bg: '#f0fdf4', icon: '⚡' },
  AGENT_PASSWORD_RESET:  { label: 'Agent Password Reset', color: '#ea580c', bg: '#fff7ed', icon: '🔑' },
  CASH_WITHDRAWN:        { label: 'Bank Cash Withdrawal', color: '#15803d', bg: '#f0fdf4', icon: '💵' },
  CASH_RETURNED:         { label: 'Unspent Cash Returned', color: '#047857', bg: '#ecfdf5', icon: '↩' },
  DISCREPANCY_RESOLVED:  { label: 'Discrepancy Resolved', color: '#b91c1c', bg: '#fef2f2', icon: '⚠' },
  OFFICIAL_IMPORT:       { label: 'Excel Data Import', color: '#4338ca', bg: '#eef2ff', icon: '⇅' }
};

const TASK_STATUS_PILL = {
  approved:       { label: 'Completed', color: '#15803d', bg: '#dcfce7', icon: '✅' },
  cash_loaded:    { label: 'Cash Loaded (Pending)', color: '#b45309', bg: '#fef3c7', icon: '📸' },
  travelling:     { label: 'Travelling', color: '#0369a1', bg: '#e0f2fe', icon: '🚗' },
  accepted:       { label: 'Accepted', color: '#4338ca', bg: '#e0e7ff', icon: '👍' },
  assigned:       { label: 'Assigned', color: '#475569', bg: '#f1f5f9', icon: '📥' },
  issue_reported: { label: 'Issue Reported', color: '#b91c1c', bg: '#fee2e2', icon: '⚠️' },
  cancelled:      { label: 'Cancelled', color: '#64748b', bg: '#f8fafc', icon: '🚫' }
};

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  let relative = '';
  if (diffMins < 1) relative = 'Just now';
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours < 24) relative = `${diffHours}h ago`;
  else relative = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return {
    full: d.toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    relative
  };
}

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [agentId, setAgentId] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [agentsList, setAgentsList] = useState([]);

  // Selected Log Drawer
  const [selectedLog, setSelectedLog] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Load Agents dropdown list
  useEffect(() => {
    request('/users/agents?all=1')
      .then(setAgentsList)
      .catch(() => {});
  }, []);

  // Compute date range from preset
  const getDateRange = () => {
    if (datePreset === 'today') {
      const t = new Date().toISOString().slice(0, 10);
      return { from: t, to: t };
    }
    if (datePreset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = d.toISOString().slice(0, 10);
      return { from: y, to: y };
    }
    if (datePreset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { from: d.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
    }
    if (datePreset === 'month') {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      return { from: first, to: new Date().toISOString().slice(0, 10) };
    }
    if (datePreset === 'custom') {
      return { from: fromDate, to: toDate };
    }
    return { from: '', to: '' };
  };

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    const dr = getDateRange();
    const query = new URLSearchParams({
      page: String(page),
      limit: '30',
      search,
      category,
      status,
      agentId,
      terminalId,
      from: dr.from,
      to: dr.to
    }).toString();

    try {
      const data = await request(`/logs?${query}`);
      setLogs(data.items || []);
      setStats(data.stats || {});
      setTotalPages(data.pages || 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadLogs, 300);
    return () => clearTimeout(timer);
  }, [search, category, status, agentId, terminalId, datePreset, fromDate, toDate, page]);

  // Export CSV function
  const exportCSV = () => {
    if (!logs.length) return;
    const headers = [
      'Timestamp', 'Action', 'Category', 'Actor', 'Agent Name', 'Agent Email',
      'Terminal ID', 'Business Name', 'City', 'Task Status', 'Is Completed',
      'Cash To Load', 'Cash Loaded', 'Notes'
    ];
    const rows = logs.map(l => [
      l.timestamp ? new Date(l.timestamp).toLocaleString('en-CA') : '',
      l.action || '',
      l.category || '',
      l.actor?.name || '',
      l.agent?.name || '',
      l.agent?.email || '',
      l.terminalId || '',
      l.businessName || '',
      l.city || '',
      l.status || '',
      l.isCompleted ? 'YES' : 'NO',
      l.cashToLoad || 0,
      l.cashLoaded || 0,
      (l.note || '').replace(/"/g, '""')
    ].map(v => `"${v}"`));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="system-logs-container">
      {/* ── Top Overview Stats ───────────────────────────────────────────── */}
      <div className="logs-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>📋</div>
          <div>
            <p className="stat-title">Total Activity Logs</p>
            <h3 className="stat-value">{stats.totalLogs || 0}</h3>
            <span className="stat-sub">Filtered recorded events</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>✅</div>
          <div>
            <p className="stat-title">Completed Tasks</p>
            <h3 className="stat-value" style={{ color: '#15803d' }}>{stats.completedTasksCount || 0}</h3>
            <span className="stat-sub">Approved ATM loadings</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#b45309' }}>⏳</div>
          <div>
            <p className="stat-title">Active & In-Progress</p>
            <h3 className="stat-value" style={{ color: '#b45309' }}>{stats.pendingTasksCount || 0}</h3>
            <span className="stat-sub">Assigned / Travelling / Loaded</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>⚠️</div>
          <div>
            <p className="stat-title">Issue Alerts</p>
            <h3 className="stat-value" style={{ color: '#b91c1c' }}>{stats.issueTasksCount || 0}</h3>
            <span className="stat-sub">Reported agent issues</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>💰</div>
          <div>
            <p className="stat-title">Cash Dispatched</p>
            <h3 className="stat-value">{money(stats.totalCashDispatched)}</h3>
            <span className="stat-sub">Total allocated to agents</span>
          </div>
        </div>
      </div>

      {/* ── Category Filter Tabs ───────────────────────────────────────────── */}
      <div className="category-tabs">
        {[
          ['all', 'All Activity Logs', '📋'],
          ['dispatch', 'Agent Dispatches', '↗'],
          ['tasks', 'Task Status & Completion', '✅'],
          ['terminals', 'ATM Updates', '▦'],
          ['agents', 'Agent Accounts', '☺'],
          ['ledger', 'Cash Ledger', '💲'],
          ['imports', 'Excel Imports', '⇅']
        ].map(([catKey, label, icon]) => (
          <button
            key={catKey}
            className={`cat-tab ${category === catKey ? 'active' : ''}`}
            onClick={() => { setCategory(catKey); setPage(1); }}
          >
            <i>{icon}</i> {label}
          </button>
        ))}
      </div>

      {/* ── Toolbar & Filters ──────────────────────────────────────────────── */}
      <div className="logs-toolbar">
        <div className="search-wrap">
          <input
            type="text"
            placeholder="Search terminal ID, agent, business name, city, note or action..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && <button className="clear-search" onClick={() => setSearch('')}>×</button>}
        </div>

        <div className="filters-group">
          {/* Status Filter */}
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">All Task Statuses</option>
            <option value="completed">✅ Completed (Approved)</option>
            <option value="cash_loaded">📸 Cash Loaded (Awaiting Approval)</option>
            <option value="in_progress">⏳ In Progress (Travelling/Accepted)</option>
            <option value="assigned">📥 Assigned</option>
            <option value="issue_reported">⚠️ Issue Reported</option>
            <option value="cancelled">🚫 Cancelled</option>
          </select>

          {/* Agent Filter */}
          <select value={agentId} onChange={e => { setAgentId(e.target.value); setPage(1); }}>
            <option value="">All Agents</option>
            {agentsList.map(a => (
              <option key={a._id || a.id} value={a._id || a.id}>
                {a.name} ({a.email})
              </option>
            ))}
          </select>

          {/* Date Presets */}
          <select value={datePreset} onChange={e => { setDatePreset(e.target.value); setPage(1); }}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Date Range...</option>
          </select>

          {/* Custom Date Inputs */}
          {datePreset === 'custom' && (
            <div className="custom-date-inputs">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <span>to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
          )}

          {/* Action Buttons */}
          <button className="btn-secondary" onClick={loadLogs} title="Refresh Logs">
            ↻ Refresh
          </button>
          <button className="btn-primary" onClick={exportCSV} disabled={!logs.length}>
            ⇩ Export CSV
          </button>
        </div>
      </div>

      {error && <div className="logs-error">⚠️ {error}</div>}

      {/* ── Main Logs Table ───────────────────────────────────────────────── */}
      <div className="logs-table-card">
        {loading ? (
          <LoadingSpinner text="Fetching real-time activity & audit logs..." />
        ) : !logs.length ? (
          <div className="logs-empty">
            <span style={{ fontSize: 36 }}>📭</span>
            <h4>No activity logs match your filter parameters</h4>
            <p>Try adjusting your search query, task status, category or date range.</p>
            <button className="btn-secondary" onClick={() => { setSearch(''); setCategory('all'); setStatus('all'); setAgentId(''); setDatePreset('all'); }}>
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action / Event</th>
                  <th>Assigned Agent</th>
                  <th>ATM Terminal / Target</th>
                  <th>Task Completion</th>
                  <th>Cash Metrics</th>
                  <th>Details & Proofs</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const cfg = ACTION_CONFIG[log.action] || { label: log.action, color: '#475569', bg: '#f1f5f9', icon: '🔹' };
                  const ts = formatTimestamp(log.timestamp);
                  const stPill = TASK_STATUS_PILL[log.status];

                  return (
                    <tr key={log._id} className={selectedLog?._id === log._id ? 'row-selected' : ''}>
                      {/* Timestamp */}
                      <td className="col-time">
                        <span className="time-full">{ts.full}</span>
                        <span className="time-rel">{ts.relative}</span>
                      </td>

                      {/* Action Badge */}
                      <td>
                        <span className="action-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + '40' }}>
                          <i>{cfg.icon}</i> {cfg.label}
                        </span>
                        {log.actor && (
                          <div className="actor-info">
                            by <b>{log.actor.name}</b> <small>({log.actor.role})</small>
                          </div>
                        )}
                      </td>

                      {/* Agent */}
                      <td>
                        {log.agent ? (
                          <div className="agent-cell">
                            <div className="avatar">
                              {log.agent.profilePicture ? (
                                <img src={log.agent.profilePicture} alt="" />
                              ) : (
                                <span>{log.agent.name?.[0]}</span>
                              )}
                            </div>
                            <div>
                              <b>{log.agent.name}</b>
                              <small>{log.agent.email}</small>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* ATM Terminal */}
                      <td>
                        {log.terminalId ? (
                          <div className="terminal-cell">
                            <span className="term-id">{log.terminalId}</span>
                            {log.businessName && <b>{log.businessName}</b>}
                            {log.city && <small>📍 {log.city}</small>}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Task Completion Pill */}
                      <td>
                        {stPill ? (
                          <span className="status-pill" style={{ color: stPill.color, background: stPill.bg }}>
                            <i>{stPill.icon}</i> {stPill.label}
                          </span>
                        ) : log.isCompleted ? (
                          <span className="status-pill" style={{ color: '#15803d', background: '#dcfce7' }}>
                            ✅ Approved
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Cash Metrics */}
                      <td>
                        {log.cashToLoad > 0 || log.cashLoaded > 0 || log.amount > 0 ? (
                          <div className="cash-cell">
                            {log.cashToLoad > 0 && <span>Load Target: <b>{money(log.cashToLoad)}</b></span>}
                            {log.cashLoaded > 0 && <span className="cash-loaded">Loaded: <b style={{ color: '#16a34a' }}>{money(log.cashLoaded)}</b></span>}
                            {log.amount > 0 && <span>Amount: <b>{money(log.amount)}</b></span>}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Details & Proofs */}
                      <td>
                        <div className="details-cell">
                          {log.note && <p className="log-note">"{log.note}"</p>}
                          {log.proofFiles?.length > 0 && (
                            <div className="proof-thumbs">
                              {log.proofFiles.map((pf, idx) => (
                                <button
                                  key={idx}
                                  className="proof-btn"
                                  onClick={e => { e.stopPropagation(); setPreviewImage(pf.url); }}
                                  title={`View Proof ${idx + 1}`}
                                >
                                  📷 Proof #{idx + 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action View */}
                      <td>
                        <button className="btn-view-detail" onClick={() => setSelectedLog(log)}>
                          Details ➔
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              ◀ Previous
            </button>
            <span>Page <b>{page}</b> of <b>{totalPages}</b></span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next ▶
            </button>
          </div>
        )}
      </div>

      {/* ── Log Detail Drawer Modal ──────────────────────────────────────── */}
      {selectedLog && (
        <div className="log-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="log-modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedLog(null)}>×</button>
            
            <div className="modal-header">
              <span className="eyebrow">SYSTEM LOG EVENT RECORD</span>
              <h2>{ACTION_CONFIG[selectedLog.action]?.label || selectedLog.action}</h2>
              <span className="time-tag">⏱ {formatTimestamp(selectedLog.timestamp).full}</span>
            </div>

            <div className="modal-body-grid">
              {/* Event Overview */}
              <div className="detail-section">
                <h4>Event Summary</h4>
                <div className="info-row"><span>Log ID:</span> <code>{selectedLog._id}</code></div>
                <div className="info-row"><span>Category:</span> <b style={{ textTransform: 'uppercase' }}>{selectedLog.category}</b></div>
                <div className="info-row"><span>Triggered By (Actor):</span> <b>{selectedLog.actor?.name || 'System / Admin'}</b> ({selectedLog.actor?.email || 'N/A'})</div>
                {selectedLog.ip && <div className="info-row"><span>IP Address:</span> <code>{selectedLog.ip}</code></div>}
              </div>

              {/* Assigned Agent Details */}
              {selectedLog.agent && (
                <div className="detail-section">
                  <h4>Assigned Agent Details</h4>
                  <div className="agent-detail-box">
                    <div className="avatar-large">
                      {selectedLog.agent.profilePicture ? (
                        <img src={selectedLog.agent.profilePicture} alt="" />
                      ) : (
                        <span>{selectedLog.agent.name?.[0]}</span>
                      )}
                    </div>
                    <div>
                      <h3>{selectedLog.agent.name}</h3>
                      <p>{selectedLog.agent.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Terminal Target */}
              {selectedLog.terminalId && (
                <div className="detail-section">
                  <h4>ATM Terminal Location</h4>
                  <div className="info-row"><span>Terminal ID:</span> <b className="highlight-id">{selectedLog.terminalId}</b></div>
                  <div className="info-row"><span>Business Name:</span> <b>{selectedLog.businessName || '—'}</b></div>
                  <div className="info-row"><span>Address:</span> {selectedLog.address || '—'}</div>
                  <div className="info-row"><span>City:</span> <b>{selectedLog.city || '—'}</b></div>
                </div>
              )}

              {/* Task Completion & Cash Breakdown */}
              <div className="detail-section">
                <h4>Task Status & Cash Metrics</h4>
                <div className="info-row">
                  <span>Task Status:</span> 
                  <b style={{ color: TASK_STATUS_PILL[selectedLog.status]?.color || '#000' }}>
                    {TASK_STATUS_PILL[selectedLog.status]?.label || selectedLog.status || 'N/A'}
                  </b>
                </div>
                {selectedLog.wishAmount > 0 && <div className="info-row"><span>Wish Amount:</span> <b>{money(selectedLog.wishAmount)}</b></div>}
                {selectedLog.cashToLoad > 0 && <div className="info-row"><span>Cash Assigned to Load:</span> <b>{money(selectedLog.cashToLoad)}</b></div>}
                {selectedLog.cashLoaded > 0 && <div className="info-row"><span>Actual Cash Loaded by Agent:</span> <b style={{ color: '#16a34a' }}>{money(selectedLog.cashLoaded)}</b></div>}
                {selectedLog.dueAt && <div className="info-row"><span>Due Deadline:</span> <b>{new Date(selectedLog.dueAt).toLocaleString('en-CA')}</b></div>}
              </div>
            </div>

            {/* Notes & Comments */}
            {selectedLog.note && (
              <div className="detail-section-full">
                <h4>Recorded Event Note / Report</h4>
                <blockquote className="note-quote">{selectedLog.note}</blockquote>
              </div>
            )}

            {/* Proof Files Attachments */}
            {selectedLog.proofFiles?.length > 0 && (
              <div className="detail-section-full">
                <h4>Uploaded Proof Attachments ({selectedLog.proofFiles.length})</h4>
                <div className="proof-grid">
                  {selectedLog.proofFiles.map((pf, i) => (
                    <div key={i} className="proof-card">
                      {pf.mimeType === 'application/pdf' ? (
                        <a href={pf.url} target="_blank" rel="noreferrer" className="pdf-proof">
                          📄 PDF Proof #{i + 1}
                        </a>
                      ) : (
                        <div className="img-wrap" onClick={() => setPreviewImage(pf.url)}>
                          <img src={pf.url} alt={`Proof ${i + 1}`} />
                          <span>Click to expand</span>
                        </div>
                      )}
                      <small>{pf.originalName || `Proof File #${i + 1}`}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw JSON inspection */}
            {selectedLog.metadata && (
              <details className="raw-json">
                <summary>Inspect Raw Log Metadata JSON</summary>
                <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
              </details>
            )}

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Lightbox Modal ────────────────────────────────────────── */}
      {previewImage && (
        <div className="lightbox-overlay" onClick={() => setPreviewImage(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setPreviewImage(null)}>×</button>
            <img src={previewImage} alt="Proof Full Preview" />
            <div className="lightbox-actions">
              <a href={previewImage} target="_blank" rel="noreferrer" download className="btn-primary">
                Download Original File
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
