const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'TerminalManagement (9).xls');
const buffer = fs.readFileSync(filePath);
const book = XLSX.read(buffer, { type: 'buffer' });
const sheet = book.Sheets[book.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

const clean = v => v == null ? '' : String(v).trim();
const headerIndex = rows.findIndex(row => row.some(cell => /terminal\s*id/i.test(clean(cell))));

if (headerIndex < 0) {
  console.log('No Terminal ID header found.');
  process.exit(1);
}

const headers = rows[headerIndex];
const terminalIndex = headers.findIndex(h => /terminal\s*id/i.test(clean(h)));

const dataRows = rows.slice(headerIndex + 1);
let dmhCount = 0;
let totalCount = 0;
let others = [];

for (const row of dataRows) {
  const tid = clean(row[terminalIndex]).toUpperCase();
  if (tid && !/TOTAL|BALANCE|GRAND/i.test(tid)) {
    totalCount++;
    if (tid.startsWith('DMH')) {
      dmhCount++;
    } else {
      others.push(tid);
    }
  }
}

console.log(JSON.stringify({
  totalCount,
  dmhCount,
  allStartWithDMH: dmhCount === totalCount,
  nonDMH: others.slice(0, 10) // Show up to 10 exceptions
}, null, 2));
