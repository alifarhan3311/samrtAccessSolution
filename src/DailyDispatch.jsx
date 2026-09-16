import React,{useEffect,useState}from'react';
import LoadingSpinner from './LoadingSpinner.jsx';
const req=async(p,o={})=>{const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`,...o.headers}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Request failed');return d};
const money=v=>'$'+Number(v||0).toLocaleString();

import { getTorontoDateString } from './timezone';

export default function DailyDispatch({done}){
  const[terminalId,setTerminalId]=useState('');
  const[terminal,setTerminal]=useState();
  const[agents,setAgents]=useState([]);
  const[bal,setBal]=useState(null);
  const[msg,setMsg]=useState('');
  const[f,setF]=useState({agentId:'',cashToLoad:'',dueAt:getTorontoDateString(),note:''});

  const loadAgents=(targetDate=f.dueAt)=>{
    const q=targetDate?`?date=${targetDate}`:'';
    return req('/users/agents'+q).then(setAgents);
  };
  const loadBal=()=>{
    const localDate=getTorontoDateString();
    return req(`/cash/available?localDate=${localDate}`).then(setBal).catch(()=>{});
  };

  const[initialLoading,setInitialLoading]=useState(true);

  useEffect(()=>{
    Promise.all([loadAgents(),loadBal()]).finally(()=>setInitialLoading(false));
  },[]);

  async function find(e, overrideTid=terminalId, overrideDate=f.dueAt){
    e?.preventDefault?.();
    const tid=(overrideTid||'').trim();
    if(!tid) return;
    try{
      const dateParam=overrideDate?`?date=${overrideDate}`:'';
      const[atm,active]=await Promise.all([req('/terminals/'+tid),req('/jobs/active-terminal/'+tid+dateParam)]);
      if(active.busy){
        setTerminal();
        return setMsg(`${tid} is already assigned on ${overrideDate||'selected date'} to ${active.job?.agent?.name||'an agent'} (${active.job?.status}). Complete and approve that job first, or select another date.`);
      }
      if(atm.official?.status==='Inactive'){
        setTerminal();
        return setMsg(`Cannot assign ${tid}: ATM is currently Inactive. Please activate the terminal in Terminal Registry first.`);
      }
      setTerminal(atm);
      const suggested=Math.max(0,(atm.official?.wishAmount||0)-(atm.official?.cashBalance||0));
      setF(p=>({...p,cashToLoad:suggested}));
      setMsg(`ATM is available for dispatch on ${overrideDate||'selected date'}.`);
    }catch(e){setTerminal();setMsg(e.message);}
  }

  function handleDateChange(newDate){
    setF(prev=>({...prev,dueAt:newDate}));
    loadAgents(newDate);
    if(terminalId){
      find(null,terminalId,newDate);
    }
  }

  async function dispatch(e){
    e.preventDefault();
    try{
      const localDate=getTorontoDateString();
      await req('/jobs/dispatch',{method:'POST',body:JSON.stringify({...f,terminalId:terminal.terminalId,cashToLoad:+f.cashToLoad,localDate})});
      setMsg('Daily job assigned successfully.');
      setTerminal();setF({agentId:'',cashToLoad:'',dueAt:getTorontoDateString(),note:''});
      loadAgents();loadBal();done?.();
    }catch(e){setMsg(e.message);}
  }

  const cashToLoad=+f.cashToLoad||0;
  const available=bal?.available??null;
  const overBudget=available!==null&&cashToLoad>available;

  if(initialLoading) return <LoadingSpinner text="Loading dispatch data..."/>;

  return <div className="daily-dispatch">
    <section className="dispatch-form">
      <p className="eyebrow">DAILY CASH OPERATION</p>
      <h2>Assign an ATM job to an agent</h2>
      <p>One ATM can have only one open job. An agent may handle multiple different ATMs.</p>

      {/* Available balance banner */}
      {bal&&<div className={'balance-banner '+(bal.available<=0?'balance-warn':'balance-ok')} style={{padding:'14px 18px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',width:'100%',flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <small style={{letterSpacing:'0.5px',fontWeight:700}}>TOTAL AVAILABLE CASH</small>
              {bal.withdrawn === 0 && (bal.previousBalance || 0) > 0 && (
                <span style={{background:'#0369a1',color:'#fff',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700}}>
                  Using Previous Days' Cash
                </span>
              )}
            </div>
            <strong style={{fontSize:24,display:'block',marginTop:2}}>{money(bal.available)}</strong>
          </div>
          <div style={{fontSize:12,color:'inherit',opacity:.95,lineHeight:1.6,textAlign:'right'}}>
            <div><b>Previous Days' Cash:</b> {money(bal.previousBalance || 0)}</div>
            <div>
              <b>Today Withdrawn:</b> {money(bal.withdrawn)} &nbsp;·&nbsp;
              <b>Dispatched:</b> {money(bal.dispatched)} &nbsp;·&nbsp;
              <b>Returned:</b> {money(bal.returned)}
            </div>
          </div>
        </div>
        {bal.withdrawn === 0 && (bal.previousBalance || 0) > 0 && (
          <div style={{fontSize:12,marginTop:8,paddingTop:8,borderTop:'1px dashed rgba(255,255,255,0.3)',opacity:0.95}}>
            ℹ️ No cash was withdrawn from the bank today ($0). You can use the remaining cash from previous days for dispatch.
          </div>
        )}
      </div>}

      <form className="find-terminal" onSubmit={find} style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <input placeholder="Terminal ID e.g. CA101618" value={terminalId} onChange={e=>setTerminalId(e.target.value.toUpperCase())}/>
        <input type="date" value={f.dueAt} onChange={e=>handleDateChange(e.target.value)} title="Target Dispatch Date" style={{width:'auto',padding:'8px 12px',borderRadius:8,border:'1px solid #c8d3cc'}}/>
        <button>Check ATM</button>
      </form>

      {terminal&&<div className="terminal-snapshot">
        <div><small>AVAILABLE TERMINAL</small><b>{terminal.terminalId}</b></div>
        <div><small>CURRENT LOCATION</small><b>{terminal.official?.tempName || terminal.official?.name}</b><span>{terminal.current?.address || terminal.official?.address}</span></div>
        <div><small>WISH / BALANCE</small><b>{money(terminal.official?.wishAmount)} / {money(terminal.official?.cashBalance)}</b></div>
        <div><small>BILLS ($20s)</small><b style={{color:'#183d36'}}>{Math.floor((terminal.official?.wishAmount||0)/20)} / {Math.floor((terminal.official?.cashBalance||0)/20)}</b></div>
      </div>}

      <form className={!terminal?'locked':''} onSubmit={dispatch}>
        <label>Select agent
          <select required value={f.agentId} onChange={e=>setF({...f,agentId:e.target.value})}>
            <option value="">Select agent...</option>
            {agents.map(a=><option key={a._id} value={a._id}>{a.name} — {a.openJobs} open job(s)</option>)}
          </select>
          <small>All active agents can receive multiple ATM jobs.</small>
        </label>
        <div className="two">
          <label>
            Cash to load
            <input
              type="number" min="0" required
              value={f.cashToLoad}
              onChange={e=>setF({...f,cashToLoad:e.target.value})}
              style={overBudget?{borderColor:'#d76858',background:'#fff8f7'}:{}}/>
            {overBudget&&<small style={{color:'#a63e36',fontWeight:700}}>
              Exceeds available balance of {money(available)}
            </small>}
          </label>
          <label>Complete before
            <input type="date" required value={f.dueAt} onChange={e=>handleDateChange(e.target.value)}/>
          </label>
        </div>
        <label>Daily instructions
          <textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})}/>
        </label>
        <button disabled={overBudget}>
          {overBudget?`Insufficient balance — need ${money(cashToLoad-available)} more`:'Dispatch daily job →'}
        </button>
      </form>

      {msg&&<p className={msg.includes('successfully')||msg.includes('available')?'success':'error'}>{msg}</p>}
    </section>

    <aside className="agent-availability">
      <p className="eyebrow">AGENT WORKLOAD</p>
      <h3>Active assignments</h3>
      {agents.map(a=><div key={a._id}>
        <span className={a.openJobs?'busy':'available'}></span>
        <section><b>{a.name}</b><small>{a.email}</small></section>
        <strong>{a.openJobs} open</strong>
      </div>)}
    </aside>
  </div>;
}
