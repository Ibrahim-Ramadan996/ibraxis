import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSiteBuilder, stageTextSiteFeature } from '../app/ai-kit/site-builder/index.mjs';

const index = '<!doctype html><html><head><title>Home</title></head><body><nav>Home</nav><main><h1>IBRAXIS</h1></main></body></html>';
async function init(t, overrides={}) {
  const root = await mkdtemp(join(tmpdir(),'ibraxis-builder-'));
  await mkdir(join(root, 'public'));
  await writeFile(join(root,'public/index.html'),index);
  t.after(()=>rm(root,{recursive:true,force:true}));
  const events=[];
  const builder=createSiteBuilder({workspaceRoot:root,allowedRoots:['public'],
    assertOwner:c=>{if(!c?.owner)throw new Error('Owner required')},
    assertCsrf:c=>{if(!c?.csrf)throw new Error('CSRF required')},
    audit:(e)=>{events.push(e)},...overrides});
  const ctx={owner:true,csrf:true};
  return {root,builder,ctx,events,home:()=>readFile(join(root,'public/index.html'),'utf8')};
}
test('page addition requires approval; updates index and creates page; undo restores both',async t=>{
  const {root,builder,ctx,home,events}=await init(t);
  const plan=await stageTextSiteFeature(builder,ctx,{request:'ضيف صفحة جديدة باسم شهاداتي',indexPath:'public/index.html',description:'شهادات موثقة بعد المراجعة'});
  assert.equal(plan.writesPerformed,0);
  assert.equal(plan.status,'awaiting_approval');
  assert.equal(plan.changes.length,2);
  assert.equal(await home(),index);
  assert.equal((await readdir(join(root,'public'))).includes('pages'),false);
  const done=await builder.approve(ctx,{planId:plan.planId,reviewDigest:plan.reviewDigest,acknowledge:true});
  assert.equal(done.gitPushed,false); assert.equal(done.published,false);
  assert.match(await home(),/href="pages\/arabic-/);
  const newPage=done.filesChanged.find(p=>p.startsWith('public/pages/'));
  assert.match(await readFile(join(root,newPage),'utf8'),/شهاداتي/);
  const undone=await builder.undo(ctx,{changeId:done.changeId,acknowledge:true});
  assert.equal(undone.status,'undone_in_workspace');assert.equal(await home(),index);
  await assert.rejects(()=>readFile(join(root,newPage),'utf8'),{code:'ENOENT'});
  assert.equal(events.some(e=>e.event==='site_changes_applied'),true);
});
test('section encodes untrusted content and cannot be duplicated',async t=>{
  const {builder,ctx,home}=await init(t);
  const plan=await stageTextSiteFeature(builder,ctx,{request:'ضيف قسم الشهادات',title:'شهاداتي <script>alert(1)</script>',description:'نماذج <img src=x onerror=alert(1)>',indexPath:'public/index.html'});
  const done=await builder.approve(ctx,{planId:plan.planId,reviewDigest:plan.reviewDigest,acknowledge:true});
  assert.equal(done.status,'applied_to_workspace');
  const s=await home();assert.match(s,/&lt;script&gt;/);assert.doesNotMatch(s,/<script>alert/);assert.match(s,/&lt;img/);
  await assert.rejects(()=>stageTextSiteFeature(builder,ctx,{request:'ضيف قسم الشهادات',title:'شهاداتي <script>alert(1)</script>',indexPath:'public/index.html'}),{code:'POSSIBLE_DUPLICATE'});
});
test('button link is mandatory and rejects script URL',async t=>{
  const {builder,ctx}=await init(t);
  await assert.rejects(()=>stageTextSiteFeature(builder,ctx,{request:'ضيف زر تحميل السيرة',indexPath:'public/index.html'}),{code:'MISSING_LINK'});
  await assert.rejects(()=>stageTextSiteFeature(builder,ctx,{request:'ضيف زر تحميل السيرة',indexPath:'public/index.html',url:'javascript:alert(1)'}),{code:'BAD_URL'});
});
test('block access without owner or CSRF before any content read',async t=>{
  const {builder}=await init(t);
  await assert.rejects(()=>builder.readText({csrf:true},'public/index.html'),/Owner/);
  await assert.rejects(()=>builder.stage({owner:true},{description:'x',changes:[]}),/CSRF/);
});
test('deny traversal, env, dot dirs, scripts and data',async t=>{
  const {builder,ctx}=await init(t);
  const paths=['../secrets.txt','public/../../index.html','public/.env','public/.git/config.js','public/secret.key','app/server.mjs','public/data/users.json','public/package.json','public/a\\b.js','public//hello.js'];
  for(const path of paths){
    await assert.rejects(()=>builder.stage(ctx,{description:'edit',changes:[{action:'create',path,content:'safe'}]}), e=>Boolean(e.code),`should reject ${path}`);
  }
});
test('symlinks to sensitive paths are rejected',async t=>{
  const {builder,ctx,root}=await init(t);
  await writeFile(join(root,'sensitive.txt'),'private');
  await symlink(join(root,'sensitive.txt'),join(root,'public','leak.js'));
  await assert.rejects(()=>builder.stage(ctx,{description:'exfiltrate',changes:[{action:'update',path:'public/leak.js',content:'leak'}]}),{code:'SYMLINK_DENIED'});
});
test('stale plan blocks edits and prevents overwriting independent changes',async t=>{
  const {root,builder,ctx}=await init(t);
  const p=await builder.stage(ctx,{description:'update index',changes:[{action:'update',path:'public/index.html',content:'new'}]});
  await writeFile(join(root,'public/index.html'),'someone else changed it');
  await assert.rejects(()=>builder.approve(ctx,{planId:p.planId,reviewDigest:p.reviewDigest,acknowledge:true}),{code:'STALE_PLAN'});
  assert.equal(await readFile(join(root,'public/index.html'),'utf8'),'someone else changed it');
});
test('tampered digest and missing acknowledgement never apply',async t=>{
  const {builder,ctx,home}=await init(t);
  const p=await builder.stage(ctx,{description:'update index',changes:[{action:'update',path:'public/index.html',content:'new'}]});
  await assert.rejects(()=>builder.approve(ctx,{planId:p.planId,reviewDigest:p.reviewDigest}),{code:'APPROVAL_REQUIRED'});
  await assert.rejects(()=>builder.approve(ctx,{planId:p.planId,reviewDigest:'0'.repeat(64),acknowledge:true}),{code:'PLAN_INVALID'});
  assert.equal(await home(),index);
});
test('plans expire, cannot be approved twice, and cannot be undone after edits',async t=>{
  let time=0;
  const {builder,ctx,root}=await init(t,{now:()=>time});
  const a=await builder.stage(ctx,{description:'update index',changes:[{action:'update',path:'public/index.html',content:'A'}]});
  time=16*60*1000;
  await assert.rejects(()=>builder.approve(ctx,{planId:a.planId,reviewDigest:a.reviewDigest,acknowledge:true}),{code:'PLAN_INVALID'});
  const b=await builder.stage(ctx,{description:'update index',changes:[{action:'update',path:'public/index.html',content:'B'}]});
  const result=await builder.approve(ctx,{planId:b.planId,reviewDigest:b.reviewDigest,acknowledge:true});
  await assert.rejects(()=>builder.approve(ctx,{planId:b.planId,reviewDigest:b.reviewDigest,acknowledge:true}),{code:'PLAN_INVALID'});
  await writeFile(join(root,'public/index.html'),'C');
  await assert.rejects(()=>builder.undo(ctx,{changeId:result.changeId,acknowledge:true}),{code:'STALE_UNDO'});
});
test('rejection does not modify files; capabilities do not include all-powerful actions',async t=>{
  const {builder,ctx,home}=await init(t);
  const p=await builder.stage(ctx,{description:'update index',changes:[{action:'update',path:'public/index.html',content:'new'}]});
  await builder.reject(ctx,{planId:p.planId});
  await assert.rejects(()=>builder.approve(ctx,{planId:p.planId,reviewDigest:p.reviewDigest,acknowledge:true}),{code:'PLAN_INVALID'});
  assert.equal(await home(),index);
  assert.deepEqual([builder.capabilities.runShell,builder.capabilities.gitPush,builder.capabilities.publicDeploy,builder.capabilities.deleteFile],[false,false,false,false]);
});
test('batched additions are all prechecked before any write',async t=>{
  const {builder,ctx,root,home}=await init(t);
  const p=await builder.stage(ctx,{description:'multi',changes:[{action:'update',path:'public/index.html',content:'new index'}, {action:'create',path:'public/new.html',content:'new page'}]});
  await writeFile(join(root,'public/new.html'),'an independent new file');
  await assert.rejects(()=>builder.approve(ctx,{planId:p.planId,reviewDigest:p.reviewDigest,acknowledge:true}),{code:'STALE_PLAN'});
  assert.equal(await home(),index);
});
test('invalid extensions, oversized files, too many changes and no-op rejected',async t=>{
  const {builder,ctx}=await init(t);
  await assert.rejects(()=>builder.stage(ctx,{description:'bad',changes:[{action:'create',path:'public/h.sh',content:'x'}]}),{code:'UNSAFE_FILE'});
  await assert.rejects(()=>builder.stage(ctx,{description:'big',changes:[{action:'create',path:'public/file.js',content:'x'.repeat(300000)}]}),{code:'FILE_LIMIT'});
  await assert.rejects(()=>builder.stage(ctx,{description:'noop',changes:[{action:'update',path:'public/index.html',content:index}]}),{code:'NO_CHANGE'});
  await assert.rejects(()=>builder.stage(ctx,{description:'many',changes:Array.from({length:13},(_,i)=>({action:'create',path:`public/test${i}.html`,content:'x'}))}),{code:'PLAN_LIMIT'});
});

test('AI adapter requires consent before outbound model call and never applies model output',async t=>{
  const {builder,ctx,home}=await init(t);
  const {createAiSitePlanner}=await import('../app/ai-kit/site-builder/ai-planner.mjs');
  let calls=0;
  const planner=createAiSitePlanner({builder,sourcePaths:['public/index.html'],externalProvider:true,
    generateChanges: async ({request,sources})=>{calls++;assert.match(sources[0].contents,/IBRAXIS/);return {description:'suggest safe title',changes:[{action:'update',path:'public/index.html',content:index+'\n<!-- approved later -->'}]};},
  });
  await assert.rejects(()=>planner.draft(ctx,{request:'ضيف ميزة للموقع'}),{code:'EXTERNAL_CONSENT_REQUIRED'});
  assert.equal(calls,0);
  const p=await planner.draft(ctx,{request:'ضيف ميزة للموقع',consentExternal:true});
  assert.equal(p.generatedBy,'configured_ai_provider');
  assert.equal(calls,1);
  assert.equal(await home(),index);
});
test('AI output cannot bypass protected paths',async t=>{
  const {builder,ctx}=await init(t);
  const {createAiSitePlanner}=await import('../app/ai-kit/site-builder/ai-planner.mjs');
  const planner=createAiSitePlanner({builder,sourcePaths:['public/index.html'],generateChanges:async()=>({description:'bad',changes:[{action:'update',path:'.env',content:'SECRET=1'}]})});
  await assert.rejects(()=>planner.draft(ctx,{request:'modify your internal env'}),{code:'UNSAFE_PATH'});
});

test('bridge exposes protected preview/apply/reject/undo callbacks for existing admin routes',async t=>{
  const {root,ctx,home}=await init(t);
  const {createSiteBuilderBridge}=await import('../app/ai-kit/integration/site-builder-bridge.mjs');
  const api=createSiteBuilderBridge({workspaceRoot:root,allowedRoots:['public'],indexPath:'public/index.html',
    assertOwner:c=>{if(!c?.owner)throw new Error('owner')}, assertCsrf:c=>{if(!c?.csrf)throw new Error('csrf')},audit:()=>{}});
  await assert.rejects(()=>api.preview({csrf:true},{request:'ضيف قسم المشاريع',mode:'template'}),/owner/);
  await assert.rejects(()=>api.preview(ctx,{request:'ضيف لوحة تحكم مع رسوم بيانية',mode:'ai'}),{code:'PROVIDER_UNAVAILABLE'});
  const p=await api.preview(ctx,{request:'ضيف قسم المشاريع',mode:'template'});
  assert.equal(await home(),index);
  const a=await api.approve(ctx,{planId:p.planId,reviewDigest:p.reviewDigest,acknowledge:true});
  assert.match(await home(),/المشاريع/);
  await api.undo(ctx,{changeId:a.changeId,acknowledge:true});
  assert.equal(await home(),index);
});
