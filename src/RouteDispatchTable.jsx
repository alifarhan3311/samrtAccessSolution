import React from 'react';
import { routeDispatchValues, routeNote, routePrintPages } from './route-dispatch-values.mjs';
import './route-dispatch-table.css';

const money = value => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
const count = value => value.toLocaleString('en-CA', { maximumFractionDigits: 2 });

export default function RouteDispatchTable({ groups, date, agentName, canEdit, onChange, onSave, returns = [] }) {
  const rows = groups.flatMap((group, groupIndex) => group.jobs.map((job, jobIndex) => ({ job, groupIndex, jobIndex })));
  const totals = rows.reduce((total, {job}) => {
    const values = routeDispatchValues(job);
    for (const key of Object.keys(total)) total[key] += values[key];
    return total;
  }, { processingAmount: 0, processingBills: 0, dayTotal: 0, currentBills: 0, expectedAmount: 0, expectedBills: 0, addBills: 0, totalBillsAdded: 0 });
  const returned = returns.filter(item => item.status !== 'rejected').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const sheetDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'2-digit'}).replaceAll(' ', '-') : date;
  const renderTable = (pageRows, showTotals = true, printing = false) => {
  const field = (row, key, label, value, type = 'number') => printing ? <span>{value ?? ''}</span> : <>
    <input aria-label={`${row.job.terminalId || 'Spare cash'} ${label}`} className="rs-input no-print" type={type}
      min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined}
      value={value ?? ''} disabled={!canEdit(key)} placeholder={type === 'number' ? '0' : ''}
      onChange={e => onChange(row.groupIndex, row.jobIndex, key, e.target.value)}
      onBlur={e => onSave(row.job._id, key, e.target.value)} />
    <span className="print-only">{value ?? ''}</span>
  </>;
  return <table className="route-dispatch-table">
    <colgroup>{[8,14,19,7,8,5,5,8,5,6,5,10].map((width, index) => <col key={index} style={{width:`${width}%`}} />)}</colgroup>
    <thead>
      <tr>{['Terminal ID','Name','Address / Locations','City','Processing Data','Day Total','Current Bills','Add Bills Amount','Add Bills','Total Bills Added','Time','Notes'].map(label => <th key={label}>{label}</th>)}</tr>
      <tr className="dispatch-date-row"><th>{sheetDate}</th><th>{agentName}</th><th colSpan="10" /></tr>
    </thead>
    <tbody>
      {pageRows.map(row => {
        const { job } = row;
        const terminal = job.terminal || {};
        const name = terminal.official?.tempName || terminal.current?.businessName || terminal.official?.name || job.businessName || job.terminalId;
        const values = routeDispatchValues(job);
        return <tr key={job._id}>
          <td>{job.terminalId || '—'}</td><td>{name}</td>
          <td>{terminal.current?.address || job.address || terminal.official?.address || '—'}</td>
          <td>{terminal.current?.city || terminal.official?.city || job.city || '—'}</td>
          <td className="dispatch-numeric">{job.isSpareCash ? '—' : <>{money(values.processingAmount)}<small>{count(values.processingBills)} bills</small></>}</td>
          <td className="dispatch-numeric" title={`Previous total ${count(values.previousTotalBillsAdded)} − processing ${count(values.processingBills)} − current ${count(values.currentBills)} bills`}>{job.isSpareCash ? '—' : count(values.dayTotal)}</td>
          <td>{job.isSpareCash ? '—' : field(row, 'routeExistingCash', 'Current Bills', job.routeExistingCash)}</td>
          <td className="dispatch-numeric">{money(values.expectedAmount)}<small className="no-print">Planned bills</small>{field(row, 'routeCashToLoad', 'Planned bills', values.expectedBills)}</td>
          <td>{field(row, 'routeCashLoaded', 'Add Bills', job.routeCashLoaded)}</td>
          <td className="dispatch-numeric">{count(values.totalBillsAdded)}</td>
          <td>{field(row, 'routeLoadTime', 'Time', job.routeLoadTime, 'text')}</td>
          <td>{field(row, 'routeNote', 'Notes', routeNote(job), 'text')}</td>
        </tr>;
      })}
      {showTotals && <><tr className="dispatch-balance"><th colSpan="4">Balance</th><td>{money(totals.processingAmount)}<small>{count(totals.processingBills)} bills</small></td><td>{count(totals.dayTotal)}</td><td>{count(totals.currentBills)}</td><td>{money(totals.expectedAmount)}<small>{count(totals.expectedBills)} bills</small></td><td>{count(totals.addBills)}</td><td>{count(totals.totalBillsAdded)}</td><td colSpan="2" /></tr>
      <tr><th colSpan="4">Start Milage</th><td colSpan="3" /><th colSpan="2">End Milage</th><td colSpan="3" /></tr>
      <tr><th colSpan="4">Money Loaded</th><td colSpan="3">{money(totals.addBills * 20)}<small>{count(totals.addBills)} bills</small></td><th colSpan="2">Money Returned</th><td colSpan="3">{money(returned * 20)}<small>{count(returned)} bills</small></td></tr></>}
    </tbody>
  </table>;
  };
  const pages = routePrintPages(rows);
  return <>
    <div className="route-dispatch-scroll no-print">{renderTable(rows)}</div>
    <div className="route-dispatch-print-pages">{pages.map((page, index) => <section className="route-dispatch-print-page" key={index}>
      {renderTable(page, index === pages.length - 1, true)}
      <div className="route-dispatch-page-number">{agentName} · {sheetDate} · Page {index + 1} of {pages.length}</div>
    </section>)}</div>
  </>;
}
