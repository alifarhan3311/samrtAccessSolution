import React,{useEffect,useState}from'react';
const req=async(p,o={})=>{const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`,...o.headers}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Request failed');return d};
export default function AreaDispatch({done}){
  const[areas,setAreas]=useState([]),[agents,setAgents]=useState([]),[area,setArea]=useState(''),[terminals,setTerminals]=useState([]),[selected,setSelected]=useState([]),[form,setForm]=useState({agentId:'',dueAt:'',note:''}),[msg,setMsg]=useState('');
  useEffect(()=>{Promise.all([req('/location-areas'),req('/users/agents')]).then(([a,g])=>{setAreas(a);setAgents(g)})},[]);
  async function choose(value){
    setArea(value);setSelected([]);setTerminals([]);setMsg('');
    if(!value)return;
    const items=await req('/location-areas/'+encodeURIComponent(value)+'/terminals');
    setTerminals(items);
    setSelected(items.filter(t=>!t.activeJob).map(t=>t.terminalId));
  }
  function toggle(id){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])}
  async function send(e){e.preventDefault();try{const result=await req('/jobs/dispatch-area',{method:'POST',body:JSON.stringify({...form,locationArea:area,terminalIds:selected})});setMsg(`${result.assigned} ATMs assigned. Total recommended cash: $${result.totalCash.toLocaleString()}. ${result.skippedLocked} locked ATM(s) skipped.`);setTimeout(()=>done?.(),900)}catch(e){setMsg(e.message)}}
  const total=terminals.filter(t=>selected.includes(t.terminalId)).reduce((s,t)=>s+t.requiredCash,0);
  return <main className="area-page">
    <section className="area-control">
      <p className="eyebrow">ROUTE PLANNER</p>
      <h2>Assign a complete Location Area</h2>
      <p>Select North A, West C or another operational area. Every available ATM in its cities becomes part of the agent's route.</p>
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
        <div><small>CITIES</small><b>{[...new Set(terminals.map(t=>t.current?.city).filter(Boolean))].join(', ')||'Not available'}</b></div>
        <div><small>SELECTED ATMs</small><b>{selected.length}</b></div>
        <div><small>RECOMMENDED CASH</small><b>${total.toLocaleString()}</b></div>
      </div>
      <div className="area-list">
        <div className="area-list-head">
          <h3>ATM route checklist</h3>
          <button type="button" onClick={()=>setSelected(terminals.filter(t=>!t.activeJob).map(t=>t.terminalId))}>Select all available</button>
        </div>
        {terminals.map(t=><label key={t.terminalId} className={t.activeJob?'locked-atm':''}>
          <input type="checkbox" disabled={!!t.activeJob} checked={selected.includes(t.terminalId)} onChange={()=>toggle(t.terminalId)}/>
          <div><b>{t.terminalId} · {t.current?.businessName||t.official?.name}</b><span>{t.current?.address} · {t.current?.city}</span></div>
          <section><small>WISH / BALANCE</small><b>${(t.official?.wishAmount||0).toLocaleString()} / ${(t.official?.cashBalance||0).toLocaleString()}</b></section>
          <strong>{t.activeJob?`Assigned: ${t.activeJob.agent?.name}`:`Load $${t.requiredCash.toLocaleString()}`}</strong>
        </label>)}
      </div>
      <label className="route-note">Route instructions<textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label>
      {msg&&<p className={msg.includes('assigned')?'success':'error'}>{msg}</p>}
      <button className="dispatch-area" disabled={!selected.length||!form.agentId||!form.dueAt}>Dispatch area route →</button>
    </form>}
  </main>
}
