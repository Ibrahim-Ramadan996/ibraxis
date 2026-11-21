import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateIcon,pickIcon,iconSvg} from '../app/identity.js';

test('identity icon selection is safe and category-aware',()=>{
 assert.equal(pickIcon('Python','skill'),'python');
 assert.equal(pickIcon('Power BI','skill'),'powerbi');
 assert.equal(pickIcon('SQL','skill'),'sql');
 assert.equal(pickIcon('تعلم الآلة','skill'),'machinelearning');
 assert.equal(pickIcon('Some certificate','certification'),'award');
 assert.equal(validateIcon('star'),'star');
 assert.throws(()=>validateIcon('<script>alert(1)</script>'));
 assert.throws(()=>validateIcon('__proto__'));
 assert.match(iconSvg('award'),/<svg/);
});

test('public gallery and permanent share URLs enforce project visibility, linked showcases, identity and welcome settings',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gallery-'));const port=18985;
 const p=spawn(process.execPath,['app/server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DB_PATH:join(dir,'db.sqlite'),OWNER_PASSWORD:'test-only-password-123'}});
 try{
  await new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('exit',()=>reject(Error('server stopped')))});
  let cookie='';
  const call=(path,data,auth=false)=>fetch('http://127.0.0.1:'+port+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(auth?{Cookie:cookie}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const json=async(path,data,auth)=>{const r=await call(path,data,auth);assert(r.ok);return r.json()};
  assert.equal((await call('/projects')).status,200);
  cookie=(await call('/api/login',{password:'test-only-password-123'})).headers.get('set-cookie').split(';')[0];
  const draft=await json('/api/records',{kind:'project',brand:'personal',title:'Private secret project',body:'not public',status:'draft'},true);
  const pub=await json('/api/records',{kind:'project',brand:'technology',title:'Sample <project>',body:'Details',status:'published',icon:'code'},true);
  const visible=async()=>{const r=await json('/api/public');return r.filter(x=>x.kind==='project').map(x=>x.id)};
  assert.deepEqual(await visible(),[pub.id]);
  assert.equal((await call('/project/'+draft.id)).status,404);
  assert.equal((await call('/api/public/record/'+draft.id)).status,404);
  assert.equal((await call('/api/public/record/'+pub.id)).status,200);
  const html=await(await call('/project/'+pub.id)).text();assert(html.includes('Sample &lt;project&gt;'));assert(!html.includes('Private secret project'));
  const show=await json('/api/showcases',{kind:'link',url:'https://example.com/demo',title_en:'Demo',title_ar:'تجربة',project_id:pub.id,published:true},true);
  assert.equal((await json('/api/public/record/'+pub.id)).showcases.length,1);
  assert.equal((await call('/showcase/'+show.id)).status,200);
  assert.equal((await call('/api/records/visibility',{id:pub.id,action:'hide',confirm:true})).status,401);
  assert.equal((await call('/api/records/visibility',{id:pub.id,action:'hide'},true)).status,400);
  await json('/api/records/visibility',{id:pub.id,action:'hide',confirm:true},true);
  assert.deepEqual(await visible(),[]);assert.equal((await call('/project/'+pub.id)).status,404);assert.equal((await call('/showcase/'+show.id)).status,404);assert.deepEqual(await json('/api/showcases/public'),[]);
  await json('/api/records/visibility',{id:pub.id,action:'publish',confirm:true},true);
  assert.equal((await call('/project/'+pub.id)).status,200);
  await json('/api/records/visibility',{id:pub.id,action:'trash',confirm:true},true);
  assert.equal((await call('/api/records/visibility',{id:pub.id,action:'publish',confirm:true},true)).status,400);
  await json('/api/records/visibility',{id:pub.id,action:'restore',confirm:true},true);
  assert.equal((await call('/project/'+pub.id)).status,404);
  assert.equal((await json('/api/records',undefined,true)).find(x=>x.id===pub.id).status,'draft');
  await json('/api/records/visibility',{id:pub.id,action:'publish',confirm:true},true);
  assert.equal((await call('/project/'+pub.id)).status,200);
  await json('/api/showcases/visibility',{id:show.id,action:'trash',confirm:true},true);
  assert.equal((await call('/showcase/'+show.id)).status,404);
  await json('/api/showcases/visibility',{id:show.id,action:'restore',confirm:true},true);
  assert.equal((await call('/showcase/'+show.id)).status,404);
  const skill={kind:'skill',brand:'personal',title:'SQL',body:'Skill',status:'published',icon:'database'};
  assert.equal((await call('/api/records',{...skill,icon:'javascript:bad'},true)).status,400);
  const sk=await json('/api/records',skill,true);
  assert.equal((await json('/api/public')).find(x=>x.id===sk.id).icon,'database');
  assert.equal((await call('/api/site',{welcome_mode:'invalid'},true)).status,400);
  await json('/api/site',{welcome_ar:'أهلًا',welcome_en:'Welcome',welcome_mode:'always'},true);
  const site=await json('/api/site');assert.equal(site.welcome_ar,'أهلًا');assert.equal(site.welcome_en,'Welcome');assert.equal(site.welcome_mode,'always');
 }finally{p.kill();await new Promise(r=>p.once('exit',r));rmSync(dir,{recursive:true,force:true})}
});
