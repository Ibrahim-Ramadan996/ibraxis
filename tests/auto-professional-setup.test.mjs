import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {buildProfessionalSetup,skillKey} from '../app/auto-professional-setup.mjs';
import {cvSkillDrafts,draftSkillSelection} from '../app/skill-experience.js';

test('professional setup deduplicates icon and bilingual/title variants and rejects bad skills',()=>{
 const existing=[
  {kind:'skill',status:'draft',icon:'PYTHON',title:'Python'},
  {kind:'skill',status:'published',title:'Microsoft  Excel',ar_title:'إكسل'},
  {kind:'skill',status:'archived',title:'Power BI'}
 ];
 const candidates=[
  ...cvSkillDrafts,
  {...cvSkillDrafts[0]},
  {kind:'skill',status:'draft',icon:'not-real',title:'Bad',ar_title:'سيئ',en_title:'Bad',ar_body:'نص',en_body:'Text'},
  {kind:'skill',status:'draft',icon:'sql',title:'SQL'}
 ];
 const plan=buildProfessionalSetup(existing,{name:'Ibrahim',role_ar:'محلل بيانات',role_en:'Data Analyst'},candidates);
 const icons=plan.skillDrafts.map(x=>x.icon);
 assert(!icons.includes('python'));
 assert(!icons.includes('excel'));
 assert(!icons.includes('powerbi'));
 assert.equal(new Set(icons).size,icons.length);
 assert(plan.skillDrafts.every(x=>x.status==='draft'));
});

test('professional setup never invents education career certification and never includes protected kinds',()=>{
 const plan=buildProfessionalSetup([],{},cvSkillDrafts);
 assert.equal(plan.report.created.education,0);
 assert.equal(plan.report.created.career,0);
 assert.equal(plan.report.created.certifications,0);
 assert(plan.report.notCreatedWithoutEvidence.education);
 assert(plan.report.notCreatedWithoutEvidence.career);
 assert(plan.report.notCreatedWithoutEvidence.certifications);
 assert.deepEqual(plan.report.leftUnchanged,['projects','caseStudies','products','services','clients','articles','futureWork']);
 assert(plan.skillDrafts.every(x=>x.kind==='skill'));
});

test('skill drafts preserve manual records, validate icons and create no in-batch duplicates',()=>{
 const manual={kind:'skill',status:'published',icon:'sql',title:'SQL'};
 const duplicateCandidates=[
  {...cvSkillDrafts.find(x=>x.icon==='sql')},
  {...cvSkillDrafts.find(x=>x.icon==='sql'),title:'SQL duplicate'},
  {kind:'skill',status:'draft',icon:'unknown',title:'Unknown',ar_title:'مجهول',en_title:'Unknown',ar_body:'',en_body:''}
 ];
 assert.deepEqual(draftSkillSelection([manual],duplicateCandidates),[]);
 assert.equal(skillKey('  PYTHON  '),'python');
 assert.equal(skillKey('بايثون'),'python');
 assert.equal(skillKey('  باور  بي '),'powerbi');
});

test('professional setup HTTP preview and repeated private apply never publish or duplicate skills',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ix-auto-setup-')),port=18974;
 const child=spawn(process.execPath,['app/server.mjs'],{env:{
  ...process.env,
  PORT:String(port),
  DB_PATH:join(dir,'db.sqlite'),
  OWNER_PASSWORD:'test-only-password-123',
  AI_PROVIDER:'',
  AI_MODEL:'',
  AI_API_KEY:'',
  OLLAMA_MODEL:''
 }});
 try{
  await new Promise((resolve,reject)=>{
   child.stdout.once('data',resolve);
   child.once('exit',()=>reject(Error('server stopped')));
  });
  const base=`http://127.0.0.1:${port}`,call=async(path,data,auth='')=>{
   const r=await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Cookie:auth}:{})},...(data?{body:JSON.stringify(data)}:{})});
   return {status:r.status,value:await r.json()};
  };
  assert.equal((await call('/api/professional/setup')).status,401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'test-only-password-123'})});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const preview=await call('/api/professional/setup',{action:'preview'},cookie);
  assert.equal(preview.status,200);
  assert(preview.value.skillDrafts.length>0);
  const applied=await call('/api/professional/setup',{action:'apply',confirm:true},cookie);
  assert.equal(applied.status,200);
  const repeated=await call('/api/professional/setup',{action:'apply',confirm:true},cookie);
  assert.equal(repeated.status,200);
  const records=(await call('/api/records',undefined,cookie)).value;
  const draftSkills=records.filter(x=>x.kind==='skill'&&x.status==='draft');
  assert.equal(new Set(draftSkills.map(x=>String(x.icon).toLowerCase())).size,draftSkills.length);
  const publicRecords=await call('/api/public');
  assert(!publicRecords.value.some(x=>x.kind==='skill'));
 }finally{
  child.kill();
  await new Promise(resolve=>child.once('exit',resolve));
  rmSync(dir,{recursive:true,force:true});
 }
});
