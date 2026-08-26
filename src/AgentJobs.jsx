import React, { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import './agent-jobs.css';

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

const STATUS_LABEL = {
  assigned:       'Assigned',
  accepted:       'Accepted',
  travelling:     'Travelling',
  cash_loaded:    'Cash Loaded',
  issue_reported: 'Issue Reported',
  approved:       'Approved',
  cancelled:      'Cancelled',
};

const STATUS_COLOR = {
  assigned:       '#78958e',
  accepted:       '#4a86d4',
  travelling:     '#d2a437',
  cash_loaded:    '#d2a437',
  issue_reported: '#d76858',
  approved:       '#48a972',
  cancelled:      '#b0b8b4',
};

// ── CSV Helpers ──────────────────────────────────────────────────────────────
function jobsToCSV(jobs) {
  const headers = ['Terminal ID','Business Name','Address','City','Status','Agent',
    'Assigned By','Wish Amount','Cash To Load','Actual Cash Loaded',
    'Due At','Approved At','Created At','Location Area','Last Note'];
  const rows = jobs.map(job => {
    const loadedEvent = [...(job.events || [])].reverse().find(e => e.status === 'cash_loaded');
    // strip auto-generated "Area route: XYZ" prefix, keep only user-written part
    const cleanNote = (note) => {
      if (!note) return '';
      // format is "Area route: Name — user note" or just "Area route: Name"
      const stripped = note.replace(/^Area route:\s*[^—\n]+—?\s*/i, '').trim();
      return stripped;
    };
    // collect all non-empty user notes from every event
    const allNotes = (job.events || [])
      .map(e => cleanNote(e.note))
      .filter(Boolean)
      .join(' | ');
    return [
      job.terminalId, job.businessName, job.address, job.city,
      STATUS_LABEL[job.status] || job.status,
      job.agent?.name || '', job.assignedBy?.name || '',
      job.wishAmount ?? '', job.cashToLoad ?? '',
      loadedEvent?.cashLoaded ?? '',
      job.dueAt      ? new Date(job.dueAt).toLocaleString('en-CA')      : '',
      job.approvedAt ? new Date(job.approvedAt).toLocaleString('en-CA') : '',
      job.createdAt  ? new Date(job.createdAt).toLocaleString('en-CA')  : '',
      job.locationArea || '',
      allNotes,
    ].map(v => v === '' || v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
  });
  return [headers, ...rows].map(r => r.join(',')).join('\r\n');
}
function downloadCSV(jobs) {
  const blob = new Blob(['\uFEFF' + jobsToCSV(jobs)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// ────────────────────────────────────────────────────────────────────────────

export default function AgentJobs({ role }) {
  const [jobs,    setJobs]    = useState([]);
  const [status,  setStatus]  = useState('');
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [selected,setSelected]= useState(null); // job detail modal
  const [updating,setUpdating]= useState(null); // job update modal
  const [msg,     setMsg]     = useState('');
  const [agent,   setAgent]   = useState({ name: '', email: '', password: '' });

  const admin = role === 'admin' || role === 'manager';

  const load = () => {
    setLoading(true);
    json(`/jobs?status=${status}&search=${encodeURIComponent(search)}`)
      .then(d => { setJobs(d); setLoading(false); })
      .catch(e => { setMsg(e.message); setLoading(false); });
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [status, search]);

  async function createAgent(e) {
    e.preventDefault();
    try {
      await json('/users/agents', { method: 'POST', body: JSON.stringify(agent) });
      setMsg('Agent account created.');
      setAgent({ name: '', email: '', password: '' });
    } catch (e) { setMsg(e.message); }
  }

  async function approve(job, e) {
    e.stopPropagation();
    try {
      await json(`/jobs/${job._id}/approve`, { method: 'POST', body: '{}' });
      setMsg('Cash loading verified and approved.');
      setSelected(null);
      load();
    } catch (e) { setMsg(e.message); }
  }

  async function openProof(job, file, e) {
    e && e.stopPropagation();
    const r = await fetch(`/api/jobs/${job._id}/proofs/${file.storedName}`, { headers: auth() });
    if (!r.ok) return setMsg('Could not open proof');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // refresh selected job after update
  async function afterUpdate() {
    setUpdating(null);
    await load();
    // re-fetch the single job to refresh modal
    if (selected) {
      const fresh = await json(`/jobs?status=&search=${encodeURIComponent(selected.terminalId)}`);
      const updated = fresh.find(j => j._id === selected._id);
      if (updated) setSelected(updated);
    }
  }

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="aj-head">
        <div>
          <p className="eyebrow">CASH SERVICE CONTROL</p>
          <h3>{admin ? 'Agent jobs & verification' : 'My assigned ATM jobs'}</h3>
        </div>
        <div className="aj-head-actions">
          {admin && jobs.length > 0 && (
            <button className="aj-btn-dl" onClick={() => downloadCSV(jobs)}>
              ⬇ Download CSV
            </button>
          )}
          {admin && (
            <details className="aj-create-details">
              <summary>+ Create agent</summary>
              <form onSubmit={createAgent}>
                <input placeholder="Agent name" required value={agent.name}
                  onChange={e => setAgent({ ...agent, name: e.target.value })} />
                <input type="email" placeholder="Email" required value={agent.email}
                  onChange={e => setAgent({ ...agent, email: e.target.value })} />
                <input type="password" placeholder="Temporary password" minLength="8" required
                  value={agent.password}
                  onChange={e => setAgent({ ...agent, password: e.target.value })} />
                <button type="submit">Create</button>
              </form>
            </details>
          )}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="aj-filters">
        <input
          placeholder="Search terminal, business or city…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {msg && (
        <p className={msg.includes('created') || msg.includes('approved') ? 'success' : 'error'}>
          {msg}
        </p>
      )}

      {/* ── Card Grid ──────────────────────────────────────────── */}
      {loading ? (
        <LoadingSpinner text="Fetching assigned agent jobs & route history..." />
      ) : jobs.length === 0 ? (
        <p className="aj-empty">No jobs found.</p>
      ) : (
          <div className="aj-grid">
            {jobs.map(job => {
              const loadedEv = [...(job.events || [])].reverse().find(e => e.status === 'cash_loaded');
              const color    = STATUS_COLOR[job.status] || '#78958e';
              return (
                <div
                  key={job._id}
                  className="aj-card"
                  style={{ '--status-color': color }}
                  onClick={() => setSelected(job)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelected(job)}
                >
                  {/* status pill */}
                  <span className="aj-card-status" style={{ background: color + '22', color }}>
                    {STATUS_LABEL[job.status]}
                  </span>

                  {/* terminal + name */}
                  <h4 className="aj-card-terminal">{job.terminalId}</h4>
                  <p  className="aj-card-biz">{job.businessName}</p>
                  <p  className="aj-card-loc">{job.city}</p>

                  {/* key metrics */}
                  <div className="aj-card-metrics">
                    <div>
                      <small>CASH TO LOAD</small>
                      <strong>${job.cashToLoad?.toLocaleString()}</strong>
                    </div>
                    {loadedEv && (
                      <div>
                        <small>LOADED</small>
                        <strong>${loadedEv.cashLoaded?.toLocaleString()}</strong>
                      </div>
                    )}
                    <div>
                      <small>AGENT</small>
                      <strong title={job.agent?.name || 'You'}>
                        {job.agent?.name
                          ? (() => {
                              const parts = job.agent.name.trim().split(/\s+/);
                              if (parts.length <= 2) return job.agent.name;
                              // first name + last name only
                              return `${parts[0]} ${parts[parts.length - 1]}`;
                            })()
                          : 'You'}
                      </strong>
                    </div>
                  </div>

                  {/* due date */}
                  <div className="aj-card-due">
                    <small>DUE</small>
                    <span>{new Date(job.dueAt).toLocaleString('en-CA')}</span>
                  </div>

                  {/* quick approve badge for admin */}
                  {admin && job.status === 'cash_loaded' && (
                    <button
                      className="aj-card-approve"
                      onClick={e => approve(job, e)}
                    >
                      ✓ Approve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      }

      {/* ── Job Detail Modal ───────────────────────────────────── */}
      {selected && (
        <JobDetailModal
          job={selected}
          admin={admin}
          onClose={() => setSelected(null)}
          onApprove={approve}
          onProof={openProof}
          onUpdate={() => setUpdating(selected)}
        />
      )}

      {/* ── Job Update Modal ───────────────────────────────────── */}
      {updating && (
        <JobUpdate
          job={updating}
          close={() => setUpdating(null)}
          saved={afterUpdate}
        />
      )}
    </>
  );
}

/* ── Job Detail Modal ─────────────────────────────────────────────────────── */
function JobDetailModal({ job, admin, onClose, onApprove, onProof, onUpdate }) {
  const color = STATUS_COLOR[job.status] || '#78958e';
  return (
    <div className="overlay" onClick={onClose}>
      <div className="aj-detail-modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>

        {/* Header */}
        <div className="aj-dm-header" style={{ borderColor: color }}>
          <div>
            <span className="aj-card-status" style={{ background: color + '22', color }}>
              {STATUS_LABEL[job.status]}
            </span>
            <h2>{job.terminalId}</h2>
            <p className="aj-dm-biz">{job.businessName}</p>
          </div>
          {job.locationArea && (
            <span className="aj-dm-area">{job.locationArea}</span>
          )}
        </div>

        {/* Info grid */}
        <div className="aj-dm-info">
          <div><small>ADDRESS</small><span>{job.address}, {job.city}</span></div>
          <div><small>AGENT</small><span>{job.agent?.name || '—'}</span></div>
          <div><small>ASSIGNED BY</small><span>{job.assignedBy?.name || '—'}</span></div>
          <div><small>WISH AMOUNT</small><span>${job.wishAmount?.toLocaleString()}</span></div>
          <div><small>CASH TO LOAD</small><span>${job.cashToLoad?.toLocaleString()}</span></div>
          <div>
            <small>DUE AT</small>
            <span>{job.dueAt ? new Date(job.dueAt).toLocaleString('en-CA') : '—'}</span>
          </div>
          {job.approvedAt && (
            <div>
              <small>APPROVED AT</small>
              <span>{new Date(job.approvedAt).toLocaleString('en-CA')}</span>
            </div>
          )}
        </div>

        {/* Timeline */}
        <h5 className="aj-dm-section-label">Activity Timeline</h5>
        <div className="aj-dm-timeline">
          {job.events.map(ev => (
            <div key={ev._id} className="aj-dm-event">
              <span className="aj-dm-dot" style={{ background: STATUS_COLOR[ev.status] || '#78958e' }} />
              <div className="aj-dm-event-body">
                <b>{STATUS_LABEL[ev.status] || ev.status}</b>
                <time>{new Date(ev.createdAt).toLocaleString('en-CA')} · {ev.createdBy?.name}</time>
                {ev.note && <p>{ev.note}</p>}
                {ev.cashLoaded != null && (
                  <p className="aj-dm-cash-loaded">
                    Cash uploaded: <strong>${ev.cashLoaded.toLocaleString()}</strong>
                  </p>
                )}
                {ev.proofFiles?.map(file => (
                  <button
                    key={file.storedName}
                    className="proof"
                    onClick={() => onProof(job, file)}
                  >
                    📎 {file.originalName}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="aj-dm-actions">
          {!admin && !['approved', 'cash_loaded'].includes(job.status) && (
            <button className="aj-btn-primary" onClick={onUpdate}>
              Update job / report issue
            </button>
          )}
          {admin && job.status === 'cash_loaded' && (
            <button className="aj-btn-approve" onClick={e => onApprove(job, e)}>
              ✓ Verify & approve cash load
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Job Update Modal ─────────────────────────────────────────────────────── */
function JobUpdate({ job, close, saved }) {
  const [status, setStatus] = useState(job.status === 'assigned' ? 'accepted' : 'travelling');
  const [note,   setNote]   = useState('');
  const [cash,   setCash]   = useState(job.cashToLoad);
  const [files,  setFiles]  = useState([]);
  const [error,  setError]  = useState('');

  async function send(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('status', status);
    fd.append('note', note);
    if (status === 'cash_loaded') fd.append('cashLoaded', cash);
    [...files].forEach(f => fd.append('proofs', f));
    const r = await fetch(`/api/jobs/${job._id}/events`, {
      method: 'POST', headers: auth(), body: fd
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d.message || 'Update failed');
    saved();
  }

  return (
    <div className="overlay">
      <form className="job-modal" onSubmit={send}>
        <button type="button" className="close" onClick={close}>×</button>
        <p className="eyebrow">AGENT FIELD UPDATE</p>
        <h3>{job.terminalId}</h3>
        <label>Status
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="accepted">Accept job</option>
            <option value="travelling">Travelling to location</option>
            <option value="cash_loaded">Cash loaded</option>
            <option value="issue_reported">Report an issue</option>
          </select>
        </label>
        {status === 'cash_loaded' && (
          <label>Actual cash uploaded
            <input type="number" min="0" required value={cash}
              onChange={e => setCash(e.target.value)} />
          </label>
        )}
        <label>Notes
          <textarea
            required={status === 'issue_reported'}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Describe work completed or issue in detail…"
          />
        </label>
        <label>Proof photos / PDF
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            required={status === 'cash_loaded'}
            onChange={e => setFiles(e.target.files)}
          />
          <small>Up to 4 files, 8 MB each.</small>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Submit secure update →</button>
      </form>
    </div>
  );
}
