import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync,cpSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {manifest,json} from '../app/hybrid-codec.mjs';
import {pickIcon,validateIcon,iconSvg} from '../app/identity.js';
import {skillRegistry,skillForTitle,cvSkillDrafts,draftSkillSelection,relatedPublishedProjects,renderSkillGallery} from '../app/skill-experience.js';
import {renderPage} from '../app/seo.mjs';

test('CV skill drafts are accurate, bilingual, opt-in, and never published by import',()=>{
 assert.equal(cvSkillDrafts.length,9);
 assert(cvSkillDrafts.every(x=>x.status==='draft'&&x.kind==='skill'&&x.ar_title&&x.en_title&&x.ar_body&&x.en_body));
 assert.deepEqual(draftSkillSelection([]).map(x=>x.icon),cvSkillDrafts.map(x=>x.icon));
 assert.deepEqual(draftSkillSelection([{kind:'skill',status:'draft',title:'PYTHON'}, {kind:'skill',status:'published',title:'Power BI'}]).map(x=>x.icon),cvSkillDrafts.filter(x=>!['python','powerbi'].includes(x.icon)).map(x=>x.icon));
 assert.equal(pickIcon('Power BI dashboard','skill'),'powerbi');
 assert.equal(pickIcon('SQL','skill'),'sql');
 assert.equal(skillForTitle('تعلم الآلة'),'machinelearning');
 assert.equal(validateIcon('pandas'),'pandas');
 assert.match(iconSvg('matplotlib'),/svg/);
 assert.throws(()=>validateIcon('url(javascript:alert(1))'));
});

test('skill portfolio uses accessible filter buttons and hides unpublished skills, no fabricated numbers',()=>{
 const drafts=[{kind:'skill',status:'draft',title:'PRIVATE_DRAFT_SKILL',icon:'python'}];
 const records=[...drafts,{id:'s'.repeat(32),kind:'skill',status:'published',title:'Power BI',ar_title:'باور بي آي',en_title:'Power BI',body:'KPI reports',icon:'powerbi'}, {id:'b'.repeat(32),kind:'skill',status:'published',title:'Python <script>bad</script>',icon:'python'}];
 const html=renderSkillGallery(records,[],'ar');
 assert.match(html,/ix-skill-lab/);assert.match(html,/ix-skill-path/);assert.match(html,/تجهيز البيانات/);assert.match(html,/aria-pressed="true"/);
 assert.match(html,/data-ix-skill-category="visual"/);
 assert(!html.includes('PRIVATE_DRAFT_SKILL'));
 assert(!html.includes('<script>bad</script>'));
 assert(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
 assert(!html.includes('95%'));
 assert(!html.includes('ix-skill-evidence'));
 assert.equal(renderSkillGallery(drafts,[],'en'),'');
});

test('evidence links appear only for explicitly classified published projects',()=>{
 const skill={kind:'skill',status:'published',title:'SQL',icon:'sql',ar_title:'SQL'};
 const yes={id:'a'.repeat(32),kind:'project',status:'published',title:'SQL project',classification:{technologies:['sql']}};
 const no={id:'b'.repeat(32),kind:'project',status:'draft',title:'PRIVATE_PROJECT',classification:{technologies:['sql']}};
 const off={id:'c'.repeat(32),kind:'project',status:'published',title:'Python only',classification:{technologies:['python']}};
 assert.deepEqual(relatedPublishedProjects(skill,[no,yes,off]),[yes]);
 const html=renderSkillGallery([skill],[no,yes,off],'en',p=>'/project/'+p.id+'/');
 assert.match(html,/SQL project/);assert.match(html,/ix-skill-evidence/);
 assert(!html.includes('PRIVATE_PROJECT'));
 assert(!html.includes('Python only'));
 const other={...skill,icon:'machinelearning',title:'Machine Learning'};
 assert.deepEqual(relatedPublishedProjects(other,[yes]),[]);
});

test('live and static landing pages share gallery while admin route never exposes it',()=>{
 const template=readFileSync('app/index.html','utf8');
 const skills=[{id:'a'.repeat(32),kind:'skill',status:'published',title:'Excel',icon:'excel',ar_title:'إكسل',en_title:'Excel',body:'Spreadsheet analysis'}];
 const home=renderPage({template,origin:'https://example.org',path:'/',lang:'ar',site:{site_name:'IBRAXIS',name:'Ibrahim Ramadan'},records:skills});
 assert.match(home,/ix-skill-lab/);assert.match(home,/إكسل/);
 const admin=renderPage({template,origin:'https://example.org',path:'/admin',lang:'ar',site:{site_name:'IBRAXIS'},records:skills});
 assert(!admin.includes('ix-skill-lab'));
 assert(readFileSync('scripts/build-pages.mjs','utf8').includes("'skill-experience.js'"));
 assert(readFileSync('app/pages.js','utf8').includes('bindSkillFilters(document)'));
 assert.equal(skillRegistry.powerbi.name,'Power BI');
 assert(readFileSync('app/server.mjs','utf8').includes("'skill-experience.js'].map(f=>"));
});

test('Pages build exports approved skills, filters and icons, but never skill drafts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ix-skill-pages-'));
 try{
  const root=join(dir,'input');mkdirSync(root);cpSync(resolve('app'),join(dir,'app'),{recursive:true});
  const files=new Map();const approved='a'.repeat(32),draft='b'.repeat(32),project='c'.repeat(32);
  files.set('settings/site.json',json({name:'Ibrahim Ramadan',default_language:'ar'}));
  for(const [id,title,status] of [[approved,'Power BI','published'],[draft,'PRIVATE_SKILL_DRAFT','draft']]){
   const prefix='identity/skill/'+id;
   files.set(prefix+'/record.json',json({id,kind:'skill',brand:'personal',title,status,ar_title:title,en_title:title,icon:'powerbi'}));
   for(const file of ['description.md','description-ar.md','description-en.md'])files.set(prefix+'/'+file,Buffer.from('KPI reports'));
  }
  files.set('projects/'+project+'/project.json',json({id:project,kind:'project',brand:'personal',title:'Power BI report',status:'published',ar_title:'تقرير Power BI',en_title:'Power BI report',icon:'data'}));for(const file of ['description.md','description-ar.md','description-en.md'])files.set('projects/'+project+'/'+file,Buffer.from('Power BI report'));
  for(const [name,data] of files){const path=join(root,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,data)}
  writeFileSync(join(root,'manifest.json'),json(manifest(files)));
  const result=spawnSync(process.execPath,[resolve('scripts/build-pages.mjs')],{cwd:dir,env:{...process.env,PAGES_DATA_DIR:root,PAGES_SITE_URL:'https://example.github.io/ibraxis/'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const html=readFileSync(join(dir,'dist/ar/index.html'),'utf8');
  assert.match(html,/ix-skill-lab/);
  assert.match(html,/ix-brand--powerbi/);
  assert(!html.includes('PRIVATE_SKILL_DRAFT'));
  assert(existsSync(join(dir,'dist/skill-experience.js')));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
