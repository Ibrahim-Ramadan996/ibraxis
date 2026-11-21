import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {validateManagerPlan,readManagerContext} from '../app/ai-manager.mjs';

test('AI Manager validates reads, drafts, icons and duplicate plans',()=>{
 const records=[{id:'a'.repeat(32),kind:'skill',status:'draft',title:'Python',ar_title:'بايثون',en_title:'Python',icon:'python'}];
 const read=validateManagerPlan({action:'read',kind:'skill',query:'PY'},records);
 assert.equal(read.rows.length,1);
 assert.equal(readManagerContext(records,'skill','بايثون')[0].icon,'python');
 assert.throws(()=>validateManagerPlan({action:'preview_create',records:[{kind:'skill',title:'Python',ar_title:'بايثون',en_title:'Python',icon:'python'}]},records));
 assert.throws(()=>validateManagerPlan({action:'preview_create',records:[{kind:'project',title:'No',body:'No'}]},records));
 assert.throws(()=>validateManagerPlan({action:'preview_create',records:[
  {kind:'education',title:'Example',ar_title:'تعليم',en_title:'Education',body:'Text',ar_body:'نص',en_body:'Text'},
  {kind:'education',title:'Example',ar_title:'تعليم',en_title:'Education',body:'Text',ar_body:'نص',en_body:'Text'}
 ]},[]));
 const plan=validateManagerPlan({action:'preview_create',records:[{kind:'career',title:'Example career',ar_title:'خبرة',en_title:'Example career',body:'Text',ar_body:'نص',en_body:'Text'}]},[]);
 assert.equal(plan.records[0].status,'draft');
});

test('AI Manager rejects published updates and unsupported plans',()=>{
 const published={id:'b'.repeat(32),kind:'career',status:'published',title:'Published',ar_title:'',en_title:''};
 assert.throws(()=>validateManagerPlan({action:'preview_update',id:published.id,patch:{body:'Changed'}},[published]));
 assert.throws(()=>validateManagerPlan({action:'preview_update',id:'c'.repeat(32),patch:{body:'Changed'}},[published]));
 assert.throws(()=>validateManagerPlan({action:'delete',id:'c'.repeat(32)},[published]));
});

test('AI Manager HTTP read is owner-only and never publishes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ix-manager-')),port=18976;
 const child=spawn(process.execPath,['app/server.mjs'],{env:{...process.env,PORT:String(port),DB_PATH:join(dir,'db.sqlite'),OWNER_PASSWORD:'test-only-password-123',AI_PROVIDER:'',AI_MODEL:'',AI_API_KEY:'',OLLAMA_MODEL:''}});
 try{
  await new Promise((resolve,reject)=>{
   child.stdout.once('data',resolve);
   child.once('exit',()=>reject(Error('server stopped')));
  });
  const base=`http://127.0.0.1:${port}`;
  const call=async(path,data,cookie='')=>{
   const r=await fetch(base+'/api/'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(data?{body:JSON.stringify(data)}:{})});
   return {status:r.status,value:await r.json()};
  };
  assert.equal((await call('ai/manager/read',{kind:'all',query:''})).status,401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'test-only-password-123'})});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const read=await call('ai/manager/read',{kind:'all',query:''},cookie);
  assert.equal(read.status,200);assert(Array.isArray(read.value.rows));
  assert.equal((await call('ai/manager/execute',{id:'x',confirm:true},cookie)).status,404);
  const publicRows=await call('public');
  assert(!publicRows.value.some(x=>['skill','education','career','certification'].includes(x.kind)&&x.status==='draft'));
 }finally{
  child.kill();
  await new Promise(resolve=>child.once('exit',resolve));
  rmSync(dir,{recursive:true,force:true});
 }
});
