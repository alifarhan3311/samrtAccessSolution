import React,{useEffect,useState}from'react';
import LoadingSpinner from './LoadingSpinner.jsx';
const auth=()=>({Authorization:`Bearer ${localStorage.getItem('token')}`});
const names={status:'Status',tempName:'Temp Name',name:'Business Name',address:'Address',city:'City',locationArea:'Location Area',wishAmount:'Wish Amount',cashBalance:'Cash Balance',cashLoading:'Cash Loading',agent:'Agent',notesTask:'Notes/Task',lastCommunication:'Last Communication',lastWithdrawalAt:'Last Withdrawal Date'};
const value=v=>v instanceof Date?new Date(v).toLocaleDateString('en-CA'):v===null||v===undefined||v===''?'Empty':String(v);
export default function Notifications({go}){
  const[data,setData]=useState({setup:[],lowCash:[],missing:[],unassignedTickets:[],recentChanges:[],total:0});
  const[tab,setTab]=useState('changes');
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    setLoading(true);
    fetch('/api/notifications',{headers:auth()})
      .then(r=>r.json())
      .then(d=>{setData(d);setLoading(false);})
      .catch(()=>setLoading(false));
  },[]);
  const groups={
    changes:data.recentChanges,
    setup:data.setup,
    lowCash:data.lowCash,
    missing:data.missing,
    tickets:data.unassignedTickets
  },items=groups[tab]||[];
  function configure(id){sessionStorage.setItem('configureTerminalId',id);go('assign')}
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
      <button className={tab==='changes'?'active':''} onClick={()=>setTab('changes')}>Latest changes <b>{data.recentChanges?.length||0}</b></button>
      <button className={tab==='tickets'?'active':''} onClick={()=>setTab('tickets')}>Unassigned Tickets <b>{data.unassignedTickets?.length||0}</b></button>
      <button className={tab==='setup'?'active':''} onClick={()=>setTab('setup')}>Setup required <b>{data.setup?.length||0}</b></button>
      <button className={tab==='lowCash'?'active':''} onClick={()=>setTab('lowCash')}>Low cash <b>{data.lowCash?.length||0}</b></button>
      <button className={tab==='missing'?'active':''} onClick={()=>setTab('missing')}>No longer present <b>{data.missing?.length||0}</b></button>
    </div>
    {loading?<LoadingSpinner text="Scanning action notifications & terminal alerts..."/>:<section className="notice-list">
      {!items.length&&<div className="empty-notice"><span>✓</span><h3>All clear</h3><p>No notifications in this category.</p></div>}
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
       items.map(t=><article key={t._id}>
        <div className={`notice-symbol ${tab}`}>{tab==='setup'?'＋':tab==='lowCash'?'$':'?'}</div>
        <div className="notice-copy">
          <div><b>{t.terminalId}</b><span>{t.official?.status||'Unknown'}</span></div>
          <h3>{t.official?.name||'Unnamed terminal'}</h3>
          <p>{tab==='setup'?(t.setupReason||'Complete operational setup'):tab==='lowCash'?`Cash balance $${(t.official?.cashBalance||0).toLocaleString()} is below minimum $${(t.alert?.threshold||0).toLocaleString()}`:'Terminal was not found in the latest official upload.'}</p>
          <small>{t.official?.address||'Address unavailable'} · {t.official?.city||'City unavailable'}</small>
        </div>
        {tab==='setup'&&<button onClick={()=>configure(t.terminalId)}>Configure ATM →</button>}
        {tab==='lowCash'&&<button onClick={()=>go('jobs')}>Dispatch cash →</button>}
      </article>)}
    </section>}
  </main>}
function ChangeCard({change,configure}){const type=change.type||'updated';return <article className="change-card"><div className={`change-type ${type}`}>{type==='new'?'NEW':type==='updated'?'UPD':'OUT'}</div><div className="notice-copy"><div><b>{change.terminalId}</b><span>{type==='new'?'New ATM':type==='updated'?'Existing ATM updated':'Removed from latest sheet'}</span></div><h3>{change.name||change.after?.name||'Unnamed terminal'}</h3>{type==='new'&&<div className="new-details">{Object.entries(change.after||{}).filter(([,v])=>v!==''&&v!=null).map(([k,v])=><span key={k}><small>{names[k]||k}</small><b>{value(v)}</b></span>)}</div>}{type==='updated'&&<div className="field-changes">{(change.fields||[]).map(f=><div key={f.field}><b>{names[f.field]||f.field}</b><span className="before">{value(f.previous)}</span><i>→</i><span className="after">{value(f.current)}</span></div>)}</div>}{type==='removed'&&<p>This existing terminal was not present in the latest uploaded workbook. Its history remains protected.</p>}</div>{(type==='new'||change.setupRequired)&&<button onClick={()=>configure(change.terminalId)}>Configure ATM →</button>}</article>}

