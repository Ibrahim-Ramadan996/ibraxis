import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAxisPlan} from '../app/axis-agent.mjs';
import {design} from '../app/design.js';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

test('AXIS validates allowlist and exact changes; preserves unrelated data',()=>{
 const site={headline_ar:'قديم',headline_en:'Old',bio_ar:'Keep',github:'https://github.com/owner',...design()};
 const result=validateAxisPlan({action:'site_update',patch:{headline_ar:'جديد',headline_en:'New',dark_colors:{accent:'#123456'}}},site);
 assert.equal(result.next.bio_ar,'Keep');assert.equal(result.next.github,site.github);assert.equal(result.next.dark_colors.bg,site.dark_colors.bg);assert.equal(result.changes.length,3);assert.equal(site.headline_en,'Old');
 assert.equal(validateAxisPlan({action:'site_update',patch:{headline_en:'Old'}},site).action,'answer');
 assert.equal(validateAxisPlan({action:'site_update',patch:{palette:'ember'}},site).next.dark_colors.bg,'#18100f');
 for(const raw of [{action:'delete'},{action:'site_update',patch:{password:'x'}},{action:'site_update',patch:{dark_colors:{accent:'url(evil)'}}},{action:'site_update',patch:{motion:'script'}},{action:'record_create',kind:'client',title:'Client',body:'Private'},{action:'site_update',patch:JSON.parse('{"__proto__":{"bad":true}}')},{action:'site_update',patch:{headline_en:null}},{action:'record_create',kind:'project',title:'x',body:'y',status:'published'}])assert.throws(()=>validateAxisPlan(raw,site));
});

test('AXIS HTTP approval, stale protection, draft isolation, revisions, persistence and replay prevention',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'axis-'));let reply={action:'answer',message:'Hello'};let calls=0;
 const mock=createServer(async(q,r)=>{let text='';for await(const c of q)text+=c;const payload=JSON.parse(text);const prompt=JSON.parse(payload.messages[1].content);assert(!('password'in prompt.currentSite));assert(!('github'in prompt.currentSite));calls++;r.setHeader('Content-Type','application/json');r.end(JSON.stringify({message:{content:JSON.stringify(reply)}}))});mock.listen(0,'127.0.0.1');await once(mock,'listening');
 const env={...process.env,PORT:'18995',DB_PATH:join(dir,'db.sqlite'),OWNER_PASSWORD:'test-only-password-123',AI_PROVIDER:'ollama',AI_MODEL:'mock',OLLAMA_BASE_URL:`http://127.0.0.1:${mock.address().port}`};delete env.GITHUB_DATA_REPO;delete env.GITHUB_DATA_TOKEN;
 let child,cookie='';const launch=async()=>{child=spawn(process.execPath,['app/server.mjs'],{env});await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited')})])};const stop=async()=>{if(child&&child.exitCode===null){child.kill();await once(child,'exit')}};
 const call=(path,data,auth=cookie)=>fetch('http://127.0.0.1:18995/api/'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(auth?{Cookie:auth}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const login=async()=>{const r=await call('login',{password:env.OWNER_PASSWORD});return r.headers.get('set-cookie').split(';')[0]};
 const plan=async()=>{const r=await call('ai/plan',{prompt:'test',language:'ar'});assert.equal(r.status,200);return r.json()};
 try{await launch();assert.equal((await call('ai/plan',{prompt:'test'},'')).status,401);cookie=await login();const other=await login();await call('site',{headline_en:'Old',bio_ar:'Keep'});assert.equal((await plan()).action,'answer');
 reply={action:'site_update',patch:{headline_en:'New'}};let p=await plan();assert.equal((await(await call('site')).json()).headline_en,'Old');assert.equal((await call('ai/execute',{id:p.id,confirm:true},other)).status,404);assert.equal((await call('ai/execute',{id:p.id})).status,400);assert.equal((await call('ai/approve',{id:p.id})).status,404);assert.equal((await call('ai/execute',{id:p.id,confirm:true})).status,200);assert.equal((await call('ai/execute',{id:p.id,confirm:true})).status,404);let site=await(await call('site')).json();assert.equal(site.headline_en,'New');assert.equal(site.bio_ar,'Keep');
 reply={action:'site_update',patch:{headline_en:'Later'}};p=await plan();assert.equal((await call('ai/cancel',{id:p.id},other)).status,404);assert.equal((await call('ai/cancel',{id:p.id})).status,200);assert.equal((await call('ai/execute',{id:p.id,confirm:true})).status,404);p=await plan();await call('site',{bio_ar:'Manual'});assert.equal((await call('ai/execute',{id:p.id,confirm:true})).status,409);assert.equal((await(await call('site')).json()).headline_en,'New');
 reply={action:'record_create',kind:'project',title:'Private project',body:'Example',ar_title:'مشروع'};p=await plan();assert(!(await(await call('records')).json()).some(x=>x.title==='Private project'));const saved=await(await call('ai/execute',{id:p.id,confirm:true})).json();assert.equal(saved.status,'draft');assert(!(await(await call('public')).json()).some(x=>x.id===saved.id));assert((await(await call('records')).json()).some(x=>x.id===saved.id&&x.ar_title==='مشروع'));
 assert.equal((await call('ai/plan',{prompt:'test'})).status,429);assert.equal(calls,5);assert((await(await call('audit')).json()).some(x=>x.action==='axis site configuration changed'));assert((await(await call('site/history')).json()).some(x=>JSON.parse(x.snapshot).headline_en==='Old'));
 await stop();await launch();cookie=await login();assert.equal((await(await call('site')).json()).headline_en,'New');assert((await(await call('records')).json()).some(x=>x.id===saved.id));
 }finally{await stop();mock.close();rmSync(dir,{recursive:true,force:true})}
});
