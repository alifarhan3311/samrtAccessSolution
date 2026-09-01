require('dotenv').config();
const express = require('express'); const mongoose = require('mongoose'); const bcrypt = require('bcryptjs'); const crypto = require('crypto');
const helmet = require('helmet'); const cors = require('cors'); const compression = require('compression'); const rateLimit = require('express-rate-limit'); const mongoSanitize = require('express-mongo-sanitize'); const multer = require('multer'); const { z } = require('zod');
const { Terminal, User, Audit, ImportRun, AgentJob, CashWithdrawal, CashReturn, CashDiscrepancy, Ticket, AtmInstallation, AtmAgreement, AtmRemoval, AtmSetup } = require('./models'); const { sign, auth, permit, audit } = require('./security'); const { importWorkbook } = require('./importer'); const { uploadBuffer, deleteFile } = require('./cloudinary');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) { console.error('JWT_SECRET must contain at least 32 characters'); if (require.main === module) process.exit(1); }
const app = express(); app.set('trust proxy', 1); app.use(helmet()); app.use(compression()); app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || false })); app.use(express.json({ limit: '1mb' })); app.use(mongoSanitize());
app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', async (req, res) => { try { const dbState = mongoose.connection.readyState; const states = {0:'disconnected',1:'connected',2:'connecting',3:'disconnecting'}; res.json({ ok: true, db: states[dbState]||dbState, jwt: !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32, mongo_uri_set: !!process.env.MONGODB_URI, node: process.version }); } catch(e) { res.status(500).json({ ok: false, error: e.message }); } });
const agentPhotoUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
app.post('/api/auth/login', async (req,res,next)=>{ try { const body=z.object({email:z.string().email(),password:z.string().min(8)}).parse(req.body); const user=await User.findOne({email:body.email.toLowerCase()}); if(!user?.active || !await bcrypt.compare(body.password,user.passwordHash)) return res.status(401).json({message:'Invalid credentials'}); user.lastLoginAt=new Date(); await user.save(); res.json({token:sign(user),user:{id:user.id,name:user.name,email:user.email,role:user.role,allowedTabs:user.allowedTabs}}); } catch(e){next(e)} });
app.get('/api/me',auth,(req,res)=>res.json(req.user));
app.get('/api/users/agents',auth,permit('admin','manager','agents'),async(req,res,next)=>{try{const showAll=req.query.all==='1'&&req.user.role==='admin';const filter=showAll?{role:'agent'}:{role:'agent',active:true};const agents=await User.find(filter).select('name email phoneNumber profilePicture active allowedTabs').sort({name:1}).lean();const workloads=await AgentJob.aggregate([{$match:{status:{$nin:['approved','cancelled']}}},{$group:{_id:'$agent',openJobs:{$sum:1}}}]);const counts=new Map(workloads.map(w=>[String(w._id),w.openJobs]));res.json(agents.map(a=>({...a,available:true,openJobs:counts.get(String(a._id))||0})));}catch(e){next(e)}});
app.post('/api/users/agents',auth,permit('admin','agents'),agentPhotoUpload.single('picture'),async(req,res,next)=>{try{const b=z.object({name:z.string().min(2).max(100),email:z.string().email(),phoneNumber:z.string().min(7).max(25).regex(/^[+0-9()\-\s]+$/),password:z.string().min(8),allowedTabs:z.preprocess(v=>{const arr=Array.isArray(v)?v:(v?[v]:[]);return arr.filter(x=>x!=='')},z.array(z.string()).optional())}).parse(req.body);if(await User.exists({email:b.email.toLowerCase()}))return res.status(409).json({message:'Email already exists'});let profilePicture=undefined;if(req.file){const uploaded=await uploadBuffer(req.file.buffer,{folder:'atm-command-center/agents',resource_type:'image',public_id:`agent_${crypto.randomUUID()}`,overwrite:false});profilePicture={storedName:uploaded.publicId,mimeType:req.file.mimetype,originalName:req.file.originalname,size:req.file.size,url:uploaded.secureUrl};}const user=await User.create({name:b.name,email:b.email.toLowerCase(),phoneNumber:b.phoneNumber,passwordHash:await bcrypt.hash(b.password,12),profilePicture,role:'agent',allowedTabs:b.allowedTabs!==undefined?b.allowedTabs:['terminals','tickets','jobs','routesheet']});await audit(req,'AGENT_CREATED','User',user.id,{email:user.email,phoneNumber:user.phoneNumber});res.status(201).json({id:user.id,name:user.name,email:user.email,phoneNumber:user.phoneNumber,role:user.role});}catch(e){next(e)}});
app.get('/api/users/agents/:id/picture',auth,async(req,res,next)=>{try{const agent=await User.findOne({_id:req.params.id,role:'agent'}).select('profilePicture');if(!agent?.profilePicture?.url)return res.status(404).end();res.redirect(agent.profilePicture.url);}catch(e){next(e)}});

// Update agent info (name, phone, email)
app.patch('/api/users/agents/:id',auth,permit('admin','agents'),agentPhotoUpload.single('picture'),async(req,res,next)=>{try{const b=z.object({name:z.string().min(2).max(100).optional(),email:z.string().email().optional(),phoneNumber:z.string().min(7).max(25).regex(/^[+0-9()\-\s]+$/).optional(),allowedTabs:z.preprocess(v=>{const arr=Array.isArray(v)?v:(v?[v]:[]);return arr.filter(x=>x!=='')},z.array(z.string()).optional())}).parse(req.body);const agent=await User.findOne({_id:req.params.id,role:'agent'});if(!agent)return res.status(404).json({message:'Agent not found'});if(b.email&&b.email.toLowerCase()!==agent.email){if(await User.exists({email:b.email.toLowerCase(),_id:{$ne:agent._id}}))return res.status(409).json({message:'Email already in use'});}if(b.name)agent.name=b.name;if(b.email)agent.email=b.email.toLowerCase();if(b.phoneNumber)agent.phoneNumber=b.phoneNumber;if(b.allowedTabs!==undefined)agent.allowedTabs=b.allowedTabs;if(req.file){const uploaded=await uploadBuffer(req.file.buffer,{folder:'atm-command-center/agents',resource_type:'image',public_id:`agent_${crypto.randomUUID()}`,overwrite:false});agent.profilePicture={storedName:uploaded.publicId,mimeType:req.file.mimetype,originalName:req.file.originalname,size:req.file.size,url:uploaded.secureUrl};}await agent.save();await audit(req,'AGENT_UPDATED','User',agent.id,{name:agent.name,email:agent.email});res.json({id:agent.id,name:agent.name,email:agent.email,phoneNumber:agent.phoneNumber,allowedTabs:agent.allowedTabs});}catch(e){next(e)}});

// Reset agent password
app.post('/api/users/agents/:id/reset-password',auth,permit('admin','agents'),async(req,res,next)=>{try{const{password}=z.object({password:z.string().min(8)}).parse(req.body);const agent=await User.findOne({_id:req.params.id,role:'agent'});if(!agent)return res.status(404).json({message:'Agent not found'});agent.passwordHash=await bcrypt.hash(password,12);await agent.save();await audit(req,'AGENT_PASSWORD_RESET','User',agent.id,{email:agent.email});res.json({ok:true});}catch(e){next(e)}});

// Deactivate (soft delete) agent
app.delete('/api/users/agents/:id',auth,permit('admin','agents'),async(req,res,next)=>{try{const agent=await User.findOne({_id:req.params.id,role:'agent'});if(!agent)return res.status(404).json({message:'Agent not found'});const openJobs=await AgentJob.countDocuments({agent:agent._id,status:{$nin:['approved','cancelled']}});if(openJobs>0)return res.status(409).json({message:`Agent has ${openJobs} open job(s). Complete or cancel them first.`});agent.active=false;await agent.save();await audit(req,'AGENT_DEACTIVATED','User',agent.id,{email:agent.email});res.json({ok:true});}catch(e){next(e)}});

// Reactivate agent
app.post('/api/users/agents/:id/reactivate',auth,permit('admin','agents'),async(req,res,next)=>{try{const agent=await User.findOne({_id:req.params.id,role:'agent'});if(!agent)return res.status(404).json({message:'Agent not found'});agent.active=true;await agent.save();await audit(req,'AGENT_REACTIVATED','User',agent.id,{email:agent.email});res.json({ok:true});}catch(e){next(e)}});
app.get('/api/dashboard',auth,async(req,res,next)=>{try{
  const today = new Date(); today.setHours(0,0,0,0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [total, active, inactive, inventory, alerts, setupRequired, cities,
         totalCashInMachines,
         todayWithdrawals, monthWithdrawals,
         todayDispatched, monthDispatched,
         todayActualLoaded, monthActualLoaded,
         todayReturned, monthReturned,
         openJobs, pendingApproval,
         agentStats,
         openDiscrepancies, totalShortfall
        ] = await Promise.all([
    Terminal.countDocuments(),
    Terminal.countDocuments({'official.status':'Active'}),
    Terminal.countDocuments({'official.status':'Inactive'}),
    Terminal.countDocuments({'official.sourcePresent':false}),
    Terminal.countDocuments({'alert.enabled':true,$expr:{$lte:['$official.cashBalance','$alert.threshold']}}),
    Terminal.countDocuments({setupRequired:true}),
    Terminal.aggregate([{$group:{_id:'$official.city',count:{$sum:1},cash:{$sum:'$official.cashBalance'}}},{$sort:{count:-1}},{$limit:10}]),
    Terminal.aggregate([{$group:{_id:null,total:{$sum:'$official.cashBalance'}}}]).then(r=>r[0]?.total||0),
    // withdrawals
    CashWithdrawal.aggregate([{$match:{date:{$gte:today}}},{$group:{_id:null,total:{$sum:'$amount'},count:{$sum:1}}}]).then(r=>r[0]||{total:0,count:0}),
    CashWithdrawal.aggregate([{$match:{date:{$gte:monthStart}}},{$group:{_id:null,total:{$sum:'$amount'},count:{$sum:1}}}]).then(r=>r[0]||{total:0,count:0}),
    // dispatched to agents (cashToLoad)
    AgentJob.aggregate([{$match:{createdAt:{$gte:today}}},{$group:{_id:null,total:{$sum:'$cashToLoad'},count:{$sum:1}}}]).then(r=>r[0]||{total:0,count:0}),
    AgentJob.aggregate([{$match:{createdAt:{$gte:monthStart}}},{$group:{_id:null,total:{$sum:'$cashToLoad'},count:{$sum:1}}}]).then(r=>r[0]||{total:0,count:0}),
    // actual cash loaded (from approved jobs)
    AgentJob.aggregate([{$match:{status:'approved',approvedAt:{$gte:today}}},{$unwind:'$events'},{$match:{'events.status':'cash_loaded'}},{$group:{_id:null,total:{$sum:{$convert:{input:'$events.cashLoaded',to:'double',onError:0,onNull:0}}}}}]).then(r=>r[0]?.total||0),
    AgentJob.aggregate([{$match:{status:'approved',approvedAt:{$gte:monthStart}}},{$unwind:'$events'},{$match:{'events.status':'cash_loaded'}},{$group:{_id:null,total:{$sum:{$convert:{input:'$events.cashLoaded',to:'double',onError:0,onNull:0}}}}}]).then(r=>r[0]?.total||0),
    // cash returned
    CashReturn.aggregate([{$match:{date:{$gte:today}}},{$group:{_id:null,total:{$sum:'$amount'},count:{$sum:1}}}]).then(r=>r[0]||{total:0,count:0}),
    CashReturn.aggregate([{$match:{date:{$gte:monthStart}}},{$group:{_id:null,total:{$sum:'$amount'},count:{$sum:1}}}]).then(r=>r[0]||{total:0,count:0}),
    // open + pending
    AgentJob.countDocuments({status:{$in:['assigned','accepted','travelling']}}),
    AgentJob.countDocuments({status:'cash_loaded'}),
    // per-agent stats this month
    AgentJob.aggregate([{$match:{createdAt:{$gte:monthStart}}},{$group:{_id:'$agent',jobsAssigned:{$sum:1},jobsApproved:{$sum:{$cond:[{$eq:['$status','approved']},1,0]}},totalDispatched:{$sum:'$cashToLoad'}}},{$lookup:{from:'users',localField:'_id',foreignField:'_id',as:'user'}},{$unwind:'$user'},{$project:{name:'$user.name',jobsAssigned:1,jobsApproved:1,totalDispatched:1}},{$sort:{totalDispatched:-1}},{$limit:10}]),
    CashDiscrepancy.countDocuments({status:'open'}),
    CashDiscrepancy.aggregate([{$match:{status:'open',discrepancy:{$gt:0}}},{$group:{_id:null,total:{$sum:'$discrepancy'}}}]).then(r=>r[0]?.total||0),
  ]);

  res.json({
    fleet:{ total, active, inactive, inventory, alerts, setupRequired, totalCashInMachines },
    cities,
    cash:{
      today:{ withdrawn:todayWithdrawals.total, dispatched:todayDispatched.total, actualLoaded:todayActualLoaded, returned:todayReturned.total,
              balance:todayDispatched.total-todayReturned.total },
      month:{ withdrawn:monthWithdrawals.total, dispatched:monthDispatched.total, actualLoaded:monthActualLoaded, returned:monthReturned.total,
              netCashOut:monthDispatched.total-monthReturned.total }
    },
    jobs:{ open:openJobs, pendingApproval },
    agents: agentStats,
    discrepancies:{ open:openDiscrepancies, totalShortfall },
  });
}catch(e){next(e)}});
app.get('/api/notifications',auth,async(req,res,next)=>{try{const [setup,lowCash,missing,latestImport,unassignedTickets]=await Promise.all([
  Terminal.find({setupRequired:true}).select('terminalId official.status official.name official.address official.city official.locationArea official.cashBalance official.lastCommunication official.lastWithdrawalAt setupReason createdAt').sort({createdAt:-1}).limit(200),
  Terminal.find({'alert.enabled':true,$expr:{$lte:['$official.cashBalance','$alert.threshold']}}).select('terminalId official.name official.address official.city official.cashBalance alert.threshold').sort({'official.cashBalance':1}).limit(200),
  Terminal.find({'official.sourcePresent':false}).select('terminalId official.name official.address official.city official.lastSyncedAt').sort({'official.lastSyncedAt':-1}).limit(100),
  ImportRun.findOne().sort({createdAt:-1}).select('fileName changes totals createdAt').lean(),
  Ticket.find({ $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }], status: { $ne: 'Closed' } }).sort({ createdAt: -1 }).limit(100).populate('generatedBy', 'name email').lean()
]);
const recentChanges=latestImport?.changes||[];
res.json({
  setup,
  lowCash,
  missing,
  unassignedTickets: unassignedTickets || [],
  recentChanges,
  latestImport:latestImport?{fileName:latestImport.fileName,createdAt:latestImport.createdAt,totals:latestImport.totals}:null,
  total:setup.length+lowCash.length+missing.length+recentChanges.length+(unassignedTickets?.length||0)
});}catch(e){next(e)}});
app.get('/api/terminals',auth,async(req,res,next)=>{try{const page=Math.max(1,+req.query.page||1),limit=Math.min(100,Math.max(1,+req.query.limit||25));const q={};if(req.query.search){const s=String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');q.$or=[{terminalId:new RegExp(s,'i')},{'current.businessName':new RegExp(s,'i')},{'current.city':new RegExp(s,'i')},{'current.address':new RegExp(s,'i')}];}if(req.query.status)q['official.status']=req.query.status;if(req.query.city)q['current.city']=new RegExp(`^${String(req.query.city).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'i');const [items,total]=await Promise.all([Terminal.find(q).sort({terminalId:1}).skip((page-1)*limit).limit(limit),Terminal.countDocuments(q)]);res.json({items,total,page,pages:Math.ceil(total/limit)});}catch(e){next(e)}});
app.get('/api/terminals/:id',auth,async(req,res,next)=>{try{const item=await Terminal.findOne({terminalId:req.params.id.toUpperCase()}).populate('assignmentHistory.assignedBy','name email');if(!item)return res.status(404).json({message:'Terminal not found'});res.json(item);}catch(e){next(e)}});
app.patch('/api/terminals/:id/status',auth,permit('admin','manager','terminals'),async(req,res,next)=>{try{const {status}=z.object({status:z.enum(['Active','Inactive'])}).parse(req.body);const t=await Terminal.findOneAndUpdate({terminalId:req.params.id.toUpperCase()},{$set:{'official.status':status}},{new:true});if(!t)return res.status(404).json({message:'Terminal not found'});await audit(req,'TERMINAL_STATUS_CHANGED','Terminal',t.id,{terminalId:t.terminalId,status});res.json(t);}catch(e){next(e)}});
app.post('/api/terminals/:id/assign',auth,permit('admin','manager','assign'),async(req,res,next)=>{try{const b=z.object({businessName:z.string().min(2).max(150),address:z.string().min(3).max(250),city:z.string().min(2).max(100),wishAmount:z.number().nonnegative(),paymentAmount:z.number().nonnegative().optional(),note:z.string().max(1000).optional(),agentId:z.string().optional(),cashToLoad:z.number().nonnegative().optional(),dueAt:z.string().optional()}).parse(req.body);const t=await Terminal.findOne({terminalId:req.params.id.toUpperCase()});if(!t)return res.status(404).json({message:'Terminal not found'});let agent;if(b.agentId){if(t.official?.status==='Inactive')return res.status(400).json({message:`Cannot assign agent: Terminal ${t.terminalId} is currently Inactive. Please activate the terminal first.`});agent=await User.findOne({_id:b.agentId,role:'agent',active:true});if(!agent)return res.status(400).json({message:'Selected agent is unavailable'});if(b.cashToLoad==null||!b.dueAt)return res.status(400).json({message:'Cash to load and due time are required when assigning an agent'});}const now=new Date();const last=t.assignmentHistory.at(-1);if(last&&!last.endedAt)last.endedAt=now;t.assignmentHistory.push({businessName:b.businessName,address:b.address,city:b.city,paymentAmount:b.paymentAmount??b.wishAmount,note:b.note,assignedAt:now,assignedBy:req.user._id});t.official.tempName=b.businessName;t.official.wishAmount=b.wishAmount;t.current={businessName:b.businessName,address:b.address,city:b.city,paymentAmount:b.paymentAmount??b.wishAmount,assignedAt:now};t.alert={enabled:true,threshold:b.wishAmount};t.setupRequired=false;t.setupReason=undefined;await t.save();let job=null;if(agent)job=await AgentJob.create({terminal:t._id,terminalId:t.terminalId,agent:agent._id,assignedBy:req.user._id,businessName:b.businessName,address:b.address,city:b.city,wishAmount:b.wishAmount,cashToLoad:b.cashToLoad,dueAt:new Date(b.dueAt),events:[{status:'assigned',note:b.note,createdBy:req.user._id}]});await audit(req,'TERMINAL_ASSIGNED','Terminal',t.id,{terminalId:t.terminalId,to:b.businessName,agent:agent?.email,cashToLoad:b.cashToLoad,wishAmount:b.wishAmount,jobId:job?.id});res.json({terminal:t,job});}catch(e){next(e)}});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024},fileFilter:(req,file,cb)=>cb(null,/\.(xlsx|xls)$/i.test(file.originalname))});
const proofUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:4},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp','application/pdf'].includes(file.mimetype))});
app.post('/api/imports',auth,permit('admin','import'),upload.single('file'),async(req,res,next)=>{try{if(!req.file)return res.status(400).json({message:'Excel file required'});const result=await importWorkbook(req.file.buffer,req.file.originalname,req.user._id,req.app.locals.io);await audit(req,'OFFICIAL_IMPORT','ImportRun',result.runId,result);res.status(201).json(result);}catch(e){next(e)}});
app.get('/api/jobs',auth,async(req,res,next)=>{try{const page=Math.max(1,+req.query.page||1),limit=Math.min(100,Math.max(1,+req.query.limit||25));const q=req.user.role==='agent'?{agent:req.user._id}:{};if(req.user.role!=='agent'&&req.query.agentId)q.agent=req.query.agentId;if(req.query.status)q.status=req.query.status;if(req.query.fromDate||req.query.toDate){q.dueAt={};if(req.query.fromDate)q.dueAt.$gte=new Date(req.query.fromDate+'T00:00:00.000Z');if(req.query.toDate){const to=new Date(req.query.toDate+'T00:00:00.000Z');to.setUTCDate(to.getUTCDate()+1);q.dueAt.$lt=to;}}if(req.query.search){const rx=new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');q.$or=[{terminalId:rx},{businessName:rx},{city:rx}];}const[items,total]=await Promise.all([AgentJob.find(q).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).populate('agent','name email').populate('assignedBy','name email').populate('events.createdBy','name email'),AgentJob.countDocuments(q)]);res.json({items,total,page,pages:Math.ceil(total/limit)});}catch(e){next(e)}});
app.get('/api/jobs/active-terminal/:terminalId',auth,async(req,res,next)=>{try{const job=await AgentJob.findOne({terminalId:req.params.terminalId.toUpperCase(),status:{$nin:['approved','cancelled']}}).populate('agent','name email').select('terminalId agent status dueAt businessName');res.json({busy:Boolean(job),job});}catch(e){next(e)}});
app.get('/api/route-sheet',auth,permit('admin','manager','agent'),async(req,res,next)=>{try{const q={status:{$nin:['cancelled']}};if(req.user.role==='agent')q.agent=req.user._id;else if(req.query.agentId)q.agent=req.query.agentId;if(req.query.date){const today=new Date(req.query.date+'T00:00:00.000Z');const tomorrow=new Date(today);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);q.dueAt={$gte:today,$lt:tomorrow};}const jobs=await AgentJob.find(q).populate('terminal','terminalId official.status official.name official.locationArea official.cashBalance official.city current.businessName current.address current.city').lean();const validJobs=jobs.filter(j=>j.terminal);const grouped={};for(const job of validJobs){const area=job.terminal.official?.locationArea||'Unassigned Area';if(!grouped[area])grouped[area]=[];grouped[area].push(job);}const sortedGroups=Object.keys(grouped).sort().map(key=>({area:key,jobs:grouped[key].sort((a,b)=>a.terminalId.localeCompare(b.terminalId))}));res.json(sortedGroups);}catch(e){next(e)}});
app.patch('/api/route-sheet/:jobId',auth,permit('admin','manager','agent'),async(req,res,next)=>{try{const job=await AgentJob.findById(req.params.jobId);if(!job)return res.status(404).json({message:'Job not found'});if(req.user.role==='agent'&&String(job.agent)!==String(req.user._id))return res.status(403).json({message:'Not authorized to edit this job'});const b=req.body;if(b.routeExistingCash!==undefined)job.routeExistingCash=b.routeExistingCash===null?undefined:Number(b.routeExistingCash);if(b.routeCashLoaded!==undefined)job.routeCashLoaded=b.routeCashLoaded===null?undefined:Number(b.routeCashLoaded);if(b.routeLoadTime!==undefined)job.routeLoadTime=b.routeLoadTime===null?undefined:String(b.routeLoadTime);await job.save();res.json(job);}catch(e){next(e)}});
app.get('/api/location-areas',auth,async(req,res,next)=>{try{const areas=await Terminal.aggregate([{$match:{'official.locationArea':{$nin:[null,'']},'official.sourcePresent':true}},{$group:{_id:'$official.locationArea',terminals:{$sum:1},cities:{$addToSet:{$ifNull:['$official.city','$current.city']}}}},{$sort:{_id:1}}]);res.json(areas.map(a=>({name:a._id,terminals:a.terminals,cities:a.cities.filter(Boolean)})));}catch(e){next(e)}});
app.get('/api/location-areas/:area/terminals',auth,async(req,res,next)=>{try{const areaParam=String(req.params.area);const areaList=areaParam.split(',').map(a=>a.trim()).filter(Boolean);const terminals=await Terminal.find({'official.locationArea':{$in:areaList},'official.sourcePresent':true}).select('terminalId official.status official.name official.locationArea official.wishAmount official.cashBalance official.lastWithdrawalAt official.city current.businessName current.address current.city').sort({'official.locationArea':1,'official.city':1,terminalId:1}).lean();const active=await AgentJob.find({terminalId:{$in:terminals.map(t=>t.terminalId)},status:{$nin:['approved','cancelled']}}).select('terminalId agent status dueAt').populate('agent','name').lean();const jobs=new Map(active.map(j=>[j.terminalId,j]));res.json(terminals.map(t=>({...t,current:{...t.current,city:t.current?.city||t.official?.city||''},requiredCash:Math.max(0,(t.official?.wishAmount||0)-(t.official?.cashBalance||0)),activeJob:jobs.get(t.terminalId)||null})));}catch(e){next(e)}});
app.post('/api/jobs/dispatch',auth,permit('admin','manager','dispatch'),async(req,res,next)=>{try{const b=z.object({terminalId:z.string().min(2),agentId:z.string().min(2),cashToLoad:z.number().nonnegative(),dueAt:z.string().min(1),note:z.string().max(2000).optional(),localDate:z.string().optional()}).parse(req.body);const [terminal,agent]=await Promise.all([Terminal.findOne({terminalId:b.terminalId.toUpperCase()}),User.findOne({_id:b.agentId,role:'agent',active:true})]);if(!terminal)return res.status(404).json({message:'Terminal not found'});if(terminal.official?.status==='Inactive')return res.status(400).json({message:`Cannot dispatch job: Terminal ${terminal.terminalId} is currently Inactive. Please activate the terminal in Terminal Registry first.`});if(!agent)return res.status(400).json({message:'Selected agent is unavailable'});const terminalJob=await AgentJob.findOne({terminalId:terminal.terminalId,status:{$nin:['approved','cancelled']}}).populate('agent','name');if(terminalJob)return res.status(409).json({message:`${terminal.terminalId} is already assigned to ${terminalJob.agent?.name||'an agent'}. Complete and approve that job first.`});
if(b.cashToLoad>0){
  let today, tomorrow;
  if(b.localDate && /^\d{4}-\d{2}-\d{2}$/.test(b.localDate)){
    today   = new Date(b.localDate + 'T00:00:00.000Z');
    tomorrow= new Date(b.localDate + 'T00:00:00.000Z');
    tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  } else {
    today=new Date();today.setHours(0,0,0,0);
    tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  }
  const dq={date:{$gte:today,$lt:tomorrow}};const jq={createdAt:{$gte:today,$lt:tomorrow}};const[withdrawn,alreadyDispatched,returned]=await Promise.all([CashWithdrawal.aggregate([{$match:dq},{$group:{_id:null,total:{$sum:'$amount'}}}]).then(r=>r[0]?.total||0),AgentJob.aggregate([{$match:jq},{$group:{_id:null,total:{$sum:'$cashToLoad'}}}]).then(r=>r[0]?.total||0),CashReturn.aggregate([{$match:dq},{$group:{_id:null,total:{$sum:'$amount'}}}]).then(r=>r[0]?.total||0)]);const available=withdrawn-alreadyDispatched+returned;if(b.cashToLoad>available)return res.status(400).json({message:`Insufficient cash balance. Available today: $${available.toLocaleString()} (Withdrawn: $${withdrawn.toLocaleString()}, Already dispatched: $${alreadyDispatched.toLocaleString()}, Returned: $${returned.toLocaleString()})`,available,withdrawn,alreadyDispatched,returned});
}
const job=await AgentJob.create({terminal:terminal._id,terminalId:terminal.terminalId,agent:agent._id,assignedBy:req.user._id,businessName:terminal.current?.businessName||terminal.official?.tempName||terminal.original?.businessName,address:terminal.current?.address||terminal.original?.address,city:terminal.current?.city||terminal.original?.city,wishAmount:terminal.official?.wishAmount||terminal.alert?.threshold||0,cashToLoad:b.cashToLoad,dueAt:new Date(b.dueAt),events:[{status:'assigned',note:b.note,createdBy:req.user._id}]});await audit(req,'DAILY_AGENT_DISPATCHED','AgentJob',job.id,{terminalId:terminal.terminalId,agent:agent.email,cashToLoad:b.cashToLoad,dueAt:b.dueAt});res.status(201).json(await job.populate('agent','name email'));}catch(e){next(e)}});

app.post('/api/jobs/dispatch-area',auth,permit('admin','manager','area'),async(req,res,next)=>{try{const b=z.object({locationArea:z.string().optional(),locationAreas:z.array(z.string()).optional(),agentId:z.string().optional(),agentOverrides:z.record(z.string(),z.string()).optional(),dueAt:z.string().min(1),note:z.string().max(2000).optional(),terminalIds:z.array(z.string()).min(1),cashOverrides:z.record(z.string(),z.number().nonnegative()).optional(),localDate:z.string().optional()}).parse(req.body);const areas=b.locationAreas&&b.locationAreas.length?b.locationAreas:[b.locationArea].filter(Boolean);if(!areas.length)return res.status(400).json({message:'At least one location area is required'});const terminals=await Terminal.find({terminalId:{$in:b.terminalIds.map(id=>id.toUpperCase())},'official.locationArea':{$in:areas},'official.sourcePresent':true});const inactiveTerminals=terminals.filter(t=>t.official?.status==='Inactive');if(inactiveTerminals.length>0)return res.status(400).json({message:`Cannot dispatch area route: Terminal(s) ${inactiveTerminals.map(t=>t.terminalId).join(', ')} are currently Inactive. Please activate them first.`});const locked=await AgentJob.distinct('terminalId',{terminalId:{$in:terminals.map(t=>t.terminalId)},status:{$nin:['approved','cancelled']}});const lockedSet=new Set(locked);const eligible=terminals.filter(t=>!lockedSet.has(t.terminalId));if(!eligible.length)return res.status(409).json({message:'All selected ATMs already have active jobs'});
// ── Balance check ──────────────────────────────────────────────────────────
const totalRequested=eligible.reduce((s,t)=>{const def=Math.max(0,(t.official?.wishAmount||0)-(t.official?.cashBalance||0));return s+(b.cashOverrides?.[t.terminalId]??def)},0);
if(totalRequested>0){
  let today, tomorrow;
  if(b.localDate && /^\d{4}-\d{2}-\d{2}$/.test(b.localDate)){
    today   = new Date(b.localDate + 'T00:00:00.000Z');
    tomorrow= new Date(b.localDate + 'T00:00:00.000Z');
    tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  } else {
    today=new Date();today.setHours(0,0,0,0);
    tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  }
  const dq={date:{$gte:today,$lt:tomorrow}};const jq={createdAt:{$gte:today,$lt:tomorrow}};const[withdrawn,alreadyDispatched,returned]=await Promise.all([CashWithdrawal.aggregate([{$match:dq},{$group:{_id:null,total:{$sum:'$amount'}}}]).then(r=>r[0]?.total||0),AgentJob.aggregate([{$match:jq},{$group:{_id:null,total:{$sum:'$cashToLoad'}}}]).then(r=>r[0]?.total||0),CashReturn.aggregate([{$match:dq},{$group:{_id:null,total:{$sum:'$amount'}}}]).then(r=>r[0]?.total||0)]);const available=withdrawn-alreadyDispatched+returned;if(totalRequested>available)return res.status(400).json({message:`Insufficient cash. This route needs $${totalRequested.toLocaleString()} but only $${available.toLocaleString()} available today. (Withdrawn: $${withdrawn.toLocaleString()}, Dispatched: $${alreadyDispatched.toLocaleString()}, Returned: $${returned.toLocaleString()})`,available,withdrawn,alreadyDispatched,returned,totalRequested});
}
const batchId=crypto.randomUUID();const primaryArea=areas.join(', ');const jobs=await AgentJob.insertMany(eligible.map(t=>{const defaultLoad=Math.max(0,(t.official?.wishAmount||0)-(t.official?.cashBalance||0));const cashToLoad=b.cashOverrides?.[t.terminalId]??defaultLoad;const targetAgentId=b.agentOverrides?.[t.terminalId]||b.agentId;const targetNote=b.noteOverrides?.[t.terminalId]||'';if(!targetAgentId)throw new Error(`Agent must be assigned for terminal ${t.terminalId}`);return{batchId,locationArea:t.official?.locationArea||primaryArea,terminal:t._id,terminalId:t.terminalId,agent:targetAgentId,assignedBy:req.user._id,businessName:t.current?.businessName||t.official?.tempName||t.original?.businessName,address:t.current?.address||t.original?.address,city:t.current?.city||t.official?.city,wishAmount:t.official?.wishAmount||0,cashToLoad,dueAt:new Date(b.dueAt),events:[{status:'assigned',note:`Area route: ${t.official?.locationArea||primaryArea}${b.note?` — ${b.note}`:''}${targetNote?` — ${targetNote}`:''}`,createdBy:req.user._id}]}}));await audit(req,'AREA_ROUTE_DISPATCHED','AgentJob',batchId,{locationArea:primaryArea,assigned:jobs.length,skippedLocked:locked.length,terminalIds:jobs.map(j=>j.terminalId)});res.status(201).json({batchId,assigned:jobs.length,skippedLocked:locked.length,totalCash:jobs.reduce((s,j)=>s+j.cashToLoad,0)});}catch(e){next(e)}});
app.post('/api/jobs/:id/events',auth,proofUpload.array('proofs',4),async(req,res,next)=>{try{const job=await AgentJob.findById(req.params.id);if(!job)return res.status(404).json({message:'Job not found'});const isAgent=req.user.role==='agent'&&String(job.agent)===String(req.user._id);if(!isAgent&&!['admin','manager'].includes(req.user.role))return res.status(403).json({message:'This job is not assigned to you'});const b=z.object({status:z.enum(['accepted','travelling','cash_loaded','issue_reported']),note:z.string().max(2000).optional(),cashLoaded:z.coerce.number().nonnegative().optional()}).parse(req.body);if(b.status==='cash_loaded'&&(b.cashLoaded==null||!req.files?.length))return res.status(400).json({message:'Cash amount and at least one proof file are required'});if(b.status==='issue_reported'&&!b.note)return res.status(400).json({message:'Please describe the issue'});const proofFiles=[];for(const file of req.files||[]){const isPdf=file.mimetype==='application/pdf';const uploaded=await uploadBuffer(file.buffer,{folder:'atm-command-center/proofs',resource_type:isPdf?'raw':'image',public_id:`proof_${crypto.randomUUID()}`,overwrite:false});proofFiles.push({originalName:file.originalname,storedName:uploaded.publicId,mimeType:file.mimetype,size:file.size,url:uploaded.secureUrl});}job.status=b.status;job.events.push({status:b.status,note:b.note,cashLoaded:b.cashLoaded,proofFiles,createdBy:req.user._id});await job.save();await job.populate('agent','name email');await audit(req,'AGENT_JOB_UPDATED','AgentJob',job.id,{terminalId:job.terminalId,status:b.status,cashLoaded:b.cashLoaded,agentId:job.agent?._id,agentName:job.agent?.name,agentEmail:job.agent?.email});res.json(job);}catch(e){next(e)}});
app.post('/api/jobs/:id/approve',auth,permit('admin','manager'),async(req,res,next)=>{try{const job=await AgentJob.findById(req.params.id);if(!job)return res.status(404).json({message:'Job not found'});if(job.status!=='cash_loaded')return res.status(400).json({message:'Only a cash-loaded job can be approved'});job.status='approved';job.approvedAt=new Date();job.approvedBy=req.user._id;job.events.push({status:'approved',note:req.body?.note,createdBy:req.user._id});await job.save();const loadEvent=[...job.events].reverse().find(e=>e.status==='cash_loaded');const loadedAmount=Number((loadEvent?.cashLoaded??job.cashToLoad)||0);await Terminal.updateOne({_id:job.terminal},{$inc:{'official.cashBalance':loadedAmount}});await job.populate('agent','name email');await audit(req,'AGENT_JOB_APPROVED','AgentJob',job.id,{terminalId:job.terminalId,loadedAmount,agentId:job.agent?._id,agentName:job.agent?.name,agentEmail:job.agent?.email});res.json(job);}catch(e){next(e)}});
app.get('/api/jobs/:id/proofs/:file',auth,async(req,res,next)=>{try{const job=await AgentJob.findById(req.params.id);if(!job)return res.status(404).end();const allowed=req.user.role!=='agent'||String(job.agent)===String(req.user._id);if(!allowed)return res.status(403).end();const proof=job.events.flatMap(e=>e.proofFiles||[]).find(f=>f.storedName===req.params.file||f.url===req.params.file);if(!proof?.url)return res.status(404).end();res.redirect(proof.url);}catch(e){next(e)}});
// ── Cash Withdrawal (admin banks cash out) ──────────────────────────────────
app.post('/api/cash/withdraw',auth,permit('admin','manager','ledger'),async(req,res,next)=>{try{const b=z.object({amount:z.number().min(1),note:z.string().max(500).optional(),date:z.string().optional()}).parse(req.body);const rec=await CashWithdrawal.create({amount:b.amount,note:b.note,withdrawnBy:req.user._id,date:b.date?new Date(b.date):new Date()});await audit(req,'CASH_WITHDRAWN','CashWithdrawal',rec.id,{amount:b.amount});res.status(201).json(rec);}catch(e){next(e)}});
app.get('/api/cash/withdrawals',auth,permit('admin','manager','ledger'),async(req,res,next)=>{try{const page=Math.max(1,+req.query.page||1),limit=20;const q={};if(req.query.from)q.date={$gte:new Date(req.query.from+'T00:00:00')};if(req.query.to)q.date={...q.date,$lte:new Date(req.query.to+'T23:59:59.999')};const[items,total]=await Promise.all([CashWithdrawal.find(q).sort({date:-1}).skip((page-1)*limit).limit(limit).populate('withdrawnBy','name'),CashWithdrawal.countDocuments(q)]);const sum=await CashWithdrawal.aggregate([{$match:q},{$group:{_id:null,total:{$sum:'$amount'}}}]);res.json({items,total,pages:Math.ceil(total/limit),page,totalAmount:sum[0]?.total||0});}catch(e){next(e)}});
app.delete('/api/cash/withdrawals/:id',auth,permit('admin'),async(req,res,next)=>{try{await CashWithdrawal.findByIdAndDelete(req.params.id);res.json({ok:true});}catch(e){next(e)}});

// ── Cash Return (agent returns leftover cash) ───────────────────────────────
app.post('/api/cash/return',auth,permit('admin','manager','ledger'),async(req,res,next)=>{try{const b=z.object({agentId:z.string().min(1),amount:z.number().min(0),jobIds:z.array(z.string()).optional(),note:z.string().max(500).optional(),date:z.string().optional()}).parse(req.body);const rec=await CashReturn.create({agent:b.agentId,amount:b.amount,jobIds:b.jobIds||[],note:b.note,recordedBy:req.user._id,date:b.date?new Date(b.date):new Date()});await audit(req,'CASH_RETURNED','CashReturn',rec.id,{amount:b.amount,agentId:b.agentId});res.status(201).json(rec);}catch(e){next(e)}});
app.get('/api/cash/returns',auth,permit('admin','manager','ledger'),async(req,res,next)=>{try{const page=Math.max(1,+req.query.page||1),limit=20;const q={};if(req.query.agentId)q.agent=req.query.agentId;if(req.query.from)q.date={$gte:new Date(req.query.from+'T00:00:00')};if(req.query.to)q.date={...q.date,$lte:new Date(req.query.to+'T23:59:59.999')};const[items,total]=await Promise.all([CashReturn.find(q).sort({date:-1}).skip((page-1)*limit).limit(limit).populate('agent','name email').populate('recordedBy','name').populate('jobIds','terminalId businessName'),CashReturn.countDocuments(q)]);const sum=await CashReturn.aggregate([{$match:q},{$group:{_id:null,total:{$sum:'$amount'}}}]);res.json({items,total,pages:Math.ceil(total/limit),page,totalAmount:sum[0]?.total||0});}catch(e){next(e)}});
app.delete('/api/cash/returns/:id',auth,permit('admin'),async(req,res,next)=>{try{await CashReturn.findByIdAndDelete(req.params.id);res.json({ok:true});}catch(e){next(e)}});

// ── Cash available balance (today) ───────────────────────────────────────────
app.get('/api/cash/available',auth,permit('admin','manager','ledger','dispatch','area'),async(req,res,next)=>{try{
  // Use client-supplied local date (YYYY-MM-DD) so server timezone (UTC on Vercel)
  // never mismatches client timezone (e.g. PKT UTC+5).
  let today, tomorrow;
  if(req.query.localDate && /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate)){
    today   = new Date(req.query.localDate + 'T00:00:00.000Z');
    tomorrow= new Date(req.query.localDate + 'T00:00:00.000Z');
    tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  } else {
    // fallback: use server local midnight
    today=new Date(); today.setHours(0,0,0,0);
    tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  }
  const dq={date:{$gte:today,$lt:tomorrow}};
  const jq={createdAt:{$gte:today,$lt:tomorrow}};
  const[withdrawn,dispatched,returned]=await Promise.all([
    CashWithdrawal.aggregate([{$match:dq},{$group:{_id:null,total:{$sum:'$amount'}}}]).then(r=>r[0]?.total||0),
    AgentJob.aggregate([{$match:jq},{$group:{_id:null,total:{$sum:'$cashToLoad'}}}]).then(r=>r[0]?.total||0),
    CashReturn.aggregate([{$match:dq},{$group:{_id:null,total:{$sum:'$amount'}}}]).then(r=>r[0]?.total||0),
  ]);
  const available=withdrawn-dispatched+returned;
  res.json({withdrawn,dispatched,returned,available,date:today});
}catch(e){next(e)}});

// ── Cash Ledger summary ──────────────────────────────────────────────────────
app.get('/api/cash/ledger',auth,permit('admin','manager','ledger'),async(req,res,next)=>{try{
  const from=req.query.from?new Date(req.query.from+'T00:00:00'):new Date(new Date().setDate(1)); // default: month start
  const to=req.query.to?new Date(req.query.to+'T23:59:59.999'):new Date();
  const dq={date:{$gte:from,$lte:to}};
  const jq={createdAt:{$gte:from,$lte:to}};
  const [withdrawals,returns,dispatched,actualLoaded,returnsByAgent]=await Promise.all([
    CashWithdrawal.find(dq).sort({date:-1}).populate('withdrawnBy','name'),
    CashReturn.find(dq).sort({date:-1}).populate('agent','name email').populate('recordedBy','name').populate('jobIds','terminalId businessName'),
    AgentJob.aggregate([{$match:jq},{$group:{_id:'$agent',dispatched:{$sum:'$cashToLoad'},jobs:{$sum:1},approved:{$sum:{$cond:[{$eq:['$status','approved']},1,0]}}}}]),
    AgentJob.aggregate([{$match:{...jq,status:'approved'}},{$unwind:'$events'},{$match:{'events.status':'cash_loaded'}},{$group:{_id:'$agent',loaded:{$sum:'$events.cashLoaded'}}}]),
    CashReturn.aggregate([{$match:dq},{$group:{_id:'$agent',returned:{$sum:'$amount'}}}]),
  ]);
  const totalWithdrawn=withdrawals.reduce((s,w)=>s+w.amount,0);
  const totalReturned=returns.reduce((s,r)=>s+r.amount,0);
  const totalDispatched=dispatched.reduce((s,d)=>s+d.dispatched,0);
  const totalLoaded=actualLoaded.reduce((s,d)=>s+d.loaded,0);
  res.json({from,to,totalWithdrawn,totalDispatched,totalLoaded,totalReturned,netCashOut:totalDispatched-totalReturned,withdrawals,returns,dispatched,actualLoaded,returnsByAgent});
}catch(e){next(e)}});

// ── Cash Discrepancies ───────────────────────────────────────────────────────
app.get('/api/discrepancies',auth,permit('admin','manager','discrepancies'),async(req,res,next)=>{try{
  const q={};
  if(req.query.status)q.status=req.query.status; else q.status='open';
  if(req.query.terminalId)q.terminalId=req.query.terminalId.toUpperCase();
  const items=await CashDiscrepancy.find(q).sort({detectedAt:-1}).limit(100)
    .populate('agent','name email')
    .populate('job','terminalId businessName cashToLoad approvedAt')
    .populate('resolvedBy','name');
  const openCount=await CashDiscrepancy.countDocuments({status:'open'});
  const totalShortfall=await CashDiscrepancy.aggregate([{$match:{status:'open',discrepancy:{$gt:0}}},{$group:{_id:null,total:{$sum:'$discrepancy'}}}]).then(r=>r[0]?.total||0);
  res.json({items,openCount,totalShortfall});
}catch(e){next(e)}});

app.patch('/api/discrepancies/:id',auth,permit('admin','manager','discrepancies'),async(req,res,next)=>{try{
  const{status,resolveNote}=z.object({status:z.enum(['resolved','dismissed']),resolveNote:z.string().max(1000).optional()}).parse(req.body);
  const d=await CashDiscrepancy.findByIdAndUpdate(req.params.id,{$set:{status,resolveNote,resolvedBy:req.user._id,resolvedAt:new Date()}},{new:true}).populate('agent','name').populate('job','terminalId businessName');
  if(!d)return res.status(404).json({message:'Discrepancy not found'});
  await audit(req,'DISCREPANCY_RESOLVED','CashDiscrepancy',d.id,{terminalId:d.terminalId,status,discrepancy:d.discrepancy});
  res.json(d);
}catch(e){next(e)}});

app.get('/api/imports',auth,async(req,res,next)=>{try{res.json(await ImportRun.find().sort({createdAt:-1}).limit(20).populate('importedBy','name'));}catch(e){next(e)}});
app.get('/api/audit',auth,permit('admin','logs'),async(req,res,next)=>{try{res.json(await Audit.find().sort({createdAt:-1}).limit(100).populate('actor','name email'));}catch(e){next(e)}});

app.get('/api/logs',auth,permit('admin','manager','logs'),async(req,res,next)=>{try{
  const page=Math.max(1,+req.query.page||1);
  const limit=Math.min(500,Math.max(1,+req.query.limit||50));
  const search=String(req.query.search||'').trim();
  const category=req.query.category||'all';
  const statusFilter=req.query.status||'all';
  const agentId=req.query.agentId||'';
  const terminalId=req.query.terminalId?req.query.terminalId.toUpperCase():'';
  const fromDate=req.query.from?new Date(req.query.from+'T00:00:00'):null;
  const toDate=req.query.to?new Date(req.query.to+'T23:59:59.999'):null;

  const auditQuery={};
  if(fromDate||toDate){
    auditQuery.createdAt={};
    if(fromDate)auditQuery.createdAt.$gte=fromDate;
    if(toDate)auditQuery.createdAt.$lte=toDate;
  }

  const auditRecords=await Audit.find(auditQuery).sort({createdAt:-1}).limit(1000).populate('actor','name email role profilePicture').lean();

  const auditLogs=auditRecords.map(a=>{
    const meta=a.metadata||{};
    let cat='general';
    if(['DAILY_AGENT_DISPATCHED','AREA_ROUTE_DISPATCHED','TERMINAL_ASSIGNED'].includes(a.action))cat='dispatch';
    else if(['AGENT_JOB_UPDATED','AGENT_JOB_APPROVED','TICKET_CREATED','TICKET_UPDATED'].includes(a.action))cat='tasks';
    else if(['TERMINAL_STATUS_CHANGED'].includes(a.action))cat='terminals';
    else if(['AGENT_CREATED','AGENT_UPDATED','AGENT_DEACTIVATED','AGENT_REACTIVATED','AGENT_PASSWORD_RESET'].includes(a.action))cat='agents';
    else if(['CASH_WITHDRAWN','CASH_RETURNED','DISCREPANCY_RESOLVED'].includes(a.action))cat='ledger';
    else if(['OFFICIAL_IMPORT'].includes(a.action))cat='imports';

    return {
      _id:String(a._id),
      source:'audit',
      timestamp:a.createdAt,
      action:a.action,
      category:cat,
      actor:a.actor?{id:a.actor._id,name:a.actor.name,email:a.actor.email,role:a.actor.role}:null,
      agent:(meta.agentId||meta.agentEmail)?{id:meta.agentId,name:meta.agentName||meta.agent,email:meta.agentEmail}:null,
      terminalId:meta.terminalId||(a.entity==='Terminal'?a.entityId:''),
      businessName:meta.businessName||meta.to||'',
      address:meta.address||'',
      city:meta.city||'',
      status:meta.status||(a.action==='AGENT_JOB_APPROVED'?'approved':''),
      isCompleted:a.action==='AGENT_JOB_APPROVED'||meta.status==='approved',
      cashToLoad:meta.cashToLoad||0,
      cashLoaded:meta.cashLoaded||0,
      wishAmount:meta.wishAmount||0,
      amount:meta.amount||0,
      dueAt:meta.dueAt||null,
      note:meta.note||meta.resolveNote||meta.problem||meta.resolutionNote||'',
      proofFiles:meta.proofFiles||[],
      metadata:meta,
      ip:a.ip||''
    };
  });

  const jobQuery={};
  if(fromDate||toDate){
    jobQuery.createdAt={};
    if(fromDate)jobQuery.createdAt.$gte=fromDate;
    if(toDate)jobQuery.createdAt.$lte=toDate;
  }
  if(agentId)jobQuery.agent=agentId;
  if(terminalId)jobQuery.terminalId=terminalId;

  const jobs=await AgentJob.find(jobQuery).sort({createdAt:-1}).limit(1000).populate('agent','name email profilePicture').populate('assignedBy','name email role').populate('events.createdBy','name email role').lean();

  const jobLogs=[];
  for(const job of jobs){
    const agentObj=job.agent?{id:job.agent._id,name:job.agent.name,email:job.agent.email,profilePicture:job.agent.profilePicture?.url}:null;
    const assignedByObj=job.assignedBy?{id:job.assignedBy._id,name:job.assignedBy.name,email:job.assignedBy.email,role:job.assignedBy.role}:null;

    jobLogs.push({
      _id:`job_dispatch_${job._id}`,
      jobId:String(job._id),
      source:'job_event',
      timestamp:job.createdAt,
      action:job.batchId?'AREA_ROUTE_DISPATCHED':'DAILY_AGENT_DISPATCHED',
      category:'dispatch',
      actor:assignedByObj,
      agent:agentObj,
      terminalId:job.terminalId,
      businessName:job.businessName,
      address:job.address,
      city:job.city,
      locationArea:job.locationArea,
      status:'assigned',
      isCompleted:job.status==='approved',
      cashToLoad:job.cashToLoad,
      cashLoaded:0,
      wishAmount:job.wishAmount,
      dueAt:job.dueAt,
      note:job.events?.[0]?.note||'',
      proofFiles:[]
    });

    for(let i=1;i<(job.events||[]).length;i++){
      const ev=job.events[i];
      const eventActor=ev.createdBy?{id:ev.createdBy._id,name:ev.createdBy.name,email:ev.createdBy.email,role:ev.createdBy.role}:(ev.status==='approved'?assignedByObj:agentObj);
      const actionType=ev.status==='approved'?'AGENT_JOB_APPROVED':'AGENT_JOB_UPDATED';

      jobLogs.push({
        _id:`job_event_${job._id}_${i}_${ev.status}`,
        jobId:String(job._id),
        source:'job_event',
        timestamp:ev.createdAt||job.updatedAt,
        action:actionType,
        category:'tasks',
        actor:eventActor,
        agent:agentObj,
        terminalId:job.terminalId,
        businessName:job.businessName,
        address:job.address,
        city:job.city,
        status:ev.status,
        isCompleted:ev.status==='approved',
        cashToLoad:job.cashToLoad,
        cashLoaded:ev.cashLoaded||(ev.status==='approved'?(job.events.find(x=>x.status==='cash_loaded')?.cashLoaded||job.cashToLoad):0),
        wishAmount:job.wishAmount,
        dueAt:job.dueAt,
        note:ev.note||'',
        proofFiles:(ev.proofFiles||[]).map(p=>({url:p.url,originalName:p.originalName,mimeType:p.mimeType}))
      });
    }
  }

  const combined=[...auditLogs,...jobLogs];
  combined.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));

  const deduped=[];
  const seen=new Set();
  for(const log of combined){
    const key=`${log.action}_${log.terminalId}_${log.status}_${new Date(log.timestamp).toISOString().slice(0,16)}`;
    if(seen.has(key))continue;
    seen.add(key);
    deduped.push(log);
  }

  let filtered=deduped;

  if(category&&category!=='all'){
    filtered=filtered.filter(l=>l.category===category);
  }

  if(statusFilter&&statusFilter!=='all'){
    if(statusFilter==='completed'){
      filtered=filtered.filter(l=>l.isCompleted||l.status==='approved'||l.action==='AGENT_JOB_APPROVED');
    }else if(statusFilter==='in_progress'){
      filtered=filtered.filter(l=>['assigned','accepted','travelling'].includes(l.status));
    }else{
      filtered=filtered.filter(l=>l.status===statusFilter);
    }
  }

  if(agentId){
    filtered=filtered.filter(l=>l.agent&&(String(l.agent.id)===String(agentId)||String(l.agent._id)===String(agentId)));
  }

  if(terminalId){
    filtered=filtered.filter(l=>l.terminalId?.toUpperCase()===terminalId);
  }

  if(search){
    const rx=search.toLowerCase();
    filtered=filtered.filter(l=>
      l.terminalId?.toLowerCase().includes(rx)||
      l.businessName?.toLowerCase().includes(rx)||
      l.city?.toLowerCase().includes(rx)||
      l.agent?.name?.toLowerCase().includes(rx)||
      l.agent?.email?.toLowerCase().includes(rx)||
      l.actor?.name?.toLowerCase().includes(rx)||
      l.action?.toLowerCase().includes(rx)||
      l.status?.toLowerCase().includes(rx)||
      l.note?.toLowerCase().includes(rx)
    );
  }

  const totalLogs=filtered.length;
  const completedTasksCount=filtered.filter(l=>l.status==='approved'||l.action==='AGENT_JOB_APPROVED').length;
  const pendingTasksCount=filtered.filter(l=>['assigned','accepted','travelling','cash_loaded'].includes(l.status)).length;
  const issueTasksCount=filtered.filter(l=>l.status==='issue_reported').length;
  const totalCashDispatched=filtered.filter(l=>['DAILY_AGENT_DISPATCHED','AREA_ROUTE_DISPATCHED'].includes(l.action)).reduce((s,l)=>s+(l.cashToLoad||0),0);
  const totalCashLoaded=filtered.filter(l=>l.status==='approved'||l.action==='AGENT_JOB_APPROVED').reduce((s,l)=>s+(l.cashLoaded||0),0);

  const totalPages=Math.ceil(filtered.length/limit)||1;
  const paginatedItems=filtered.slice((page-1)*limit,page*limit);

  res.json({
    items:paginatedItems,
    total:totalLogs,
    page,
    pages:totalPages,
    stats:{
      totalLogs,
      completedTasksCount,
      pendingTasksCount,
      issueTasksCount,
      totalCashDispatched,
      totalCashLoaded
    }
  });
}catch(e){next(e)}});
app.get('/api/assignment-history',auth,permit('admin','history'),async(req,res,next)=>{try{const escape=s=>String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match={};if(req.query.search){const rx=new RegExp(escape(req.query.search),'i');match.$or=[{terminalId:rx},{'assignmentHistory.businessName':rx},{'assignmentHistory.address':rx},{'assignmentHistory.city':rx}];}if(req.query.city)match['assignmentHistory.city']=new RegExp(`^${escape(req.query.city)}$`,'i');if(req.query.from||req.query.to){match['assignmentHistory.assignedAt']={};if(req.query.from)match['assignmentHistory.assignedAt'].$gte=new Date(`${req.query.from}T00:00:00`);if(req.query.to)match['assignmentHistory.assignedAt'].$lte=new Date(`${req.query.to}T23:59:59.999`);}const limit=Math.min(5000,Math.max(1,+req.query.limit||500));const pipeline=[{$unwind:'$assignmentHistory'},{$match:match},{$lookup:{from:'users',localField:'assignmentHistory.assignedBy',foreignField:'_id',as:'assignedUser'}},{$unwind:{path:'$assignedUser',preserveNullAndEmptyArrays:true}},{$project:{_id:0,terminalId:1,originalBusiness:'$original.businessName',originalAddress:'$original.address',businessName:'$assignmentHistory.businessName',address:'$assignmentHistory.address',city:'$assignmentHistory.city',paymentAmount:'$assignmentHistory.paymentAmount',assignedAt:'$assignmentHistory.assignedAt',endedAt:'$assignmentHistory.endedAt',note:'$assignmentHistory.note',assignedBy:'$assignedUser.name',assignedByEmail:'$assignedUser.email'}},{$sort:{assignedAt:-1}},{$limit:limit}];const items=await Terminal.aggregate(pipeline);res.json({items,total:items.length,limited:items.length===limit});}catch(e){next(e)}});
// ── Tickets ─────────────────────────────────────────────────────────────────
app.post('/api/tickets', auth, async(req, res, next) => {
  try {
    const b = z.object({
      terminalId: z.string().min(2),
      problem: z.string().min(3).max(2000),
      assignedTo: z.string().optional()
    }).parse(req.body);
    
    const t = await Terminal.findOne({terminalId: b.terminalId.toUpperCase()});
    if(!t) return res.status(404).json({message: 'Terminal not found'});
    
    const payload = {
      terminalId: t.terminalId,
      problem: b.problem,
      generatedBy: req.user._id
    };
    
    if (b.assignedTo && req.user.role === 'admin') {
      payload.assignedTo = b.assignedTo;
    }
    
    const ticket = await Ticket.create(payload);
    await ticket.populate('generatedBy', 'name email');
    if (ticket.assignedTo) await ticket.populate('assignedTo', 'name email');
    
    await audit(req, 'TICKET_CREATED', 'Ticket', ticket.id, { 
      terminalId: t.terminalId, 
      problem: b.problem, 
      status: ticket.status || 'Open',
      agentId: ticket.assignedTo?._id,
      agentName: ticket.assignedTo?.name,
      agentEmail: ticket.assignedTo?.email
    });

    const io = req.app.locals.io;
    if (io) {
      const bizName = t.current?.businessName || t.official?.tempName || t.official?.name || '';
      io.emit('terminal_alert', {
        type: 'ticket',
        title: 'New Maintenance Ticket',
        message: `New ticket generated for Terminal ${t.terminalId}${bizName ? ' (' + bizName + ')' : ''} by ${req.user.name}: "${b.problem.slice(0, 75)}${b.problem.length > 75 ? '...' : ''}"`,
        ticketId: ticket.id,
        terminalId: t.terminalId,
        problem: b.problem,
        generatedBy: req.user.name,
        assignedTo: ticket.assignedTo ? ticket.assignedTo.name : null
      });
    }

    res.status(201).json(ticket);
  } catch(e) { next(e); }
});

app.get('/api/tickets', auth, async(req, res, next) => {
  try {
    const page = Math.max(1, +req.query.page || 1);
    const limit = Math.min(100, Math.max(1, +req.query.limit || 25));
    const q = {};
    if(req.query.status) {
      if (req.query.status.includes(',')) {
        q.status = { $in: req.query.status.split(',').map(s => s.trim()) };
      } else {
        q.status = req.query.status;
      }
    }
    if(req.query.assignedTo) {
      q.assignedTo = req.query.assignedTo;
    } else if (req.user.role === 'agent' && !req.query.all) {
      q.assignedTo = req.user._id;
    }
    if(req.query.terminalId) q.terminalId = new RegExp(String(req.query.terminalId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    
    const [items, total] = await Promise.all([
      Ticket.find(q).sort({createdAt:-1}).skip((page-1)*limit).limit(limit)
        .populate('generatedBy', 'name email')
        .populate('assignedTo', 'name email')
        .lean(),
      Ticket.countDocuments(q)
    ]);

    if (items.length > 0) {
      const termIds = [...new Set(items.map(t => t.terminalId).filter(Boolean))];
      const terms = await Terminal.find({ terminalId: { $in: termIds } })
        .select('terminalId official.name official.address official.city official.locationArea official.status current.businessName current.address current.city')
        .lean();
      const termMap = new Map(terms.map(t => [t.terminalId, t]));
      for (const item of items) {
        item.terminal = termMap.get(item.terminalId) || null;
      }
    }

    res.json({items, total, page, pages: Math.ceil(total/limit)});
  } catch(e) { next(e); }
});

app.patch('/api/tickets/:id', auth, async(req, res, next) => {
  try {
    const b = z.object({
      status: z.enum(['Open','In Progress','Resolved','Closed']).optional(),
      resolutionNote: z.string().max(2000).optional(),
      assignedTo: z.string().optional()
    }).parse(req.body);
    
    const ticket = await Ticket.findById(req.params.id);
    if(b.status) ticket.status = b.status;
    if(b.resolutionNote !== undefined) ticket.resolutionNote = b.resolutionNote;
    if(b.assignedTo && req.user.role === 'admin') {
      if(['Resolved', 'Closed'].includes(ticket.status)) {
        return res.status(400).json({ message: `Cannot reassign agent on a ${ticket.status} ticket.` });
      }
      ticket.assignedTo = b.assignedTo;
    }
    
    await ticket.save();
    await ticket.populate('generatedBy', 'name email');
    if (ticket.assignedTo) await ticket.populate('assignedTo', 'name email');
    
    await audit(req, 'TICKET_UPDATED', 'Ticket', ticket.id, { 
      status: b.status, 
      resolutionNote: ticket.resolutionNote,
      agentId: ticket.assignedTo?._id,
      agentName: ticket.assignedTo?.name,
      agentEmail: ticket.assignedTo?.email
    });
    res.json(ticket);
  } catch(e) { next(e); }
});

// --- ATM Installation Forms ---
app.post('/api/atm/installation', auth, permit('admin', 'agent', 'atm'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.terminalId) return res.status(400).json({ message: 'Terminal ID is required' });
    
    // Save the installation form
    const installation = new AtmInstallation({
      ...data,
      createdBy: req.user._id
    });
    await installation.save();

    await audit(req, 'ATM_INSTALLATION_SUBMITTED', 'AtmInstallation', installation._id.toString(), { terminalId: data.terminalId });

    res.status(201).json({ message: 'Installation form saved successfully', installation });
  } catch(e) { next(e); }
});

app.get('/api/atm/installation/:terminalId', auth, permit('admin', 'agent', 'atm'), async (req, res, next) => {
  try {
    const termId = req.params.terminalId.toUpperCase().trim();
    const form = await AtmInstallation.findOne({ terminalId: termId }).sort({ createdAt: -1 });
    if (form) {
      return res.json(form);
    }
    
    // If no form exists, see if the Terminal exists to pre-fill the form
    const terminal = await Terminal.findOne({ terminalId: termId });
    if (terminal) {
      return res.json({
        terminalId: termId,
        locationName: terminal.current?.businessName || terminal.official?.name || '',
        locationStreet: terminal.current?.address || terminal.official?.address || '',
        locationCity: terminal.current?.city || terminal.official?.city || ''
      });
    }

    res.status(404).json({ message: 'No installation form or terminal found for this ID' });
  } catch(e) { next(e); }
});

app.post('/api/atm/agreement', auth, permit('admin', 'agent', 'atm'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.terminalId) return res.status(400).json({ message: 'Terminal ID is required' });
    
    const agreement = new AtmAgreement({
      ...data,
      createdBy: req.user._id
    });
    await agreement.save();

    await audit(req, 'ATM_AGREEMENT_SUBMITTED', 'AtmAgreement', agreement._id.toString(), { terminalId: data.terminalId });

    res.status(201).json({ message: 'Agreement form saved successfully', agreement });
  } catch(e) { next(e); }
});

app.post('/api/atm/removal', auth, permit('admin', 'agent', 'atm'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.terminalId) return res.status(400).json({ message: 'Terminal ID is required' });
    
    const removal = new AtmRemoval({
      ...data,
      createdBy: req.user._id
    });
    await removal.save();

    await audit(req, 'ATM_REMOVAL_SUBMITTED', 'AtmRemoval', removal._id.toString(), { terminalId: data.terminalId });

    res.status(201).json({ message: 'Removal form saved successfully', removal });
  } catch(e) { next(e); }
});

app.post('/api/atm/upload-form', auth, permit('admin', 'agent', 'atm'), proofUpload.single('file'), async (req, res, next) => {
  try {
    const { terminalId, formType, date, locationName, remarks } = req.body;
    if (!terminalId) return res.status(400).json({ message: 'Terminal ID is required' });
    if (!formType) return res.status(400).json({ message: 'Form Type is required' });
    if (!req.file) return res.status(400).json({ message: 'Form document/picture file is required' });

    const cleanTermId = terminalId.toUpperCase().trim();

    // Upload file to Cloudinary
    const uploaded = await uploadBuffer(req.file.buffer, {
      folder: 'atm-command-center/forms',
      resource_type: req.file.mimetype === 'application/pdf' ? 'raw' : 'image',
      public_id: `form_${cleanTermId}_${formType}_${Date.now()}`,
      overwrite: false
    });

    const docFile = {
      url: uploaded.secureUrl,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    };

    const effectiveDate = date ? new Date(date) : new Date();

    let createdRecord = null;
    if (formType === 'installation') {
      createdRecord = await AtmInstallation.create({
        terminalId: cleanTermId,
        date: effectiveDate,
        locationName: locationName || '',
        remarks: remarks || '',
        documentUrl: uploaded.secureUrl,
        documentFile: docFile,
        createdBy: req.user._id
      });
      await audit(req, 'ATM_INSTALLATION_DOCUMENT_UPLOADED', 'AtmInstallation', createdRecord.id, { terminalId: cleanTermId });
    } else if (formType === 'agreement') {
      createdRecord = await AtmAgreement.create({
        terminalId: cleanTermId,
        date: effectiveDate,
        customerName: locationName || '',
        remarks: remarks || '',
        documentUrl: uploaded.secureUrl,
        documentFile: docFile,
        createdBy: req.user._id
      });
      await audit(req, 'ATM_AGREEMENT_DOCUMENT_UPLOADED', 'AtmAgreement', createdRecord.id, { terminalId: cleanTermId });
    } else if (formType === 'removal') {
      createdRecord = await AtmRemoval.create({
        terminalId: cleanTermId,
        date: effectiveDate,
        locationName: locationName || '',
        remarks: remarks || '',
        documentUrl: uploaded.secureUrl,
        documentFile: docFile,
        createdBy: req.user._id
      });
      await audit(req, 'ATM_REMOVAL_DOCUMENT_UPLOADED', 'AtmRemoval', createdRecord.id, { terminalId: cleanTermId });
    } else if (formType === 'setup') {
      createdRecord = await AtmSetup.create({
        terminalId: cleanTermId,
        date: effectiveDate,
        locationName: locationName || '',
        remarks: remarks || '',
        documentUrl: uploaded.secureUrl,
        documentFile: docFile,
        createdBy: req.user._id
      });
      await audit(req, 'ATM_SETUP_DOCUMENT_UPLOADED', 'AtmSetup', createdRecord.id, { terminalId: cleanTermId });
    } else {
      return res.status(400).json({ message: 'Invalid Form Type' });
    }

    res.status(201).json({
      message: 'Form document uploaded successfully',
      record: createdRecord,
      url: uploaded.secureUrl
    });
  } catch(e) { next(e); }
});

app.get('/api/atm/timeline/:terminalId', auth, permit('admin', 'agent', 'atm'), async (req, res, next) => {
  try {
    const termId = req.params.terminalId.toUpperCase().trim();
    
    // Fetch all forms associated with this terminal
    const [installations, agreements, removals, setups] = await Promise.all([
      AtmInstallation.find({ terminalId: termId }).populate('createdBy', 'name').lean(),
      AtmAgreement.find({ terminalId: termId }).populate('createdBy', 'name').lean(),
      AtmRemoval.find({ terminalId: termId }).populate('createdBy', 'name').lean(),
      AtmSetup.find({ terminalId: termId }).populate('createdBy', 'name').lean()
    ]);

    // Map each form to a timeline event object
    const timeline = [
      ...installations.map(doc => ({ type: 'AtmInstallation', title: 'ATM Installation', date: doc.date || doc.createdAt, data: doc })),
      ...agreements.map(doc => ({ type: 'AtmAgreement', title: 'ATM Agreement', date: doc.date || doc.createdAt, data: doc })),
      ...removals.map(doc => ({ type: 'AtmRemoval', title: 'ATM Removal', date: doc.date || doc.createdAt, data: doc })),
      ...setups.map(doc => ({ type: 'AtmSetup', title: 'ATM Setup & Location', date: doc.date || doc.createdAt, data: doc }))
    ];

    // Sort by date (newest first)
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(timeline);
  } catch(e) { next(e); }
});

app.use((err,req,res,next)=>{console.error(err);if(err.name==='ZodError')return res.status(400).json({message:'Validation failed',issues:err.issues});res.status(500).json({message:'An unexpected error occurred',...(process.env.NODE_ENV!=='production'?{detail:err.message}:{})});});
async function start(){
  await mongoose.connect(process.env.MONGODB_URI);
  const email=process.env.ADMIN_EMAIL?.toLowerCase();
  if(email&&!await User.exists({email}))await User.create({name:'Administrator',email,passwordHash:await bcrypt.hash(process.env.ADMIN_PASSWORD,12),role:'admin'});
  const server = require('http').createServer(app);
  const io = new (require('socket.io').Server)(server, { cors: { origin: process.env.CLIENT_ORIGIN?.split(',') || '*' } });
  app.locals.io = io;
  io.on('connection', (socket) => { console.log('Socket.IO Client connected:', socket.id); socket.on('disconnect', () => console.log('Socket.IO Client disconnected:', socket.id)); });
  server.listen(process.env.PORT||4000,'localhost',()=>console.log(`API ready on ${process.env.PORT||4000}`));
} 
if(require.main===module)start().catch(e=>{console.error(e);process.exit(1)});

// Vercel serverless handler
async function connectDB() {
  if (mongoose.connection.readyState === 1) return; // already connected
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  if (email && !await User.exists({ email })) {
    await User.create({ name: 'Administrator', email, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'admin' });
  }
}

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (e) {
    console.error('DB connection failed:', e.message);
    return res.status(500).json({ message: 'Database connection failed', detail: e.message });
  }
  return app(req, res);
};


