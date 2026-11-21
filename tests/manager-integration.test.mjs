import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {previewIngestion,prepareIngestionPlan,readInput} from '../app/manager-upgrade.mjs';
import {createSiteBuilder} from '../app/ai-kit/site-builder/engine.mjs';
import {stageHomeFeature} from '../app/site-home-features.mjs';

const raw='التعليم\nجامعة الفيوم\nبكالوريوس علوم الحاسب\n2021 - 2025';
test('text request => structured preview => approved draft plan only, with original evidence', async()=>{
 const preview=await previewIngestion({type:'text',text:raw},[]);
 assert.equal(preview.proposals.length,1);
 const plan=await prepareIngestionPlan({type:'text',text:raw},[preview.proposals[0].id],[]);
 assert.equal(plan.plan.action,'preview_create');
 assert.equal(plan.plan.records[0].kind,'education');
 assert.equal(plan.plan.records[0].status,'draft');
 assert.match(plan.plan.records[0].body,/جامعة الفيوم/);
 assert.match(plan.plan.records[0].body,/Source \/ المصدر:/);
});
test('duplicate text must not create a new draft; unknown IDs rejected',async()=>{
 const preview=await previewIngestion({type:'text',text:'المهارات\nPython'},[]);
 assert.ok(preview.proposals.length>0);
 const id=preview.proposals[0].id;
 const plan=await prepareIngestionPlan({type:'text',text:'المهارات\nPython'},[id],[]);
 assert.equal(plan.plan.records[0].kind,'skill');
 await assert.rejects(()=>prepareIngestionPlan({type:'text',text:'المهارات\nPython'},[id],[{kind:'skill',title:'Python',status:'draft'}]));
 await assert.rejects(()=>prepareIngestionPlan({type:'text',text:'المهارات\nPython'},['f'.repeat(20)],[]));
});
test('file signatures and file size are validated before extract',async()=>{
 assert.throws(()=>readInput({type:'file',filename:'resume.pdf',data:'not-base64'}));
 assert.throws(()=>readInput({type:'file',filename:'huge.txt',data:'A'.repeat(6e6)}));
 await assert.rejects(()=>previewIngestion({type:'file',filename:'resume.pdf',data:Buffer.from('wrong').toString('base64')},[]));
});
test('site feature preview edits approved public feature config; undo restores it', async t=>{
 const dir=await mkdtemp(join(tmpdir(),'ibraxis-site-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(join(dir,'app'));
 const original='[]\n';await writeFile(join(dir,'app/site-features.json'),original);
 const events=[];
 const builder=createSiteBuilder({workspaceRoot:dir,allowedRoots:['app'],assertOwner:c=>{if(!c.owner)throw Error('owner')},assertCsrf:c=>{if(!c.csrf)throw Error('csrf')},audit:e=>events.push(e)});
 const ctx={owner:true,csrf:true};
 await assert.rejects(()=>stageHomeFeature(builder,{owner:false,csrf:true},{request:'ضيف قسم الشهادات',title:'شهاداتي'}));
 const plan=await stageHomeFeature(builder,ctx,{request:'ضيف قسم الشهادات',title:'شهاداتي',description:'كل شهاداتي'});
 assert.equal(await readFile(join(dir,'app/site-features.json'),'utf8'),original);
 assert.match(plan.changes[0].summary,/شهاداتي/);
 await assert.rejects(()=>builder.approve(ctx,{planId:plan.planId,reviewDigest:'bad',acknowledge:true}));
 const done=await builder.approve(ctx,{planId:plan.planId,reviewDigest:plan.reviewDigest,acknowledge:true});
 assert.match(await readFile(join(dir,'app/site-features.json'),'utf8'),/شهاداتي/);
 assert.equal(done.gitPushed,false);
 await builder.undo(ctx,{changeId:done.changeId,acknowledge:true});
 assert.equal(await readFile(join(dir,'app/site-features.json'),'utf8'),original);
 assert.ok(events.length);
});
test('source builder does not allow editing backend and private modules',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'ibraxis-allow-'));t.after(()=>rm(dir,{recursive:true,force:true}));await mkdir(join(dir,'app'));await writeFile(join(dir,'app/server.mjs'),'export default 1');
 const builder=createSiteBuilder({workspaceRoot:dir,allowedRoots:['app'],assertOwner:()=>{},assertCsrf:()=>{}});
 await assert.rejects(()=>builder.stage({}, {description:'edit auth',changes:[{path:'app/server.mjs',action:'update',content:'export default 2'}]}), {code:'UNSAFE_FILE'});
});
