import React,{useEffect,useState}from'react';
import LoadingSpinner from './LoadingSpinner.jsx';
const authH=()=>({Authorization:`Bearer ${localStorage.getItem('token')}`});
async function api(path,options={}){
  const r=await fetch('/api'+path,{...options,headers:{...(!options.body||options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...authH(),...(options.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.message||'Request failed');
  return d;
}

const EMPTY_FORM={name:'',email:'',phoneNumber:'',password:'',allowedTabs:['terminals','tickets','jobs','routesheet']};

const ALL_TABS = [
  { id: 'dashboard', label: 'Command Center (Dashboard)' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'terminals', label: 'Terminal Registry' },
  { id: 'tickets', label: 'Generate Ticket' },
  { id: 'area', label: 'Area Route Dispatch' },
  { id: 'jobs', label: 'Daily Agent Load' },
  { id: 'routesheet', label: 'Daily Route Sheet' },
  { id: 'agents', label: 'Agent Management' },
  { id: 'ledger', label: 'Cash Ledger' },
  { id: 'discrepancies', label: 'Cash Discrepancies' },
  { id: 'history', label: 'ATM Movement History' },
  { id: 'logs', label: 'Activity & Audit Logs' },
  { id: 'import', label: 'Official Import' },
  { id: 'atm', label: 'ATM Forms' }
];

export default function AgentManagement(){
  const[agents,setAgents]=useState([]);
  const[showInactive,setShowInactive]=useState(false);
  const[form,setForm]=useState(EMPTY_FORM);
  const[picture,setPicture]=useState(null);
  const[preview,setPreview]=useState(null);
  const[msg,setMsg]=useState('');
  const[saving,setSaving]=useState(false);
  const[loading,setLoading]=useState(true);
  const[editing,setEditing]=useState(null);     // agent being edited
  const[resetting,setResetting]=useState(null);  // agent password reset modal
  const[newPwd,setNewPwd]=useState('');
  const[pwdMsg,setPwdMsg]=useState('');

  const load=()=>{
    setLoading(true);
    api('/users/agents?all=1').then(d=>{setAgents(d);setLoading(false);}).catch(()=>setLoading(false));
  };
  useEffect(()=>{load()},[]);

  const visible=showInactive?agents:agents.filter(a=>a.active!==false);

  function startEdit(agent){
    setEditing(agent);
    setForm({name:agent.name,email:agent.email,phoneNumber:agent.phoneNumber||'',password:'',allowedTabs:agent.allowedTabs||['terminals','tickets','jobs','routesheet']});
    setPicture(null);setPreview(null);setMsg('');
  }
  function cancelEdit(){setEditing(null);setForm(EMPTY_FORM);setPicture(null);setPreview(null);setMsg('');}

  function selectPhoto(file){setPicture(file);setPreview(file?URL.createObjectURL(file):null);}

  async function save(e){
    e.preventDefault();
    if(!editing&&!picture)return setMsg('Profile picture is required.');
    setSaving(true);setMsg('');
    const body=new FormData();
    if(!editing){
      Object.entries(form).forEach(([k,v])=>{
        if(k==='allowedTabs'){
          if(v.length===0) body.append('allowedTabs','');
          else v.forEach(t=>body.append('allowedTabs',t));
        }else{
          body.append(k,v);
        }
      });
      body.append('picture',picture);
    }else{
      if(form.name!==editing.name)body.append('name',form.name);
      if(form.email!==editing.email)body.append('email',form.email);
      if(form.phoneNumber!==editing.phoneNumber)body.append('phoneNumber',form.phoneNumber);
      const currentTabs = editing.allowedTabs || ['terminals','tickets','jobs','routesheet'];
      const tabsChanged = form.allowedTabs.join(',') !== currentTabs.join(',');
      if(tabsChanged){
        if(form.allowedTabs.length===0) body.append('allowedTabs','');
        else form.allowedTabs.forEach(t=>body.append('allowedTabs',t));
      }
      if(picture)body.append('picture',picture);
    }
    try{
      if(!editing){
        await fetch('/api/users/agents',{method:'POST',headers:authH(),body});
        setMsg('Agent account created successfully.');
      }else{
        await fetch(`/api/users/agents/${editing._id}`,{method:'PATCH',headers:authH(),body});
        setMsg('Agent updated successfully.');
      }
      setForm(EMPTY_FORM);setPicture(null);setPreview(null);setEditing(null);load();
    }catch(err){setMsg(err.message);}
    finally{setSaving(false);}
  }

  async function deactivate(agent){
    if(!confirm(`Deactivate ${agent.name}? They cannot log in until reactivated.`))return;
    try{await api(`/users/agents/${agent._id}`,{method:'DELETE'});load();}
    catch(e){setMsg(e.message);}
  }

  async function reactivate(agent){
    try{await api(`/users/agents/${agent._id}/reactivate`,{method:'POST'});load();}
    catch(e){setMsg(e.message);}
  }

  async function resetPwd(e){
    e.preventDefault();setPwdMsg('');
    try{
      await api(`/users/agents/${resetting._id}/reset-password`,{method:'POST',body:JSON.stringify({password:newPwd})});
      setPwdMsg('Password reset successfully.');
      setTimeout(()=>{setResetting(null);setNewPwd('');setPwdMsg('');},1200);
    }catch(err){setPwdMsg(err.message);}
  }

  const isCreate=!editing;

  return <main className="agent-manage">
    {/* ── Create / Edit form ── */}
    <section className="agent-create">
      <p className="eyebrow">ADMIN ONLY</p>
      <h2>{isCreate?'Create agent account':'Edit agent'}</h2>
      <p>{isCreate?'All identity fields and a profile picture are mandatory.':'Update name, email, phone or photo.'}</p>
      <form onSubmit={save}>
        <label className="photo-field">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>selectPhoto(e.target.files?.[0])}/>
          {preview
            ?<img src={preview} alt="preview"/>
            :editing?.profilePicture?.url
              ?<img src={editing.profilePicture.url} alt={editing.name}/>
              :<span>+</span>}
          <div><b>{picture?.name||'Upload profile picture'}</b><small>JPG, PNG or WebP · max 5 MB</small></div>
        </label>
        <div className="agent-fields">
          <label>Full Name<input required minLength="2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label>Email Address<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
          <label>Phone Number<input type="tel" required={isCreate} minLength="7" placeholder="+1 416 555 0100" value={form.phoneNumber} onChange={e=>setForm({...form,phoneNumber:e.target.value})}/></label>
          {isCreate&&<label>Password<input type="password" required minLength="8" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>}
        </div>
        <div className="tab-access-section" style={{marginTop:'1.5rem',paddingTop:'1.5rem',borderTop:'1px solid var(--border)'}}>
          <h4 style={{marginBottom:'0.2rem'}}>Tab Access Permissions</h4>
          <p className="muted" style={{marginBottom:'1rem',fontSize:'0.85rem'}}>Select which tabs this agent is allowed to view and interact with.</p>
          <div className="checkbox-grid" style={{display:'grid',gridTemplateColumns:'repeat(2, 1fr)',gap:'0.75rem',marginBottom:'1.5rem'}}>
            {ALL_TABS.map(tab=>(
              <label key={tab.id} style={{display:'flex',flexDirection:'row',alignItems:'center',gap:'0.5rem',cursor:'pointer',fontSize:'0.85rem',background:'#f4f7f2',padding:'0.5rem',borderRadius:'0.4rem'}}>
                <input type="checkbox" checked={form.allowedTabs.includes(tab.id)} onChange={e=>{
                  const checked=e.target.checked;
                  setForm(f=>({...f,allowedTabs:checked?[...f.allowedTabs,tab.id]:f.allowedTabs.filter(x=>x!==tab.id)}));
                }}/>
                <span>{tab.label}</span>
              </label>
            ))}
          </div>
        </div>
        {msg&&<p className={msg.includes('success')?'success':'error'}>{msg}</p>}
        <div style={{display:'flex',gap:10}}>
          <button disabled={saving} style={{flex:1}}>{saving?'Saving...':(isCreate?'Create agent account →':'Save changes →')}</button>
          {editing&&<button type="button" onClick={cancelEdit} style={{background:'#eee',color:'#333',border:0,borderRadius:8,padding:'13px 18px',fontWeight:700}}>Cancel</button>}
        </div>
      </form>
    </section>

    {/* ── Agent directory ── */}
    <aside className="agent-directory">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div><p className="eyebrow" style={{margin:0}}>AGENT DIRECTORY</p><h3 style={{margin:'4px 0 0'}}>{visible.length} agent{visible.length!==1?'s':''}</h3></div>
        <label style={{fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
          <input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/>
          Show inactive
        </label>
      </div>

      {loading ? <LoadingSpinner text="Loading agent directory..."/> : visible.map(a=><article key={a._id} className={a.active===false?'agent-inactive':''}>
        <div className="agent-avatar" style={{background:a.active===false?'#ddd':'#d5ff55',color:a.active===false?'#999':'#173e36'}}>
          {a.profilePicture?.url
            ?<img src={a.profilePicture.url} alt={a.name} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/>
            :a.name?.[0]}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <b style={{display:'flex',alignItems:'center',gap:6}}>
            {a.name}
            {a.active===false&&<span style={{fontSize:10,background:'#f0e5e2',color:'#955246',borderRadius:4,padding:'2px 6px',fontWeight:700}}>Inactive</span>}
          </b>
          <small style={{display:'block'}}>{a.email}</small>
          <small>{a.phoneNumber||'No phone'}</small>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:5,alignItems:'flex-end'}}>
          <span style={{fontSize:10,background:'#edf2ed',borderRadius:12,padding:'3px 7px'}}>{a.openJobs||0} open jobs</span>
          <div style={{display:'flex',gap:5}}>
            <button className="agent-action-btn" title="Edit" onClick={()=>startEdit(a)}>✏</button>
            <button className="agent-action-btn" title="Reset password" onClick={()=>{setResetting(a);setNewPwd('');setPwdMsg('');}}>🔑</button>
            {a.active!==false
              ?<button className="agent-action-btn danger" title="Deactivate" onClick={()=>deactivate(a)}>✕</button>
              :<button className="agent-action-btn success" title="Reactivate" onClick={()=>reactivate(a)}>✓</button>}
          </div>
        </div>
      </article>)}

      {visible.length===0&&<p className="muted" style={{padding:'20px 0'}}>No agents found.</p>}
    </aside>

    {/* ── Password reset modal ── */}
    {resetting&&<div className="overlay" onClick={()=>setResetting(null)}>
      <div className="job-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
        <button className="close" onClick={()=>setResetting(null)}>&#215;</button>
        <p className="eyebrow">PASSWORD RESET</p>
        <h3 style={{font:'700 22px Manrope',margin:'4px 0 16px'}}>{resetting.name}</h3>
        <form onSubmit={resetPwd} style={{display:'flex',flexDirection:'column',gap:14}}>
          <label style={{fontSize:13,fontWeight:700,display:'flex',flexDirection:'column',gap:7}}>
            New password (min 8 characters)
            <input type="password" required minLength="8" value={newPwd} onChange={e=>setNewPwd(e.target.value)} style={{border:'1px solid #d9dfda',borderRadius:8,padding:'11px',font:'inherit'}}/>
          </label>
          {pwdMsg&&<p className={pwdMsg.includes('success')?'success':'error'}>{pwdMsg}</p>}
          <button style={{border:0,borderRadius:8,background:'#183d36',color:'#fff',padding:'12px',fontWeight:700}}>Reset password &#8594;</button>
        </form>
      </div>
    </div>}
  </main>;
}
