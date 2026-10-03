const dns = require('dns');
try { dns.setServers(['8.8.8.8']); } catch(e) {}
require('dotenv').config();
require('mongoose').connect(process.env.MONGODB_URI)
  .then(async () => {
    const { Terminal } = require('./server/src/models.js');
    const ottawa = await Terminal.find({'official.locationArea': 'East Ottawa'}).select('terminalId official.sourcePresent');
    console.log('East Ottawa Terminals:', ottawa);
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
