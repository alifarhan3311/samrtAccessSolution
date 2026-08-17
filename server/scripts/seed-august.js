require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const { User } = require('../src/models');
const { importWorkbook } = require('../src/importer');

const sourcePath = process.argv[2] || 'C:\\Users\\FarhanRaza\\Downloads\\atm\\August-05-2026 -.xlsx';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ role: 'admin', active: true });
  if (!admin) throw new Error('No active admin user exists. Start the API once to create the configured admin.');
  const buffer = fs.readFileSync(sourcePath);
  const result = await importWorkbook(buffer, sourcePath.split(/[\\/]/).pop(), admin._id);
  console.log(JSON.stringify(result, null, 2));
}

seed()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
