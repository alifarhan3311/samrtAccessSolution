import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import './terminal.css';

const money = v => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v || 0);
const auth  = () => ({  });

async function req(path, options = {}) {
  const r = await fetch('/api' + path, { credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...auth(), ...options.headers }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}

import { getTorontoDateString } from './timezone';
const show = v => (v === 0 ? 0 : v || '—');
const fmt  = v => v ? getTorontoDateString(v) : '—';

export default function TerminalRegistry() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAgent = user.role === 'agent';

  // Search & Filters
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [areaFilter,   setAreaFilter]   = useState('all');
  const [cityFilter,   setCityFilter]   = useState('all');

  // Sorting
  const [sortKey, setSortKey] = useState('terminalId');
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  // Pagination
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25); // 25, 50, 100, or 'all'

  // Data
  const [data,     setData]     = useState({ items: [], total: 0 });
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [exporting, setExporting]= useState(false);
  const [selected, setSelected] = useState(null); // mobile detail modal

  const load = () => {
    setLoading(true);
    req('/terminals?limit=500')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => {
    load();
  }, []);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, areaFilter, cityFilter, pageSize]);

  async function updateStatus(t, value) {
    try {
      await req('/terminals/' + t.terminalId + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: value })
      });
      // update state in memory immediately for instant feedback
      setData(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.terminalId === t.terminalId
            ? { ...item, official: { ...item.official, status: value } }
            : item
        )
      }));
      // refresh selected modal if open
      if (selected?.terminalId === t.terminalId) {
        setSelected(prev => ({ ...prev, official: { ...prev.official, status: value } }));
      }
    } catch (e) { setError(e.message); }
  }

  // Extract unique areas & cities for dropdowns
  const { areas, cities, counts } = useMemo(() => {
    const aSet = new Set();
    const cSet = new Set();
    const cnt = { total: data.items.length, active: 0, inactive: 0, spare: 0, pending: 0, neverComm: 0 };

    for (const t of data.items) {
      if (t.official?.locationArea) aSet.add(t.official.locationArea);
      const city = t.current?.city || t.original?.city || t.official?.city;
      if (city) cSet.add(city);

      if (t.official?.lastCommunication === 'Never Communicated') {
        cnt.neverComm++;
      }

      const st = (t.official?.status || '').toLowerCase();
      if (st === 'active') cnt.active++;
      else if (st === 'inactive') cnt.inactive++;
      else if (st === 'spare') cnt.spare++;
      else if (st === 'pending') cnt.pending++;
    }

    return {
      areas: Array.from(aSet).sort(),
      cities: Array.from(cSet).sort(),
      counts: cnt
    };
  }, [data.items]);

  // Filtering
  const filteredItems = useMemo(() => {
    return data.items.filter(t => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'NeverCommunicated') {
          if (t.official?.lastCommunication !== 'Never Communicated') return false;
        } else {
          if ((t.official?.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
        }
      }
      // Area filter
      if (areaFilter !== 'all' && t.official?.locationArea !== areaFilter) {
        return false;
      }
      // City filter
      const city = t.current?.city || t.original?.city || t.official?.city || '';
      if (cityFilter !== 'all' && city !== cityFilter) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const tid = (t.terminalId || '').toLowerCase();
        const temp = (t.official?.tempName || '').toLowerCase();
        const name = (t.original?.businessName || t.official?.name || '').toLowerCase();
        const addr = (t.current?.address || t.original?.address || t.official?.address || '').toLowerCase();
        const cty  = (city || '').toLowerCase();
        const area = (t.official?.locationArea || '').toLowerCase();
        const ag   = (t.official?.agent || '').toLowerCase();
        const notes= (t.official?.notes || '').toLowerCase();
        const task = (t.official?.notesTask || '').toLowerCase();

        if (!tid.includes(q) && !temp.includes(q) && !name.includes(q) &&
            !addr.includes(q) && !cty.includes(q) && !area.includes(q) &&
            !ag.includes(q) && !notes.includes(q) && !task.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [data.items, statusFilter, areaFilter, cityFilter, search]);

  // Sorting
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      let valA, valB;
      switch (sortKey) {
        case 'status':
          valA = a.official?.status || ''; valB = b.official?.status || ''; break;
        case 'terminalId':
          valA = a.terminalId || ''; valB = b.terminalId || ''; break;
        case 'tempName':
          valA = a.official?.tempName || ''; valB = b.official?.tempName || ''; break;
        case 'name':
          valA = a.original?.businessName || a.official?.name || '';
          valB = b.original?.businessName || b.official?.name || ''; break;
        case 'address':
          valA = a.current?.address || a.original?.address || a.official?.address || '';
          valB = b.current?.address || b.original?.address || b.official?.address || ''; break;
        case 'city':
          valA = a.current?.city || a.original?.city || a.official?.city || '';
          valB = b.current?.city || b.original?.city || b.official?.city || ''; break;
        case 'locationArea':
          valA = a.official?.locationArea || ''; valB = b.official?.locationArea || ''; break;
        case 'wishAmount':
          valA = Number(a.official?.wishAmount) || 0; valB = Number(b.official?.wishAmount) || 0; break;
        case 'cashBalance':
          valA = Number(a.official?.cashBalance) || 0; valB = Number(b.official?.cashBalance) || 0; break;
        case 'cashLoading':
          valA = Number(a.official?.cashLoading) || 0; valB = Number(b.official?.cashLoading) || 0; break;
        case 'agent':
          valA = a.official?.agent || ''; valB = b.official?.agent || ''; break;
        case 'notesTask':
          valA = a.official?.notesTask || ''; valB = b.official?.notesTask || ''; break;
        case 'lastCommunication':
          valA = a.official?.lastCommunication || ''; valB = b.official?.lastCommunication || ''; break;
        case 'lastWithdrawalDate':
          valA = a.official?.lastWithdrawalDate || (a.official?.lastWithdrawalAt ? new Date(a.official.lastWithdrawalAt).getTime() : '');
          valB = b.official?.lastWithdrawalDate || (b.official?.lastWithdrawalAt ? new Date(b.official.lastWithdrawalAt).getTime() : ''); break;
        case 'notes':
          valA = a.official?.notes || ''; valB = b.official?.notes || ''; break;
        default:
          valA = a.terminalId || ''; valB = b.terminalId || '';
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? comp : -comp;
    });
    return list;
  }, [filteredItems, sortKey, sortDir]);

  // Pagination calculations
  const totalFiltered = sortedItems.length;
  const effectivePageSize = pageSize === 'all' ? Math.max(1, totalFiltered) : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(totalFiltered / effectivePageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = sortedItems.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);
  const startRecord = totalFiltered === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const endRecord = Math.min(currentPage * effectivePageSize, totalFiltered);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function clearAllFilters() {
    setSearch('');
    setStatusFilter('all');
    setAreaFilter('all');
    setCityFilter('all');
    setPage(1);
  }

  async function exportAll() {
    setExporting(true);
    try {
      const allItems = filteredItems;
      if (allItems.length === 0) {
        toast.error("No terminals to export");
        setExporting(false);
        return;
      }
      
      const rows = allItems.map(t => ({
        "Status": t.official?.status || 'Active',
        "Terminal ID": t.terminalId,
        "Temp Name": t.official?.tempName || '',
        "Name": t.original?.businessName || t.official?.name || '',
        "Address": t.current?.address || t.original?.address || t.official?.address || '',
        "City": t.current?.city || t.original?.city || t.official?.city || '',
        "Location Area": t.official?.locationArea || '',
        "Wish Amount": Number(t.official?.wishAmount) || 0,
        "Cash Balance": Number(t.official?.cashBalance) || 0,
        "Cashloading": t.official?.cashLoading || '',
        "Agent": t.official?.agent || '',
        "Notes/Task": t.official?.notesTask || '',
        "Last Communication": t.official?.lastCommunication || '',
        "Last Withdrawal Date": t.official?.lastWithdrawalAt ? getTorontoDateString(t.official.lastWithdrawalAt) : '',
        "Notes": t.official?.notes || ''
      }));

      const sheet = XLSX.utils.json_to_sheet(rows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Terminals");
      XLSX.writeFile(book, `Terminal-Registry-${getTorontoDateString()}.xlsx`);
      toast.success(`Exported ${allItems.length} terminals`);
    } catch (err) {
      toast.error(err.message || "Failed to export terminals");
    } finally {
      setExporting(false);
    }
  }

  const isFiltered = search || statusFilter !== 'all' || areaFilter !== 'all' || cityFilter !== 'all';

  // Table header component for sorting
  function Th({ colKey, label, className = '' }) {
    const active = sortKey === colKey;
    return (
      <th
        className={`tr-sortable-th ${className}`}
        onClick={() => handleSort(colKey)}
        title={`Sort by ${label} (${active ? (sortDir === 'asc' ? 'Ascending' : 'Descending') : 'Click to sort'})`}
      >
        <div className="tr-sortable-th-inner">
          <span>{label}</span>
          <span className={`tr-sort-icon ${active ? 'active' : ''}`}>
            {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </div>
      </th>
    );
  }

  return (
    <>
      {/* ── Filters & Controls Container ──────────────────────────── */}
      <div className="tr-filter-container">
        {/* Status Count Pills */}
        <div className="tr-status-pills">
          {[
            ['all',      'All Records', counts.total],
            ['Active',   'Active',      counts.active],
            ['Inactive', 'Inactive',    counts.inactive],
            ['NeverCommunicated', 'Never Comm.', counts.neverComm],
          ].map(([st, lbl, cnt]) => (
            <button
              key={st}
              type="button"
              className={`tr-pill ${statusFilter.toLowerCase() === st.toLowerCase() ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              <span>{lbl}</span>
              <span className="tr-pill-count">{cnt}</span>
            </button>
          ))}
        </div>

        {/* Search & Dropdown Filters Row */}
        <div className="tr-controls-row">
          <div className="tr-search-box">
            <span className="search-icon">🔍</span>
            <input
              placeholder="Search terminal ID, business name, address, city, agent, notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="tr-dropdown-filters">
            {/* Location Area Filter */}
            <select
              value={areaFilter}
              onChange={e => setAreaFilter(e.target.value)}
              title="Filter by Location Area"
            >
              <option value="all">All Areas ({areas.length})</option>
              {areas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* City Filter */}
            <select
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              title="Filter by City"
            >
              <option value="all">All Cities ({cities.length})</option>
              {cities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Page Size Selector */}
            <select
              value={pageSize}
              onChange={e => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              title="Records per page"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value="all">View All ({totalFiltered})</option>
            </select>

            {/* Clear Filters Button */}
            {isFiltered && (
              <button
                type="button"
                className="tr-clear-btn"
                onClick={clearAllFilters}
                title="Reset all filters"
              >
                ✕ Reset Filters
              </button>
            )}

            <button
              type="button"
              className="tr-clear-btn"
              onClick={exportAll}
              disabled={exporting}
              style={{ background: '#183d36', color: '#fff', borderColor: '#183d36', opacity: exporting ? 0.7 : 1 }}
              title="Download filtered terminals as Excel"
            >
              {exporting ? 'Exporting...' : '↓ Download All'}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <LoadingSpinner text="Fetching terminal registry data..." />
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════
              DESKTOP — Full Sortable Data Table
              ══════════════════════════════════════════════════════════ */}
          <div className="table-wrap full-table tr-desktop">
            <table>
              <thead>
                <tr>
                  <Th colKey="status"             label="Status" />
                  <Th colKey="terminalId"         label="Terminal ID" />
                  <Th colKey="tempName"           label="Temp Name" />
                  <Th colKey="name"               label="Name" />
                  <Th colKey="address"            label="Address" />
                  <Th colKey="city"               label="City" />
                  <Th colKey="locationArea"       label="Location Area" />
                  <Th colKey="wishAmount"         label="Wish Amount" />
                  <Th colKey="cashBalance"        label="Cash Balance" />
                  <Th colKey="cashLoading"        label="Cashloading" />
                  <Th colKey="agent"              label="Agent" />
                  <Th colKey="notesTask"          label="Notes/Task" />
                  <Th colKey="lastCommunication"  label="Last Communication" />
                  <Th colKey="lastWithdrawalDate" label="Last Withdrawal Date" />
                  <Th colKey="notes"              label="Notes" />
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={16} style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
                      No matching terminals found. Try clearing filters.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map(t => {
                    const currentAddress = t.current?.address || t.original?.address || t.official?.address;
                    const currentCity    = t.current?.city    || t.original?.city    || t.official?.city;
                    return (
                      <tr key={t.terminalId}>
                        <td>
                          <select
                            className={`status-select ${t.official?.status?.toLowerCase()}`}
                            value={['Active', 'Inactive', 'Never Communicated'].includes(t.official?.status) ? t.official?.status : 'Active'}
                            onChange={e => updateStatus(t, e.target.value)}
                            disabled={isAgent && !user.canChangeTerminalStatus}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Never Communicated">Never Communicated</option>
                          </select>
                        </td>
                        <td><b>{t.terminalId}</b></td>
                        <td>{show(t.official?.tempName)}</td>
                        <td>{show(t.original?.businessName || t.official?.name)}</td>
                        <td className="wide-cell">{show(currentAddress)}</td>
                        <td>{show(currentCity)}</td>
                        <td>{show(t.official?.locationArea)}</td>
                        <td><b>{money(t.official?.wishAmount)}</b></td>
                        <td><b>{money(t.official?.cashBalance)}</b></td>
                        <td>{show(t.official?.cashLoading)}</td>
                        <td>{show(t.official?.agent)}</td>
                        <td className="wide-cell">{show(t.official?.notesTask)}</td>
                        <td>{show(t.official?.lastCommunication)}</td>
                        <td>{show(t.official?.lastWithdrawalDate || fmt(t.official?.lastWithdrawalAt))}</td>
                        <td>{show(t.official?.notes)}</td>
                        <td>
                          <button className="link" onClick={() => setSelected(t)}>
                            View Details ➔
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ══════════════════════════════════════════════════════════
              MOBILE — Cards
              ══════════════════════════════════════════════════════════ */}
          <div className="tr-mobile">
            {paginatedItems.length === 0 ? (
              <p className="tr-empty">No matching terminals found.</p>
            ) : (
              <div className="tr-card-grid">
                {paginatedItems.map(t => {
                  const currentBiz  = t.current?.businessName || t.official?.tempName || t.original?.businessName;
                  const currentCity = t.current?.city || t.original?.city || t.official?.city;
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
                        <span className={`tr-card-badge tr-badge-${(t.official?.status || 'active').toLowerCase()}`}>
                          {t.official?.status || 'Active'}
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

          {/* ══════════════════════════════════════════════════════════
              PAGINATION BAR (Both Desktop & Mobile)
              ══════════════════════════════════════════════════════════ */}
          <div className="tr-pagination-bar">
            <div className="tr-page-info">
              Showing <b>{startRecord}</b> to <b>{endRecord}</b> of <b>{totalFiltered}</b> terminals
              {totalFiltered !== data.items.length && (
                <span> (filtered from {data.items.length} total)</span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="tr-pagination-actions">
                <button
                  type="button"
                  className="tr-page-btn"
                  onClick={() => setPage(1)}
                  disabled={currentPage <= 1}
                  title="First Page"
                >
                  «
                </button>
                <button
                  type="button"
                  className="tr-page-btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  title="Previous Page"
                >
                  ‹ Prev
                </button>

                {/* Page Numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span style={{ padding: '0 4px', color: '#888' }}>…</span>}
                        <button
                          type="button"
                          className={`tr-page-btn ${currentPage === p ? 'active' : ''}`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  className="tr-page-btn"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  title="Next Page"
                >
                  Next ›
                </button>
                <button
                  type="button"
                  className="tr-page-btn"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  title="Last Page"
                >
                  »
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Terminal Detail Modal ─────────────────────────────── */}
      {selected && (
        <TerminalModal
          t={selected}
          onClose={() => setSelected(null)}
          onStatusChange={updateStatus}
          onSave={updated => {
            setData(prev => ({
              ...prev,
              items: prev.items.map(item => item.terminalId === updated.terminalId ? updated : item)
            }));
            setSelected(updated);
          }}
          isAgent={isAgent}
          canChangeStatus={!isAgent || user.canChangeTerminalStatus}
        />
      )}
    </>
  );
}

/* ── Terminal Detail Modal ────────────────────────────────────────────────── */
function TerminalModal({ t, onClose, onStatusChange, isAgent, canChangeStatus, onSave }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [formData, setFormData] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setFormData({
      locationArea: t.official?.locationArea || '',
      name: t.official?.name || '',
      wishAmount: t.official?.wishAmount || '',
      cashBalance: t.official?.cashBalance || '',
      cashLoading: t.official?.cashLoading || '',
      agent: t.official?.agent || '',
      notesTask: t.official?.notesTask || '',
      notes: t.official?.notes || '',
      terminalModel: t.official?.terminalModel || '',
      serialNumber: t.official?.serialNumber || '',
      merchantCommission: t.official?.merchantCommission || ''
    });
  }, [t]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/terminals/${t.terminalId}`, { credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to update');
      const updated = await res.json();
      if (onSave) onSave(updated);
      setIsEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentBiz     = t.official?.tempName || t.official?.name;
  const currentAddress = t.current?.address      || t.original?.address  || t.official?.address;
  const currentCity    = t.current?.city         || t.original?.city     || t.official?.city;

  const editableFields = [
    { key: 'locationArea', label: 'Location Area' },
    { key: 'name', label: 'Name' },
    { key: 'wishAmount', label: 'Wish Amount', type: 'number' },
    { key: 'cashBalance', label: 'Cash Balance', type: 'number' },
    { key: 'cashLoading', label: 'Cash Loading', type: 'number' },
    { key: 'agent', label: 'Agent' },
    { key: 'notesTask', label: 'Notes / Task' },
    { key: 'notes', label: 'Notes' },
    { key: 'terminalModel', label: 'Model' },
    { key: 'serialNumber', label: 'Machine Serial No' },
    { key: 'merchantCommission', label: 'Merchant Comm.' },
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="tr-modal" onClick={e => e.stopPropagation()} style={{ width: '500px', maxWidth: '95%' }}>
        <button className="close" onClick={onClose}>×</button>

        {/* Header */}
        <div className="tr-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className={`tr-card-badge tr-badge-${(t.official?.status || 'active').toLowerCase()}`}>
              {t.official?.status || 'Active'}
            </span>
            <h2 style={{ marginTop: '8px' }}>{t.terminalId}</h2>
            <p className="tr-modal-biz">{show(currentBiz)}</p>
          </div>
          {!isAgent && !isEditing && (
            <button onClick={() => setIsEditing(true)} style={{ padding: '6px 12px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '32px' }}>Edit</button>
          )}
          {!isAgent && isEditing && (
            <div style={{ display: 'flex', gap: '8px', marginRight: '32px' }}>
              <button onClick={() => setIsEditing(false)} style={{ padding: '6px 12px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} disabled={saving}>Cancel</button>
              <button onClick={handleSave} style={{ padding: '6px 12px', background: '#2a5aaa', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="tr-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
          <div className="tr-modal-section">
            <h5>Current Location</h5>
            <p>{show(currentBiz)}</p>
            <p className="muted">{show(currentAddress)}</p>
            <p className="muted">{show(currentCity)}</p>
          </div>
          
          <div className="tr-modal-section" style={{ marginTop: '16px' }}>
            <h5>Previous Location</h5>
            <p>{show(t.original?.businessName)}</p>
            <p className="muted">{show(t.original?.address)}</p>
            <p className="muted">{show(t.original?.city)}</p>
          </div>

          <div className="tr-modal-rows">
            {editableFields.map(field => (
              <div key={field.key} className="tr-modal-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                <small style={{ marginBottom: '4px', color: '#666' }}>{field.label.toUpperCase()}</small>
                {isEditing ? (
                  <input
                    type={field.type || 'text'}
                    name={field.key}
                    value={formData[field.key] || ''}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                ) : (
                  <span style={{ fontWeight: 500 }}>
                    {field.type === 'number' && t.official?.[field.key] !== undefined ? money(t.official[field.key]) : show(t.official?.[field.key])}
                  </span>
                )}
              </div>
            ))}
            <div className="tr-modal-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
              <small style={{ marginBottom: '4px', color: '#666' }}>LAST COMMUNICATION</small>
              <span style={{ fontWeight: 500 }}>{show(t.official?.lastCommunication)}</span>
            </div>
            <div className="tr-modal-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
              <small style={{ marginBottom: '4px', color: '#666' }}>LAST WITHDRAWAL</small>
              <span style={{ fontWeight: 500 }}>{show(t.official?.lastWithdrawalDate || fmt(t.official?.lastWithdrawalAt))}</span>
            </div>
          </div>

          {/* Status toggle */}
          <div className="tr-modal-status" style={{ marginTop: '20px' }}>
            <small>CHANGE STATUS</small>
            <select
              className={`status-select ${t.official?.status?.toLowerCase()}`}
              value={['Active', 'Inactive', 'Never Communicated'].includes(t.official?.status) ? t.official?.status : 'Active'}
              onChange={e => onStatusChange(t, e.target.value)}
              disabled={!canChangeStatus}
              style={{ width: '100%', padding: '8px', marginTop: '8px' }}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Never Communicated">Never Communicated</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
