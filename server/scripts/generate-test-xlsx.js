const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const data = [
  ['Terminal ID', 'Name', 'Address', 'Cash Balance'],
  ['FAKE9999', 'Fake ATM', '123 Fake', 0]
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

const outPath = path.join(__dirname, 'test_zero_balance.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Created test file:', outPath);
