const dns = require('dns');
try { dns.setServers(['8.8.8.8']); } catch(e) {}
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const { AtmRemoval, AtmAgreement, AtmInstallation, AtmSetup, Audit } = require('./server/src/models.js');
    
    const tid = 'TENETUR CULPA NIHIL'.toUpperCase();
    
    // Delete from forms collections
    await AtmRemoval.deleteMany({ terminalId: { $regex: /TENETUR CULPA/i } });
    await AtmAgreement.deleteMany({ terminalId: { $regex: /TENETUR CULPA/i } });
    await AtmInstallation.deleteMany({ terminalId: { $regex: /TENETUR CULPA/i } });
    await AtmSetup.deleteMany({ terminalId: { $regex: /TENETUR CULPA/i } });
    
    // Clean up audits
    await Audit.deleteMany({ 'details.terminalId': { $regex: /TENETUR CULPA/i } });

    console.log(`Deleted forms and logs for TENETUR CULPA NIHIL`);
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
