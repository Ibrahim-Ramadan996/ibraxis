import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';

// Run against isolated memory + checkpoint data. Never touches owner secrets or remote repositories.
test('owner can review file/text then save private drafts; source-code writes remain approval-gated',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'ibraxis-http-manager-'));
 const port=18000+Math.floor(Math.random()*13000);
 const child=spawn(process.execPath,['app/server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:join(dir,'checkpoints'),DB_PATH:join(dir,'test.sqlite'),OWNER_PASSWORD:'isolated-test-password-123',GITHUB_DATA_TOKEN:'',GITHUB_DATA_REPO:'',GITHUB_DATA_BOOTSTRAP:'0',AI_PROVIDER:'',AI_MODEL:'',AI_API_KEY:'',OLLAMA_MODEL:''}});
 let stopped=false;child.on('exit',()=>{stopped=true});
 t.after(async()=>{if(!stopped){child.kill();await new Promise(resolve=>child.once('exit',resolve));}await rm(dir,{recursive:true,force:true});});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Server startup timeout')),12000);
  child.stdout.once('data',()=>{clearTimeout(timer);resolve()});
  child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code))});
 });
 const base=`http://127.0.0.1:${port}`;
 const post=async(route,data,cookie='',cross=false,withCsrf=false)=>{
  const res=await fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json',...(cookie?{Cookie:cookie}:{}),...(withCsrf?{'X-IBRAXIS-Request':'1',origin:cross?'http://evil.test':base}:{})},body:JSON.stringify(data)});
  return {status:res.status,data:await res.json()};
 };
 const get=async(route,cookie='')=>{const res=await fetch(base+'/api/'+route,{headers:cookie?{Cookie:cookie}:{}});return {status:res.status,data:await res.json()}};
 const input={type:'text',text:'التعليم\nجامعة الفيوم\nبكالوريوس علوم الحاسب\n2021 - 2025'};
 assert.equal((await post('ai/manager/ingest/preview',{input})).status,401);
 assert.equal((await get('ai/manager/site/capabilities')).status,401);
 const login=await post('login',{password:'isolated-test-password-123'});assert.equal(login.status,200);
 const res=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'isolated-test-password-123'})});
 assert.equal(res.status,200);const cookie=res.headers.get('set-cookie').split(';')[0];
 const preview=await post('ai/manager/ingest/preview',{input},cookie);
 assert.equal(preview.status,200);assert.equal(preview.data.proposals.length,1);
 const selectedIds=[preview.data.proposals[0].id];
 const staged=await post('ai/manager/ingest/prepare',{input,selectedIds},cookie);
 assert.equal(staged.status,200);assert.equal(staged.data.action,'preview_create');assert.equal(staged.data.records[0].status,'draft');
 assert.equal((await get('public')).data.filter(x=>x.kind==='education').length,0);
 const done=await post('ai/manager/execute',{id:staged.data.id,confirm:true},cookie);
 assert.equal(done.status,200);assert.equal(done.data.created.length,1);
 assert.equal((await get('public')).data.filter(x=>x.kind==='education').length,0);
 assert.equal((await post('ai/manager/execute',{id:staged.data.id,confirm:true},cookie)).status,404);
 const after=await post('ai/manager/ingest/preview',{input},cookie);
 assert.equal(after.status,200);assert.equal(after.data.proposals.length,0);
 assert.notEqual((await post('ai/manager/site/preview',{request:'ضيف قسم الشهادات',title:'شهاداتي'},cookie)).status,200);
 assert.notEqual((await post('ai/manager/site/preview',{request:'ضيف قسم الشهادات',title:'شهاداتي'},cookie,true,true)).status,200);
 const site=await post('ai/manager/site/preview',{request:'ضيف قسم الشهادات',title:'شهاداتي'},cookie,false,true);
 assert.equal(site.status,200);assert.equal(site.data.writesPerformed,0);
 assert.equal((await post('ai/manager/site/approve',{planId:site.data.planId,reviewDigest:site.data.reviewDigest,acknowledge:false},cookie,false,true)).status,400);
 assert.equal((await post('ai/manager/site/reject',{planId:site.data.planId},cookie,false,true)).status,200);
 assert.equal((await post('ai/manager/site/approve',{planId:site.data.planId,reviewDigest:site.data.reviewDigest,acknowledge:true},cookie,false,true)).status,409);
});
