const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const {
  Terminal, User, Audit, ImportRun, AgentJob,
  CashWithdrawal, CashReturn, CashDiscrepancy,
  Ticket, AtmInstallation, AtmAgreement, AtmRemoval, AtmSetup
} = require('../src/models');

async function cleanAllData() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not found in .env');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('Purging non-admin data...');
  const [
    resTerminals,
    resUsers,
    resAgentJobs,
    resAudits,
    resImportRuns,
    resCashWithdrawals,
    resCashReturns,
    resCashDiscrepancies,
    resTickets,
    resAtmInstallations,
    resAtmAgreements,
    resAtmRemovals,
    resAtmSetups
  ] = await Promise.all([
    Terminal.deleteMany({}),
    User.deleteMany({ role: { $ne: 'admin' } }),
    AgentJob.deleteMany({}),
    Audit.deleteMany({}),
    ImportRun.deleteMany({}),
    CashWithdrawal.deleteMany({}),
    CashReturn.deleteMany({}),
    CashDiscrepancy.deleteMany({}),
    Ticket.deleteMany({}),
    AtmInstallation.deleteMany({}),
    AtmAgreement.deleteMany({}),
    AtmRemoval.deleteMany({}),
    AtmSetup.deleteMany({})
  ]);

  // Clean local upload folders (agents and proofs)
  const uploadsDir = path.resolve(__dirname, '../../uploads');
  for (const subDir of ['agents', 'proofs']) {
    const targetDir = path.join(uploadsDir, subDir);
    if (fs.existsSync(targetDir)) {
      const files = fs.readdirSync(targetDir);
      for (const file of files) {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(targetDir, file));
        }
      }
    }
  }

  const remainingUsers = await User.find({}, 'name email role active');
  const summary = {
    deletedTerminals: resTerminals.deletedCount,
    deletedAgentsAndUsers: resUsers.deletedCount,
    deletedAgentJobs: resAgentJobs.deletedCount,
    deletedAudits: resAudits.deletedCount,
    deletedImportRuns: resImportRuns.deletedCount,
    deletedCashWithdrawals: resCashWithdrawals.deletedCount,
    deletedCashReturns: resCashReturns.deletedCount,
    deletedCashDiscrepancies: resCashDiscrepancies.deletedCount,
    deletedTickets: resTickets.deletedCount,
    deletedAtmInstallations: resAtmInstallations.deletedCount,
    deletedAtmAgreements: resAtmAgreements.deletedCount,
    deletedAtmRemovals: resAtmRemovals.deletedCount,
    deletedAtmSetups: resAtmSetups.deletedCount,
    remainingUsers
  };

  console.log('Cleanup completed successfully:');
  console.log(JSON.stringify(summary, null, 2));

  await mongoose.disconnect();
}

cleanAllData()
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
