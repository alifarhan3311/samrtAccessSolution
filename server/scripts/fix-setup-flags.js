require('dotenv').config();
const mongoose = require('mongoose');
const { Terminal } = require('../src/models');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Flag terminals that have no wishAmount but are not marked as needing setup
  const result = await Terminal.updateMany(
    { 'official.wishAmount': { $lte: 0 }, 'official.sourcePresent': true, setupRequired: false },
    { $set: { setupRequired: true, setupReason: 'Wish amount not configured' } }
  );
  console.log('Flagged as setup required:', result.modifiedCount);

  // Unflag terminals that DO have wishAmount but are incorrectly flagged
  // (only if their setupReason is the auto one — don't touch manually set ones)
  const result2 = await Terminal.updateMany(
    { 'official.wishAmount': { $gt: 0 }, setupRequired: true, setupReason: 'New terminal requires Wish Amount and operational setup' },
    { $set: { setupRequired: false }, $unset: { setupReason: '' } }
  );
  console.log('Unflagged (now have wishAmount):', result2.modifiedCount);

  const finalCount = await Terminal.countDocuments({ setupRequired: true });
  console.log('Final setupRequired count:', finalCount);

  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
