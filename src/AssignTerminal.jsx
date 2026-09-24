import React,{useEffect,useState}from'react';
const req=async(p,o={})=>{const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`,...o.headers}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Request failed');return d};

export default function AssignTerminal({ initialTerminalId, initialData, readOnly, onDone }){
  const[id,setId]=useState(initialTerminalId||'');
  const[terminal,setTerminal]=useState();
  const[msg,setMsg]=useState('');
  const[f,setF]=useState({businessName:'',address:'',city:'',locationArea:'',wishAmount:2000,paymentAmount:0,note:''});

  async function loadTerminal(terminalId){
    if(!terminalId)return;
    try{
      const t=await req('/terminals/'+terminalId);
      setId(terminalId);
      setTerminal(t);
      setF(x=>({
        ...x,
        businessName:t.official?.tempName||t.current?.businessName||t.original?.businessName||t.official?.name||'',
        address:t.current?.address||t.official?.address||t.original?.address||'',
        city:t.current?.city||t.official?.city||t.original?.city||'',
        locationArea:t.official?.locationArea||'',
        wishAmount:t.official?.wishAmount||2000,
        paymentAmount:t.current?.paymentAmount||0,
        note:''
      }));
      setMsg('');
    }catch(e){setMsg(e.message)}
  }

  useEffect(()=>{
    if(initialTerminalId){
      loadTerminal(initialTerminalId);
    }else{
      const selected=sessionStorage.getItem('configureTerminalId');
      if(selected){
        sessionStorage.removeItem('configureTerminalId');
        loadTerminal(selected);
      }
    }
  },[initialTerminalId]);

  async function save(e){
    e.preventDefault();
    try{
      await req('/terminals/'+terminal.terminalId+'/assign',{
        method:'POST',
        body:JSON.stringify({...f,wishAmount:+f.wishAmount,paymentAmount:+f.paymentAmount})
      });
      setMsg('ATM setup and current location saved successfully.');
      onDone?.(terminal.terminalId);
    }catch(e){setMsg(e.message)}
  }

  return <div className="dispatch-grid">
    <article>
      <p className="eyebrow">ATM MASTER SETUP</p>
      <h3>Find ATM machine</h3>
      <form className="find-terminal" onSubmit={e=>{e.preventDefault();loadTerminal(id)}}>
        <input placeholder="CA101622" value={id} onChange={e=>setId(e.target.value.toUpperCase())}/>
        <button>Find</button>
      </form>
      {terminal&&<div className="immutable">
        <small>ORIGINAL INSTALLATION · ALWAYS READ ONLY</small>
        <b>{terminal.original?.businessName||terminal.official?.name}</b>
        <p>{terminal.original?.address||terminal.official?.address}</p>
      </div>}
      {msg&&<p className={msg.includes('successfully')?'success':'error'}>{msg}</p>}
    </article>
    <article className={!terminal?'locked':''}>
      <p className="eyebrow">LOCATION & PERMANENT CASH RULE</p>
      <h3>Configure current ATM details</h3>

      {terminal && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#92400e', fontSize: 13 }}>
            <span>📋</span> What needs to be set for <b>{terminal.terminalId}</b>:
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#78350f', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(!terminal.official?.wishAmount || terminal.official.wishAmount <= 0) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#b45309', fontWeight: 800 }}>⚠️</span>
                <span><b>Wish Amount:</b> Minimum cash rule is missing or $0. Set wish amount (e.g. $2,000) to activate low-cash alerts.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#15803d', fontWeight: 800 }}>✓</span>
                <span><b>Wish Amount:</b> Configured (${terminal.official.wishAmount.toLocaleString()}).</span>
              </div>
            )}
            {(!f.city || f.city.toLowerCase().includes('unavailable')) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#c2410c', fontWeight: 800 }}>⚠️</span>
                <span><b>City:</b> City is missing or marked unavailable. Set city for area route dispatching.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#15803d', fontWeight: 800 }}>✓</span>
                <span><b>City:</b> {f.city}</span>
              </div>
            )}
            {(!f.address || f.address.toLowerCase().includes('unavailable')) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#b91c1c', fontWeight: 800 }}>⚠️</span>
                <span><b>Address:</b> Physical location address needs verification.</span>
              </div>
            )}
            {terminal.setupReason && (
              <div style={{ marginTop: 2, fontStyle: 'italic', color: '#854d0e' }}>
                Note: {terminal.setupReason}
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={save}>
        <label>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Temp Name / Current Business</span>
            {!f.businessName && <span style={{ fontSize: 10, background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>NEEDS SETUP</span>}
          </span>
          <input required value={f.businessName} onChange={e=>setF({...f,businessName:e.target.value})}/>
        </label>
        <label>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Current Address</span>
            {(!f.address || f.address.toLowerCase().includes('unavailable')) && <span style={{ fontSize: 10, background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>NEEDS SETUP</span>}
          </span>
          <input required value={f.address} onChange={e=>setF({...f,address:e.target.value})}/>
        </label>
        <div className="two">
          <label>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>City</span>
              {(!f.city || f.city.toLowerCase().includes('unavailable')) && <span style={{ fontSize: 10, background: '#ffedd5', color: '#c2410c', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>NEEDS SETUP</span>}
            </span>
            <input required value={f.city} onChange={e=>setF({...f,city:e.target.value})}/>
          </label>
          <label>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Location Area</span>
              {!f.locationArea && <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>NEEDS SETUP</span>}
            </span>
            <input value={f.locationArea} onChange={e=>setF({...f,locationArea:e.target.value})} placeholder="e.g. DOWNTOWN / WEST"/>
          </label>
        </div>
        <div className="two">
          <label>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Wish Amount — minimum cash</span>
              {(!terminal?.official?.wishAmount || terminal?.official?.wishAmount <= 0) && <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>NEEDS SETUP</span>}
            </span>
            <input type="number" min="0" required value={f.wishAmount} onChange={e=>setF({...f,wishAmount:e.target.value})}/>
            <small style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>This stays until ATM setup changes.</span>
              <button
                type="button"
                onClick={()=>setF({...f, wishAmount: 2000})}
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 4, padding: '1px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}
              >
                Quick set $2,000
              </button>
            </small>
          </label>
          <label>
            <span>Payment Amount</span>
            <input type="number" min="0" value={f.paymentAmount} onChange={e=>setF({...f,paymentAmount:e.target.value})}/>
          </label>
        </div>
        <label>Setup / movement note
          <textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})}/>
        </label>
        <button>Save ATM setup →</button>
      </form>
    </article>
  </div>;
}
