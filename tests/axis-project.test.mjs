import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectContext,validateAxisPlan} from '../app/axis-agent.mjs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
const edit={action:'project_update',patch:{en_body:'New description',catalog:{tags:['Python']}}};
test('Project plan is scoped and validates patches without exposing raw project data',()=>{
 const row={id:'a'.repeat(32),kind:'project',title:'Old',en_body:'Before',status:'draft',catalog:'{"featured":true}',files:'never sent'};
 const plan=validateAxisPlan(edit,{},row);assert.equal(plan.projectId,row.id);assert.equal(plan.next.en_body,'New description');assert.equal(JSON.parse(plan.next.catalog).featured,true);assert.equal(row.en_body,'Before');
 assert(!('files' in projectContext(row,{technologies:['python']})));assert(!('id' in projectContext(row,{})));
 for(const patch of [{status:'published'},{id:'another'},{catalog:{featured:'yes'}},{catalog:{tags:null}},{title:''},{en_body:'x'.repeat(30001)}])assert.throws(()=>validateAxisPlan({action:'project_update',patch},{},row));
 assert.throws(()=>validateAxisPlan(edit,{}));assert.throws(()=>validateAxisPlan(edit,{}, {...row,status:'deleted'}));
});
test('Project HTTP preview, consent, stale protection, approval, private visibility and revision',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'axis-project-'));let calls=0;
 const mock=createServer(async(q,r)=>{let text='';for await(const c of q)text+=c;const prompt=JSON.parse(JSON.parse(text).messages[1].content);assert.equal(prompt.selectedProject.title,'Scoped project');assert(!('id' in prompt.selectedProject));assert(!JSON.stringify(prompt).includes('DO NOT SEND OTHER'));calls++;r.setHeader('Content-Type','application/json');r.end(JSON.stringify({message:{content:JSON.stringify(edit)}}));});mock.listen(0,'127.0.0.1');await once(mock,'listening');
 const env={...process.env,PORT:'18996',DB_PATH:join(dir,'db.sqlite'),OWNER_PASSWORD:'test-only-password-123',AI_PROVIDER:'ollama',AI_MODEL:'mock',OLLAMA_BASE_URL:`http://127.0.0.1:${mock.address().port}`};for(const k of ['GITHUB_DATA_REPO','GITHUB_DATA_TOKEN','IBRAXIS_PUBLISH_TOKEN','DATA_DIR'])delete env[k];
 let child,cookie='';const call=(p,data,auth=cookie)=>fetch('http://127.0.0.1:18996/api/'+p,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(auth?{Cookie:auth}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 try{child=spawn(process.execPath,['app/server.mjs'],{env});await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited')})]);cookie=(await call('login',{password:env.OWNER_PASSWORD})).headers.get('set-cookie').split(';')[0];
 const record={kind:'project',brand:'personal',title:'Scoped project',body:'Local',status:'draft',en_body:'Before'};const {id}=await(await call('records',record)).json();await call('records',{...record,title:'DO NOT SEND OTHER'});
 const request={prompt:'Edit description',projectId:id,shareProject:true};assert.equal((await call('ai/plan',{...request,shareProject:false})).status,400);assert.equal(calls,0);
 let p=await(await call('ai/plan',request)).json();assert.equal(p.action,'project_update');assert.equal(p.projectId,id);assert.equal((await call('ai/execute',{id:p.id})).status,400);
 await call('records',{...record,id,en_body:'Manual'});assert.equal((await call('ai/execute',{id:p.id,confirm:true})).status,409);
 p=await(await call('ai/plan',request)).json();assert.equal(p.changes[0].before,'Manual');assert.equal((await call('ai/execute',{id:p.id,confirm:true})).status,200);assert.equal((await call('ai/execute',{id:p.id,confirm:true})).status,404);
 const saved=(await(await call('records')).json()).find(x=>x.id===id);assert.equal(saved.en_body,'New description');assert.equal(saved.status,'draft');assert.deepEqual(saved.catalog.tags,['Python']);assert(!(await(await call('public')).json()).some(x=>x.id===id));assert((await(await call('revisions?id='+id)).json()).some(x=>JSON.parse(x.snapshot).en_body==='Manual'));
 }finally{if(child&&child.exitCode===null){child.kill();await once(child,'exit')}mock.close();rmSync(dir,{recursive:true,force:true})}
});
