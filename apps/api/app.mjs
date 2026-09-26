import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { basename,resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { openDatabase,tenantStore,id,timestamp,passwordHash,passwordMatches,hashToken,transaction,patientFacts } from '../../database/db.mjs';
import { seedDemo } from '../../database/seed/index.mjs';
import { analyse,DEFAULT_SETTINGS } from '../../packages/rules/index.mjs';
import { TYPES } from '../../packages/domain/index.mjs';
import { draftMessage,campaignTemplate,explainOpportunity,answerQuestion } from '../../packages/ai/index.mjs';
import { audiencePreview,createCampaign,approveCampaign,sendCampaign,campaignMetrics,recordOutcome } from '../../packages/domain/campaigns.mjs';
import { FIELDS } from '../../connectors/generic-csv/index.mjs';
import { getConnector,listConnectors } from '../../connectors/index.mjs';
import { analytics } from './analytics.mjs';
const typeSchema=z.enum(Object.keys(TYPES)); const channelSchema=z.enum(['whatsapp','sms','email']);
const campaignSchema=z.object({name:z.string().trim().min(3).max(100),type:typeSchema,channel:channelSchema,template:z.string().trim().min(20).max(1600),opportunityIds:z.array(z.string()).max(1000).optional()});
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const userView=u=>({id:u.id,name:u.name,email:u.email,role:u.role});
const safePractice=p=>({...p,settings:{...DEFAULT_SETTINGS,...JSON.parse(p.settings)}});
export function createApp({db=openDatabase(),demo=process.env.SEED_DEMO==='true',aiProvider}={}) {
  if(demo) seedDemo(db);
  const app=express(); app.disable('x-powered-by');
  app.locals.db=db;
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],connectSrc:["'self'"],fontSrc:["'self'"],objectSrc:["'none'"],upgradeInsecureRequests:null}}}));
  app.use(express.json({limit:'256kb'}));
  app.use('/api',rateLimit({windowMs:60_000,limit:300,standardHeaders:'draft-8',legacyHeaders:false}));
  app.use('/api',(req,res,next)=>{
    res.set('Cache-Control','no-store');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
      if(req.get('X-Requested-With')!=='OpticalOperator') return res.status(403).json({error:'A same-origin application request is required.'});
      const allowed=new Set([process.env.APP_ORIGIN||'http://localhost:5173','http://127.0.0.1:5173',`${req.protocol}://${req.get('host')}`]);
      if(req.get('Origin')&&!allowed.has(req.get('Origin'))) return res.status(403).json({error:'Origin is not allowed.'});
    }
    next();
  });
  const cookieOptions={httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',path:'/',maxAge:8*60*60*1000};
  function session(req,res,user) {
    const token=randomBytes(32).toString('hex'); const now=timestamp();
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hashToken(token),user.id,new Date(Date.now()+8*60*60*1000).toISOString());
    res.cookie('optical_session',token,cookieOptions);
    const store=tenantStore(db,user.tenant_id);store.audit('auth.login',user.id,user.id);
    return {user:userView(user),practice:safePractice(store.practice()),demo,provider:'mock'};
  }
  const loginLimiter=rateLimit({windowMs:15*60_000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,skipSuccessfulRequests:true});
  app.get('/api/health',(req,res)=>res.json({status:'ok',version:'0.2.0'}));
  app.get('/api/config',(req,res)=>res.json({demo,signup:demo||process.env.ALLOW_SIGNUP==='true'}));
  app.post('/api/auth/login',loginLimiter,(req,res)=>{
    const input=z.object({email:z.email().max(200),password:z.string().min(1).max(200)}).parse(req.body);
    const user=db.prepare('SELECT * FROM users WHERE email=?').get(input.email.toLowerCase());
    if(!user||!passwordMatches(input.password,user.password_hash)) fail(401,'Email or password is incorrect.');
    res.json(session(req,res,user));
  });
  app.post('/api/auth/register',loginLimiter,(req,res)=>{
    if(!demo&&process.env.ALLOW_SIGNUP!=='true') fail(403,'Practice registration is disabled.');
    const input=z.object({practice:z.string().trim().min(2).max(100),name:z.string().trim().min(2).max(100),email:z.email().max(200),password:z.string().min(12).max(200)}).parse(req.body);
    if(db.prepare('SELECT id FROM users WHERE email=?').get(input.email.toLowerCase())) fail(409,'An account with that email already exists.');
    const user=transaction(db,()=>{const tenantId=id('practice');db.prepare('INSERT INTO practices(id,name,created_at) VALUES(?,?,?)').run(tenantId,input.practice,timestamp());const store=tenantStore(db,tenantId);const user=store.insert('users',{id:id('user'),name:input.name,email:input.email.toLowerCase(),password_hash:passwordHash(input.password),role:'owner',created_at:timestamp()});store.insert('outlets',{id:id('outlet'),name:'Main practice'});store.audit('practice.created',tenantId,user.id);return user;});
    res.status(201).json(session(req,res,user));
  });
  app.use('/api',(req,res,next)=>{
    const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('optical_session='))?.slice(16);
    if(!token) return res.status(401).json({error:'Sign in to your practice to continue.'});
    const row=db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hashToken(token),timestamp());
    if(!row) return res.status(401).json({error:'Your session expired. Please sign in again.'});
    req.user=row;req.store=tenantStore(db,row.tenant_id);req.token=token;next();
  });
  const manage=(req,res,next)=>['owner','manager'].includes(req.user.role)?next():res.status(403).json({error:'An owner or manager must approve this action.'});
  const owner=(req,res,next)=>req.user.role==='owner'?next():res.status(403).json({error:'Only the practice owner can change these settings.'});
  app.get('/api/auth/me',(req,res)=>res.json({user:userView(req.user),practice:safePractice(req.store.practice()),demo,provider:'mock'}));
  app.get('/api/connectors',(req,res)=>res.json(listConnectors()));
  app.post('/api/auth/logout',(req,res)=>{db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(req.token));req.store.audit('auth.logout',req.user.id,req.user.id);res.clearCookie('optical_session',cookieOptions);res.json({ok:true});});
  app.get('/api/dashboard',(req,res)=>res.json(analytics(req.store)));
  app.get('/api/opportunities',(req,res)=>{
    const params=z.object({type:z.string().optional(),status:z.string().optional(),search:z.string().max(160).optional(),outlet:z.string().optional(),priority:z.string().optional(),from:z.string().optional(),to:z.string().optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(20)}).parse(req.query);
    const patients=new Map(patientFacts(req.store).map(p=>[p.id,p]));
    let rows=req.store.all('opportunities').map(o=>({...o,patient:patients.get(o.patient_id),evidence:JSON.parse(o.evidence),components:JSON.parse(o.components)}));
    rows=rows.filter(o=>(!params.type||o.type===params.type)&&(!params.status||params.status==='all'||o.status===params.status)&&(!params.outlet||o.patient.outlet===params.outlet)&&(!params.priority||(params.priority==='high'?o.score>=75:o.score<75))&&(!params.search||`${o.patient.name} ${o.patient.source_id}`.toLowerCase().includes(params.search.toLowerCase()))&&(!params.from||(o.patient.last_purchase||o.patient.last_exam||'')>=params.from)&&(!params.to||(o.patient.last_purchase||o.patient.last_exam||'')<=params.to)).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    res.json({items:rows.slice((params.page-1)*params.limit,params.page*params.limit),total:rows.length,page:params.page,types:TYPES,outlets:[...new Set([...patients.values()].map(p=>p.outlet))]});
  });
  app.post('/api/opportunities/analyse',manage,(req,res)=>res.json(transaction(db,()=>{const count=analyse(req.store);req.store.audit('opportunities.analysed',null,req.user.id,{count});return {count};})));
  app.get('/api/opportunities/:id',(req,res)=>{
    const opportunity=req.store.get('opportunities',req.params.id);if(!opportunity)fail(404,'Opportunity not found.');
    const patient=patientFacts(req.store).find(p=>p.id===opportunity.patient_id);
    req.store.audit('opportunity.viewed',opportunity.id,req.user.id);
    res.json({...opportunity,evidence:JSON.parse(opportunity.evidence),components:JSON.parse(opportunity.components),patient,explanation:explainOpportunity(opportunity),visits:req.store.all('visits','patient_id = ?',[patient.id]),transactions:req.store.all('transactions','patient_id = ?',[patient.id]).sort((a,b)=>b.date.localeCompare(a.date))});
  });
  app.post('/api/opportunities/:id/draft',async(req,res)=>{
    const opportunity=req.store.get('opportunities',req.params.id);if(!opportunity)fail(404,'Opportunity not found.');
    const {tone}=z.object({tone:z.enum(['warm','concise','professional']).default('warm')}).parse(req.body);
    const draft=await draftMessage({practice:req.store.practice(),patient:req.store.get('patients',opportunity.patient_id),opportunity},aiProvider,tone);
    req.store.audit('message.drafted',opportunity.id,req.user.id,{provider:draft.provider,fallback:draft.fallback});res.json(draft);
  });
  app.post('/api/opportunities/:id/action',manage,(req,res)=>{
    const input=z.object({action:z.enum(['approve','dismiss','snooze']),message:z.string().max(1600).optional(),channel:channelSchema.default('whatsapp')}).parse(req.body);
    const opportunity=req.store.get('opportunities',req.params.id);if(!opportunity)fail(404,'Opportunity not found.');
    if(opportunity.status!=='new')fail(409,'Only an open opportunity can be acted on.');
    const result=transaction(db,()=>{
      if(input.action==='approve') {
        if(!input.message||input.message.trim().length<20)fail(400,'Review a message of at least 20 characters before approval.');
        const campaign=createCampaign(req.store,{name:`${TYPES[opportunity.type].short} · ${req.store.get('patients',opportunity.patient_id).name}`,type:opportunity.type,channel:input.channel,template:input.message,opportunityIds:[opportunity.id]},req.user.id);approveCampaign(req.store,campaign.id,req.user.id);return {campaign_id:campaign.id,status:'queued'};
      }
      const status=input.action==='dismiss'?'dismissed':'snoozed';req.store.update('opportunities',opportunity.id,{status,snoozed_until:status==='snoozed'?new Date(Date.now()+7*86400000).toISOString():null});req.store.audit(`opportunity.${status}`,opportunity.id,req.user.id);return {status};
    });res.json(result);
  });
  app.get('/api/campaigns',(req,res)=>res.json(campaignMetrics(req.store)));
  app.post('/api/campaigns/preview',(req,res)=>{const input=z.object({type:typeSchema,channel:channelSchema,opportunityIds:z.array(z.string()).max(1000).optional()}).parse(req.body);res.json({...audiencePreview(req.store,input),template:campaignTemplate(input.type,req.store.practice().name)});});
  app.post('/api/campaigns',(req,res)=>{const input=campaignSchema.parse(req.body);res.status(201).json(transaction(db,()=>createCampaign(req.store,input,req.user.id)));});
  app.get('/api/campaigns/:id',(req,res)=>{
    const campaign=campaignMetrics(req.store).find(c=>c.id===req.params.id);if(!campaign)fail(404,'Campaign not found.');
    const patients=new Map(req.store.all('patients').map(p=>[p.id,p]));const events=req.store.all('events');
    const messages=req.store.all('communications','campaign_id = ?',[campaign.id]).map(m=>({...m,patient:patients.get(m.patient_id),events:events.filter(e=>e.communication_id===m.id),transactions:req.store.all('transactions','patient_id = ?',[m.patient_id]).filter(t=>t.status==='paid'&&m.sent_at&&t.date>=m.sent_at.slice(0,10)&&t.date<=new Date(Date.parse(m.sent_at)+30*86400000).toISOString().slice(0,10)&&!events.some(e=>e.transaction_id===t.id))}));
    res.json({...campaign,messages});
  });
  app.patch('/api/campaigns/:id',(req,res)=>{
    const {template}=z.object({template:z.string().trim().min(20).max(1600)}).parse(req.body);const campaign=req.store.get('campaigns',req.params.id);if(!campaign)fail(404,'Campaign not found.');if(campaign.status!=='draft')fail(409,'Approved messages cannot be edited. Create a new draft for new approval.');
    transaction(db,()=>{req.store.update('campaigns',campaign.id,{template});for(const m of req.store.all('communications','campaign_id = ?',[campaign.id]))req.store.update('communications',m.id,{body:template.replaceAll('{{first_name}}',req.store.get('patients',m.patient_id).name.split(/\s+/)[0])});req.store.audit('campaign.edited',campaign.id,req.user.id);});res.json({ok:true});
  });
  app.post('/api/campaigns/:id/approve',manage,(req,res)=>res.json(transaction(db,()=>approveCampaign(req.store,req.params.id,req.user.id))));
  app.post('/api/campaigns/:id/send',manage,(req,res)=>res.json(transaction(db,()=>sendCampaign(req.store,req.params.id,req.user.id))));
  app.post('/api/communications/:id/outcomes',(req,res)=>{const input=z.object({type:z.enum(['reply','appointment','purchase']),transaction_id:z.string().optional()}).parse(req.body);transaction(db,()=>recordOutcome(req.store,req.params.id,input.type,input.transaction_id,req.user.id));res.json({ok:true});});
  app.get('/api/analytics',(req,res)=>res.json(analytics(req.store)));
  app.get('/api/analytics/export',(req,res)=>{
    const escape=value=>`"${String(value).replace(/^[=+@-]/,"'").replaceAll('"','""')}"`;
    const rows=campaignMetrics(req.store).map(c=>[c.name,c.status,c.channel,c.recipients,c.delivered,c.replies,c.appointments,c.purchases,(c.revenue/100).toFixed(2)]);
    req.store.audit('analytics.exported',null,req.user.id);res.type('text/csv').attachment('campaign-results.csv').send([['Campaign','Status','Channel','Recipients','Delivered','Replies','Appointments','Purchases','Attributed revenue SGD'],...rows].map(row=>row.map(escape).join(',')).join('\r\n'));
  });
  app.post('/api/assistant',(req,res)=>{const {question}=z.object({question:z.string().trim().min(3).max(1000)}).parse(req.body);const answer=answerQuestion(question,analytics(req.store));req.store.audit('assistant.queried',null,req.user.id,{sources:answer.sources.map(s=>s.label)});res.json({...answer,provider:'controlled-analytics',practice:req.store.practice().name});});
  const uploads=new Map(); const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:3}});
  const clearExpired=()=>{for(const [key,item] of uploads)if(item.expires<Date.now())uploads.delete(key);};
  const uploadFor=req=>{clearExpired();const item=uploads.get(req.params.id);if(!item||item.tenantId!==req.user.tenant_id||item.userId!==req.user.id)fail(404,'Import preview expired or was not found. Upload the file again.');return item;};
  app.get('/api/data',(req,res)=>{const facts=analytics(req.store);res.json({health:facts.health,imports:req.store.all('imports').sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(i=>({...i,report:JSON.parse(i.report),mapping:JSON.parse(i.mapping)})),fields:FIELDS});});
  app.get('/api/data/template',(req,res)=>res.type('text/csv').attachment('sample-patients.csv').send('Patient ID,Full Name,Mobile,Email,Consent,Last Exam,Last Purchase,Total,Category,CL Interval,Outlet\nIMPORT-001,Jamie Tan,81234567,jamie@example.test,yes,2024-01-15,2026-01-15,180,Contact lenses,90,Orchard\nIMPORT-002,Alex Lim,87654321,alex@example.test,no,2026-01-02,2026-01-02,320,Eyewear,,Tampines\nIMPORT-003,Jamie Tan,81234567,,yes,2024-02-30,,,,,Orchard\n'));
  app.post('/api/imports/inspect',manage,upload.single('file'),async(req,res)=>{
    if(!req.file)fail(400,'Choose a CSV or XLSX file.');clearExpired();if(uploads.size>=20)fail(429,'Too many import previews are open. Please try again later.');
    const entity=z.enum(Object.keys(FIELDS)).parse(req.body.entity||'patients');const connector=getConnector(z.string().max(80).parse(req.body.connector||'generic-csv'));connector.requireCapability('fileImport',entity);const file=await connector.inspect(req.file.buffer,basename(req.file.originalname),entity);const uploadId=id('upload');
    uploads.set(uploadId,{...file,connector:connector.descriptor.id,tenantId:req.user.tenant_id,userId:req.user.id,expires:Date.now()+15*60_000});req.store.audit('import.inspected',uploadId,req.user.id,{filename:file.filename,rows:file.rows.length,entity,connector:connector.descriptor.id});
    res.json({id:uploadId,filename:file.filename,entity,headers:file.headers,mapping:file.mapping,confidence:file.confidence,fields:FIELDS[entity],preview:file.rows.slice(0,5),total:file.rows.length});
  });
  app.post('/api/imports/:id/validate',manage,(req,res)=>{const file=uploadFor(req);const {mapping}=z.object({mapping:z.record(z.string(),z.string().max(120))}).parse(req.body);const report=getConnector(file.connector).validate(req.store,file.rows,mapping,file.entity);file.mapping=mapping;res.json({...report,rows:report.rows.slice(0,200)});});
  app.post('/api/imports/:id/commit',manage,(req,res)=>{const file=uploadFor(req);const {approved,includeDuplicates}=z.object({approved:z.literal(true),includeDuplicates:z.boolean().default(false)}).parse(req.body);if(!approved)fail(400,'Review and approve the import first.');const result=getConnector(file.connector).import(req.store,file,req.user.id,includeDuplicates);uploads.delete(req.params.id);res.json(result);});
  app.get('/api/settings',(req,res)=>res.json({practice:safePractice(req.store.practice()),users:req.store.all('users').map(userView),outlets:req.store.all('outlets'),ai:{provider:'verified-template',externalCalls:false},communications:{provider:'mock',approvalRequired:true}}));
  app.patch('/api/settings',owner,(req,res)=>{
    const schema=z.object({name:z.string().trim().min(2).max(100),recall_days:z.number().int().min(30).max(1095),inactive_days:z.number().int().min(30).max(1825),valuable_threshold:z.number().int().min(0).max(100000000),followup_min_days:z.number().int().min(1).max(60),followup_max_days:z.number().int().min(1).max(90),collection_days:z.number().int().min(1).max(180),contact_cooldown_days:z.number().int().min(1).max(365)}).refine(v=>v.followup_min_days<=v.followup_max_days,{message:'Follow-up start must be before the end.'});
    const {name,...settings}=schema.parse(req.body);transaction(db,()=>{db.prepare('UPDATE practices SET name=?,settings=? WHERE id=?').run(name,JSON.stringify(settings),req.user.tenant_id);analyse(req.store);req.store.audit('settings.updated',req.user.tenant_id,req.user.id,{settings});});res.json({ok:true});
  });
  app.get('/api/audit',manage,(req,res)=>res.json(req.store.all('audit_events').sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,200).map(e=>({...e,details:JSON.parse(e.details),actor:req.store.get('users',e.user_id)?.name||'System'}))));
  app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found.'}));
  const dist=resolve('dist');if(existsSync(dist)){app.use(express.static(dist));app.get('/{*path}',(req,res)=>res.sendFile(resolve(dist,'index.html')));}
  app.use((err,req,res,next)=>{
    if(err instanceof z.ZodError)return res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')||'Request'}: ${i.message}`).join('; ')});
    if(err instanceof multer.MulterError)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'The file exceeds the 5 MB limit.':err.message});
    const expected=err.status||(/CSV|column|Map required|source column|Workbook|worksheet|file|headers|Formula|dates|reassigned|rows|Consent|Source ID|import entity/i.test(err.message)?400:500);
    if(expected===500)console.error('API error:',err.code||err.name,err.message);
    res.status(expected).json({error:expected===500?'The operation could not be completed. No partial changes were saved.':err.message});
  });
  return app;
}
