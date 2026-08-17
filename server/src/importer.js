const XLSX = require('xlsx');
const { Terminal, ImportRun } = require('./models');

const clean = v => v == null ? '' : String(v).trim();
const num = v => Number.isFinite(Number(v)) ? Number(v) : undefined;
const status = v => /^active$/i.test(clean(v)) ? 'Active' : /^inactive$/i.test(clean(v)) ? 'Inactive' : 'Unknown';
const date = v => { if (!v) return undefined; const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? undefined : d; };
function findHeader(rows) { return rows.findIndex(r => r.some(c => /terminal\s*id/i.test(clean(c)))); }
function pick(row, headers, patterns) { const i = headers.findIndex(h => patterns.some(p => p.test(clean(h)))); return i >= 0 ? row[i] : undefined; }

async function importWorkbook(buffer, fileName, userId) {
  const book = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: '' });
  const hi = findHeader(rows); if (hi < 0) throw new Error('Could not locate a Terminal ID header');
  const headers = rows[hi]; const data = rows.slice(hi + 1).filter(r => clean(pick(r, headers, [/terminal\s*id/i])));
  const seen = []; const changes = []; const totals = { imported: data.length, new: 0, updated: 0, removed: 0, unchanged: 0 };
  for (const row of data) {
    const terminalId = clean(pick(row, headers, [/terminal\s*id/i])).toUpperCase(); seen.push(terminalId);
    const official = {
      status: status(pick(row, headers, [/^status$/i])),
      tempName: clean(pick(row, headers, [/temp\s*name/i])),
      name: clean(pick(row, headers, [/^name$/i, /business/i])),
      address: clean(pick(row, headers, [/address/i])), city: clean(pick(row, headers, [/city/i])),
      locationArea: clean(pick(row, headers, [/location\s*area/i])),
      wishAmount: num(pick(row, headers, [/wish\s*amount/i])),
      cashBalance: num(pick(row, headers, [/cash\s*balance/i, /^balance$/i])),
      cashLoading: num(pick(row, headers, [/cash\s*loading/i])),
      agent: clean(pick(row, headers, [/^agent$/i])), notesTask: clean(pick(row, headers, [/notes?\s*\/??\s*task/i])),
      lastCommunication: clean(pick(row, headers, [/last\s*communication/i])),
      lastWithdrawalAt: date(pick(row, headers, [/last\s*withdrawal/i])),
      sourcePresent: true, raw: Object.fromEntries(headers.map((h,i)=>[clean(h)||`column_${i+1}`,row[i]])), lastSyncedAt: new Date()
    };
    const existing = await Terminal.findOne({ terminalId });
    if (existing) {
      if (official.wishAmount == null) official.wishAmount = existing.official?.wishAmount;
      if (!official.tempName) official.tempName = existing.official?.tempName || '';
    }
    if (!existing) { const needsSetup = official.wishAmount == null || official.wishAmount <= 0; await Terminal.create({ terminalId, official, original: { businessName: official.name, address: official.address, city: official.city }, current: { businessName: official.tempName || official.name, address: official.address, city: official.city }, setupRequired: needsSetup, setupReason: needsSetup ? 'New terminal requires Wish Amount and operational setup' : undefined }); changes.push({ terminalId, type: 'new', after: { status: official.status, tempName: official.tempName, name: official.name, address: official.address, city: official.city, locationArea: official.locationArea, cashBalance: official.cashBalance, lastCommunication: official.lastCommunication, lastWithdrawalAt: official.lastWithdrawalAt }, setupRequired: needsSetup }); totals.new++; }
    else { const tracked=['status','tempName','name','address','city','locationArea','wishAmount','cashBalance','cashLoading','agent','notesTask','lastCommunication','lastWithdrawalAt'];const fields=tracked.filter(k=>String(existing.official?.[k]??'')!==String(official[k]??'')).map(k=>({field:k,previous:existing.official?.[k]??'',current:official[k]??''}));await Terminal.updateOne({ _id: existing._id }, { $set: { official } });if(fields.length){changes.push({terminalId,type:'updated',name:official.name,fields});totals.updated++;}else totals.unchanged++; }
  }
  const removedItems=await Terminal.find({terminalId:{$nin:seen},'official.sourcePresent':true}).select('terminalId official.name official.city');
  const removed = await Terminal.updateMany({ terminalId: { $nin: seen }, 'official.sourcePresent': true }, { $set: { 'official.sourcePresent': false } }); totals.removed = removed.modifiedCount;
  changes.push(...removedItems.map(t=>({terminalId:t.terminalId,type:'removed',name:t.official?.name,city:t.official?.city})));
  const run = await ImportRun.create({ fileName, importedBy: userId, totals, changes }); return { runId: run.id, ...totals };
}
module.exports = { importWorkbook, findHeader };
