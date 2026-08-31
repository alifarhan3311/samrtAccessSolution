import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import './history.css';

const money = v => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(v || 0);
const when  = v => v ? new Date(v).toLocaleDateString('en-CA') : 'Current';

async function loadHistory(filters) {
  const query = new URLSearchParams({ ...filters, limit: '5000' });
  for (const [k, v] of [...query]) if (!v) query.delete(k);
  const r = await fetch('/api/assignment-history?' + query, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Could not load assignment history');
  return d;
}

export default function AssignmentHistory() {
  const [filters,  setFilters]  = useState({ search: '', city: '', from: '', to: '' });
  const [data,     setData]     = useState({ items: [], total: 0 });
  const [selected, setSelected] = useState(null);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(true);

  const refresh = () => {
    setLoading(true);
    loadHistory(filters).then(d => { setData(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => {
    const t = setTimeout(refresh, 300);
    return () => clearTimeout(t);
  }, [filters.search, filters.city, filters.from, filters.to]);

  function exportExcel() {
    const rows = data.items.map(item => ({
      'Terminal ID':          item.terminalId,
      'Original Business':    item.originalBusiness,
      'Original Address':     item.originalAddress,
      'Assigned Business':    item.businessName,
      'Assigned Address':     item.address,
      'City':                 item.city,
      'Payment Amount':       item.paymentAmount,
      'Assigned Date & Time': item.assignedAt ? new Date(item.assignedAt) : '',
      'Ended Date & Time':    item.endedAt    ? new Date(item.endedAt)    : 'Current',
      'Assigned By':          item.assignedBy,
      'Admin Email':          item.assignedByEmail,
      'Note':                 item.note,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 16 }, { wch: 24 }, { wch: 34 }, { wch: 24 }, { wch: 34 },
      { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 20 },
      { wch: 28 }, { wch: 35 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Assignment History');
    XLSX.writeFile(book, `ATM-Assignment-History-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // decide badge color for "current" vs ended assignments
  const isCurrent = item => !item.endedAt;

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="history-toolbar">
        <div>
          <p className="eyebrow">ADMIN AUDIT VIEW</p>
          <h3>Complete machine movement history</h3>
        </div>
        <button onClick={exportExcel} disabled={!data.items.length}>
          ⬇ Download Excel
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="history-filters">
        <label>Search
          <input placeholder="Terminal, business, address…"
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })} />
        </label>
        <label>City
          <input placeholder="e.g. Woodbridge"
            value={filters.city}
            onChange={e => setFilters({ ...filters, city: e.target.value })} />
        </label>
        <label>From date
          <input type="date" value={filters.from}
            onChange={e => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label>To date
          <input type="date" value={filters.to}
            onChange={e => setFilters({ ...filters, to: e.target.value })} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <LoadingSpinner text="Fetching ATM movement & assignment history..." />
      ) : (
        <>
          <p className="history-count">
            {data.total} assignment record{data.total !== 1 ? 's' : ''} found
            {data.limited ? ' · Result limit reached' : ''}
          </p>

      {/* ── Table View ────────────────────────────────────────── */}
      {data.items.length === 0
        ? <p className="ah-empty">No records found.</p>
        : (
          <div className="ah-table-wrap">
            <table className="ah-table">
              <thead>
                <tr>
                  <th>Terminal ID</th>
                  <th>Business Name</th>
                  <th>Address</th>
                  <th>City</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Assigned Date</th>
                  <th>Ended Date</th>
                  <th>Assigned By</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, idx) => (
                  <tr
                    key={`${item.terminalId}-${item.assignedAt}-${idx}`}
                    className={`ah-row ${isCurrent(item) ? 'ah-row--current' : ''}`}
                    onClick={() => setSelected(item)}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setSelected(item)}
                  >
                    <td className="ah-cell-terminal">{item.terminalId}</td>
                    <td>{item.businessName}</td>
                    <td className="ah-cell-address">{item.address}</td>
                    <td>{item.city}</td>
                    <td className="ah-cell-payment">{money(item.paymentAmount)}</td>
                    <td>
                      <span className={`ah-badge ${isCurrent(item) ? 'ah-badge--active' : 'ah-badge--ended'}`}>
                        {isCurrent(item) ? 'Current' : 'Ended'}
                      </span>
                    </td>
                    <td>{item.assignedAt ? new Date(item.assignedAt).toLocaleDateString('en-CA') : '—'}</td>
                    <td>{item.endedAt ? new Date(item.endedAt).toLocaleDateString('en-CA') : '—'}</td>
                    <td>{item.assignedBy || 'Unknown'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
      )}

      {/* ── Detail Modal ─────────────────────────────────────── */}
      {selected && (
        <HistoryDetailModal
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

/* ── History Detail Modal ─────────────────────────────────────────────────── */
function HistoryDetailModal({ item, onClose }) {
  const current = !item.endedAt;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="ah-detail-modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>

        {/* Header */}
        <div className="ah-dm-header">
          <div>
            <span className={`ah-badge ${current ? 'ah-badge--active' : 'ah-badge--ended'}`}>
              {current ? 'Current assignment' : 'Ended assignment'}
            </span>
            <h2>{item.terminalId}</h2>
            <p className="ah-dm-biz">{item.businessName}</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="ah-dm-grid">
          <div className="ah-dm-section">
            <h5>Original Installation</h5>
            <p>{item.originalBusiness}</p>
            <p className="muted">{item.originalAddress}</p>
          </div>

          <div className="ah-dm-section">
            <h5>Current Assignment</h5>
            <p>{item.businessName}</p>
            <p className="muted">{item.address}</p>
          </div>

          <div className="ah-dm-row">
            <small>CITY</small>
            <span>{item.city}</span>
          </div>

          <div className="ah-dm-row">
            <small>PAYMENT AMOUNT</small>
            <span>{money(item.paymentAmount)}</span>
          </div>

          <div className="ah-dm-row">
            <small>ASSIGNED DATE & TIME</small>
            <span>{when(item.assignedAt)}</span>
          </div>

          <div className="ah-dm-row">
            <small>ENDED DATE & TIME</small>
            <span>{when(item.endedAt)}</span>
          </div>

          <div className="ah-dm-row">
            <small>ASSIGNED BY</small>
            <span>{item.assignedBy || 'Unknown'}</span>
          </div>

          <div className="ah-dm-row">
            <small>ADMIN EMAIL</small>
            <span>{item.assignedByEmail || '—'}</span>
          </div>

          {item.note && (
            <div className="ah-dm-note">
              <small>NOTE</small>
              <p>{item.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
