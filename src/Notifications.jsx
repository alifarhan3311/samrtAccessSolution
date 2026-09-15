import React,{useEffect,useState}from'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import AssignTerminal from './AssignTerminal.jsx';
import './atm-forms.css';

const auth=()=>({Authorization:`Bearer ${localStorage.getItem('token')}`});
const names={status:'Status',tempName:'Temp Name',name:'Business Name',address:'Address',city:'City',locationArea:'Location Area',wishAmount:'Wish Amount',cashBalance:'Cash Balance',cashLoading:'Cash Loading',agent:'Agent',notesTask:'Notes/Task',lastCommunication:'Last Communication',lastWithdrawalAt:'Last Withdrawal Date'};
const value=v=>v instanceof Date?new Date(v).toLocaleDateString('en-CA'):v===null||v===undefined||v===''?'Empty':String(v);

export function getSetupNeeds(t) {
  const needs = [];
  const wish = t.official?.wishAmount;
  if (!wish || Number(wish) <= 0) {
    needs.push({
      key: 'wish',
      label: 'Wish Amount ($0 / unconfigured)',
      detail: 'Set minimum cash rule (e.g. $2,000) to activate low-cash alerts',
      color: '#b45309',
      bg: '#fef3c7',
      icon: '💰'
    });
  }
  const city = (t.official?.city || t.current?.city || '').trim();
  if (!city || city.toLowerCase().includes('unavailable')) {
    needs.push({
      key: 'city',
      label: 'City (Unavailable / Missing)',
      detail: 'City required for route and area dispatching',
      color: '#c2410c',
      bg: '#ffedd5',
      icon: '📍'
    });
  }
  const address = (t.official?.address || t.current?.address || '').trim();
  if (!address || address.toLowerCase().includes('unavailable')) {
    needs.push({
      key: 'address',
      label: 'Address (Missing)',
      detail: 'Physical address required',
      color: '#b91c1c',
      bg: '#fee2e2',
      icon: '🏢'
    });
  }
  const name = (t.official?.tempName || t.current?.businessName || t.official?.name || '').trim();
  if (!name || name.toLowerCase().includes('unnamed')) {
    needs.push({
      key: 'name',
      label: 'Business Name (Missing)',
      detail: 'Business / store name required',
      color: '#4338ca',
      bg: '#e0e7ff',
      icon: '🏷️'
    });
  }
  return needs;
}

export default function Notifications({go}){
  const[data,setData]=useState({setup:[],lowCash:[],missing:[],unassignedTickets:[],recentChanges:[],total:0});
  const[tab,setTab]=useState('changes');
  const[loading,setLoading]=useState(true);
  const[configuringTerminalId,setConfiguringTerminalId]=useState(null);

  // Filters & Search
  const[searchQuery,setSearchQuery]=useState('');
  const[setupFilter,setSetupFilter]=useState('all'); // 'all' | 'wish' | 'city' | 'address' | 'name'
  const[cityFilter,setCityFilter]=useState('all');

  const loadData=()=>{
    setLoading(true);
    fetch('/api/notifications',{headers:auth()})
      .then(r=>r.json())
      .then(d=>{setData(d);setLoading(false);})
      .catch(()=>setLoading(false));
  };

  useEffect(()=>{
    loadData();
  },[]);

  const groups={
    changes:data.recentChanges,
    setup:data.setup,
    lowCash:data.lowCash,
    missing:data.missing,
    tickets:data.unassignedTickets
  };

  const rawItems=groups[tab]||[];

  // Compute breakdown stats for Setup Required tab
  const setupStats = React.useMemo(() => {
    let wish = 0, city = 0, address = 0, name = 0;
    (data.setup || []).forEach(t => {
      const needs = getSetupNeeds(t);
      if (needs.some(n => n.key === 'wish')) wish++;
      if (needs.some(n => n.key === 'city')) city++;
      if (needs.some(n => n.key === 'address')) address++;
      if (needs.some(n => n.key === 'name')) name++;
    });
    return { wish, city, address, name };
  }, [data.setup]);

  // Unique cities list for setup terminals
  const uniqueCities = React.useMemo(() => {
    const set = new Set();
    (data.setup || []).forEach(t => {
      const c = (t.official?.city || t.current?.city || '').trim();
      if (c && !c.toLowerCase().includes('unavailable')) set.add(c);
    });
    return Array.from(set).sort();
  }, [data.setup]);

  // Filter items based on active search & tab filters
  const items = React.useMemo(() => {
    return rawItems.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tid = (item.terminalId || '').toLowerCase();
        const name = (item.official?.name || item.name || item.after?.name || item.official?.tempName || item.current?.businessName || '').toLowerCase();
        const addr = (item.official?.address || item.after?.address || item.current?.address || '').toLowerCase();
        const city = (item.official?.city || item.after?.city || item.current?.city || '').toLowerCase();
        const prob = (item.problem || '').toLowerCase();
        const matches = tid.includes(q) || name.includes(q) || addr.includes(q) || city.includes(q) || prob.includes(q);
        if (!matches) return false;
      }

      if (tab === 'setup') {
        const needs = getSetupNeeds(item);
        if (setupFilter === 'wish' && !needs.some(n => n.key === 'wish')) return false;
        if (setupFilter === 'city' && !needs.some(n => n.key === 'city')) return false;
        if (setupFilter === 'address' && !needs.some(n => n.key === 'address')) return false;
        if (setupFilter === 'name' && !needs.some(n => n.key === 'name')) return false;

        if (cityFilter !== 'all') {
          const c = (item.official?.city || item.current?.city || '').trim();
          if (c !== cityFilter) return false;
        }
      }

      return true;
    });
  }, [rawItems, searchQuery, setupFilter, cityFilter, tab]);

  function configure(id){
    setConfiguringTerminalId(id);
  }

  return <main className="notice-page">
    <div className="notice-hero">
      <div>
        <p className="eyebrow">ACTION CENTER</p>
        <h1>{data.total} item{data.total===1?'':'s'} need attention</h1>
        <p>Every new terminal, ticket, and official field change is identified automatically.</p>
      </div>
      <div className="notice-orb">{data.total}</div>
    </div>
    {data.latestImport&&<div className="latest-import"><span>Latest upload</span><b>{data.latestImport.fileName}</b><small>{new Date(data.latestImport.createdAt).toLocaleDateString('en-CA')}</small></div>}
    
    <div className="notice-tabs">
      <button className={tab==='changes'?'active':''} onClick={()=>{setTab('changes');setSetupFilter('all');setCityFilter('all');}}>Latest changes <b>{data.recentChanges?.length||0}</b></button>
      <button className={tab==='tickets'?'active':''} onClick={()=>{setTab('tickets');setSetupFilter('all');setCityFilter('all');}}>Unassigned Tickets <b>{data.unassignedTickets?.length||0}</b></button>
      <button className={tab==='setup'?'active':''} onClick={()=>{setTab('setup');setSetupFilter('all');setCityFilter('all');}}>Setup required <b>{data.setup?.length||0}</b></button>
      <button className={tab==='lowCash'?'active':''} onClick={()=>{setTab('lowCash');setSetupFilter('all');setCityFilter('all');}}>Low cash <b>{data.lowCash?.length||0}</b></button>
      <button className={tab==='missing'?'active':''} onClick={()=>{setTab('missing');setSetupFilter('all');setCityFilter('all');}}>No longer present <b>{data.missing?.length||0}</b></button>
    </div>

    {/* Filter & Search Bar */}
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      alignItems: 'center',
      background: '#fff',
      border: '1px solid #dce2dd',
      borderRadius: '12px',
      padding: '12px 16px',
      marginBottom: '16px'
    }}>
      <div style={{ flex: '1 1 240px', position: 'relative' }}>
        <input
          type="text"
          placeholder={tab === 'setup' ? "Search ATM ID, business name, address, or city..." : "Search current tab items..."}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 12px 9px 32px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '13px'
          }}
        />
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold'
            }}
          >✕</button>
        )}
      </div>

      {tab === 'setup' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Filter by missing:</span>
            <button
              type="button"
              onClick={() => setSetupFilter('all')}
              style={{
                border: '1px solid ' + (setupFilter === 'all' ? '#183d36' : '#e2e8f0'),
                background: setupFilter === 'all' ? '#183d36' : '#f8fafc',
                color: setupFilter === 'all' ? '#fff' : '#475569',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              All ({data.setup?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setSetupFilter(setupFilter === 'wish' ? 'all' : 'wish')}
              style={{
                border: '1px solid ' + (setupFilter === 'wish' ? '#b45309' : '#fde68a'),
                background: setupFilter === 'wish' ? '#fef3c7' : '#fffbeb',
                color: '#b45309',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: setupFilter === 'wish' ? '0 0 0 2px #b45309' : 'none'
              }}
            >
              💰 Missing Wish Amount ({setupStats.wish})
            </button>
            <button
              type="button"
              onClick={() => setSetupFilter(setupFilter === 'city' ? 'all' : 'city')}
              style={{
                border: '1px solid ' + (setupFilter === 'city' ? '#c2410c' : '#fed7aa'),
                background: setupFilter === 'city' ? '#ffedd5' : '#fff7ed',
                color: '#c2410c',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: setupFilter === 'city' ? '0 0 0 2px #c2410c' : 'none'
              }}
            >
              📍 Missing City ({setupStats.city})
            </button>
            <button
              type="button"
              onClick={() => setSetupFilter(setupFilter === 'address' ? 'all' : 'address')}
              style={{
                border: '1px solid ' + (setupFilter === 'address' ? '#b91c1c' : '#fecaca'),
                background: setupFilter === 'address' ? '#fee2e2' : '#fef2f2',
                color: '#b91c1c',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: setupFilter === 'address' ? '0 0 0 2px #b91c1c' : 'none'
              }}
            >
              🏢 Missing Address ({setupStats.address})
            </button>
          </div>

          {uniqueCities.length > 0 && (
            <select
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                background: '#f8fafc'
              }}
            >
              <option value="all">All Cities ({uniqueCities.length})</option>
              {uniqueCities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </>
      )}

      <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>Showing <b>{items.length}</b> of <b>{rawItems.length}</b></span>
        {(searchQuery || setupFilter !== 'all' || cityFilter !== 'all') && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setSetupFilter('all'); setCityFilter('all'); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>

    {loading?<LoadingSpinner text="Scanning action notifications & terminal alerts..."/>:<section className="notice-list">
      {!items.length&&<div className="empty-notice"><span>✓</span><h3>All clear</h3><p>No notifications match your current search and filters.</p></div>}
      {tab==='changes'?items.map((change,index)=><ChangeCard key={`${change.terminalId}-${index}`} change={change} configure={configure}/>):
       tab==='tickets'?items.map(t=><article key={t._id}>
        <div className="notice-symbol" style={{ background: '#fef3c7', color: '#b45309' }}>🎫</div>
        <div className="notice-copy">
          <div><b>{t.terminalId}</b><span style={{ background: '#e0f2fe', color: '#0369a1' }}>{t.status}</span></div>
          <h3>{t.problem}</h3>
          <p>Reported by <b>{t.generatedBy?.name || 'User'}</b> on {new Date(t.createdAt).toLocaleDateString('en-CA')}. Currently unassigned.</p>
        </div>
        <button onClick={()=>go('tickets')} style={{ background: '#357064', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
          Assign Agent →
        </button>
      </article>):
       items.map(t=>{
        const needs = tab === 'setup' ? getSetupNeeds(t) : [];
        return (
          <article key={t._id}>
            <div className={`notice-symbol ${tab}`}>{tab==='setup'?'＋':tab==='lowCash'?'$':'?'}</div>
            <div className="notice-copy">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <b>{t.terminalId}</b>
                <span>{t.official?.status||'Unknown'}</span>
                {tab === 'setup' && (
                  t.official?.wishAmount > 0 ? (
                    <span style={{ background: '#ecfdf5', color: '#047857', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                      Wish: ${t.official.wishAmount.toLocaleString()}
                    </span>
                  ) : (
                    <span style={{ background: '#fef2f2', color: '#b91c1c', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                      ⚠️ Wish Amount: Missing ($0)
                    </span>
                  )
                )}
              </div>
              <h3>{t.official?.name || t.current?.businessName || 'Unnamed terminal'}</h3>

              {tab === 'setup' && (
                <div style={{ margin: '6px 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Required configuration:</span>
                    {needs.length > 0 ? (
                      needs.map(n => (
                        <span
                          key={n.key}
                          style={{
                            background: n.bg,
                            color: n.color,
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            border: `1px solid ${n.color}40`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title={n.detail}
                        >
                          <span>{n.icon}</span> {n.label}
                        </span>
                      ))
                    ) : (
                      <span style={{ background: '#f0fdf4', color: '#166534', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                        ✓ Details present, click Configure to finalize setup
                      </span>
                    )}
                  </div>
                  {t.setupReason && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      Reason: {t.setupReason}
                    </p>
                  )}
                </div>
              )}

              {tab !== 'setup' && (
                <p>{tab==='lowCash'?`Cash balance $${(t.official?.cashBalance||0).toLocaleString()} is below minimum $${(t.alert?.threshold||0).toLocaleString()}`:'Terminal was not found in the latest official upload.'}</p>
              )}
              <small>{t.official?.address||'Address unavailable'} · {t.official?.city||'City unavailable'}</small>
            </div>
            {tab==='setup'&&<button onClick={()=>configure(t.terminalId)} style={{ background: '#183d36', color: '#fff', border: 0, padding: '10px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Configure ATM →</button>}
            {tab==='lowCash'&&<button onClick={()=>go('jobs')}>Dispatch cash →</button>}
          </article>
        );
       })}
    </section>}

    {configuringTerminalId && (
      <div className="atm-modal-overlay" onClick={()=>setConfiguringTerminalId(null)}>
        <div className="atm-modal-container" onClick={e=>e.stopPropagation()} style={{ maxWidth: 1050, height: 'auto', maxHeight: '90vh' }}>
          <button className="atm-modal-close" onClick={()=>setConfiguringTerminalId(null)}>✕ Close</button>
          <div className="atm-modal-body" style={{ padding: '0 24px 24px' }}>
            <AssignTerminal
              initialTerminalId={configuringTerminalId}
              onDone={()=>{
                loadData();
              }}
            />
          </div>
        </div>
      </div>
    )}
  </main>}
function ChangeCard({change,configure}){const type=change.type||'updated';return <article className="change-card"><div className={`change-type ${type}`}>{type==='new'?'NEW':type==='updated'?'UPD':'OUT'}</div><div className="notice-copy"><div><b>{change.terminalId}</b><span>{type==='new'?'New ATM':type==='updated'?'Existing ATM updated':'Removed from latest sheet'}</span></div><h3>{change.name||change.after?.name||'Unnamed terminal'}</h3>{type==='new'&&<div className="new-details">{Object.entries(change.after||{}).filter(([,v])=>v!==''&&v!=null).map(([k,v])=><span key={k}><small>{names[k]||k}</small><b>{value(v)}</b></span>)}</div>}{type==='updated'&&<div className="field-changes">{(change.fields||[]).map(f=><div key={f.field}><b>{names[f.field]||f.field}</b><span className="before">{value(f.previous)}</span><i>→</i><span className="after">{value(f.current)}</span></div>)}</div>}{type==='removed'&&<p>This existing terminal was not present in the latest uploaded workbook. Its history remains protected.</p>}</div>{(type==='new'||change.setupRequired)&&<button onClick={()=>configure(change.terminalId)}>Configure ATM →</button>}</article>}

