// Public professional proof of work: any HTTPS platform or tool, never arbitrary scraping.
export const ACHIEVEMENTS_KEY='ix_professional_achievements_v1';
export const achievementCategories=['data','coding','design','ai','research','business','learning','other'];
const names={data:['Data & BI','تحليل البيانات وذكاء الأعمال'],coding:['Programming','البرمجة'],design:['Design','التصميم'],ai:['AI & Automation','الذكاء الاصطناعي والأتمتة'],research:['Research','الأبحاث'],business:['Business','الأعمال'],learning:['Learning','التعلّم'],other:['Other','أخرى']};
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bounded=(v,n=180)=>{if(typeof v!=='string'||v.length>n)throw Error('Invalid achievement text');return v.trim()};
export function achievementURL(v){
 if(typeof v!=='string'||v.length>1500)throw Error('Invalid achievement URL');
 let u;try{u=new URL(v)}catch{throw Error('Use a complete HTTPS profile or evidence URL')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||u.hostname.length>253||u.hostname.endsWith('.')||/^(?:localhost|.+\.localhost|.+\.local|.+\.internal)$/i.test(u.hostname)||/^(?:\d{1,3}\.){3}\d{1,3}$/.test(u.hostname)||u.hostname.includes(':'))throw Error('A public HTTPS URL is required');
 return u.href;
}
export function codewarsUsername(url){
 const u=new URL(achievementURL(url));
 if(!['codewars.com','www.codewars.com'].includes(u.hostname)||u.search||u.hash)return null;
 const m=u.pathname.match(/^\/users\/([a-zA-Z0-9_.-]{1,60})\/?$/);
 return m?m[1]:null;
}
export function githubUsername(url){
 const u=new URL(achievementURL(url));
 if(!['github.com','www.github.com'].includes(u.hostname)||u.search||u.hash)return null;
 const m=u.pathname.match(/^\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)\/?$/);
 return m?m[1]:null;
}
export function supportedAchievementProvider(url){
 try{return codewarsUsername(url)?'codewars':githubUsername(url)?'github':null}catch{return null}
}
// A URL is sufficient to generate a private, publishable card. Unrecognised sites
// are links only; no page scraping, invented numbers or inferred account ownership.
export function achievementFromURL(value){
 const url=achievementURL(value),u=new URL(url),host=u.hostname.toLowerCase().replace(/^www\./,'');
 const known={
  'datalemur.com':['DataLemur','data'],
  'github.com':['GitHub','coding'],
  'codewars.com':['Codewars','coding'],
  'kaggle.com':['Kaggle','data'],
  'app.powerbi.com':['Power BI','data'],
  'powerbi.microsoft.com':['Power BI','data'],
  'public.tableau.com':['Tableau','data'],
  'tableau.com':['Tableau','data'],
  'leetcode.com':['LeetCode','coding'],
  'hackerrank.com':['HackerRank','coding'],
  'behance.net':['Behance','design'],
  'dribbble.com':['Dribbble','design'],
  'figma.com':['Figma','design'],
  'medium.com':['Medium','research'],
  'scholar.google.com':['Google Scholar','research'],
  'linkedin.com':['LinkedIn','business'],
  'credly.com':['Credly','learning']
 };
 const [platform,category]=known[host]||[host,'other'];
 const chunks=u.pathname.split('/').filter(Boolean),last=chunks.at(-1)||'';
 let profile_name='';try{profile_name=decodeURIComponent(last).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,80).trim()}catch{}
 if(!profile_name||['profile','user','users','in','dashboard','home'].includes(profile_name.toLowerCase()))profile_name='';
 return validateAchievement({url,platform,category,profile_name,
  title_ar:'ملفي على '+platform,title_en:'My '+platform+' profile',
  status:'draft',source:'manual',metric_value:null,extra_stats:[]});
}
export function validateAchievement(v){
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid achievement');
 const category=bounded(v.category,20),platform=bounded(v.platform,80),title_ar=bounded(v.title_ar,160),title_en=bounded(v.title_en,160);
 if(!achievementCategories.includes(category)||!platform||!(title_ar||title_en))throw Error('Category, platform, and title required');
 const url=achievementURL(v.url),id=v.id===undefined?'':bounded(v.id,32);
 if(id&&!/^[a-f0-9]{32}$/.test(id))throw Error('Invalid achievement ID');
 const metric_value=(v.metric_value===''||v.metric_value===undefined||v.metric_value===null)?null:Number(v.metric_value);
 if(metric_value!==null&&(!Number.isSafeInteger(metric_value)||metric_value<0||metric_value>100000000))throw Error('Invalid achievement metric');
 const extra_stats=Array.isArray(v.extra_stats)?v.extra_stats:[];
 if(extra_stats.length>2)throw Error('Too many achievement stats');
 const safeStats=extra_stats.map(s=>{
  if(!s||typeof s!=='object')throw Error('Invalid achievement stat');
  const value=Number(s.value);
  if(!Number.isSafeInteger(value)||value<0||value>100000000)throw Error('Invalid achievement stat value');
  return {value,label_ar:bounded(s.label_ar||'',70),label_en:bounded(s.label_en||'',70)};
 });
 const status=v.status==='published'?'published':'draft';
 const source=v.source==='api'?'api':'manual';
 const updated_at=v.updated_at?bounded(v.updated_at,30):'';
 if(updated_at&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(updated_at))throw Error('Invalid update date');
 return {id,platform,category,profile_name:bounded(v.profile_name||'',80),extra_stats:safeStats,title_ar,title_en,body_ar:bounded(v.body_ar||'',1200),body_en:bounded(v.body_en||'',1200),url,metric_value,metric_label_ar:bounded(v.metric_label_ar||'',80),metric_label_en:bounded(v.metric_label_en||'',80),status,source:source==='api'&&supportedAchievementProvider(url)?'api':'manual',updated_at};
}
export function publicAchievements(items=[]){if(!Array.isArray(items))return [];return items.slice(0,60).filter(x=>x?.status==='published').flatMap(x=>{try{const v=validateAchievement(x);return v.status==='published'?[v]:[]}catch{return []}});}
export function renderAchievements(items=[],lang='ar'){
 const rows=publicAchievements(items),ar=lang==='ar',tr=(en,a)=>ar?a:en;
 const label=(x,k)=>x[k+'_'+(ar?'ar':'en')]||x[k+'_'+(ar?'en':'ar')]||'';
 const cards=rows.map(x=>{
  const initial=(x.platform||'?').slice(0,2).toUpperCase();
  const extras=(x.extra_stats||[]).map(stat=>`<div class="ix-achievement-stat"><strong>${escapeHTML(stat.value.toLocaleString('en-US'))}</strong><span>${escapeHTML(label(stat,'label'))}</span></div>`).join('');
  const isVerified=x.source==='api'&&x.metric_value!==null&&supportedAchievementProvider(x.url);
  return `<article class="ix-achievement-card"><div class="ix-achievement-top"><div class="ix-achievement-brand" aria-hidden="true">${escapeHTML(initial)}</div><div class="ix-achievement-id"><h3>${escapeHTML(x.platform)}</h3>${x.profile_name?`<span dir="auto">${escapeHTML(x.profile_name)}</span>`:`<span>${escapeHTML(names[x.category][ar?1:0])}</span>`}</div></div>${x.metric_value!==null?`<div class="ix-achievement-main-metric"><span class="ix-achievement-star" aria-hidden="true">☆</span><strong>${escapeHTML(x.metric_value.toLocaleString('en-US'))}</strong><span>${escapeHTML(label(x,'metric_label')||tr('Achievements','إنجازات'))}</span></div>${extras?`<div class="ix-achievement-stats">${extras}</div>`:''}`:`<div class="ix-achievement-no-metric"><strong>${escapeHTML(label(x,'title')||x.platform)}</strong><p>${tr('Public profile link. This platform does not currently provide supported automatic statistics.','رابط البروفايل متاح؛ هذه المنصة لا تدعم حاليًا قراءة الإحصائيات تلقائيًا.')}</p></div>`}<div class="ix-achievement-foot"><span>${isVerified?tr('Updated from public API','محدّث من واجهة عامة'):tr('Profile link only','رابط المنصة فقط')}${x.updated_at?' · '+escapeHTML(x.updated_at.slice(0,10)):''}</span><a href="${escapeHTML(x.url)}" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">${tr('Open profile','فتح البروفايل')} <span aria-hidden="true">↗</span></a></div></article>`;
 }).join('');
 return `<section class="ix-achievements content-section" id="achievements" aria-labelledby="ix-achievements-title"><div class="ix-achievements-heading"><div><span class="ix-achievements-eyebrow">${tr('PROFESSIONAL PLATFORMS','المنصات المهنية')}</span><h2 id="ix-achievements-title">${tr('Professional achievements','إنجازاتي المهنية')}</h2><p>${tr('My public profiles and verifiable progress on professional platforms.','حساباتي العامة وتقدّمي على المنصات المهنية، مع روابط مباشرة للمصدر.')}</p></div></div>${rows.length?`<div class="ix-achievements-grid">${cards}</div>`:`<p class="ix-achievements-empty">${tr('My professional profiles will appear here after publication.','ستظهر حساباتي وإنجازاتي هنا بعد نشرها.')}</p>`}</section>`;
}
