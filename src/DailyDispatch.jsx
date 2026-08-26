import React,{useEffect,useState}from'react';
import LoadingSpinner from './LoadingSpinner.jsx';
const req=async(p,o={})=>{const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`,...o.headers}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Request failed');return d};
const money=v=>'$'+Number(v||0).toLocaleString();

export default function DailyDispatch({done}){
  const[terminalId,setTerminalId]=useState('');
  const[terminal,setTerminal]=useState();
  const[agents,setAgents]=useState([]);
  const[bal,setBal]=useState(null);
  const[msg,setMsg]=useState('');
  const[f,setF]=useState({agentId:'',cashToLoad:'',dueAt:'',note:''});

  const loadAgents=()=>req('/users/agents').then(setAgents);
  const loadBal=()=>{
    const ld=new Date();const localDate=`${ld.getFullYear()}-${String(ld.getMonth()+1).padStart(2,'0')}-${String(ld.getDate()).padStart(2,'0')}`;
    return req(`/cash/available?localDate=${localDate}`).then(setBal).catch(()=>{});
  };

  const[initialLoading,setInitialLoading]=useState(true);

  useEffect(()=>{
    Promise.all([loadAgents(),loadBal()]).finally(()=>setInitialLoading(false));
  },[]);

  async function find(e){
    e.preventDefault();
    try{
      const[atm,active]=await Promise.all([req('/terminals/'+terminalId),req('/jobs/active-terminal/'+terminalId)]);
      if(active.busy){setTerminal();return setMsg(`${terminalId} is already assigned to ${active.job?.agent?.name||'an agent'} (${active.job?.status}). Complete and approve that job first.`);}
      if(atm.official?.status==='Inactive'){setTerminal();return setMsg(`Cannot assign ${terminalId}: ATM is currently Inactive. Please activate the terminal in Terminal Registry first.`);}
      setTerminal(atm);
      const suggested=Math.max(0,(atm.official?.wishAmount||0)-(atm.official?.cashBalance||0));
      setF(p=>({...p,cashToLoad:suggested}));
      setMsg('ATM is available for a new daily dispatch.');
    }catch(e){setTerminal();setMsg(e.message);}
  }

  async function dispatch(e){
    e.preventDefault();
    try{
      const ld=new Date();const localDate=`${ld.getFullYear()}-${String(ld.getMonth()+1).padStart(2,'0')}-${String(ld.getDate()).padStart(2,'0')}`;
      await req('/jobs/dispatch',{method:'POST',body:JSON.stringify({...f,terminalId:terminal.terminalId,cashToLoad:+f.cashToLoad,localDate})});
      setMsg('Daily job assigned successfully.');
      setTerminal();setF({agentId:'',cashToLoad:'',dueAt:'',note:''});
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
      {bal&&<div className={'balance-banner '+(bal.available<=0?'balance-warn':'balance-ok')}>
        <div>
          <small>AVAILABLE CASH TODAY</small>
          <strong>{money(bal.available)}</strong>
        </div>
        <div style={{fontSize:12,color:'inherit',opacity:.8,lineHeight:1.6}}>
          Withdrawn {money(bal.withdrawn)} &nbsp;·&nbsp;
          Dispatched {money(bal.dispatched)} &nbsp;·&nbsp;
          Returned {money(bal.returned)}
        </div>
      </div>}

      <form className="find-terminal" onSubmit={find}>
        <input placeholder="Terminal ID e.g. CA101618" value={terminalId} onChange={e=>setTerminalId(e.target.value.toUpperCase())}/>
        <button>Check ATM</button>
      </form>

      {terminal&&<div className="terminal-snapshot">
        <div><small>AVAILABLE TERMINAL</small><b>{terminal.terminalId}</b></div>
        <div><small>CURRENT LOCATION</small><b>{terminal.current?.businessName}</b><span>{terminal.current?.address}</span></div>
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
            <input type="date" required value={f.dueAt} onChange={e=>setF({...f,dueAt:e.target.value})}/>
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
