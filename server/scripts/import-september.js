const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { User, Terminal } = require('../src/models');
const { importWorkbook } = require('../src/importer');

const filePath = path.resolve(__dirname, '../../September 2026 Spreadsheet.xlsx');

async function run() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    throw new Error('Admin user not found in database');
  }

  console.log('Resetting terminals collection...');
  await Terminal.deleteMany({});

  console.log(`Reading ${filePath}...`);
  const buffer = fs.readFileSync(filePath);

  console.log('Running importWorkbook...');
  const result = await importWorkbook(buffer, 'September 2026 Spreadsheet.xlsx', admin._id);

  console.log('Import result:');
  console.log(JSON.stringify(result, null, 2));

  const totalTerminals = await Terminal.countDocuments();
  const activeTerminals = await Terminal.countDocuments({ 'official.status': 'Active' });
  const inactiveTerminals = await Terminal.countDocuments({ 'official.status': 'Inactive' });
  const spareTerminals = await Terminal.countDocuments({ 'official.status': 'Spare' });
  const pendingTerminals = await Terminal.countDocuments({ 'official.status': 'Pending' });

  console.log('\n--- Terminal Count in Database ---');
  console.log(`Total: ${totalTerminals}`);
  console.log(`Active: ${activeTerminals}`);
  console.log(`Inactive: ${inactiveTerminals}`);
  console.log(`Spare: ${spareTerminals}`);
  console.log(`Pending: ${pendingTerminals}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error importing:', err);
  process.exit(1);
});
