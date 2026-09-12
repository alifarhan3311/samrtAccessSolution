const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
require('dotenv').config();
const mongoose = require('mongoose');
const { Terminal } = require('../src/models');

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  const sample = await Terminal.find({}).limit(4).lean();
  for (const t of sample) {
    console.log('=== ' + t.terminalId + ' ===');
    console.log('Status:           ', t.official?.status);
    console.log('Temp Name:        ', t.official?.tempName);
    console.log('Name:             ', t.official?.name);
    console.log('Address:          ', t.official?.address);
    console.log('City:             ', t.official?.city);
    console.log('Location Area:    ', t.official?.locationArea);
    console.log('Wish Amount:      ', t.official?.wishAmount);
    console.log('Cash Balance:     ', t.official?.cashBalance);
    console.log('Cashloading:      ', t.official?.cashLoading);
    console.log('Agent:            ', t.official?.agent);
    console.log('Notes/Task:       ', t.official?.notesTask);
    console.log('Last Comm:        ', t.official?.lastCommunication);
    console.log('Last Withdrawal:  ', t.official?.lastWithdrawalDate);
    console.log('Notes:            ', t.official?.notes);
  }

  const all = await Terminal.find({}).lean();
  const withNotes = all.find(t => t.official?.notes);
  console.log('\nSample with Notes:      ', withNotes?.terminalId, '->', withNotes?.official?.notes);
  const withTemp = all.find(t => t.official?.tempName);
  console.log('Sample with Temp Name:  ', withTemp?.terminalId, '->', withTemp?.official?.tempName);
  const withLoading = all.find(t => t.official?.cashLoading);
  console.log('Sample with Cashloading:', withLoading?.terminalId, '->', withLoading?.official?.cashLoading);
  const withTask = all.find(t => t.official?.notesTask);
  console.log('Sample with Notes/Task: ', withTask?.terminalId, '->', withTask?.official?.notesTask);

  console.log('\nTotal terminals verified in MongoDB:', all.length);
  await mongoose.disconnect();
}

verify().catch(console.error);
