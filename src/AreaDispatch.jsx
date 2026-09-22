import React,{useEffect,useState}from'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getTorontoDateString, isOlderThan3Days } from './timezone';
const req=async(p,o={})=>{const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`,...o.headers}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Request failed');return d};
const money2=v=>'$'+Number(v||0).toLocaleString();
const fmt=v=>v?getTorontoDateString(v):'N/A';

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
  const[form,setForm]=useState({agentId:'',dueAt:getTorontoDateString(),note:''});
  const[msg,setMsg]=useState('');
  const[bal,setBal]=useState(null);
  const[loadingTerminals,setLoadingTerminals]=useState(false);
  const[initialLoading,setInitialLoading]=useState(true);
  const[showSingleDispatch, setShowSingleDispatch] = useState(false);
  const[submitting, setSubmitting] = useState(false);

  const [ticketModal, setTicketModal] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [tForm, setTForm] = useState({ problem: '', assignedTo: '' });
  const [tSubmitting, setTSubmitting] = useState(false);

  async function handleCreateTicket(e) {
    e.preventDefault();
    setTSubmitting(true);
    try {
      await req('/tickets', {
        method: 'POST',
        body: JSON.stringify({ terminalId: ticketModal, problem: tForm.problem, assignedTo: tForm.assignedTo || undefined })
      });
      setMsg(`Ticket generated successfully for ${ticketModal}!`);
      setTicketModal(null);
      setTForm({ problem: '', assignedTo: '' });
    } catch(err) {
      alert(err.message);
    } finally {
      setTSubmitting(false);
    }
  }

  useEffect(()=>{
    const localDate=getTorontoDateString();
    Promise.all([
      req('/location-areas'),
      req(`/users/agents?date=${localDate}`),
      req(`/cash/available?localDate=${localDate}`).catch(()=>null)
    ])
      .then(([a,g,b])=>{setAreas(a);setAgents(g);if(b)setBal(b);})
      .finally(()=>setInitialLoading(false));
  },[]);

  useEffect(() => {
    const closeDropdown = () => setOpenDropdown(null);
    window.addEventListener('click', closeDropdown);
    return () => window.removeEventListener('click', closeDropdown);
  }, []);

  async function loadTerminalsForAreas(areaList, targetDate = form.dueAt, keepMsg = false){
    setSelectedAreas(areaList);setSelected([]);setTerminals([]);setCashOverrides({});setAgentOverrides({});setNoteOverrides({});
    if(!keepMsg)setMsg('');
    if(!areaList.length)return;
    setLoadingTerminals(true);
    try{
      const param=encodeURIComponent(areaList.join(','));
      const dateParam=targetDate ? `?date=${encodeURIComponent(targetDate)}` : '';
      const items=await req('/location-areas/'+param+'/terminals'+dateParam);
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

  function handleDateChange(newDate){
    setForm(prev=>({...prev, dueAt: newDate}));
    if(newDate){
      req(`/users/agents?date=${newDate}`).then(setAgents).catch(()=>{});
      if(selectedAreas.length){
        loadTerminalsForAreas(selectedAreas, newDate);
      }
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
    if(submitting) return;
    setSubmitting(true);
    try{
      const localDate=getTorontoDateString();
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
      loadTerminalsForAreas(selectedAreas, form.dueAt, true);
      req(`/cash/available?localDate=${localDate}`).then(setBal).catch(()=>{});
    }catch(e){setMsg(e.message);}finally{setSubmitting(false);}
  }

  const total=selected.reduce((s,id)=>s+(cashOverrides[id]||0),0);
  const available=bal?.available??null;
  const overBudget=available!==null&&total>available;
  const allAssigned=selected.length>0 && selected.every(id => Boolean(agentOverrides[id] || form.agentId));

  const selectableTerminals = terminals.filter(t => !t.activeJob && t.official?.status !== 'Inactive');
  const allSelected = selectableTerminals.length > 0 && selectableTerminals.every(t => selected.includes(t.terminalId));
  const someSelected = selectableTerminals.some(t => selected.includes(t.terminalId));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(selectableTerminals.map(t => t.terminalId));
    }
  }

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
      {bal&&<div className={'balance-banner '+(bal.available<=0?'balance-warn':'balance-ok')} style={{marginBottom:16,padding:'14px 18px'}}>
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
            <strong style={{fontSize:24,display:'block',marginTop:2}}>{money2(bal.available)}</strong>
          </div>
          <div style={{fontSize:12,opacity:.95,lineHeight:1.6,textAlign:'right'}}>
            <div><b>Previous Days' Cash:</b> {money2(bal.previousBalance || 0)}</div>
            <div>
              <b>Today Withdrawn:</b> {money2(bal.withdrawn)} &nbsp;·&nbsp;
              <b>Dispatched:</b> {money2(bal.dispatched)} &nbsp;·&nbsp;
              <b>Returned:</b> {money2(bal.returned)}
            </div>
          </div>
        </div>
        {bal.withdrawn === 0 && (bal.previousBalance || 0) > 0 && (
          <div style={{fontSize:12,marginTop:8,paddingTop:8,borderTop:'1px dashed rgba(255,255,255,0.3)',opacity:0.95}}>
            ℹ️ No cash was withdrawn from the bank today ($0). You can use the remaining cash from previous days for dispatch.
          </div>
        )}
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

      <div className="area-fields area-fields-2col" style={{position: 'relative', zIndex: openDropdown === 'global' ? 100 : 2}}>
        <label style={{position:'relative'}}>Default Agent (Sets for all ATMs)
          <div className="custom-select-pill" style={{marginTop: 7, height: 42, background: '#fff', border: '1px solid #d8dfda', borderRadius: 8, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative'}} onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'global' ? null : 'global'); }}>
            <div className="custom-select-value" style={{fontSize: 14, fontWeight: 500}}>
              {form.agentId ? agents.find(a => a._id === form.agentId)?.name || 'Select default agent...' : 'Select default agent...'}
            </div>
            <span className="agent-chevron" style={{ position: 'static', transform: openDropdown === 'global' ? 'rotate(180deg)' : 'none', marginLeft: 'auto' }}>▾</span>
            
            {openDropdown === 'global' && (
              <div className="custom-agent-dropdown" style={{ top: '100%', marginTop: 4 }}>
                <div className="agent-option" onClick={() => handleGlobalAgentChange('')}>
                  <span style={{opacity:0.6}}>Select default agent...</span>
                </div>
                {agents.map(a => (
                  <div key={a._id} className={`agent-option ${form.agentId === a._id ? 'selected' : ''}`} onClick={() => handleGlobalAgentChange(a._id)}>
                    {a.name} <span style={{marginLeft: 8, fontSize: 10, color: '#7f8983', fontWeight: 500}}>— {a.openJobs} open jobs</span>
                    {form.agentId === a._id && <span style={{marginLeft:'auto', color:'#10b981'}}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </label>
        <label>Complete before
          <input type="date" value={form.dueAt} onChange={e=>handleDateChange(e.target.value)} required/>
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
        <div className="area-list-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="checkbox"
              id="selectAllAtms"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={toggleSelectAll}
              disabled={selectableTerminals.length === 0}
              style={{
                width: 18,
                height: 18,
                cursor: selectableTerminals.length === 0 ? 'not-allowed' : 'pointer',
                accentColor: '#183d36',
                margin: 0
              }}
              title={allSelected ? "Deselect all" : "Select all available active"}
            />
            <label htmlFor="selectAllAtms" style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, font: '700 18px Manrope', color: '#173e36' }}>ATM route checklist</h3>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: allSelected ? '#15803d' : someSelected ? '#0369a1' : '#64748b',
                background: allSelected ? '#dcfce7' : someSelected ? '#e0f2fe' : '#f1f5f3',
                padding: '2px 8px',
                borderRadius: 12
              }}>
                {allSelected ? '✓ All Selected' : someSelected ? `${selected.length}/${selectableTerminals.length} Selected` : 'Select All'}
              </span>
            </label>
          </div>
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={selectableTerminals.length === 0}
            style={{
              border: 0,
              background: 'none',
              color: '#286658',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
              textDecoration: 'underline'
            }}
          >
            {allSelected ? 'Deselect all' : 'Select all available active'}
          </button>
        </div>

        {terminals.map(t=>{
          const isInactive=t.official?.status==='Inactive';
          const isDisabled=Boolean(t.activeJob||isInactive);
          const isSelected=selected.includes(t.terminalId);
          const currentCad=cashOverrides[t.terminalId]??t.requiredCash??0;
          const currentBills=Math.floor(currentCad/20);
          const assignedAgent=agentOverrides[t.terminalId]||form.agentId||'';

          const commOutdated = isOlderThan3Days(t.official?.lastCommunication);
          const withOutdated = isOlderThan3Days(t.official?.lastWithdrawalAt);
          const isDisconnected = commOutdated || withOutdated;

          return <div key={t.terminalId} className={`area-atm-row ${isDisabled?'locked-atm':''}`} style={{ ...(isDisconnected ? { background: '#fef2f2', border: '1px solid #f87171', borderLeft: '5px solid #ef4444' } : {}), position: 'relative', zIndex: openDropdown === t.terminalId ? 50 : 1 }}>
            <input type="checkbox" disabled={isDisabled} checked={isSelected} onChange={()=>toggle(t.terminalId)}/>
            <div>
              <b>{t.terminalId} · {t.official?.tempName || t.official?.name} {isInactive&&<span style={{color:'#a63e36',fontSize:11,fontWeight:800,marginLeft:6}}>(INACTIVE)</span>}</b>
              <span>{t.current?.address||t.official?.address} · {t.current?.city||t.official?.city} &nbsp; <span style={{background:'#edf2f0',padding:'1px 6px',borderRadius:8,fontWeight:700,fontSize:10,color:'#357064'}}>{t.official?.locationArea}</span></span>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: '#555', alignItems: 'center' }}>
                <span>Last Withdrawal: <strong style={{color: withOutdated ? '#dc2626' : '#183d36'}}>{fmt(t.official?.lastWithdrawalAt)}</strong></span>
                <span>Last Comm: <strong style={{color: commOutdated ? '#dc2626' : '#183d36'}}>{t.official?.lastCommunication || 'N/A'}</strong></span>
                <button type="button" onClick={() => setTicketModal(t.terminalId)} style={{ padding: '2px 8px', fontSize: 10, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>🎫 Create Ticket</button>
              </div>
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
                {t.activeJob.dueAt && <small style={{color:'#a5b0aa', fontSize: '10px', marginTop: '2px'}}>Due: {getTorontoDateString(t.activeJob.dueAt)}</small>}
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
                  <div className={`agent-pill-box custom-select-pill ${assignedAgent ? 'has-agent' : ''} ${!isSelected ? 'disabled' : ''}`}
                       onClick={(e) => { e.stopPropagation(); if (isSelected) setOpenDropdown(openDropdown === t.terminalId ? null : t.terminalId); }}
                  >
                    <span className="agent-avatar-icon">👤</span>
                    <div className="custom-select-value">
                      {assignedAgent ? agents.find(a => a._id === assignedAgent)?.name || 'Choose Agent...' : 'Choose Agent...'}
                    </div>
                    <span className="agent-chevron" style={{ transform: openDropdown === t.terminalId ? 'rotate(180deg)' : 'none' }}>▾</span>
                    
                    {openDropdown === t.terminalId && (
                      <div className="custom-agent-dropdown">
                        <div className="agent-option" onClick={() => handleRowAgentChange(t.terminalId, '')}>
                          <span style={{opacity:0.6}}>Choose Agent...</span>
                        </div>
                        {agents.map(a => (
                          <div key={a._id} className={`agent-option ${assignedAgent === a._id ? 'selected' : ''}`} onClick={() => handleRowAgentChange(t.terminalId, a._id)}>
                            {a.name}
                            {assignedAgent === a._id && <span style={{marginLeft:'auto', color:'#10b981'}}>✓</span>}
                          </div>
                        ))}
                      </div>
                    )}
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
      {overBudget&&!submitting&&(
        <div style={{background:'#fff3cd',border:'1px solid #ffc107',borderRadius:8,padding:'10px 14px',marginBottom:8,fontSize:13,color:'#856404',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:16}}>⚠️</span>
          <span><b>Balance Warning:</b> Dispatching <b>{money2(total)}</b> but only <b>{money2(available)}</b> available. Balance will go negative by <b>{money2(total-available)}</b>.</span>
        </div>
      )}
      <button className="dispatch-area" disabled={!selected.length||!allAssigned||!form.dueAt||submitting}>
        {submitting
          ?'Dispatching Route...'
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

    {/* Modal Overlay for Ticket Creation */}
    {ticketModal && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999, padding: '20px'
      }}>
        <div style={{
          background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px',
          display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Create Ticket for {ticketModal}</h3>
            <button onClick={() => setTicketModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
          </div>
          <form onSubmit={handleCreateTicket} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Describe Problem
              <textarea 
                required 
                rows="4" 
                value={tForm.problem} 
                onChange={e => setTForm({ ...tForm, problem: e.target.value })}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical' }}
                placeholder="e.g. Bill jam, offline, card reader issue..."
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Assign Agent (Optional)
              <select 
                value={tForm.assignedTo} 
                onChange={e => setTForm({ ...tForm, assignedTo: e.target.value })}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              >
                <option value="">-- Leave Unassigned --</option>
                {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" onClick={() => setTicketModal(null)} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={tSubmitting} style={{ padding: '8px 16px', background: '#b45309', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                {tSubmitting ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

  </main>;
}
