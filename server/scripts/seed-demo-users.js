require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('../src/models');

const accounts = [
  { name: 'Operations User One', email: 'user1@smartaccess.local', password: 'UserOne@123', role: 'user' },
  { name: 'Operations User Two', email: 'user2@smartaccess.local', password: 'UserTwo@123', role: 'user' },
  { name: 'Operations User Three', email: 'user3@smartaccess.local', password: 'UserThree@123', role: 'user' },
  { name: 'Field Agent Ali', email: 'agent.ali@smartaccess.local', password: 'AgentAli@123', role: 'agent' },
  { name: 'Field Agent Hamza', email: 'agent.hamza@smartaccess.local', password: 'AgentHamza@123', role: 'agent' },
  { name: 'Field Agent Usman', email: 'agent.usman@smartaccess.local', password: 'AgentUsman@123', role: 'agent' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const results = [];
  for (const account of accounts) {
    const existing = await User.findOne({ email: account.email });
    if (existing) {
      existing.name = account.name;
      existing.role = account.role;
      existing.active = true;
      await existing.save();
      results.push({ email: account.email, role: account.role, status: 'already exists' });
      continue;
    }
    await User.create({ name: account.name, email: account.email, passwordHash: await bcrypt.hash(account.password, 12), role: account.role, active: true });
    results.push({ email: account.email, role: account.role, status: 'created' });
  }
  console.table(results);
}

seed().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
