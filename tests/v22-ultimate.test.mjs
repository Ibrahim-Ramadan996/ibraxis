import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {design} from '../app/design.js';
import {overviewMetrics,searchWorkspace,readinessAudit,layoutOffenders,sanitizeCSV,inquiryCSV,validateQuickProject} from '../app/premium-tools.js';
const records=[
 {kind:'project',title:'Demo private',body:'CSV model',status:'draft'},
 {kind:'project',title:'Published work',body:'Public report',status:'published',ar_title:'منشور',en_title:'Published'},
 {kind:'inquiry',title:'Client =secret',body:JSON.stringify({name:'Sara',email:'sara@example.com',kind:'dashboard',budget:'large'}),status:'new'},
 {kind:'inquiry',title:'Old archived',body:'old',status:'archived'},
 {kind:'client',title:'Client',status:'approved'}
];
test('private command center counts and search respect scope and bounded results',()=>{
 assert.deepEqual(overviewMetrics(records),{projects:2,published:1,inquiries:1,reviewing:0,clients:1,drafts:1});
 assert.deepEqual(searchWorkspace(records,'csv','project').map(r=>r.title),['Demo private']);
 assert.equal(searchWorkspace(records,'old').length,0);
 assert.equal(searchWorkspace(records,'').length,0);
 assert.throws(()=>searchWorkspace(records,'x'.repeat(181)));
 assert.equal(searchWorkspace([...Array.from({length:99},(_,i)=>({kind:'project',status:'draft',title:'test '+i}))],'test').length,40);
});
test('readiness audit checks bilingual SEO and published data only',()=>{
 const result=readinessAudit({seo_title_ar:'a',seo_title_en:'b',seo_description_ar:'a',seo_description_en:'b',headline_ar:'a',headline_en:'b'},records);
 assert.equal(result.filter(x=>x.code.startsWith('translation')).length,1);
 assert(!result.some(x=>JSON.stringify(x).includes('Demo private')));
 const a=readinessAudit({},[]);assert.equal(a.length,3);
});
test('guard detects only off-screen boxes and never causes layout changes',()=>{
 assert.deepEqual(layoutOffenders([{left:0,right:375},{left:-100,right:-90},{left:10,right:400}],375).length,2);
 assert.throws(()=>layoutOffenders([],0));
});
test('CSV formula injection is disarmed; project wizard creates a draft, never published',()=>{
 assert.match(sanitizeCSV('=1+1'),/^"'=/);assert.match(sanitizeCSV('  -cmd'),/^"'  -cmd/);
 assert.match(sanitizeCSV('hi,"ok"'),/^"hi,""ok"""$/);
 const csv=inquiryCSV([...records,{kind:'inquiry',title:'=HYPERLINK(1)',body:'{}',status:'new'}]);
 assert.match(csv,/"'=HYPERLINK/);assert.match(csv,/sara@example.com/);assert.ok(!csv.includes('old'));
 assert.deepEqual(validateQuickProject({title:' Example ',body:'',ar_title:'مثال'}),{kind:'project',brand:'personal',status:'draft',title:'Example',body:'',ar_title:'مثال',en_title:''});
 assert.throws(()=>validateQuickProject({title:''}));
});
test('premium display options validated and frontend asset is not in static public export list',()=>{
 assert.equal(design({density:'compact',button_size:'large'}).density,'compact');
 assert.throws(()=>design({button_size:'background:red'}));
 assert.throws(()=>design({density:'bad'}));
 const build=readFileSync('scripts/build-pages.mjs','utf8');
 assert.ok(!build.includes("copyFileSync('app/premium-admin.js'"));
 assert.match(readFileSync('app/public.js','utf8'),/mountGlobalSearch/);
});
test('AI diagnostics is authenticated, read-only and does not expose tokens',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ibraxis-ultimate-'));
 const port=19467;const env={...process.env,PORT:String(port),DB_PATH:join(dir,'db.sqlite'),OWNER_PASSWORD:'test-only-password-123',AI_PROVIDER:'gemini',AI_MODEL:'test-model',AI_API_KEY:'private-testing-key',IBRAXIS_PUBLISH_TOKEN:'private-publish-token'};
 for(const k of ['GITHUB_DATA_REPO','GITHUB_DATA_TOKEN','IBRAXIS_DATA_TOKEN'])delete env[k];
 const server=spawn(process.execPath,['app/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([new Promise((resolve,reject)=>{let buffer='';server.stdout.on('data',c=>{buffer+=c.toString();if(buffer.includes('listening'))resolve()});server.once('exit',()=>reject(Error('server exit before ready')))}),new Promise((_,reject)=>setTimeout(()=>reject(Error('server start timeout')),9000))]);
  const url=path=>'http://127.0.0.1:'+port+path;
  const call=(path,payload,cookie='')=>fetch(url(path),{method:payload===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(payload===undefined?{}:{body:JSON.stringify(payload)})});
  assert.equal((await call('/api/diagnostics')).status,401);
  assert.equal((await call('/api/diagnostics',{action:'test'})).status,401);
  const login=await call('/api/login',{password:env.OWNER_PASSWORD});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  const response=await call('/api/diagnostics',undefined,cookie);assert.equal(response.status,200);const body=await response.text();
  assert(!body.includes(env.AI_API_KEY));assert(!body.includes(env.IBRAXIS_PUBLISH_TOKEN));
  const data=JSON.parse(body);assert.equal(data.ai.configured,true);assert.equal(data.ai.provider,'gemini');assert.equal(data.publishing.configured,true);
  assert.equal((await call('/api/diagnostics',{action:'invalid'},cookie)).status,400);
  assert.equal((await call('/api/site',{density:'compact',button_size:'large'},cookie)).status,200);
  const site=await (await call('/api/site')).json();assert.equal(site.density,'compact');assert.equal(site.button_size,'large');
 }finally{if(server.exitCode===null&&server.signalCode===null){const stopped=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await stopped;}rmSync(dir,{recursive:true,force:true})}
});
