require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { Terminal } = require('../src/models');

const sourcePath = process.argv[2] || 'C:\\Users\\FarhanRaza\\Downloads\\atm\\August-05-2026 -.xlsx';
const clean = value => value == null ? '' : String(value).trim();

async function sync() {
  const book = XLSX.read(fs.readFileSync(sourcePath), { type: 'buffer', cellDates: true });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: '' });
  const headerIndex = rows.findIndex(row => row.some(cell => /terminal\s*id/i.test(clean(cell))));
  if (headerIndex < 0) throw new Error('Terminal ID header was not found');
  const headers = rows[headerIndex].map(clean);
  const terminalIndex = headers.findIndex(value => /terminal\s*id/i.test(value));
  const wishIndex = headers.findIndex(value => /wish\s*amount/i.test(value));
  if (wishIndex < 0) throw new Error('Wish Amount header was not found');

  await mongoose.connect(process.env.MONGODB_URI);
  const summary = { rows: 0, updated: 0, unchanged: 0, missingInDatabase: 0, invalidWishAmount: 0 };
  for (const row of rows.slice(headerIndex + 1)) {
    const terminalId = clean(row[terminalIndex]).toUpperCase();
    if (!terminalId) continue;
    summary.rows++;
    const rawWishAmount = clean(row[wishIndex]);
    const wishAmount = Number(rawWishAmount);
    if (!rawWishAmount || !Number.isFinite(wishAmount) || wishAmount < 0) {
      summary.invalidWishAmount++;
      const terminal = await Terminal.findOne({ terminalId }).select('_id');
      if (!terminal) { summary.missingInDatabase++; continue; }
      await Terminal.updateOne({ _id: terminal._id }, { $set: { setupRequired: true, setupReason: `Wish Amount requires manual setup (sheet value: ${rawWishAmount || 'blank'})`, 'alert.enabled': false }, $unset: { 'official.wishAmount': 1, 'alert.threshold': 1 } });
      continue;
    }
    const terminal = await Terminal.findOne({ terminalId }).select('official.wishAmount alert.threshold setupRequired');
    if (!terminal) { summary.missingInDatabase++; continue; }
    if (terminal.official?.wishAmount === wishAmount && terminal.alert?.threshold === wishAmount) { summary.unchanged++; continue; }
    await Terminal.updateOne({ _id: terminal._id }, { $set: { 'official.wishAmount': wishAmount, 'alert.enabled': true, 'alert.threshold': wishAmount, setupRequired: false }, $unset: { setupReason: 1 } });
    summary.updated++;
  }
  console.log(JSON.stringify(summary, null, 2));
}

sync().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
