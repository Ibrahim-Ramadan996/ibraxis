import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {achievementURL,achievementLogoURL,achievementFromURL,validateAchievement,publicAchievements,renderAchievements,codewarsUsername,githubUsername,supportedAchievementProvider} from '../app/achievements.js';
import {fetchAchievementMetric} from '../app/achievements-sync.mjs';
import {areaCounts,projectInArea,WORK_AREAS} from '../app/work-areas.js';
import {homeExperience} from '../app/home-experience.js';
import {renderPage} from '../app/seo.mjs';
const id='a'.repeat(32);
const item={id,platform:'DataLemur',category:'data',title_ar:'تدريبات SQL',title_en:'SQL practice',url:'https://datalemur.com',metric_value:7,metric_label_ar:'مسائل',metric_label_en:'Problems solved',status:'published'};
test('public professional achievements require HTTPS and safe metadata',()=>{
 for(const url of ['http://example.com','javascript:alert(1)','https://localhost/data','https://127.0.0.1/a','https://user:pass@example.com','https://example.com:455/'])assert.throws(()=>achievementURL(url));
 const a=validateAchievement(item);assert.equal(a.metric_value,7);assert.equal(a.source,'manual');
 assert.throws(()=>validateAchievement({...item,metric_value:-1}));
 assert.throws(()=>validateAchievement({...item,title_en:'',title_ar:''}));
 assert.throws(()=>validateAchievement({...item,url:'http://example.com'}));
});
test('published achievements display evidence and no private drafts or HTML injection',()=>{
 const dangerous={...item,platform:'<img src=x>',title_ar:'<script>alert(1)</script>',body_ar:'<p>secret</p>'};
 const data=publicAchievements([{...item,status:'draft'},dangerous,{...item,id:'wrong'}]);
 assert.equal(data.length,1);
 const html=renderAchievements(data,'ar');assert.match(html,/إنجازاتي المهنية/);assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/href="https:\/\/datalemur.com\//);
 const empty=renderAchievements([{...item,status:'draft'}], 'en');assert.match(empty,/Professional achievements/);assert.doesNotMatch(empty,/ix-achievement-card/);
});
test('provider integration supports only allowlisted profile URLs',async()=>{
 assert.equal(codewarsUsername('https://www.codewars.com/users/test-person'),'test-person');
 assert.equal(githubUsername('https://github.com/example-user'),'example-user');
 assert.equal(supportedAchievementProvider('https://datalemur.com/user/someone'),null);
 assert.equal(supportedAchievementProvider('https://github.com/example-user/project'),null);
 const calls=[];const get=(json)=>async(url,opts)=>{calls.push([url,opts]);return {ok:true,json:async()=>json}};
 const cw=await fetchAchievementMetric('https://www.codewars.com/users/demo',{fetcher:get({codeChallenges:{totalCompleted:27}})});
 assert.equal(cw.metric_value,27);assert.equal(cw.source,'api');assert.equal(calls[0][0],'https://www.codewars.com/api/v1/users/demo');
 const gh=await fetchAchievementMetric('https://github.com/demo',{fetcher:get({public_repos:18})});
 assert.equal(gh.metric_value,18);assert.equal(calls[1][0],'https://api.github.com/users/demo');
 await assert.rejects(()=>fetchAchievementMetric('https://datalemur.com/user/demo',{fetcher:()=>{throw Error('Must not fetch')}}),/unavailable/);
});
test('work area cards use published classifications and link to filtered portfolio',()=>{
 const data={id,kind:'project',status:'published',title:'SQL dashboard',classification:{domains:['data','bi']}};
 const ai={...data,id:'b'.repeat(32),classification:{domains:['ai']}};
 const draft={...data,id:'c'.repeat(32),status:'draft'};
 assert.equal(projectInArea(data,'data'),true);assert.equal(projectInArea(ai,'data'),false);
 assert.equal(areaCounts([data,ai,draft]).find(x=>x.id==='data').count,1);
 assert.equal(WORK_AREAS.length,3);
 const html=homeExperience({site:{},rows:[data,ai,draft],lang:'ar',urlFor:x=>'/ibraxis/ar'+x+'/?lang=ar'});
 assert.match(html,/area=data/);assert.match(html,/area=ai/);assert.doesNotMatch(html,/area=build/);assert.match(html,/عرض المشاريع/);
});
test('published professional achievements have a separate page and projects support area filtering',()=>{
 const template=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 const html=renderPage({template,origin:'https://example.org',path:'/achievements',lang:'en',site:{site_name:'Demo',section_order:['work','identity']},records:[],achievements:[item]});
 assert.match(html,/Professional achievements/);
 assert.equal((html.match(/ix-achievements-grid/g)||[]).length,1);
 const admin=renderPage({template,origin:'https://example.org',path:'/admin',lang:'en',site:{},records:[],achievements:[item]});assert.doesNotMatch(admin,/ix-achievements-grid/);
 const server=readFileSync(new URL('../app/server.mjs',import.meta.url),'utf8');
 assert.match(server,/work-areas\.js/);
 const pages=readFileSync(new URL('../app/pages.js',import.meta.url),'utf8');
 assert.match(pages,/projectInArea/);
 const client=readFileSync(new URL('../app/public.js',import.meta.url),'utf8');
 assert.match(client,/achievementsHub\(p\)/);
 assert.match(client,/id="gallery-area"/);
});

test('the landing page is concise; contact, achievements and custom features have dedicated routes',()=>{
 const template=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 const features=[{id:'abc123abc123',kind:'section',title:'Featured extra',description:'Additional public feature'}];
 for(const lang of ['ar','en']){
  const site={site_name:'IBRAXIS',section_order:['contact','identity','work'],contact_email:'owner@example.com'};
  const render=path=>renderPage({template,origin:'https://example.org',path,lang,site,records:[],achievements:[item],features});
  const home=render('/'),contact=render('/contact'),achievements=render('/achievements'),experiences=render('/experiences');
  assert.match(home,/ix-page-directory/);
  assert.doesNotMatch(home,/id="contact"|id="achievements"|data-ibraxis-feature=/);
  assert.match(contact,/id="contact"/);assert.doesNotMatch(contact,/ix-achievements-grid/);
  assert.match(achievements,/ix-achievements-grid/);assert.doesNotMatch(achievements,/id="contact"/);
  assert.match(experiences,/data-ibraxis-feature="abc123abc123"/);assert.doesNotMatch(experiences,/id="contact"/);
 }
 const source=readFileSync(new URL('../app/public.js',import.meta.url),'utf8');
 assert.match(source,/path==='\/contact'/);
 assert.match(source,/path==='\/experiences'/);
});

test('owner approves evidence while public API never exposes private drafts',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {spawn}=await import('node:child_process');
 const root=mkdtempSync(join(tmpdir(),'ix-achievements-http-'));
 const port=19129,server=spawn(process.execPath,['app/server.mjs'],{env:{...process.env,PORT:String(port),DB_PATH:join(root,'db.sqlite'),DATA_DIR:join(root,'files'),OWNER_PASSWORD:'test-only-password-123'}});
 try{
  await new Promise((ok,fail)=>{server.stdout.once('data',ok);server.once('exit',()=>fail(Error('Server terminated')))});
  const base=`http://127.0.0.1:${port}`;let cookie='';
  const call=async(path,data,auth=false)=>fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Cookie:cookie}:{})},...(data?{body:JSON.stringify(data)}:{})});
  assert.equal((await call('/api/achievements')).status,401);
  assert.deepEqual(await (await call('/api/achievements/public')).json(),[]);
  const login=await call('/api/login',{password:'test-only-password-123'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
  const auto=await call('/api/achievements',{action:'add-url',url:'https://datalemur.com/profile'},true);assert.equal(auto.status,200);const automatic=await auto.json();assert.equal(automatic.achievement.platform,'DataLemur');assert.equal(automatic.achievement.metric_value,null);
  assert.deepEqual(await (await call('/api/achievements/public')).json(),[]);
  assert.equal((await call('/api/achievements',{action:'publish',id:automatic.id,confirm:true},true)).status,200);
  const autoPublished=await (await call('/api/achievements/public')).json();assert.equal(autoPublished.length,1);assert.equal(autoPublished[0].platform,'DataLemur');assert.equal(autoPublished[0].metric_value,null);
  assert.equal((await call('/api/achievements',{action:'hide',id:automatic.id,confirm:true},true)).status,200);assert.deepEqual(await (await call('/api/achievements/public')).json(),[]);
  assert.equal((await call('/api/achievements',{action:'remove',id:automatic.id,confirm:true},true)).status,200);
  const saved=await call('/api/achievements',{action:'save',item:{...item,id:''}},true);assert.equal(saved.status,200);const record=await saved.json();assert.match(record.id,/^[a-f0-9]{32}$/);assert.equal(record.status,'draft');
  assert.deepEqual(await (await call('/api/achievements/public')).json(),[]);
  const published=await call('/api/achievements',{action:'publish',id:record.id,confirm:true},true);assert.equal(published.status,200);
  const rows=await (await call('/api/achievements/public')).json();assert.equal(rows.length,1);assert.equal(rows[0].metric_value,7);
  assert.equal((await call('/api/achievements',{action:'hide',id:record.id,confirm:true},true)).status,200);
  assert.deepEqual(await (await call('/api/achievements/public')).json(),[]);
 }finally{server.kill();await new Promise(ok=>server.once('exit',ok));rmSync(root,{recursive:true,force:true})}
});

test('link-only input generates a professional card without invented statistics',()=>{
 const dl=achievementFromURL('https://datalemur.com/profile');
 assert.equal(dl.platform,'DataLemur');assert.equal(dl.category,'data');
 assert.equal(dl.metric_value,null);assert.equal(dl.source,'manual');
 assert.equal(dl.status,'draft');assert.ok(dl.title_ar);
 const other=achievementFromURL('https://custom-work.example/portfolio/me');
 assert.equal(other.platform,'custom-work.example');assert.equal(other.metric_value,null);
 const pub=renderAchievements([{...dl,id,status:'published'}],'ar');
 assert.match(pub,/DataLemur/);assert.doesNotMatch(pub,/الإحصائيات تلقائيًا|لا تدعم حاليًا|ملفي على DataLemur|رابط المنصة فقط/);
 assert.doesNotMatch(pub,/ix-achievement-main-metric/);
 assert.match(pub,/زيارة الحساب/);
});

test('URL-based approved profiles show trusted API counts and detailed stats',async()=>{
 const base=achievementFromURL('https://github.com/demo');
 const metric=await fetchAchievementMetric(base.url,{fetcher:async()=>({ok:true,json:async()=>({login:'demo',name:'Demo Dev',public_repos:12,followers:5,public_gists:2})})});
 const record=validateAchievement({...base,...metric,id,status:'published'});
 assert.equal(record.profile_name,'Demo Dev');assert.equal(record.extra_stats.length,2);
 const html=renderAchievements([record],'en');
 assert.match(html,/12/);assert.match(html,/Followers/);assert.match(html,/Public gists/);
 assert.doesNotMatch(html,/Updated from public API|Profile link only/);
 assert.doesNotMatch(html,/onclick=|<script>/);
});


test('visitor profile cards are compact, scalable and never disclose provider integration limits',()=>{
 const profiles=[
  {...achievementFromURL('https://leetcode.com/studyplan/top-sql-50/'),id:'b'.repeat(32),status:'published'},
  {...achievementFromURL('https://datalemur.com/profile'),id:'c'.repeat(32),status:'published'}
 ];
 const html=renderAchievements(profiles,'ar');
 assert.equal((html.match(/class="ix-achievement-card ix-achievement-card--link"/g)||[]).length,2);
 assert.doesNotMatch(html,/لا تدعم حاليًا|الإحصائيات تلقائيًا|ملفي على|رابط البروفايل متاح|رابط المنصة فقط/);
 assert.match(html,/LeetCode/);assert.match(html,/DataLemur/);
 assert.match(html,/زيارة الحساب/);
 assert.equal((html.match(/target="_blank"/g)||[]).length,2);
 const en=renderAchievements(profiles,'en');
 assert.doesNotMatch(en,/This platform does not currently|My LeetCode profile|Profile link only/);
 const css=readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
 assert.match(css,/grid-template-columns:repeat\(auto-fill,minmax\(min\(100%,230px\),1fr\)\)/);
 assert.match(css,/max-width:320px/);
});

test('automatic platform favicons come from the validated hostname, with a privacy-safe graceful fallback',()=>{
 assert.equal(achievementLogoURL('https://leetcode.com/studyplan/top-sql-50/'),
  'https://www.google.com/s2/favicons?domain=leetcode.com&sz=128');
 assert.throws(()=>achievementLogoURL('http://localhost/private'));
 const forged=validateAchievement({...achievementFromURL('https://example.net/portfolio'),platform:'GitHub',status:'published',id});
 const html=renderAchievements([forged], 'en');
 assert.match(html,/domain=example.net&amp;sz=128/);
 assert.doesNotMatch(html,/domain=github.com/);
 assert.match(html,/class="ix-achievement-brand-fallback"/);
 assert.match(html,/class="ix-achievement-logo" data-achievement-logo/);
 assert.match(html,/referrerpolicy="no-referrer"/);
 const css=readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
 assert.match(css,/ix-achievement-brand--loaded/);
 const staticJs=readFileSync(new URL('../app/pages.js',import.meta.url),'utf8');
 const liveJs=readFileSync(new URL('../app/public.js',import.meta.url),'utf8');
 const build=readFileSync(new URL('../scripts/build-pages.mjs',import.meta.url),'utf8');
 const server=readFileSync(new URL('../app/server.mjs',import.meta.url),'utf8');
 assert.match(staticJs,/enhanceAchievementLogos\(\)/);
 assert.match(liveJs,/enhanceAchievementLogos\(app\)/);
 assert.match(build,/achievement-logos\.js/);
 assert.match(server,/img-src 'self' data: https:\/\/www\.google\.com https:\/\/\*\.gstatic\.com/);
});
