const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (_) { }
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const models = require('./src/models');

async function clearDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const collectionsToClear = [
      'Terminal',
      'Audit',
      'ImportRun',
      'AgentJob',
      'CashWithdrawal',
      'CashReturn',
      'CashDiscrepancy',
      'Ticket',
      'AtmInstallation',
      'AtmAgreement',
      'AtmRemoval',
      'AtmSetup'
    ];

    for (const modelName of collectionsToClear) {
      const Model = models[modelName];
      if (Model) {
        console.log(`Clearing ${modelName}...`);
        const result = await Model.deleteMany({});
        console.log(`Deleted ${result.deletedCount} documents from ${modelName}.`);
      } else {
        console.warn(`Model ${modelName} not found.`);
      }
    }

    // We do NOT clear the User model, so agents/admins are kept.
    console.log('User collection (agents/admin) was intentionally skipped and preserved.');

    console.log('Database cleanup completed successfully.');
  } catch (err) {
    console.error('Error cleaning database:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

clearDatabase();
