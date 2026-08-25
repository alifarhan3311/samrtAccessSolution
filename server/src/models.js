const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  businessName: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  city: { type: String, trim: true, index: true },
  paymentAmount: { type: Number, min: 0, default: 0 },
  assignedAt: { type: Date, default: Date.now },
  endedAt: Date,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, maxlength: 1000 }
}, { _id: true });

const terminalSchema = new mongoose.Schema({
  terminalId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  official: {
    status: { type: String, enum: ['Active', 'Inactive', 'Unknown'], default: 'Unknown' },
    tempName: String, name: String, address: String, city: String, locationArea: { type: String, index: true },
    wishAmount: Number, cashBalance: Number, cashLoading: Number, agent: String, notesTask: String,
    lastCommunication: String, lastWithdrawalAt: Date, sourcePresent: { type: Boolean, default: true },
    // Terminal Management file fields
    lastTransData: String, lastTransTime: Date,
    totalCassetteValue: Number, totalCassetteCount: Number,
    lastSettledTime: Date, withdrawalCount: Number,
    dispensedAmount: Number, terminalModel: String,
    raw: mongoose.Schema.Types.Mixed, lastSyncedAt: Date
  },
  original: { businessName: String, address: String, city: String },
  current: { businessName: String, address: String, city: { type: String, index: true }, paymentAmount: { type: Number, default: 0 }, assignedAt: Date },
  assignmentHistory: [assignmentSchema],
  setupRequired: { type: Boolean, default: false, index: true },
  setupReason: String,
  alert: { enabled: { type: Boolean, default: false }, threshold: { type: Number, min: 0 }, lastTriggeredAt: Date },
  archivedAt: Date
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true },
  phoneNumber: { type: String, trim: true }, profilePicture: { storedName: String, mimeType: String, originalName: String, size: Number, url: String },
  passwordHash: { type: String, required: true }, role: { type: String, enum: ['admin', 'user', 'agent'], default: 'user' },
  active: { type: Boolean, default: true }, lastLoginAt: Date
}, { timestamps: true });

const auditSchema = new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, action: String, entity: String, entityId: String, metadata: mongoose.Schema.Types.Mixed, ip: String }, { timestamps: true });
const importSchema = new mongoose.Schema({ fileName: String, importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, totals: mongoose.Schema.Types.Mixed, changes: [mongoose.Schema.Types.Mixed], errorMessages: [String] }, { timestamps: true });
const jobEventSchema = new mongoose.Schema({ status: String, note: { type: String, maxlength: 2000 }, cashLoaded: Number, proofFiles: [{ originalName: String, storedName: String, mimeType: String, size: Number, url: String }], createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, createdAt: { type: Date, default: Date.now } }, { _id: true });
const agentJobSchema = new mongoose.Schema({
  batchId: { type: String, index: true }, locationArea: { type: String, index: true },
  terminal: { type: mongoose.Schema.Types.ObjectId, ref: 'Terminal', required: true, index: true }, terminalId: { type: String, required: true, index: true },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  businessName: String, address: String, city: String, wishAmount: { type: Number, min: 0, default: 0 }, cashToLoad: { type: Number, min: 0, required: true },
  dueAt: { type: Date, required: true, index: true }, status: { type: String, enum: ['assigned','accepted','travelling','cash_loaded','issue_reported','approved','cancelled'], default: 'assigned', index: true },
  events: [jobEventSchema], approvedAt: Date, approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Cash withdrawn from bank by admin
const cashWithdrawalSchema = new mongoose.Schema({
  amount:      { type: Number, required: true, min: 1 },
  note:        { type: String, maxlength: 500 },
  withdrawnBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:        { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Cash returned by agent after job(s) — unspent cash credited back
const cashReturnSchema = new mongoose.Schema({
  agent:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount:      { type: Number, required: true, min: 0 },
  jobIds:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'AgentJob' }], // jobs this return is linked to
  note:        { type: String, maxlength: 500 },
  recordedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:        { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Cash discrepancy — detected on import by comparing expected vs actual ATM balance
const cashDiscrepancySchema = new mongoose.Schema({
  terminalId:       { type: String, required: true, index: true },
  terminal:         { type: mongoose.Schema.Types.ObjectId, ref: 'Terminal' },
  job:              { type: mongoose.Schema.Types.ObjectId, ref: 'AgentJob' },
  agent:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  importRunId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ImportRun' },
  balanceBeforeJob: { type: Number, default: 0 },   // ATM balance snapshot before job
  cashLoadedByAgent:{ type: Number, default: 0 },   // agent reported
  expectedBalance:  { type: Number, default: 0 },   // balanceBeforeJob + cashLoadedByAgent
  actualBalance:    { type: Number, default: 0 },   // this import's cashBalance
  discrepancy:      { type: Number, default: 0 },   // expectedBalance - actualBalance (positive = shortfall)
  status:    { type: String, enum: ['open','resolved','dismissed'], default: 'open', index: true },
  resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt:  Date,
  resolveNote: { type: String, maxlength: 1000 },
  detectedAt:  { type: Date, default: Date.now, index: true },
}, { timestamps: true });

module.exports = {
  Terminal:           mongoose.model('Terminal', terminalSchema),
  User:               mongoose.model('User', userSchema),
  Audit:              mongoose.model('Audit', auditSchema),
  ImportRun:          mongoose.model('ImportRun', importSchema),
  AgentJob:           mongoose.model('AgentJob', agentJobSchema),
  CashWithdrawal:     mongoose.model('CashWithdrawal', cashWithdrawalSchema),
  CashReturn:         mongoose.model('CashReturn', cashReturnSchema),
  CashDiscrepancy:    mongoose.model('CashDiscrepancy', cashDiscrepancySchema),
};
