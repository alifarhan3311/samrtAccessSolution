import React, { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import './terminal.css';

const money = v => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v || 0);
const auth  = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

async function req(path, options = {}) {
  const r = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...auth(), ...options.headers }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}

const show = v => (v === 0 ? 0 : v || '—');
const fmt  = v => v ? new Date(v).toLocaleDateString('en-CA') : '—';

export default function TerminalRegistry() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAgent = user.role === 'agent';

  const [q,        setQ]        = useState('');
  const [data,     setData]     = useState({ items: [] });
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null); // mobile detail modal

  const load = () => {
    setLoading(true);
    req('/terminals?limit=100&search=' + encodeURIComponent(q))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function updateStatus(t, value) {
    try {
      await req('/terminals/' + t.terminalId + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: value })
      });
      load();
      // refresh selected modal if open
      if (selected?.terminalId === t.terminalId) {
        setSelected(prev => ({ ...prev, official: { ...prev.official, status: value } }));
      }
    } catch (e) { setError(e.message); }
  }

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="toolbar">
        <input
          placeholder="Search terminal, business, current location or city..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <span>{data.total || 0} terminals</span>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <LoadingSpinner text="Fetching terminal registry data..." />
      ) : (
        <>
      <div className="table-wrap full-table tr-desktop">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Terminal ID</th>
              <th>Temp Name</th>
              <th>Name</th>
              <th>Address</th>
              <th>City</th>
              <th>Location Area</th>
              <th>Wish Amount</th>
              <th>Cash Balance</th>
              <th>Cashloading</th>
              <th>Agent</th>
              <th>Notes/Task</th>
              <th>Last Communication</th>
              <th>Last Withdrawal Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(t => {
              const currentAddress = t.current?.address  || t.original?.address  || t.official?.address;
              const currentCity    = t.current?.city     || t.original?.city     || t.official?.city;
              return (
                <tr key={t.terminalId}>
                  <td>
                    <select
                      className={`status-select ${t.official?.status?.toLowerCase()}`}
                      value={t.official?.status === 'Inactive' ? 'Inactive' : 'Active'}
                      onChange={e => updateStatus(t, e.target.value)}
                      disabled={isAgent}
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </td>
                  <td><b>{t.terminalId}</b></td>
                  <td>{show(t.official?.tempName)}</td>
                  <td>{show(t.original?.businessName || t.official?.name)}</td>
                  <td className="wide-cell">{show(currentAddress)}</td>
                  <td>{show(currentCity)}</td>
                  <td>{show(t.official?.locationArea)}</td>
                  <td>{money(t.official?.wishAmount)}</td>
                  <td>{money(t.official?.cashBalance)}</td>
                  <td>{show(t.official?.cashLoading)}</td>
                  <td>{show(t.official?.agent)}</td>
                  <td className="wide-cell">{show(t.official?.notesTask)}</td>
                  <td>{show(t.official?.lastCommunication)}</td>
                  <td>{fmt(t.official?.lastWithdrawalAt)}</td>
                  <td>
                    <button className="link" onClick={() => setSelected(t)}>
                      View Details ➔
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MOBILE — card grid (hidden on desktop via CSS)
      ══════════════════════════════════════════════════════════ */}
      <div className="tr-mobile">
        {data.items.length === 0
          ? <p className="tr-empty">No terminals found.</p>
          : (
            <div className="tr-card-grid">
              {data.items.map(t => {
                const currentBiz     = t.current?.businessName || t.official?.tempName || t.original?.businessName;
                const currentCity    = t.current?.city || t.original?.city || t.official?.city;
                const isActive       = t.official?.status !== 'Inactive';
                return (
                  <div
                    key={t.terminalId}
                    className="tr-card"
                    onClick={() => setSelected(t)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setSelected(t)}
                  >
                    <div className="tr-card-top">
                      <span className={`tr-card-badge ${isActive ? 'tr-badge-active' : 'tr-badge-inactive'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                      <b className="tr-card-id">{t.terminalId}</b>
                    </div>

                    <p className="tr-card-biz">{show(currentBiz)}</p>
                    <p className="tr-card-city">{show(currentCity)}</p>

                    <div className="tr-card-metrics">
                      <div>
                        <small>CASH BALANCE</small>
                        <strong>{money(t.official?.cashBalance)}</strong>
                      </div>
                      <div>
                        <small>WISH AMOUNT</small>
                        <strong>{money(t.official?.wishAmount)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </>
  )}

      {/* ── Terminal Detail Modal (mobile) ──────────────────────── */}
      {selected && (
        <TerminalModal
          t={selected}
          onClose={() => setSelected(null)}
          onStatusChange={updateStatus}
          isAgent={isAgent}
        />
      )}
    </>
  );
}

/* ── Terminal Detail Modal ────────────────────────────────────────────────── */
function TerminalModal({ t, onClose, onStatusChange, isAgent }) {
  const currentBiz     = t.official?.tempName || t.current?.businessName || t.official?.name;
  const currentAddress = t.current?.address      || t.original?.address  || t.official?.address;
  const currentCity    = t.current?.city         || t.original?.city     || t.official?.city;
  const isActive       = t.official?.status !== 'Inactive';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="tr-modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>

        {/* Header */}
        <div className="tr-modal-header">
          <span className={`tr-card-badge ${isActive ? 'tr-badge-active' : 'tr-badge-inactive'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
          <h2>{t.terminalId}</h2>
          <p className="tr-modal-biz">{show(currentBiz)}</p>
        </div>

        {/* Details */}
        <div className="tr-modal-body">

          <div className="tr-modal-section">
            <h5>Current Location</h5>
            <p>{show(currentBiz)}</p>
            <p className="muted">{show(currentAddress)}</p>
            <p className="muted">{show(currentCity)}</p>
          </div>


          <div className="tr-modal-rows">
            {[
              ['Location Area',       show(t.official?.locationArea)],
              ['Temp Name',           show(t.official?.tempName)],
              ['Wish Amount',         money(t.official?.wishAmount)],
              ['Cash Balance',        money(t.official?.cashBalance)],
              ['Cash Loading',        show(t.official?.cashLoading)],
              ['Agent',               show(t.official?.agent)],
              ['Notes / Task',        show(t.official?.notesTask)],
              ['Last Communication',  show(t.official?.lastCommunication)],
              ['Last Withdrawal',     fmt(t.official?.lastWithdrawalAt)],
            ].map(([label, value]) => (
              <div key={label} className="tr-modal-row">
                <small>{label}</small>
                <span>{value}</span>
              </div>
            ))}
          </div>

          {/* Status toggle */}
          <div className="tr-modal-status">
            <small>CHANGE STATUS</small>
            <select
              className={`status-select ${t.official?.status?.toLowerCase()}`}
              value={isActive ? 'Active' : 'Inactive'}
              onChange={e => onStatusChange(t, e.target.value)}
              disabled={isAgent}
            >
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>

        </div>
      </div>
    </div>
  );
}
