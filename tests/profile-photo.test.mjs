import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,cpSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {manifest,json} from '../app/hybrid-codec.mjs';
import {parsePortrait,publicPortrait,validatePortraitData,MAX_PROFILE_BYTES} from '../app/profile-photo.mjs';
import {design} from '../app/design.js';
import {homeExperience} from '../app/home-experience.js';
import {renderPage} from '../app/seo.mjs';
const photo64='UklGRkIAAABXRUJQVlA4IDYAAAAQAwCdASogACgAPl0sk0cjoqGhJWgAcAuJZwAALqYfEAAA/vCbP60QS//8Wh/bz/g1tKAAAAA=';
const bytes=Buffer.from(photo64,'base64');

test('WebP photo is bounded and validated, draft never becomes public automatically',()=>{
 assert.equal(validatePortraitData(photo64).bytes.length,bytes.length);
 assert.equal(publicPortrait(parsePortrait({draft:photo64})),null);
 assert.equal(publicPortrait(parsePortrait({draft:photo64,approved:photo64})).bytes.compare(bytes),0);
 assert.throws(()=>validatePortraitData('<svg onload="alert(1)" />'));
 assert.throws(()=>validatePortraitData('A'.repeat(MAX_PROFILE_BYTES*3)));
 assert.throws(()=>validatePortraitData(Buffer.alloc(128).toString('base64')));
 assert.throws(()=>design({portrait_placement:'javascript:alert(1)'}));
 assert.throws(()=>design({portrait_focus_x:'999'}));
 assert.throws(()=>design({portrait_style:'<img>'}));
 assert.equal(design({portrait_focus_y:'42'}).portrait_focus_y,42);
});

test('portrait integrates with bilingual home and About, remains absent from admin and hidden modes',()=>{
 const site={...design({portrait_style:'circle',portrait_placement:'both',portrait_size:'balanced',portrait_focus_x:60}),name:'Test Owner',profile_photo_src:'/profile-photo.webp?v=123456'};
 const ar=homeExperience({site,rows:[],lang:'ar'});assert.match(ar,/ix-hero-portrait/);assert.match(ar,/الصورة الشخصية/);assert.match(ar,/ix-photo--circle/);assert.match(ar,/60% 35%/);
 const t=readFileSync('app/index.html','utf8');const html=renderPage({template:t,origin:'https://example.org',path:'/',lang:'en',site});const about=renderPage({template:t,origin:'https://example.org',path:'/about',lang:'en',site});assert.match(about,/ix-profile-about/);assert.match(html,/ix-hero-portrait/);assert.doesNotMatch(html,/ix-profile-about/);
 const admin=renderPage({template:t,origin:'https://example.org',path:'/admin',lang:'en',site});assert(!admin.includes('ix-profile-about')&&!admin.includes('ix-hero-portrait'));
 assert(!homeExperience({site:{...site,portrait_placement:'off'},lang:'en'}).includes('ix-hero-portrait'));
});

test('owner-only photo API: private upload, explicit approval, appearance and hide',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ix-photo-server-'));
 const env={...process.env,PORT:'19571',DB_PATH:join(dir,'db.sqlite'),OWNER_PASSWORD:'test-only-password-123'};
 for(const k of ['AI_API_KEY','AI_PROVIDER','AI_MODEL','GITHUB_DATA_REPO','GITHUB_DATA_TOKEN','IBRAXIS_PUBLISH_TOKEN'])delete env[k];
 const proc=spawn(process.execPath,['app/server.mjs'],{env});
 try{
  const port=19571;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server start timed out')),9000);proc.stdout.on('data',d=>{if(d.toString().includes('listening')){clearTimeout(timer);resolve()}});proc.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'))})});
  const base='http://127.0.0.1:'+port;
  const call=(path,b,cookie='')=>fetch(base+path,{method:b===undefined?'GET':'POST',headers:{...(b===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(b===undefined?{}:{body:JSON.stringify(b)})});
  assert.equal((await call('/api/profile-photo')).status,401);
  assert.equal((await call('/api/profile-photo',{action:'upload',data:photo64})).status,401);
  assert.equal((await call('/profile-photo.webp')).status,404);
  const login=await call('/api/login',{password:'test-only-password-123'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/profile-photo',{action:'upload',data:'not an image'},cookie)).status,400);
  let response=await call('/api/profile-photo',{action:'upload',data:photo64},cookie);assert.equal(response.status,200);
  const privateState=await (await call('/api/profile-photo',undefined,cookie)).json();assert.equal(privateState.approved,false);assert(privateState.draft.includes(photo64));
  assert.equal((await call('/profile-photo.webp')).status,404);
  assert(!((await (await call('/?lang=ar')).text()).includes('ix-hero-portrait')));
  response=await call('/api/profile-photo',{action:'approve',confirm:true},cookie);assert.equal(response.status,200);
  response=await call('/api/profile-photo',{action:'appearance',portrait_style:'circle',portrait_focus_y:30},cookie);assert.equal(response.status,200);
  response=await call('/profile-photo.webp');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(Buffer.compare(Buffer.from(await response.arrayBuffer()),bytes),0);
  const site=await (await call('/api/site')).json();assert.match(site.profile_photo_src,/^\/profile-photo\.webp\?v=/);assert.equal(site.portrait_style,'circle');assert(!JSON.stringify(site).includes(photo64));
  const html=await (await call('/?lang=en')).text();const about=await (await call('/about?lang=en')).text();assert.match(html,/ix-hero-portrait/);assert.match(about,/ix-profile-about/);assert(!html.includes(photo64));assert(!about.includes(photo64));
  assert.equal((await call('/api/profile-photo',{action:'hide'},cookie)).status,400);
  assert.equal((await call('/api/profile-photo',{action:'hide',confirm:true},cookie)).status,200);
  assert.equal((await call('/profile-photo.webp')).status,404);
  assert.equal((await call('/api/profile-photo',{action:'remove',confirm:true},cookie)).status,200);
  assert.equal((await (await call('/api/profile-photo',undefined,cookie)).json()).hasDraft,false);
 }finally{if(proc.exitCode===null&&proc.signalCode===null){const done=new Promise(r=>proc.once('exit',r));proc.kill();await done}rmSync(dir,{recursive:true,force:true})}
});

test('Pages export includes only approved WebP, never the private photo draft or its base64 data',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ix-photo-pages-'));
 try{
  cpSync(resolve('app'),join(dir,'app'),{recursive:true});
  const root=join(dir,'input');mkdirSync(root);
  const files=new Map();files.set('settings/site.json',json({name:'Test Owner',default_language:'ar',portrait_placement:'both',portrait_style:'editorial'}));
  const setPhoto=state=>{files.set('settings/other.json',json([{key:'ix_profile_photo',value:JSON.stringify(state)}]));for(const [name,b] of files){mkdirSync(dirname(join(root,name)),{recursive:true});writeFileSync(join(root,name),b)}writeFileSync(join(root,'manifest.json'),json(manifest(files)))};
  const run=()=>spawnSync(process.execPath,[resolve('scripts/build-pages.mjs')],{cwd:dir,env:{...process.env,PAGES_DATA_DIR:root,PAGES_SITE_URL:'https://example.github.io/ibraxis/'},encoding:'utf8'});
  setPhoto({draft:photo64,approved:''});let result=run();assert.equal(result.status,0,result.stderr);assert(!existsSync(join(dir,'dist/profile-photo.webp')));assert(!readFileSync(join(dir,'dist/ar/index.html'),'utf8').includes('ix-hero-portrait'));
  setPhoto({draft:'PRIVATE_UNAPPROVED_TEXT',approved:photo64});result=run();assert.equal(result.status,0,result.stderr);assert.equal(Buffer.compare(readFileSync(join(dir,'dist/profile-photo.webp')),bytes),0);
  for(const lang of ['ar','en']){const html=readFileSync(join(dir,'dist',lang,'index.html'),'utf8');assert(html.includes('/ibraxis/profile-photo.webp'));assert(!html.includes(photo64));assert(!html.includes('PRIVATE_UNAPPROVED_TEXT'))}
  const publicIndex=readFileSync(join(dir,'dist/public-index.json'),'utf8');assert(!publicIndex.includes(photo64));assert(!publicIndex.includes('PRIVATE_UNAPPROVED_TEXT'));
  setPhoto({draft:photo64,approved:''});result=run();assert.equal(result.status,0,result.stderr);assert(!existsSync(join(dir,'dist/profile-photo.webp')));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
