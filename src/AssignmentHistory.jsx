import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

const money = value => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(value||0);
const when = value => value ? new Date(value).toLocaleString('en-CA') : 'Current';
async function loadHistory(filters) {
  const query = new URLSearchParams({ ...filters, limit:'5000' });
  for (const [key,value] of [...query]) if (!value) query.delete(key);
  const response = await fetch('/api/assignment-history?' + query, { headers:{ Authorization:`Bearer ${localStorage.getItem('token')}` } });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.message || 'Could not load assignment history');
  return data;
}

export default function AssignmentHistory() {
  const [filters,setFilters]=useState({search:'',city:'',from:'',to:''});
  const [data,setData]=useState({items:[],total:0});
  const [error,setError]=useState('');
  const refresh=()=>loadHistory(filters).then(setData).catch(e=>setError(e.message));
  useEffect(()=>{const timer=setTimeout(refresh,300);return()=>clearTimeout(timer)},[filters.search,filters.city,filters.from,filters.to]);
  function exportExcel(){
    const rows=data.items.map(item=>({'Terminal ID':item.terminalId,'Original Business':item.originalBusiness,'Original Address':item.originalAddress,'Assigned Business':item.businessName,'Assigned Address':item.address,'City':item.city,'Payment Amount':item.paymentAmount,'Assigned Date & Time':item.assignedAt?new Date(item.assignedAt):'','Ended Date & Time':item.endedAt?new Date(item.endedAt):'Current','Assigned By':item.assignedBy,'Admin Email':item.assignedByEmail,'Note':item.note}));
    const sheet=XLSX.utils.json_to_sheet(rows);sheet['!cols']=[{wch:16},{wch:24},{wch:34},{wch:24},{wch:34},{wch:16},{wch:16},{wch:22},{wch:22},{wch:20},{wch:28},{wch:35}];
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Assignment History');XLSX.writeFile(book,`ATM-Assignment-History-${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  return <><div className="history-toolbar"><div><p className="eyebrow">ADMIN AUDIT VIEW</p><h3>Complete machine movement history</h3></div><button onClick={exportExcel} disabled={!data.items.length}>Download filtered Excel ↓</button></div><div className="history-filters"><label>Search<input placeholder="Terminal, business, address..." value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/></label><label>City<input placeholder="e.g. Woodbridge" value={filters.city} onChange={e=>setFilters({...filters,city:e.target.value})}/></label><label>From date<input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label><label>To date<input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label></div>{error&&<p className="error">{error}</p>}<p className="history-count">{data.total} assignment record(s) found{data.limited?' · Result limit reached':''}</p><div className="table-wrap history-table"><table><thead><tr><th>Terminal ID</th><th>Original installation</th><th>Assigned business</th><th>Assigned address</th><th>City</th><th>Payment</th><th>Assigned date & time</th><th>Ended date & time</th><th>Assigned by</th><th>Note</th></tr></thead><tbody>{data.items.map((item,index)=><tr key={`${item.terminalId}-${item.assignedAt}-${index}`}><td><b>{item.terminalId}</b></td><td>{item.originalBusiness}<small>{item.originalAddress}</small></td><td><b>{item.businessName}</b></td><td>{item.address}</td><td>{item.city}</td><td>{money(item.paymentAmount)}</td><td>{when(item.assignedAt)}</td><td>{when(item.endedAt)}</td><td>{item.assignedBy||'Unknown'}<small>{item.assignedByEmail}</small></td><td>{item.note||'—'}</td></tr>)}</tbody></table></div></>;
}
