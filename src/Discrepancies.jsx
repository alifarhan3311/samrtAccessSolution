import React,{useEffect,useState}from'react';
import LoadingSpinner from './LoadingSpinner.jsx';
const req=async(p,o={})=>{const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`,...(o.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Request failed');return d};
const money=v=>'$'+Number(v||0).toLocaleString();
const fmt=v=>v?new Date(v).toLocaleDateString('en-CA',{dateStyle:'medium'}):'—';

export default function Discrepancies(){
  const[data,setData]=useState({items:[],openCount:0,totalShortfall:0});
  const[statusFilter,setStatusFilter]=useState('open');
  const[loading,setLoading]=useState(true);
  const[resolving,setResolving]=useState(null);
  const[resolveForm,setResolveForm]=useState({status:'resolved',resolveNote:''});
  const[msg,setMsg]=useState('');

  const load=()=>{
    setLoading(true);
    req(`/discrepancies?status=${statusFilter}`).then(d=>{setData(d);setLoading(false);}).catch(e=>{setMsg(e.message);setLoading(false);});
  };
  useEffect(()=>{load();},[statusFilter]);

  async function resolve(e){
    e.preventDefault();
    try{
      await req(`/discrepancies/${resolving._id}`,{method:'PATCH',body:JSON.stringify(resolveForm)});
      setResolving(null);setResolveForm({status:'resolved',resolveNote:''});
      load();
    }catch(e){setMsg(e.message);}
  }

  const shortfalls=data.items.filter(d=>d.discrepancy>0);
  const surpluses=data.items.filter(d=>d.discrepancy<0);

  return <div style={{paddingTop:28}}>
    {loading ? <LoadingSpinner text="Scanning cash discrepancies & shortfall alerts..."/> : <>

    {/* Summary cards */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
      <div style={{background:'#fff',border:'1px solid #e0e4df',borderTop:'3px solid #d76858',borderRadius:12,padding:20}}>
        <small style={{fontSize:10,fontWeight:800,letterSpacing:'1px',color:'#79827c',textTransform:'uppercase'}}>OPEN DISCREPANCIES</small>
        <strong style={{display:'block',font:'800 32px Manrope',margin:'8px 0 4px',color:'#a63e36'}}>{data.openCount}</strong>
        <small style={{color:'#888'}}>Require attention</small>
      </div>
      <div style={{background:'#fff',border:'1px solid #e0e4df',borderTop:'3px solid #e4a327',borderRadius:12,padding:20}}>
        <small style={{fontSize:10,fontWeight:800,letterSpacing:'1px',color:'#79827c',textTransform:'uppercase'}}>TOTAL SHORTFALL</small>
        <strong style={{display:'block',font:'800 32px Manrope',margin:'8px 0 4px',color:'#a07422'}}>{money(data.totalShortfall)}</strong>
        <small style={{color:'#888'}}>Unaccounted cash</small>
      </div>
      <div style={{background:'#fff',border:'1px solid #e0e4df',borderTop:'3px solid #357064',borderRadius:12,padding:20}}>
        <small style={{fontSize:10,fontWeight:800,letterSpacing:'1px',color:'#79827c',textTransform:'uppercase'}}>HOW IT WORKS</small>
        <small style={{display:'block',color:'#555',lineHeight:1.6,marginTop:8,fontSize:12}}>
          On each Excel import, the system compares<br/>
          <b>Agent loaded + Previous balance</b> vs <b>Actual ATM balance</b>.<br/>
          A gap &gt; $50 creates an alert.
        </small>
      </div>
    </div>

    {/* Filter + list */}
    <div style={{background:'#fff',border:'1px solid #e0e4df',borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'16px 20px',borderBottom:'1px solid #edf0ed',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <p style={{margin:0,fontSize:10,fontWeight:800,letterSpacing:'1px',color:'#79827c',textTransform:'uppercase'}}>DISCREPANCY ALERTS</p>
          <h3 style={{font:'700 19px Manrope',margin:'3px 0 0'}}>{data.items.length} records</h3>
        </div>
        <select
          value={statusFilter}
          onChange={e=>setStatusFilter(e.target.value)}
          style={{border:'1px solid #d9dfda',borderRadius:8,padding:'8px 12px',font:'inherit',fontSize:13}}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {msg&&<p style={{color:'#a63e36',padding:'12px 20px',margin:0}}>{msg}</p>}

      {data.items.length===0&&
        <p style={{padding:'40px 20px',textAlign:'center',color:'#888'}}>
          {statusFilter==='open'
            ?'No open discrepancies. System is clean.'
            :`No ${statusFilter} discrepancies found.`}
        </p>}

      {data.items.map(d=>{
        const isShortfall=d.discrepancy>0;
        const borderColor=isShortfall?'#d76858':d.discrepancy<0?'#4a7fd4':'#78909c';
        return <div key={d._id} style={{padding:'18px 20px',borderBottom:'1px solid #edf0ed',borderLeft:`4px solid ${borderColor}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
            <div style={{flex:1,minWidth:200}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <b style={{fontSize:15}}>{d.terminalId}</b>
                <span style={{
                  fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:20,letterSpacing:.5,
                  background:isShortfall?'#fce8e6':'#e8f0fe',
                  color:isShortfall?'#a63e36':'#2a5aaa'
                }}>
                  {isShortfall?'SHORTFALL':'SURPLUS'}
                </span>
                <span style={{fontSize:10,background:'#f0f3f0',borderRadius:20,padding:'3px 8px',color:'#666'}}>
                  {d.status.toUpperCase()}
                </span>
              </div>
              <p style={{margin:'0 0 6px',fontSize:13,color:'#555'}}>{d.job?.businessName||'—'}</p>
              <small style={{color:'#888',fontSize:11}}>
                Detected {fmt(d.detectedAt)} &nbsp;·&nbsp; Agent: <b>{d.agent?.name||'Unknown'}</b>
              </small>
            </div>

            {/* Numbers */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,textAlign:'center',minWidth:380}}>
              {[
                ['PREV BALANCE',d.balanceBeforeJob,'#555'],
                ['AGENT LOADED',d.cashLoadedByAgent,'#267249'],
                ['EXPECTED',d.expectedBalance,'#2a5aaa'],
                ['ACTUAL',d.actualBalance,isShortfall?'#a63e36':'#267249'],
              ].map(([lbl,val,col])=><div key={lbl} style={{background:'#f8faf8',borderRadius:8,padding:'8px 10px'}}>
                <small style={{fontSize:9,fontWeight:800,letterSpacing:.8,color:'#888',textTransform:'uppercase',display:'block'}}>{lbl}</small>
                <strong style={{font:'700 15px Manrope',color:col}}>{money(val)}</strong>
              </div>)}
            </div>

            {/* Discrepancy amount */}
            <div style={{textAlign:'right',minWidth:120}}>
              <small style={{fontSize:10,fontWeight:800,letterSpacing:1,color:'#79827c',textTransform:'uppercase',display:'block'}}>
                {isShortfall?'SHORTFALL':'SURPLUS'}
              </small>
              <strong style={{font:'800 24px Manrope',color:borderColor}}>
                {isShortfall?'-':'++'}{money(Math.abs(d.discrepancy))}
              </strong>
            </div>
          </div>

          {/* Resolve note if resolved */}
          {d.resolveNote&&<div style={{marginTop:10,padding:'8px 12px',background:'#f0faf4',borderRadius:8,fontSize:12,color:'#267249'}}>
            <b>Resolution note:</b> {d.resolveNote} — <em>{d.resolvedBy?.name}</em>
          </div>}

          {/* Action buttons */}
          {d.status==='open'&&<div style={{marginTop:12,display:'flex',gap:8}}>
            <button
              onClick={()=>{setResolving(d);setResolveForm({status:'resolved',resolveNote:''});}}
              style={{border:0,borderRadius:7,background:'#183d36',color:'#fff',padding:'8px 14px',fontWeight:700,fontSize:12,cursor:'pointer'}}>
              Mark resolved ✓
            </button>
            <button
              onClick={()=>{setResolving(d);setResolveForm({status:'dismissed',resolveNote:''});}}
              style={{border:'1px solid #d9dfda',borderRadius:7,background:'#fff',color:'#555',padding:'8px 14px',fontWeight:600,fontSize:12,cursor:'pointer'}}>
              Dismiss
            </button>
          </div>}
        </div>;
      })}
    </div>

    {/* Resolve modal */}
    {resolving&&<div className="overlay" onClick={()=>setResolving(null)}>
      <div className="job-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
        <button className="close" onClick={()=>setResolving(null)}>&#215;</button>
        <p className="eyebrow">{resolveForm.status==='resolved'?'RESOLVE':'DISMISS'} DISCREPANCY</p>
        <h3 style={{font:'700 20px Manrope',margin:'4px 0 4px'}}>{resolving.terminalId}</h3>
        <p style={{color:'#666',fontSize:13,margin:'0 0 16px'}}>
          {resolveForm.status==='resolved'
            ?'Mark this discrepancy as resolved — cash has been accounted for.'
            :'Dismiss this alert — no action required.'}
          &nbsp;Discrepancy: <b style={{color:'#a63e36'}}>{money(Math.abs(resolving.discrepancy))}</b>
        </p>
        <form onSubmit={resolve} style={{display:'flex',flexDirection:'column',gap:14}}>
          <label style={{fontSize:13,fontWeight:700,display:'flex',flexDirection:'column',gap:7}}>
            {resolveForm.status==='resolved'?'Resolution note':'Dismiss reason'} (optional)
            <textarea
              value={resolveForm.resolveNote}
              onChange={e=>setResolveForm(p=>({...p,resolveNote:e.target.value}))}
              placeholder={resolveForm.status==='resolved'?'e.g. Agent returned $200 cash separately':'e.g. ATM had a transaction during loading period'}
              style={{border:'1px solid #d9dfda',borderRadius:8,padding:10,font:'inherit',minHeight:70,resize:'vertical'}}/>
          </label>
          <button style={{border:0,borderRadius:8,background:resolveForm.status==='resolved'?'#183d36':'#6b7280',color:'#fff',padding:'12px',fontWeight:700,cursor:'pointer'}}>
            {resolveForm.status==='resolved'?'Confirm resolved ✓':'Confirm dismiss'}
          </button>
        </form>
      </div>
    </div>}
    </>}
  </div>;
}
