import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{BrowserRouter,Routes,Route,useNavigate,useLocation,Navigate}from'react-router-dom';
import TerminalRegistry from './TerminalRegistry.jsx';
import AssignmentHistory from './AssignmentHistory.jsx';
import AssignTerminal from './AssignTerminal.jsx';
import DailyDispatch from './DailyDispatch.jsx';
import AreaDispatch from './AreaDispatch.jsx';
import AgentJobs from './AgentJobs.jsx';
import AgentManagement from './AgentManagement.jsx';
import OfficialImport from './OfficialImport.jsx';
import Notifications from './Notifications.jsx';
import CashLedger from './CashLedger.jsx';
import Discrepancies from './Discrepancies.jsx';
import SystemLogs from './SystemLogs.jsx';
import'./style.css';
import'./terminal.css';
import'./history.css';
import'./operations.css';
import'./import.css';
import'./notifications.css';
import'./agent-management.css';
import'./overrides.css';
import'./area-dispatch.css';
import'./ledger.css';
import'./system-logs.css';
import'./loader.css';
import LoadingSpinner from './LoadingSpinner.jsx';

const nativeFetch=window.fetch.bind(window);
window.fetch=async(...args)=>{
  const response=await nativeFetch(...args);
  const url=typeof args[0]==='string'?args[0]:args[0]?.url||'';
  if(response.status===401&&!url.includes('/api/auth/login')){
    localStorage.removeItem('token');localStorage.removeItem('user');
    if(!sessionStorage.getItem('sessionResetting')){sessionStorage.setItem('sessionResetting','1');window.location.replace('/')}
  }
  return response;
};
sessionStorage.removeItem('sessionResetting');

const API='/api';
async function request(path,options={}){
  const token=localStorage.getItem('token');
  const r=await fetch(API+path,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{}),...options.headers}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.message||'Request failed');
  return data;
}
const money=v=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(v||0);

function Login({done}){
  const[form,setForm]=useState({email:'admin@example.com',password:'ChangeMe123!'}),[error,setError]=useState('');
  async function submit(e){e.preventDefault();try{const d=await request('/auth/login',{method:'POST',body:JSON.stringify(form)});localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));done(d.user)}catch(e){setError(e.message)}}
  return <main className="login"><section className="brand-panel"><div className="mark">S</div><div><p className="eyebrow">Smart Access Solutions</p><h1>Every terminal.<br/>Exactly where it belongs.</h1><p>Operational visibility for your complete ATM fleet.</p></div><small>SECURE OPERATIONS PLATFORM · CANADA</small></section><form className="login-card" onSubmit={submit}><div><p className="eyebrow">WELCOME BACK</p><h2>Sign in to Command Center</h2><p className="muted">Use your organization credentials.</p></div><label>Email<input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>{error&&<p className="error">{error}</p>}<button>Sign in securely <span>&#8594;</span></button><small className="muted">Protected by encrypted authentication and activity monitoring.</small></form></main>;
}

function Shell(){
  const[user,setUser]=useState(()=>JSON.parse(localStorage.getItem('user')||'null'));
  const navigate=useNavigate();
  const location=useLocation();

  if(!user)return <Login done={u=>{setUser(u);navigate(u.role==='agent'?'/jobs':'/dashboard')}}/>;
  const logout=()=>{localStorage.clear();setUser(null)};
  const admin=user.role==='admin', agent=user.role==='agent';

  const links=agent
    ?[['jobs','My jobs & history','▣','/jobs']]
    :[['dashboard','Overview','⌂','/dashboard'],
      ['notifications','Notifications','●','/notifications'],
      ['terminals','Terminals','▦','/terminals'],
      ['assign','ATM setup & location','⌖','/assign'],
      ['dispatch','Single ATM dispatch','↗','/dispatch'],
      ['area','Area route dispatch','⌘','/area'],
      ['jobs','Agent jobs & history','▣','/jobs'],
      ...(admin?[
        ['agents','Manage agents','☺','/agents'],
        ['ledger','Cash ledger','$','/ledger'],
        ['discrepancies','Cash discrepancies','⚠','/discrepancies'],
        ['history','ATM movement history','◷','/history'],
        ['logs','Activity & Audit Logs','📋','/logs']
      ]:[]),
      ['import','Official import','⇅','/import']];

  const titles={
    dashboard:'Command center',
    notifications:'Notifications & setup queue',
    terminals:'Terminal registry',
    assign:'ATM setup & current location',
    dispatch:'Single ATM dispatch',
    area:'Location area route dispatch',
    jobs:agent?'My jobs & completed history':'Agent jobs & assignment history',
    agents:'Agent management',
    ledger:'Cash ledger & flow',
    history:'ATM movement history',
    discrepancies:'Cash discrepancies & alerts',
    logs:'System Activity & Audit Logs',
    import:'Official data import'
  };

  const go=(targetKey)=>{
    const pathMap={
      dashboard:'/dashboard',
      notifications:'/notifications',
      terminals:'/terminals',
      assign:'/assign',
      dispatch:'/dispatch',
      area:'/area',
      jobs:'/jobs',
      agents:'/agents',
      ledger:'/ledger',
      discrepancies:'/discrepancies',
      history:'/history',
      logs:'/logs',
      import:'/import'
    };
    navigate(pathMap[targetKey]||(targetKey.startsWith('/')?targetKey:`/${targetKey}`));
  };

  const currentPath=location.pathname.replace(/^\//,'')||(agent?'jobs':'dashboard');

  return <div className="shell">
    <aside>
      <div className="logo"><div className="mark">S</div><div><b>Smart Access</b><small>COMMAND CENTER</small></div></div>
      <nav>{links.map(x=><button key={x[0]} className={location.pathname===x[3]||(x[0]==='dashboard'&&location.pathname==='/')?'active':''} onClick={()=>navigate(x[3])}><i>{x[2]}</i>{x[1]}</button>)}</nav>
      <div className="user"><span>{user.name?.[0]}</span><div><b>{user.name}</b><small>{user.role}</small></div><button onClick={logout}>&#8617;</button></div>
    </aside>
    <section className="content">
      <header>
        <div><p className="eyebrow">ATM FLEET OPERATIONS</p><h2>{titles[currentPath]||currentPath}</h2></div>
        <div className="live"><span></span> Systems operational</div>
      </header>
      <Routes>
        <Route path="/" element={<Navigate to={agent ? '/jobs' : '/dashboard'} replace />} />
        <Route path="/dashboard" element={<Dashboard go={go}/>} />
        <Route path="/notifications" element={<Notifications go={go}/>} />
        <Route path="/terminals" element={<TerminalRegistry/>} />
        <Route path="/assign" element={<AssignTerminal/>} />
        <Route path="/dispatch" element={<DailyDispatch done={()=>go('jobs')}/>} />
        <Route path="/area" element={<AreaDispatch done={()=>go('jobs')}/>} />
        <Route path="/jobs" element={<AgentJobs role={user.role}/>} />
        <Route path="/agents" element={admin?<AgentManagement/>:<Navigate to="/jobs" replace/>} />
        <Route path="/ledger" element={admin?<CashLedger/>:<Navigate to="/jobs" replace/>} />
        <Route path="/discrepancies" element={admin?<Discrepancies/>:<Navigate to="/jobs" replace/>} />
        <Route path="/history" element={admin?<AssignmentHistory/>:<Navigate to="/jobs" replace/>} />
        <Route path="/logs" element={admin?<SystemLogs/>:<Navigate to="/jobs" replace/>} />
        <Route path="/import" element={<OfficialImport/>} />
        <Route path="*" element={<Navigate to={agent ? '/jobs' : '/dashboard'} replace />} />
      </Routes>
    </section>
  </div>;
}

function Dashboard({go}){
  const[d,setD]=useState(null);
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayName=days[new Date().getDay()];
  useEffect(()=>{request('/dashboard').then(setD).catch(()=>{})},[]);
  if(!d)return <Loading text="Loading command center overview & fleet statistics..."/>;
  const f=d.fleet||{};
  const today=(d.cash||{}).today||{};
  const month=(d.cash||{}).month||{};
  const jobs=d.jobs||{};
  return <>
    <div className="hero">
      <div><p className="eyebrow">{dayName.toUpperCase()} &#183; FLEET SNAPSHOT</p><h1>Good morning.</h1><p>Here's what's happening across your terminal network today.</p></div>
      <button onClick={()=>go('ledger')}>Cash ledger <b>&#8594;</b></button>
    </div>

    <div className="stats">
      <Stat label="Total fleet" value={f.total||0} note="All registered terminals"/>
      <Stat label="Active" value={f.active||0} note={Math.round((f.active||0)/Math.max(f.total||1,1)*100)+'% of fleet online'} accent/>
      <Stat label="Inactive" value={f.inactive||0} note="Offline terminals"/>
      <Stat label="Cash alerts" value={f.alerts||0} note={f.alerts?'Below threshold':'All thresholds healthy'} warn={f.alerts}/>
    </div>

    <p className="eyebrow" style={{padding:'18px 0 8px',margin:0}}>TODAY'S CASH FLOW</p>
    <div className="stats">
      <article className="stat" style={{borderTop:'3px solid #3aaa68'}}><p>Withdrawn from bank</p><strong style={{color:'#267249'}}>{money(today.withdrawn||0)}</strong><small>Bank pulls today</small></article>
      <article className="stat" style={{borderTop:'3px solid #d2a437'}}><p>Dispatched to agents</p><strong style={{color:'#a07422'}}>{money(today.dispatched||0)}</strong><small>Assigned to agents</small></article>
      <article className="stat" style={{borderTop:'3px solid #4a7fd4'}}><p>Actually loaded</p><strong style={{color:'#2a5aaa'}}>{money(today.actualLoaded||0)}</strong><small>Approved jobs</small></article>
      <article className="stat" style={{borderTop:'3px solid #357064'}}><p>Returned by agents</p><strong style={{color:'#1e5040'}}>{money(today.returned||0)}</strong><small>Unspent cash back</small></article>
    </div>

    <div className="stats" style={{gridTemplateColumns:'repeat(3,1fr)',marginTop:10}}>
      <article className="stat accent"><p>Cash in all machines</p><strong>{money(f.totalCashInMachines||0)}</strong><small>Live balance across fleet</small></article>
      <article className="stat" style={{borderTop:'3px solid #8b5cf6'}}><p>Net cash out today</p><strong style={{color:(today.balance||0)>=0?'#a63e36':'#267249'}}>{money(Math.abs(today.balance||0))}</strong><small>{(today.balance||0)>=0?'Dispatched exceeds returned':'Surplus returned'}</small></article>
      <article className="stat" style={{borderTop:'3px solid #78909c'}}><p>Open jobs</p><strong>{jobs.open||0}</strong><small>{jobs.pendingApproval||0} awaiting approval</small></article>
    </div>

    {/* Discrepancy alert banner */}
    {(d.discrepancies?.open||0)>0&&<div style={{background:'#fdecea',border:'1px solid #f5b7b1',borderRadius:10,padding:'14px 18px',marginTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div>
        <p style={{margin:0,fontSize:11,fontWeight:800,letterSpacing:'1px',color:'#922b21',textTransform:'uppercase'}}>⚠ CASH DISCREPANCY ALERTS</p>
        <p style={{margin:'4px 0 0',fontSize:14,color:'#7b241c'}}>
          <b>{d.discrepancies.open}</b> open alert{d.discrepancies.open!==1?'s':''} — total shortfall <b style={{color:'#a63e36'}}>${(d.discrepancies.totalShortfall||0).toLocaleString()}</b>
        </p>
      </div>
      <button onClick={()=>go('discrepancies')} style={{border:0,borderRadius:8,background:'#a63e36',color:'#fff',padding:'10px 16px',fontWeight:700,cursor:'pointer',flexShrink:0}}>
        Review alerts &#8594;
      </button>
    </div>}

    <div className="grid" style={{marginTop:14}}>
      <article>
        <div className="article-head">
          <div><p className="eyebrow">LOCATION INTELLIGENCE</p><h3>Fleet by city</h3></div>
          <button onClick={()=>go('terminals')}>View all &#8594;</button>
        </div>
        {(d.cities||[]).map((c,i)=><div className="city" key={c._id||i}>
          <span className="rank">{String(i+1).padStart(2,'0')}</span>
          <div><b>{c._id||'Unassigned'}</b><small>{c.count} terminals</small></div>
          <div className="bar"><i style={{width:(c.count/(d.cities[0]?.count||1)*100)+'%'}}/></div>
          <strong>{money(c.cash||0)}</strong>
        </div>)}
      </article>

      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <article style={{background:'#fff',border:'1px solid #e0e4df',borderRadius:12,padding:20}}>
          <p className="eyebrow">THIS MONTH</p>
          <h3 style={{font:'700 19px Manrope',margin:'4px 0 14px'}}>Cash flow summary</h3>
          {[['Withdrawn from bank',month.withdrawn||0,'#267249'],['Dispatched to agents',month.dispatched||0,'#a07422'],['Actually loaded',month.actualLoaded||0,'#2a5aaa'],['Returned by agents',month.returned||0,'#1e5040']].map(([lbl,val,col])=>
            <div key={lbl} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderTop:'1px solid #eef0ed'}}>
              <span style={{fontSize:13,color:'#6f7873'}}>{lbl}</span>
              <strong style={{color:col}}>{money(val)}</strong>
            </div>)}
          <div style={{display:'flex',justifyContent:'space-between',padding:'11px 0 0',borderTop:'2px solid #dce1dc',marginTop:4}}>
            <span style={{fontSize:13,fontWeight:700}}>Net cash out</span>
            <strong style={{color:(month.netCashOut||0)>0?'#a63e36':'#267249'}}>{money(month.netCashOut||0)}</strong>
          </div>
        </article>

        {d.agents&&d.agents.length>0&&<article style={{background:'#fff',border:'1px solid #e0e4df',borderRadius:12,padding:20}}>
          <p className="eyebrow">AGENT PERFORMANCE &#183; THIS MONTH</p>
          <h3 style={{font:'700 19px Manrope',margin:'4px 0 14px'}}>Top agents</h3>
          {d.agents.slice(0,5).map(a=>
            <div key={a._id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderTop:'1px solid #eef0ed'}}>
              <div><b style={{fontSize:13}}>{a.name}</b><div style={{fontSize:11,color:'#888'}}>{a.jobsApproved}/{a.jobsAssigned} approved</div></div>
              <strong style={{color:'#183d36'}}>{money(a.totalDispatched)}</strong>
            </div>)}
          <button className="link" style={{marginTop:8,fontSize:13}} onClick={()=>go('ledger')}>Full ledger &#8594;</button>
        </article>}

        <article className="signal">
          <p className="eyebrow">OPERATIONAL SIGNAL</p>
          <h3>{f.alerts?'Cash thresholds need attention':'Fleet is healthy'}</h3>
          <p>{f.active||0} active, {f.inactive||0} inactive.{f.setupRequired>0?' '+f.setupRequired+' terminals need setup.':''}</p>
          <div className="ring"><b>{Math.round((f.active||0)/Math.max(f.total||1,1)*100)}%</b><small>ACTIVE RATE</small></div>
        </article>
      </div>
    </div>
  </>;
}

function Stat({label,value,note,accent,warn}){return <article className={'stat '+(accent?'accent ':'')+( warn?'warn':'')}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;}

function Terminals(){const[q,setQ]=useState(''),[data,setData]=useState({items:[]}),[selected,setSelected]=useState(null),[error,setError]=useState('');const load=()=>request('/terminals?limit=100&search='+encodeURIComponent(q)).then(setData).catch(e=>setError(e.message));useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t)},[q]);async function changeStatus(t,status){const old=t.official.status;setData(d=>({...d,items:d.items.map(x=>x.terminalId===t.terminalId?{...x,official:{...x.official,status}}:x)}));try{await request('/terminals/'+t.terminalId+'/status',{method:'PATCH',body:JSON.stringify({status})})}catch(e){setError(e.message);setData(d=>({...d,items:d.items.map(x=>x.terminalId===t.terminalId?{...x,official:{...x.official,status:old}}:x)}))}}const show=v=>v===0?0:v||'—',date=v=>v?new Date(v).toLocaleDateString('en-CA'):'—';return <><div className="toolbar"><input placeholder="Search terminal, business, city or address..." value={q} onChange={e=>setQ(e.target.value)}/><span>{data.total||0} terminals</span></div>{error&&<p className="error">{error}</p>}<div className="table-wrap full-table"><table><thead><tr><th>Status</th><th>Terminal ID</th><th>Temp Name</th><th>Name</th><th>Address</th><th>City</th><th>Location Area</th><th>Wish Amount</th><th>Cash Balance</th><th>Cashloading</th><th>Agent</th><th>Notes/Task</th><th>Last Communication</th><th>Last Withdrawal Date</th><th></th></tr></thead><tbody>{data.items.map(t=><tr key={t.terminalId}><td><select className={'status-select '+(t.official?.status?.toLowerCase())} value={t.official?.status==='Inactive'?'Inactive':'Active'} onChange={e=>changeStatus(t,e.target.value)}><option>Active</option><option>Inactive</option></select></td><td><b>{t.terminalId}</b></td><td>{show(t.official?.tempName)}</td><td>{show(t.official?.name)}</td><td className="wide-cell">{show(t.official?.address)}</td><td>{show(t.official?.city)}</td><td>{show(t.official?.locationArea)}</td><td>{money(t.official?.wishAmount)}</td><td>{money(t.official?.cashBalance)}</td><td>{show(t.official?.cashLoading)}</td><td>{show(t.official?.agent)}</td><td className="wide-cell">{show(t.official?.notesTask)}</td><td>{show(t.official?.lastCommunication)}</td><td>{date(t.official?.lastWithdrawalAt)}</td><td><button className="link" onClick={()=>setSelected(t)}>View &#8594;</button></td></tr>)}</tbody></table></div>{selected&&<Drawer t={selected} close={()=>setSelected(null)}/>}</>;
}

function Drawer({t,close}){return <div className="overlay" onClick={close}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="close" onClick={close}>&#215;</button><p className="eyebrow">TERMINAL RECORD</p><h2>{t.terminalId}</h2><span className="pill active">{t.official?.status}</span><h4>Original installation</h4><b>{t.original?.businessName||'Not recorded'}</b><p>{t.original?.address}</p><h4>Current assignment</h4><b>{t.current?.businessName||'Unassigned'}</b><p>{t.current?.address}</p><div className="amount"><small>PAYMENT AMOUNT</small><strong>{money(t.current?.paymentAmount)}</strong></div><h4>Assignment history</h4><p className="muted">{t.assignmentHistory?.length||0} recorded movement(s)</p></aside></div>;}

function Assign(){const[id,setId]=useState(''),[t,setT]=useState(null),[msg,setMsg]=useState(''),[f,setF]=useState({businessName:'',address:'',city:'',paymentAmount:0,note:'',alertThreshold:0});async function find(e){e.preventDefault();setMsg('');try{setT(await request('/terminals/'+id))}catch(e){setMsg(e.message)}}async function save(e){e.preventDefault();try{await request('/terminals/'+t.terminalId+'/assign',{method:'POST',body:JSON.stringify({...f,paymentAmount:+f.paymentAmount,alertThreshold:+f.alertThreshold})});setMsg('Assignment saved. Original installation details were preserved.');setT(null)}catch(e){setMsg(e.message)}}return <div className="assign-grid"><article><p className="eyebrow">STEP 01 &#183; IDENTIFY</p><h3>Find the machine</h3><form className="search-id" onSubmit={find}><input placeholder="e.g. CA101622" value={id} onChange={e=>setId(e.target.value.toUpperCase())}/><button>Find</button></form>{t&&<div className="original"><small>ORIGINAL INSTALLATION &#183; READ ONLY</small><b>{t.original?.businessName}</b><p>{t.original?.address}</p></div>}{msg&&<p className={msg.startsWith('Assignment')?'success':'error'}>{msg}</p>}</article><article className={!t?'disabled':''}><p className="eyebrow">STEP 02 &#183; NEW ASSIGNMENT</p><h3>Where is it going?</h3><form onSubmit={save}>{[['businessName','Business name'],['address','Street address'],['city','City'],['paymentAmount','Payment amount (CAD)'],['alertThreshold','Balance alert threshold']].map(([k,l])=><label key={k}>{l}<input type={k.includes('Amount')||k.includes('Threshold')?'number':'text'} required value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></label>)}<label>Assignment note<textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></label><button disabled={!t}>Save assignment <span>&#8594;</span></button></form></article></div>;}

function Importer(){const[file,setFile]=useState(),[result,setResult]=useState(),[error,setError]=useState('');async function send(){const fd=new FormData();fd.append('file',file);try{setResult(await request('/imports',{method:'POST',body:fd}));setError('')}catch(e){setError(e.message)}}return <div className="import-card"><p className="eyebrow">CONTROLLED SYNCHRONIZATION</p><h3>Import official terminal status</h3><p>The official layer will update. Original locations, current assignments, payments and full movement history will remain untouched.</p><label className="drop"><input type="file" accept=".xls,.xlsx" onChange={e=>setFile(e.target.files[0])}/><b>{file?.name||'Choose Canada Terminal Status file'}</b><small>XLS or XLSX &#183; maximum 10 MB</small></label><button disabled={!file} onClick={send}>Run secure import &#8594;</button>{error&&<p className="error">{error}</p>}{result&&<div className="result">{['imported','new','updated','removed','unchanged'].map(k=><div key={k}><small>{k}</small><b>{result[k]}</b></div>)}</div>}</div>;}

function Loading({text}){return <LoadingSpinner text={text||'Loading operational data...'}/>;}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Shell />
  </BrowserRouter>
);
