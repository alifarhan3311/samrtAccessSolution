require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Terminal, User, Audit, ImportRun, AgentJob } = require('../src/models');
const { importWorkbook } = require('../src/importer');

const sourcePath = process.argv[2] || 'C:\\Users\\FarhanRaza\\Downloads\\atm\\August-05-2026 -.xlsx';

async function reset() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  await mongoose.connect(process.env.MONGODB_URI);

  const before = {
    terminals: await Terminal.countDocuments(), users: await User.countDocuments(),
    jobs: await AgentJob.countDocuments(), audits: await Audit.countDocuments(), imports: await ImportRun.countDocuments(),
  };

  await Promise.all([
    Terminal.deleteMany({}), User.deleteMany({}), AgentJob.deleteMany({}),
    Audit.deleteMany({}), ImportRun.deleteMany({}),
  ]);

  const admin = await User.create({
    name: 'Administrator', email: process.env.ADMIN_EMAIL.toLowerCase(),
    passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'admin', active: true,
  });

  const workbook = await fs.readFile(sourcePath);
  const imported = await importWorkbook(workbook, path.basename(sourcePath), admin._id);

  for (const relative of [path.join('uploads','agents'), path.join('uploads','proofs')]) {
    const target = path.resolve(process.cwd(), relative);
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    if (!target.startsWith(uploadsRoot + path.sep)) throw new Error(`Unsafe cleanup target: ${target}`);
    await fs.rm(target, { recursive: true, force: true });
  }

  console.log(JSON.stringify({ deleted: before, admin: admin.email, imported }, null, 2));
}

reset().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
