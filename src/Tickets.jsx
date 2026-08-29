import React, { useEffect, useState } from 'react';
import './tickets.css';

const req = async (p, o = {}) => {
  const r = await fetch('/api' + p, {
    ...o,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}`, ...o.headers }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
};

const fmtDate = d => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Tickets() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  const [tickets, setTickets] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Agents for admin assignment
  const [agents, setAgents] = useState([]);

  // Form
  const [terminalId, setTerminalId] = useState('');
  const [problem, setProblem] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [formMsg, setFormMsg] = useState({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadTickets = async (p = 1) => {
    try {
      const qs = new URLSearchParams({ page: p, limit: 30 });
      if (statusFilter) qs.set('status', statusFilter);
      if (search) qs.set('terminalId', search);
      
      const data = await req(`/tickets?${qs.toString()}`);
      setTickets(data.items || []);
      setPages(data.pages || 1);
      setPage(data.page || 1);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadTickets(1);
    if (isAdmin) {
      req('/users/agents?all=1')
        .then(res => setAgents(Array.isArray(res) ? res : []))
        .catch(() => setAgents([]));
    }
  }, [statusFilter, search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMsg({ text: '', type: '' });
    setIsSubmitting(true);
    try {
      const payload = { terminalId, problem };
      if (isAdmin && assignedTo) payload.assignedTo = assignedTo;

      await req('/tickets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setFormMsg({ text: 'Ticket generated successfully!', type: 'success' });
      setTerminalId('');
      setProblem('');
      setAssignedTo('');
      loadTickets(1);
      setTimeout(() => setFormMsg({ text: '', type: '' }), 3000);
    } catch (e) {
      setFormMsg({ text: e.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const updated = await req(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setTickets(prev => prev.map(t => t._id === ticketId ? { ...t, status: updated.status } : t));
    } catch (e) {
      alert(e.message);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Open': return 'status-open';
      case 'In Progress': return 'status-progress';
      case 'Resolved': return 'status-resolved';
      case 'Closed': return 'status-closed';
      default: return '';
    }
  };

  return (
    <div className="tickets-page">
      <div className="tickets-header">
        <div>
          <h2>Generate & Manage Tickets</h2>
          <p>Report terminal issues and track their resolution status.</p>
        </div>
      </div>

      <div className="tickets-layout">
        {/* Left Side: Form */}
        <div className="ticket-form-card">
          <h3>Create New Ticket</h3>
          <form onSubmit={handleSubmit}>
            <label>
              Terminal ID
              <input 
                type="text" 
                placeholder="e.g. CA101618" 
                required 
                value={terminalId}
                onChange={e => setTerminalId(e.target.value)}
              />
            </label>
            <label>
              Problem Description
              <textarea 
                placeholder="Describe the issue in detail..." 
                required 
                rows={5}
                value={problem}
                onChange={e => setProblem(e.target.value)}
              />
            </label>
            
            {isAdmin && (
              <label>
                Assign To (Optional)
                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                  <option value="">-- Unassigned --</option>
                  {agents.map(a => (
                    <option key={a._id} value={a._id}>{a.name} ({a.email})</option>
                  ))}
                </select>
              </label>
            )}
            
            {formMsg.text && (
              <div className={`ticket-msg ${formMsg.type}`}>
                {formMsg.text}
              </div>
            )}
            
            <button type="submit" disabled={isSubmitting || !terminalId || !problem}>
              {isSubmitting ? 'Submitting...' : 'Generate Ticket'}
            </button>
          </form>
        </div>

        {/* Right Side: List */}
        <div className="ticket-list-card">
          <div className="ticket-filters">
            <input 
              type="text" 
              placeholder="Search by Terminal ID..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <p className="ticket-count">{total} ticket(s) found</p>

          <div className="ticket-table-wrap">
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>Terminal ID</th>
                  <th>Problem Details</th>
                  <th>Status</th>
                  <th>Generated By</th>
                  <th>Date / Time</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">No tickets found.</td>
                  </tr>
                ) : (
                  tickets.map(t => (
                    <tr key={t._id}>
                      <td><strong>{t.terminalId}</strong></td>
                      <td>
                        <div className="ticket-problem" title={t.problem}>
                          {t.problem}
                        </div>
                        {t.resolutionNote && (
                          <div className="ticket-resolution">
                            <strong>Note:</strong> {t.resolutionNote}
                          </div>
                        )}
                        {t.assignedTo && (
                          <div style={{ marginTop: '4px', fontSize: '12px', color: '#357064', fontWeight: 'bold' }}>
                            Assigned To: {t.assignedTo.name}
                          </div>
                        )}
                      </td>
                      <td>
                        <select 
                          className={`ticket-status-select ${getStatusColor(t.status)}`}
                          value={t.status}
                          onChange={e => handleStatusChange(t._id, e.target.value)}
                          disabled={!isAdmin && user._id !== t.generatedBy?._id && user._id !== t.assignedTo?._id}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                      <td>
                        <div className="generated-by">
                          <span className="gen-name">{t.generatedBy?.name || 'Unknown'}</span>
                          <span className="gen-email">{t.generatedBy?.email}</span>
                        </div>
                      </td>
                      <td><span className="ticket-date">{fmtDate(t.createdAt)}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => loadTickets(page - 1)}>Prev</button>
              <span>Page {page} of {pages}</span>
              <button disabled={page >= pages} onClick={() => loadTickets(page + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
