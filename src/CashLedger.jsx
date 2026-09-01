import React,{useEffect,useState,useCallback}from'react';
import LoadingSpinner from './LoadingSpinner.jsx';

const req=async(p,o={})=>{
  const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`,...(o.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.message||'Request failed');
  return d;
};

const money=v=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(v||0);
const fmt=v=>v?new Date(v).toLocaleDateString('en-CA',{dateStyle:'medium'}):'—';
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const monthStartStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;};

export default function CashLedger(){
  const[tab,setTab]=useState('overview');
  const[agents,setAgents]=useState([]);
  const[ledger,setLedger]=useState(null);
  const[withdrawals,setWithdrawals]=useState({items:[],totalAmount:0});
  const[returns,setReturns]=useState({items:[],totalAmount:0});
  const[dateRange,setDateRange]=useState({from:monthStartStr(),to:todayStr()});
  const[loading,setLoading]=useState(true);

  // per-form state
  const[wForm,setWForm]=useState({amount:'',note:'',date:todayStr()});
  const[wMsg,setWMsg]=useState({text:'',ok:false});
  const[wSaving,setWSaving]=useState(false);

  const[loadErr,setLoadErr]=useState('');

  const[auditAgentId, setAuditAgentId] = useState('');
  const[auditData, setAuditData] = useState(null);
  const[auditLoading, setAuditLoading] = useState(false);

  // load agents once
  useEffect(()=>{req('/users/agents').then(setAgents).catch(()=>{})},[]);

  const loadAll=useCallback(async()=>{
    setLoading(true);
    setLoadErr('');
    const qs=`from=${dateRange.from}&to=${dateRange.to}`;
    try{
      const[l,w,r]=await Promise.all([
        req(`/cash/ledger?${qs}`),
        req(`/cash/withdrawals?${qs}`),
        req(`/cash/returns?${qs}`),
      ]);
      setLedger(l);
      setWithdrawals(w);
      setReturns(r);
    }catch(e){setLoadErr(e.message);}
    finally{setLoading(false);}
  },[dateRange]);

  useEffect(()=>{loadAll();},[loadAll]);

  useEffect(() => {
    if (tab === 'agent-audit' && auditAgentId) {
      setAuditLoading(true);
      setLoadErr('');
      req(`/cash/agent-audit?agentId=${auditAgentId}&from=${dateRange.from}&to=${dateRange.to}`)
        .then(setAuditData)
        .catch(e => setLoadErr(e.message))
        .finally(() => setAuditLoading(false));
    } else if (tab === 'agent-audit') {
      setAuditData(null);
    }
  }, [tab, auditAgentId, dateRange]);

  async function addWithdrawal(e){
    e.preventDefault();
    const amount=Number(wForm.amount);
    if(!amount||amount<1){setWMsg({text:'Enter a valid amount.',ok:false});return;}
    setWSaving(true);setWMsg({text:'',ok:false});
    try{
      await req('/cash/withdraw',{method:'POST',body:JSON.stringify({amount,note:wForm.note||undefined,date:wForm.date})});
      setWMsg({text:`Recorded: ${money(amount)} withdrawal saved.`,ok:true});
      setWForm({amount:'',note:'',date:todayStr()});
      loadAll();
    }catch(e){setWMsg({text:e.message,ok:false});}
    finally{setWSaving(false);}
  }

  async function delEntry(type,id){
    if(!confirm('Delete this record? This cannot be undone.'))return;
    try{await req(`/cash/${type}/${id}`,{method:'DELETE'});loadAll();}
    catch(e){alert(e.message);}
  }

  return <div className="ledger-page">

    {/* Header with tabs + date range */}
    <div className="ledger-header">
      <div className="ledger-tabs">
        {[['overview','Overview'],['withdraw','Bank Withdrawals'],['agent-audit','Agent Audit']].map(([k,v])=>
          <button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{v}</button>)}
      </div>
      <div className="date-range">
        <label>From<input type="date" value={dateRange.from} onChange={e=>setDateRange(p=>({...p,from:e.target.value}))}/></label>
        <label>To<input type="date" value={dateRange.to} onChange={e=>setDateRange(p=>({...p,to:e.target.value}))}/></label>
      </div>
    </div>

    {loadErr&&<p className="error" style={{marginBottom:12}}>{loadErr}</p>}

    {/* ── OVERVIEW TAB ── */}
    {loading && <LoadingSpinner text="Calculating cash ledger totals & bank withdrawals..." />}
    {!loading && ledger && <>
        <div className="ledger-stats">
          <div className="lstat green">
            <small>WITHDRAWN FROM BANK</small>
            <strong>{money(ledger.totalWithdrawn)}</strong>
            <span>{withdrawals.items.length} withdrawal{withdrawals.items.length!==1?'s':''}</span>
          </div>
          <div className="lstat amber">
            <small>DISPATCHED TO AGENTS</small>
            <strong>{money(ledger.totalDispatched)}</strong>
            <span>Total cashToLoad assigned</span>
          </div>
          <div className="lstat blue">
            <small>ACTUALLY LOADED</small>
            <strong>{money(ledger.totalLoaded)}</strong>
            <span>Verified &amp; approved jobs</span>
          </div>
          <div className="lstat teal">
            <small>RETURNED BY AGENTS</small>
            <strong>{money(ledger.totalReturned)}</strong>
            <span>{returns.items.length} return{returns.items.length!==1?'s':''}</span>
          </div>
          <div className={'lstat '+(ledger.netCashOut>=0?'red':'green')}>
            <small>NET CASH OUT</small>
            <strong>{money(Math.abs(ledger.netCashOut))}</strong>
            <span>{ledger.netCashOut>0?'Dispatched minus returned':'Surplus returned'}</span>
          </div>
          <div className="lstat purple">
            <small>UNACCOUNTED</small>
            <strong>{money(Math.max(0,ledger.totalDispatched-ledger.totalLoaded))}</strong>
            <span>Given vs actually loaded</span>
          </div>
        </div>

        <div className="ledger-grid">
          <div className="ledger-card">
            <p className="eyebrow">AGENT PERFORMANCE</p>
            <h3>Cash dispatched this period</h3>
            {(!ledger.agents||ledger.agents.length===0)
              ?<p className="muted" style={{padding:'16px 0'}}>No dispatches in this period.</p>
              :<table>
                <thead><tr><th>Agent</th><th>Jobs</th><th>Approved</th><th>Dispatched</th></tr></thead>
                <tbody>{(ledger.agents||[]).map(a=><tr key={a._id}>
                  <td><b>{a.name}</b></td>
                  <td>{a.jobsAssigned}</td>
                  <td style={{color:'#267249',fontWeight:700}}>{a.jobsApproved}</td>
                  <td><b>{money(a.totalDispatched)}</b></td>
                </tr>)}</tbody>
              </table>}
          </div>

          <div className="ledger-card">
            <p className="eyebrow">RECENT WITHDRAWALS</p>
            <h3>Last 5 bank pulls</h3>
            {withdrawals.items.length===0
              ?<p className="muted" style={{padding:'16px 0'}}>No withdrawals in this period.</p>
              :withdrawals.items.slice(0,5).map(w=><div className="ledger-row" key={w._id}>
                <div><b>{money(w.amount)}</b><span>{fmt(w.date)}</span></div>
                <div><small>{w.note||'No note'}</small><small style={{color:'#888'}}>{w.withdrawnBy?.name}</small></div>
              </div>)}
            {withdrawals.items.length>0&&
              <button className="link" style={{marginTop:8,fontSize:13}} onClick={()=>setTab('withdraw')}>
                View all withdrawals &#8594;
              </button>}
          </div>
        </div>
      </>}

    {/* ── WITHDRAWALS TAB ── */}
    {tab==='withdraw'&&<div className="ledger-split">
      <div className="ledger-card">
        <p className="eyebrow">RECORD BANK WITHDRAWAL</p>
        <h3>Log cash pulled from bank</h3>
        <form onSubmit={addWithdrawal} className="ledger-form">
          <label>
            Amount (CAD)
            <input
              type="number" min="1" step="1" required
              placeholder="e.g. 5000"
              value={wForm.amount}
              onChange={e=>setWForm(p=>({...p,amount:e.target.value}))}/>
          </label>
          <label>
            Date
            <input type="date" value={wForm.date} onChange={e=>setWForm(p=>({...p,date:e.target.value}))}/>
          </label>
          <label>
            Note (optional)
            <input placeholder="e.g. Scotia Bank branch" value={wForm.note} onChange={e=>setWForm(p=>({...p,note:e.target.value}))}/>
          </label>
          {wMsg.text&&<p className={wMsg.ok?'success':'error'} style={{margin:0}}>{wMsg.text}</p>}
          <button disabled={wSaving}>{wSaving?'Saving...':'Record withdrawal \u2192'}</button>
        </form>
        <div className="ledger-summary">
          <b>Period total: {money(withdrawals.totalAmount)}</b>
          <span style={{fontSize:12,color:'#888',marginLeft:8}}>{withdrawals.items.length} records</span>
        </div>
      </div>

      <div className="ledger-card">
        <p className="eyebrow">WITHDRAWAL HISTORY</p>
        <h3>All entries</h3>
        {withdrawals.items.length===0
          ?<p className="muted" style={{padding:'20px 0'}}>No withdrawals in this period.</p>
          :<div className="table-wrap" style={{border:'none',borderRadius:0,overflow:'visible'}}>
            <table>
              <thead><tr><th>Date</th><th>Amount</th><th>Note</th><th>By</th><th></th></tr></thead>
              <tbody>{withdrawals.items.map(w=><tr key={w._id}>
                <td style={{whiteSpace:'nowrap'}}>{fmt(w.date)}</td>
                <td><b>{money(w.amount)}</b></td>
                <td style={{color:'#555',fontSize:12}}>{w.note||'—'}</td>
                <td style={{fontSize:12}}>{w.withdrawnBy?.name}</td>
                <td><button className="del-btn" title="Delete" onClick={()=>delEntry('withdrawals',w._id)}>&#10005;</button></td>
              </tr>)}</tbody>
            </table>
          </div>}
      </div>
    </div>}

    {/* ── AGENT AUDIT TAB ── */}
    {tab==='agent-audit'&&<div className="ledger-card" style={{marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:20}}>
        <div>
          <p className="eyebrow">AGENT PERFORMANCE AUDIT</p>
          <h3>Detailed agent history</h3>
        </div>
        <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12,fontWeight:700}}>
          Select Agent
          <select value={auditAgentId} onChange={e=>setAuditAgentId(e.target.value)} style={{padding:8,borderRadius:6,border:'1px solid #ccc'}}>
            <option value="">Choose...</option>
            {agents.map(a=><option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </label>
      </div>

      {!auditAgentId && <p className="muted" style={{textAlign:'center',padding:'40px 0'}}>Please select an agent to view their audit.</p>}
      
      {auditAgentId && auditLoading && <LoadingSpinner text="Fetching agent audit data..." />}
      
      {auditAgentId && !auditLoading && auditData && <>
        <div className="ledger-stats" style={{marginBottom:24}}>
          <div className="lstat amber">
            <small>CASH GIVEN (DISPATCHED)</small>
            <strong>{money(auditData.summary.totalDispatched)}</strong>
            <span>{auditData.summary.totalJobs} jobs assigned</span>
          </div>
          <div className="lstat blue">
            <small>CASH LOADED</small>
            <strong>{money(auditData.summary.totalLoaded)}</strong>
            <span>{auditData.summary.jobsApproved} jobs approved</span>
          </div>
          <div className="lstat teal">
            <small>CASH RETURNED</small>
            <strong>{money(auditData.summary.totalReturned)}</strong>
            <span>{auditData.returns.length} returns logged</span>
          </div>
          <div className={'lstat '+(auditData.summary.unaccounted>0?'red':'green')}>
            <small>UNACCOUNTED (SHORTFALL)</small>
            <strong>{money(auditData.summary.unaccounted)}</strong>
            <span>Given - Loaded - Returned</span>
          </div>
        </div>

        <div className="ledger-split">
          <div className="ledger-card" style={{border:'1px solid #eee'}}>
            <p className="eyebrow">JOBS RECORD</p>
            <h3>Assigned ATMs</h3>
            {auditData.jobs.length===0 ? <p className="muted">No jobs in this period.</p> :
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Terminal</th><th>Status</th><th>Given</th><th>Loaded</th></tr></thead>
                <tbody>{auditData.jobs.map(j=><tr key={j._id}>
                  <td style={{whiteSpace:'nowrap'}}>{fmt(j.createdAt)}</td>
                  <td><b>{j.terminalId}</b><br/><span style={{fontSize:11}}>{j.businessName}</span></td>
                  <td><span className={'badge badge-'+j.status.replace('_','-')} style={{fontSize:10}}>{j.status.replace('_',' ')}</span></td>
                  <td>{money(j.cashToLoad)}</td>
                  <td><b style={{color:'#183d36'}}>{money([...j.events].reverse().find(e=>e.status==='cash_loaded')?.cashLoaded ?? (j.status==='approved'?j.cashToLoad:0))}</b></td>
                </tr>)}</tbody>
              </table>
            </div>}
          </div>

          <div className="ledger-card" style={{border:'1px solid #eee'}}>
            <p className="eyebrow">CASH RETURNS RECORD</p>
            <h3>Submitted money</h3>
            {auditData.returns.length===0 ? <p className="muted">No returns in this period.</p> :
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Amount</th><th>Note</th><th>Received By</th></tr></thead>
                <tbody>{auditData.returns.map(r=><tr key={r._id}>
                  <td style={{whiteSpace:'nowrap'}}>{fmt(r.date)}</td>
                  <td><b style={{color:'#267249'}}>{money(r.amount)}</b></td>
                  <td style={{fontSize:12,color:'#555'}}>{r.note||'—'}</td>
                  <td style={{fontSize:12}}>{r.recordedBy?.name}</td>
                </tr>)}</tbody>
              </table>
            </div>}
          </div>
        </div>
      </>}
    </div>}

  </div>;
}
