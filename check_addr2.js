require('dotenv').config({ path: 'server/.env' });
const mongoose = require('mongoose');
const Terminal = require('./server/src/models').Terminal;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const terms = await Terminal.find({ terminalId: { $in: ['DMH00020', 'DMH0003'] } });
  for (const t of terms) {
    console.log(t.terminalId);
    console.log('official.address:', JSON.stringify(t.official?.address));
    console.log('current.address:', JSON.stringify(t.current?.address));
  }
  process.exit(0);
}
run();
