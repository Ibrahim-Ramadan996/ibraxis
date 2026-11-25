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
export function validateAchievement(v){
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid achievement');
 const category=bounded(v.category,20),platform=bounded(v.platform,80),title_ar=bounded(v.title_ar,160),title_en=bounded(v.title_en,160);
 if(!achievementCategories.includes(category)||!platform||!(title_ar||title_en))throw Error('Category, platform, and title required');
 const url=achievementURL(v.url),id=v.id===undefined?'':bounded(v.id,32);
 if(id&&!/^[a-f0-9]{32}$/.test(id))throw Error('Invalid achievement ID');
 const metric_value=(v.metric_value===''||v.metric_value===undefined||v.metric_value===null)?null:Number(v.metric_value);
 if(metric_value!==null&&(!Number.isSafeInteger(metric_value)||metric_value<0||metric_value>100000000))throw Error('Invalid achievement metric');
 const status=v.status==='published'?'published':'draft';
 const source=v.source==='api'?'api':'manual';
 const updated_at=v.updated_at?bounded(v.updated_at,30):'';
 if(updated_at&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(updated_at))throw Error('Invalid update date');
 return {id,platform,category,title_ar,title_en,body_ar:bounded(v.body_ar||'',1200),body_en:bounded(v.body_en||'',1200),url,metric_value,metric_label_ar:bounded(v.metric_label_ar||'',80),metric_label_en:bounded(v.metric_label_en||'',80),status,source:source==='api'&&supportedAchievementProvider(url)?'api':'manual',updated_at};
}
export function publicAchievements(items=[]){if(!Array.isArray(items))return [];return items.slice(0,60).filter(x=>x?.status==='published').flatMap(x=>{try{const v=validateAchievement(x);return v.status==='published'?[v]:[]}catch{return []}});}
export function renderAchievements(items=[],lang='ar'){
 const rows=publicAchievements(items);if(!rows.length)return '';
 const ar=lang==='ar',tr=(e,a)=>ar?a:e, t=(x,k)=>x[k+'_'+(ar?'ar':'en')]||x[k+'_'+(ar?'en':'ar')]||'';
 return `<section class="ix-achievements content-section" id="achievements" aria-labelledby="ix-achievements-title"><div class="ix-achievements-heading"><div><span class="ix-achievements-eyebrow">${tr('PROOF OF WORK','إنجازات موثقة بروابط')}</span><h2 id="ix-achievements-title">${tr('Professional achievements','إنجازاتي المهنية')}</h2><p>${tr('Tools, platforms, projects and progress — with sources you can visit.','أدوات ومنصات ومشاريع وتقدّم مهني، مع روابط تقدر تتحقق منها.')}</p></div></div><div class="ix-achievements-grid">${rows.map(x=>`<article class="ix-achievement-card"><div class="ix-achievement-top"><span class="ix-achievement-category">${escapeHTML(names[x.category][ar?1:0])}</span><span class="ix-achievement-platform" dir="auto">${escapeHTML(x.platform)}</span></div><h3>${escapeHTML(t(x,'title'))}</h3>${t(x,'body')?`<p class="ix-achievement-description">${escapeHTML(t(x,'body'))}</p>`:''}${x.metric_value!==null?`<div class="ix-achievement-metric"><strong>${escapeHTML(x.metric_value.toLocaleString('en-US'))}</strong><span>${escapeHTML(t(x,'metric_label')||tr('Recorded milestones','إنجازات مسجلة'))}</span></div>`:''}<div class="ix-achievement-foot"><span>${x.source==='api'?tr('Source: public platform API','المصدر: واجهة المنصة العامة'):tr('Owner reported','بيانات أدخلها صاحب الموقع')}${x.updated_at?' · '+escapeHTML(x.updated_at.slice(0,10)):''}</span><a href="${escapeHTML(x.url)}" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">${tr('View evidence','عرض المصدر')} <span aria-hidden="true">↗</span></a></div></article>`).join('')}</div></section>`;
}
