import React,{useEffect,useState}from'react';
import LoadingSpinner from './LoadingSpinner.jsx';
const req=async(p,o={})=>{const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`,...o.headers}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Request failed');return d};
const money2=v=>'$'+Number(v||0).toLocaleString();
const fmt=v=>v?new Date(v).toLocaleDateString('en-CA'):'N/A';

import DailyDispatch from './DailyDispatch.jsx';

export default function AreaDispatch({done}){
  const[areas,setAreas]=useState([]);
  const[agents,setAgents]=useState([]);
  const[selectedAreas,setSelectedAreas]=useState([]);
  const[terminals,setTerminals]=useState([]);
  const[selected,setSelected]=useState([]);
  const[cashOverrides,setCashOverrides]=useState({});
  const[agentOverrides,setAgentOverrides]=useState({});
  const[noteOverrides,setNoteOverrides]=useState({});
  const[form,setForm]=useState({agentId:'',dueAt:'',note:''});
  const[msg,setMsg]=useState('');
  const[bal,setBal]=useState(null);
  const[loadingTerminals,setLoadingTerminals]=useState(false);
  const[initialLoading,setInitialLoading]=useState(true);
  const[showSingleDispatch, setShowSingleDispatch] = useState(false);

  useEffect(()=>{
    const ld=new Date();const localDate=`${ld.getFullYear()}-${String(ld.getMonth()+1).padStart(2,'0')}-${String(ld.getDate()).padStart(2,'0')}`;
    Promise.all([req('/location-areas'),req('/users/agents'),req(`/cash/available?localDate=${localDate}`).catch(()=>null)])
      .then(([a,g,b])=>{setAreas(a);setAgents(g);if(b)setBal(b);})
      .finally(()=>setInitialLoading(false));
  },[]);

  async function loadTerminalsForAreas(areaList){
    setSelectedAreas(areaList);setSelected([]);setTerminals([]);setCashOverrides({});setAgentOverrides({});setNoteOverrides({});setMsg('');
    if(!areaList.length)return;
    setLoadingTerminals(true);
    try{
      const param=encodeURIComponent(areaList.join(','));
      const items=await req('/location-areas/'+param+'/terminals');
      setTerminals(items);
      const activeIds=items.filter(t=>!t.activeJob&&t.official?.status!=='Inactive').map(t=>t.terminalId);
      setSelected(activeIds);
      const defaultCash={};
      const defaultAgents={};
      const defaultNotes={};
      items.forEach(t=>{
        defaultCash[t.terminalId]=t.requiredCash||0;
        if(form.agentId) defaultAgents[t.terminalId]=form.agentId;
        defaultNotes[t.terminalId]='';
      });
      setCashOverrides(defaultCash);
      setAgentOverrides(defaultAgents);
      setNoteOverrides(defaultNotes);
    }catch(e){
      setMsg(e.message);
    }finally{
      setLoadingTerminals(false);
    }
  }

  function toggleArea(areaName){
    const nextAreas=selectedAreas.includes(areaName)
      ? selectedAreas.filter(a=>a!==areaName)
      : [...selectedAreas, areaName];
    loadTerminalsForAreas(nextAreas);
  }

  function handleGlobalAgentChange(globalAgentId){
    setForm(prev=>({...prev, agentId: globalAgentId}));
    if(globalAgentId){
      setAgentOverrides(prev=>{
        const next={...prev};
        terminals.forEach(t=>{ next[t.terminalId] = globalAgentId; });
        return next;
      });
    }
  }

  function handleRowAgentChange(terminalId, targetAgentId){
    setAgentOverrides(prev=>({...prev, [terminalId]: targetAgentId}));
  }

  function toggle(id){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}

  function setBills(terminalId, billsCount){
    const bills=Math.max(0,parseInt(billsCount,10)||0);
    const totalCad=bills*20;
    setCashOverrides(prev=>({...prev,[terminalId]:totalCad}));
  }

  async function send(e){
    e.preventDefault();
    try{
      const ld=new Date();const localDate=`${ld.getFullYear()}-${String(ld.getMonth()+1).padStart(2,'0')}-${String(ld.getDate()).padStart(2,'0')}`;
      const result=await req('/jobs/dispatch-area',{method:'POST',body:JSON.stringify({
        ...form,
        locationAreas:selectedAreas,
        locationArea:selectedAreas.join(', '),
        terminalIds:selected,
        cashOverrides,
        agentOverrides,
        noteOverrides,
        localDate
      })});
      setMsg(`${result.assigned} ATMs assigned across ${selectedAreas.length} area(s). Total cash: $${result.totalCash.toLocaleString()}. ${result.skippedLocked} locked ATM(s) skipped.`);
      setTimeout(()=>done?.(),1200);
    }catch(e){setMsg(e.message);}
  }

  const total=selected.reduce((s,id)=>s+(cashOverrides[id]||0),0);
  const available=bal?.available??null;
  const overBudget=available!==null&&total>available;
  const allAssigned=selected.length>0 && selected.every(id => Boolean(agentOverrides[id] || form.agentId));

  if(initialLoading) return <LoadingSpinner text="Loading route planning data..."/>;

  return <main className="area-page">
    <section className="area-control">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <div>
          <p className="eyebrow">ROUTE PLANNER</p>
          <h2 style={{margin:'4px 0 0'}}>Assign Location Area Routes</h2>
        </div>
        <button 
          onClick={() => setShowSingleDispatch(true)}
          style={{
            background:'#f1f3ef', border:'1px solid #dce1dc', color:'#17211f',
            padding:'8px 16px', borderRadius:'8px', fontWeight:600, fontSize:'13px', cursor:'pointer'
          }}
        >
          ↗ Single ATM dispatch
        </button>
      </div>
      <p style={{marginTop:0}}>Select one or multiple operational areas (e.g. North A, West C). All available ATMs in the selected areas become part of the agent's route.</p>

      {/* Available balance banner */}
      {bal&&<div className={'balance-banner '+(bal.available<=0?'balance-warn':'balance-ok')} style={{marginBottom:16}}>
        <div><small>AVAILABLE CASH TODAY</small><strong>{money2(bal.available)}</strong></div>
        <div style={{fontSize:12,opacity:.8,lineHeight:1.6}}>
          Withdrawn {money2(bal.withdrawn)} &nbsp;·&nbsp;
          Dispatched {money2(bal.dispatched)} &nbsp;·&nbsp;
          Returned {money2(bal.returned)}
        </div>
      </div>}

      <div style={{marginBottom:16}}>
        <label style={{fontSize:12,fontWeight:700,display:'block',marginBottom:8,color:'#183d36'}}>
          SELECT LOCATION AREAS (1 OR MULTIPLE)
        </label>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {areas.map(a=>{
            const isSelected=selectedAreas.includes(a.name);
            return <button
              key={a.name}
              type="button"
              onClick={()=>toggleArea(a.name)}
              disabled={loadingTerminals}
              style={{
                border:isSelected?'2px solid #183d36':'1px solid #d8dfda',
                background:isSelected?'#183d36':'#fff',
                color:isSelected?'#fff':'#333',
                padding:'8px 14px',
                borderRadius:20,
                cursor:'pointer',
                fontWeight:700,
                fontSize:13,
                display:'flex',
                alignItems:'center',
                gap:6,
                transition:'all .15s ease'
              }}
            >
              <span>{isSelected?'✓':'+'}</span>
              <b>{a.name}</b>
              <span style={{fontSize:11,opacity:isSelected?.9:.6,background:isSelected?'#ffffff25':'#f0f4f1',padding:'2px 6px',borderRadius:10,color:isSelected?'#fff':'#555'}}>
                {a.terminals} ATMs
              </span>
            </button>;
          })}
        </div>
      </div>

      <div className="area-fields area-fields-2col">
        <label>Default Agent (Sets for all ATMs)
          <select value={form.agentId} onChange={e=>handleGlobalAgentChange(e.target.value)}>
            <option value="">Select default agent...</option>
            {agents.map(a=><option key={a._id} value={a._id}>{a.name} — {a.openJobs} open jobs</option>)}
          </select>
        </label>
        <label>Complete before
          <input type="date" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})} required/>
        </label>
      </div>
    </section>

    {loadingTerminals&&<div className="area-loading-card">
      <div className="area-spinner"></div>
      <p>Fetching ATMs and building route checklist for <b>{selectedAreas.join(', ')}</b>...</p>
    </div>}

    {selectedAreas.length>0&&!loadingTerminals&&<form onSubmit={send}>
      <div className="route-summary">
        <div><small>SELECTED AREAS</small><b>{selectedAreas.join(', ')}</b></div>
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
          const currentCad=cashOverrides[t.terminalId]??t.requiredCash??0;
          const currentBills=Math.floor(currentCad/20);
          const assignedAgent=agentOverrides[t.terminalId]||form.agentId||'';

          return <div key={t.terminalId} className={`area-atm-row ${isDisabled?'locked-atm':''}`}>
            <input type="checkbox" disabled={isDisabled} checked={isSelected} onChange={()=>toggle(t.terminalId)}/>
            <div>
              <b>{t.terminalId} · {t.official?.tempName || t.official?.name} {isInactive&&<span style={{color:'#a63e36',fontSize:11,fontWeight:800,marginLeft:6}}>(INACTIVE)</span>}</b>
              <span>{t.current?.address||t.official?.address} · {t.current?.city||t.official?.city} &nbsp; <span style={{background:'#edf2f0',padding:'1px 6px',borderRadius:8,fontWeight:700,fontSize:10,color:'#357064'}}>{t.official?.locationArea}</span></span>
              <span style={{marginTop:2}}>Last Withdrawal: <strong style={{color:'#183d36'}}>{fmt(t.official?.lastWithdrawalAt)}</strong></span>
            </div>
            <section>
              <small>WISH / BALANCE</small>
              <b>${(t.official?.wishAmount||0).toLocaleString()} / ${(t.official?.cashBalance||0).toLocaleString()}</b>
            </section>
            <section>
              <small>BILLS ($20s)</small>
              <b style={{color:'#183d36'}}>{Math.floor((t.official?.wishAmount||0)/20)} / {Math.floor((t.official?.cashBalance||0)/20)}</b>
            </section>

            {isInactive ? (
              <strong style={{color:'#a63e36', gridColumn: 'span 3', textAlign: 'right'}}>Inactive — Activate first</strong>
            ) : t.activeJob ? (
              <div style={{gridColumn: 'span 3', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                <strong style={{color:'#999'}}>Assigned: {t.activeJob.agent?.name}</strong>
                {t.activeJob.dueAt && <small style={{color:'#a5b0aa', fontSize: '10px', marginTop: '2px'}}>Due: {new Date(t.activeJob.dueAt).toLocaleDateString('en-CA')}</small>}
              </div>
            ) : (
              <>
                <div className="agent-select-wrap">
                  <small className="agent-select-label">COMMENT (OPTIONAL)</small>
                  <input
                    type="text"
                    placeholder="Note for agent..."
                    value={noteOverrides[t.terminalId]||''}
                    onChange={e=>setNoteOverrides(prev=>({...prev,[t.terminalId]:e.target.value}))}
                    disabled={!isSelected}
                    onClick={e=>e.stopPropagation()}
                    style={{width:'100%',padding:'6px 10px',borderRadius:'16px',border:'1.5px solid #d0dad5',fontSize:12,outline:'none',background:!isSelected?'#f1f5f3':'#f8faf9',transition:'all 0.2s',color:'#173e36'}}
                    onFocus={e=>e.target.style.borderColor='#183d36'}
                    onBlur={e=>e.target.style.borderColor='#d0dad5'}
                  />
                </div>
                <div className="agent-select-wrap">
                  <small className="agent-select-label">ASSIGNED AGENT</small>
                  <div className={`agent-pill-box ${assignedAgent ? 'has-agent' : ''} ${!isSelected ? 'disabled' : ''}`}>
                    <span className="agent-avatar-icon">👤</span>
                    <select
                      value={assignedAgent}
                      onChange={e=>handleRowAgentChange(t.terminalId, e.target.value)}
                      disabled={!isSelected}
                      onClick={e=>e.stopPropagation()}
                      required={isSelected}
                    >
                      <option value="">Choose Agent...</option>
                      {agents.map(a=><option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                    <span className="agent-chevron">▾</span>
                  </div>
                </div>

                <div className="cash-override">
                  <small>BILLS TO LOAD (20s)</small>
                  <div className="bills-input-wrap">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={currentBills}
                      onChange={e=>setBills(t.terminalId,e.target.value)}
                      disabled={!isSelected}
                      onClick={e=>e.stopPropagation()}
                    />
                    <span className="cad-equiv">= {money2(currentCad)}</span>
                  </div>
                </div>
              </>
            )}
          </div>;
        })}
      </div>

      <label className="route-note">Route instructions
        <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
      </label>
      {msg&&<p className={msg.includes('assigned')?'success':'error'}>{msg}</p>}
      <button className="dispatch-area" disabled={!selected.length||!allAssigned||!form.dueAt||overBudget}>
        {overBudget
          ?`Insufficient balance — need ${money2(total-available)} more`
          :!allAssigned
          ?'Please select an Agent for all checked ATMs'
          :'Dispatch area route →'}
      </button>
    </form>}

    {/* Modal Overlay for Single ATM Dispatch */}
    {showSingleDispatch && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999, padding: '40px'
      }}>
        <div style={{
          background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '1100px', height: '100%',
          display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden'
        }}>
          <button 
            onClick={() => setShowSingleDispatch(false)}
            style={{
              background: '#f1f3ef', border: 'none', borderBottom: '1px solid #dce1dc', padding: '12px 20px',
              textAlign: 'right', fontWeight: 'bold', color: '#3a443d', cursor: 'pointer'
            }}
          >
            ✖ Close
          </button>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f9faf8' }}>
            <DailyDispatch done={() => setShowSingleDispatch(false)} />
          </div>
        </div>
      </div>
    )}

  </main>;
}
