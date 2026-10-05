const mongoose = require('mongoose');
const { Terminal } = require('./server/src/models');
require('dotenv').config({ path: './.env.example' }); // using .env.example if .env is missing? No, there is a .env file. Let's use it.

async function check() {
  require('dotenv').config({ path: './.env' });
  await mongoose.connect(process.env.MONGODB_URI);
  const t = await Terminal.findOne({ terminalId: 'DMH00020' });
  console.log(JSON.stringify(t.official, null, 2));
  mongoose.disconnect();
}
check();
