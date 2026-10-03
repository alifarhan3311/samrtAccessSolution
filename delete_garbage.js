const dns = require('dns');
try { dns.setServers(['8.8.8.8']); } catch(e) {}
require('dotenv').config();
require('mongoose').connect(process.env.MONGODB_URI)
  .then(async () => {
    const { Terminal } = require('./server/src/models.js');
    const terminals = await Terminal.find({ terminalId: { $regex: /TOTAL|BALANCE|GRAND/i } });
    console.log('Found garbage terminals:', terminals.map(t => t.terminalId));
    const r = await Terminal.deleteMany({ terminalId: { $regex: /TOTAL|BALANCE|GRAND/i } });
    console.log('Deleted:', r.deletedCount);
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
