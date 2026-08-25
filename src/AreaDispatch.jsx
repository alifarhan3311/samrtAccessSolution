import React,{useEffect,useState}from'react';
const req=async(p,o={})=>{const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`,...o.headers}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Request failed');return d};
const money2=v=>'$'+Number(v||0).toLocaleString();

export default function AreaDispatch({done}){
  const[areas,setAreas]=useState([]);
  const[agents,setAgents]=useState([]);
  const[area,setArea]=useState('');
  const[terminals,setTerminals]=useState([]);
  const[selected,setSelected]=useState([]);
  const[cashOverrides,setCashOverrides]=useState({});
  const[form,setForm]=useState({agentId:'',dueAt:'',note:''});
  const[msg,setMsg]=useState('');
  const[bal,setBal]=useState(null);

  useEffect(()=>{
    Promise.all([req('/location-areas'),req('/users/agents'),req('/cash/available').catch(()=>null)])
      .then(([a,g,b])=>{setAreas(a);setAgents(g);if(b)setBal(b);});
  },[]);

  async function choose(value){
    setArea(value);setSelected([]);setTerminals([]);setCashOverrides({});setMsg('');
    if(!value)return;
    const items=await req('/location-areas/'+encodeURIComponent(value)+'/terminals');
    setTerminals(items);
    setSelected(items.filter(t=>!t.activeJob&&t.official?.status!=='Inactive').map(t=>t.terminalId));
    // set default cash overrides from requiredCash
    const defaults={};
    items.forEach(t=>{ defaults[t.terminalId]=t.requiredCash||0; });
    setCashOverrides(defaults);
  }

  function toggle(id){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}

  function setCash(terminalId, value){
    const num=Math.max(0,Number(value)||0);
    setCashOverrides(prev=>({...prev,[terminalId]:num}));
  }

  async function send(e){
    e.preventDefault();
    try{
      const result=await req('/jobs/dispatch-area',{method:'POST',body:JSON.stringify({
        ...form,
        locationArea:area,
        terminalIds:selected,
        cashOverrides, // per-terminal cash amounts
      })});
      setMsg(`${result.assigned} ATMs assigned. Total cash to handover: $${result.totalCash.toLocaleString()}. ${result.skippedLocked} locked ATM(s) skipped.`);
      setTimeout(()=>done?.(),1200);
    }catch(e){setMsg(e.message);}
  }

  const total=selected.reduce((s,id)=>s+(cashOverrides[id]||0),0);
  const available=bal?.available??null;
  const overBudget=available!==null&&total>available;

  return <main className="area-page">
    <section className="area-control">
      <p className="eyebrow">ROUTE PLANNER</p>
      <h2>Assign a complete Location Area</h2>
      <p>Select North A, West C or another operational area. Every available ATM in its cities becomes part of the agent's route.</p>

      {/* Available balance banner */}
      {bal&&<div className={'balance-banner '+(bal.available<=0?'balance-warn':'balance-ok')} style={{marginBottom:16}}>
        <div><small>AVAILABLE CASH TODAY</small><strong>{money2(bal.available)}</strong></div>
        <div style={{fontSize:12,opacity:.8,lineHeight:1.6}}>
          Withdrawn {money2(bal.withdrawn)} &nbsp;·&nbsp;
          Dispatched {money2(bal.dispatched)} &nbsp;·&nbsp;
          Returned {money2(bal.returned)}
        </div>
      </div>}
      <div className="area-fields">
        <label>Location Area
          <select value={area} onChange={e=>choose(e.target.value)}>
            <option value="">Select area...</option>
            {areas.map(a=><option key={a.name} value={a.name}>{a.name} — {a.terminals} ATMs</option>)}
          </select>
        </label>
        <label>Assign Agent
          <select value={form.agentId} onChange={e=>setForm({...form,agentId:e.target.value})} required>
            <option value="">Select agent...</option>
            {agents.map(a=><option key={a._id} value={a._id}>{a.name} — {a.openJobs} open jobs</option>)}
          </select>
        </label>
        <label>Complete before
          <input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})} required/>
        </label>
      </div>
    </section>

    {area&&<form onSubmit={send}>
      <div className="route-summary">
        <div><small>AREA</small><b>{area}</b></div>
        <div><small>CITIES</small><b>{[...new Set(terminals.map(t=>t.current?.city||t.official?.city).filter(Boolean))].join(', ')||'Not available'}</b></div>
        <div><small>SELECTED ATMs</small><b>{selected.length}</b></div>
        <div><small>TOTAL CASH TO HANDOVER</small><b style={{color:overBudget?'#a63e36':'inherit'}}>{money2(total)}{overBudget?` ⚠ exceeds ${money2(available)} available`:''}</b></div>
      </div>

      <div className="area-list">
        <div className="area-list-head">
          <h3>ATM route checklist</h3>
          <button type="button" onClick={()=>setSelected(terminals.filter(t=>!t.activeJob&&t.official?.status!=='Inactive').map(t=>t.terminalId))}>Select all available active</button>
        </div>

        {terminals.map(t=>{
          const isInactive=t.official?.status==='Inactive';
          const isDisabled=Boolean(t.activeJob||isInactive);
          const isSelected=selected.includes(t.terminalId);
          return <label key={t.terminalId} className={isDisabled?'locked-atm':''}>
            <input type="checkbox" disabled={isDisabled} checked={isSelected} onChange={()=>toggle(t.terminalId)}/>
            <div>
              <b>{t.terminalId} · {t.current?.businessName||t.official?.name} {isInactive&&<span style={{color:'#a63e36',fontSize:11,fontWeight:800,marginLeft:6}}>(INACTIVE)</span>}</b>
              <span>{t.current?.address||t.official?.address} · {t.current?.city||t.official?.city}</span>
            </div>
            <section>
              <small>WISH / BALANCE</small>
              <b>${(t.official?.wishAmount||0).toLocaleString()} / ${(t.official?.cashBalance||0).toLocaleString()}</b>
            </section>
            {isInactive
              ? <strong style={{color:'#a63e36'}}>Inactive — Activate first</strong>
              : t.activeJob
              ? <strong style={{color:'#999'}}>Assigned: {t.activeJob.agent?.name}</strong>
              : <div className="cash-override">
                  <small>CASH TO LOAD (CAD)</small>
                  <input
                    type="number"
                    min="0"
                    step="20"
                    value={cashOverrides[t.terminalId]??t.requiredCash??0}
                    onChange={e=>setCash(t.terminalId,e.target.value)}
                    disabled={!isSelected}
                    onClick={e=>e.stopPropagation()}
                    style={{width:'110px',padding:'4px 8px',fontWeight:'700',fontSize:'14px',border:'1.5px solid #ccc',borderRadius:'6px',textAlign:'right'}}
                  />
                </div>
            }
          </label>;
        })}
      </div>

      <label className="route-note">Route instructions
        <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
      </label>
      {msg&&<p className={msg.includes('assigned')?'success':'error'}>{msg}</p>}
      <button className="dispatch-area" disabled={!selected.length||!form.agentId||!form.dueAt||overBudget}>
        {overBudget
          ?`Insufficient balance — need ${money2(total-available)} more`
          :'Dispatch area route →'}
      </button>
    </form>}
  </main>;
}
