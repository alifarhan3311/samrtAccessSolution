require('dotenv').config();
const mongoose = require('mongoose');
const { Terminal } = require('../src/models');

async function sync() {
  await mongoose.connect(process.env.MONGODB_URI);
  const terminals = await Terminal.find({ 'assignmentHistory.0': { $exists: false } });
  let updated = 0;
  for (const terminal of terminals) {
    const businessName = terminal.official?.tempName || terminal.original?.businessName || terminal.official?.name;
    const address = terminal.current?.address || terminal.original?.address || terminal.official?.address;
    const city = terminal.current?.city || terminal.original?.city || terminal.official?.city;
    const result = await Terminal.updateOne({ _id: terminal._id }, { $set: { 'current.businessName': businessName, 'current.address': address, 'current.city': city } });
    updated += result.modifiedCount;
  }
  console.log(JSON.stringify({ checked: terminals.length, updated }, null, 2));
}

sync().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
