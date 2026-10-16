require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { Terminal, User, Audit } = require('../src/models');

const sourcePath = process.argv[2] || path.resolve(process.cwd(), 'Terminal-Registry-2026-10-07 (1).xlsx');
const normalizeStatus = value => {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'active') return 'Active';
  if (status === 'inactive') return 'Inactive';
  if (status === 'never communicated') return 'Never Communicated';
  return null;
};

async function sync() {
  const workbook = XLSX.readFile(sourcePath, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
  const source = new Map();
  const invalid = [];
  for (const row of rows) {
    const terminalId = String(row['Terminal ID'] ?? '').trim().toUpperCase();
    if (!terminalId) continue;
    const status = normalizeStatus(row.Status);
    if (!status) { invalid.push({ terminalId, status: row.Status }); continue; }
    source.set(terminalId, status);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await Terminal.find({ terminalId: { $in: [...source.keys()] } }).select('terminalId official.status');
  const existingIds = new Set(existing.map(item => item.terminalId));
  const operations = [];
  const changed = [];
  let unchanged = 0;
  for (const terminal of existing) {
    const nextStatus = source.get(terminal.terminalId);
    if (terminal.official?.status === nextStatus) { unchanged++; continue; }
    changed.push({ terminalId: terminal.terminalId, previous: terminal.official?.status || '', current: nextStatus });
    operations.push({ updateOne: { filter: { _id: terminal._id }, update: { $set: { 'official.status': nextStatus } } } });
  }
  if (operations.length) await Terminal.bulkWrite(operations);
  const unmatched = [...source.keys()].filter(id => !existingIds.has(id));
  const actor = await User.findOne({ role: 'admin', active: true }).select('_id');
  if (actor && changed.length) await Audit.create({ actor: actor._id, action: 'TERMINAL_STATUSES_SYNCED', entity: 'Terminal', entityId: path.basename(sourcePath), metadata: { sourceFile: path.basename(sourcePath), matched: existing.length, updated: changed.length, unchanged, unmatched: unmatched.length, changes: changed }, ip: 'local-script' });
  const updatedStatusCounts = {};
  for (const item of changed) updatedStatusCounts[item.current] = (updatedStatusCounts[item.current] || 0) + 1;
  console.log(JSON.stringify({ sourceFile: path.basename(sourcePath), sourceTerminalIds: source.size, matched: existing.length, updated: changed.length, unchanged, unmatchedCount: unmatched.length, unmatchedTerminalIds: unmatched, invalidCount: invalid.length, invalid, updatedStatusCounts }, null, 2));
}

sync().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
