// One public information architecture for the live server and the static site.
// Each route owns its content; the landing page remains an introduction.
export const PUBLIC_PAGES = Object.freeze([
  {path:'/', en:'Home', ar:'الرئيسية', section:null},
  {path:'/about', en:'About', ar:'من أنا', section:'identity'},
  {path:'/projects', en:'Projects', ar:'المشاريع', section:'work'},
  {path:'/services', en:'Services', ar:'الخدمات', section:'services'},
  {path:'/products', en:'Products', ar:'المنتجات', section:'products'},
  {path:'/insights', en:'Articles', ar:'المقالات', section:'insights'},
  {path:'/experiences', en:'Experiences', ar:'التجارب', section:'experiences'},
  {path:'/achievements', en:'Achievements', ar:'الإنجازات', section:null},
  {path:'/contact', en:'Contact', ar:'تواصل معي', section:'contact'}
]);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const publicPage=path=>PUBLIC_PAGES.find(x=>x.path===path);
export const pageText=(page,lang)=>page?.[lang==='ar'?'ar':'en']||'';
export function visiblePublicPages(site={}){
  const hidden=new Set(site.hidden_sections||[]);
  return PUBLIC_PAGES.filter(page=>!page.section||!hidden.has(page.section));
}
export function publicNavigation({path='/',lang='ar',site={},urlFor=p=>p,staticMode=false,includeAdmin=true}={}){
  const ar=lang==='ar',pages=visiblePublicPages(site),primary=new Set(['/','/about','/projects','/services','/contact']);
  const link=page=>`<a href="${escape(urlFor(page.path))}"${path===page.path?' aria-current="page" class="is-current"':''}>${escape(pageText(page,lang))}</a>`;
  const more=pages.filter(page=>!primary.has(page.path));
  return `<div class="ix-nav-links" aria-label="${ar?'التنقل الرئيسي':'Main navigation'}">${pages.filter(page=>primary.has(page.path)).map(link).join('')}${more.length?`<details class="ix-nav-more"${more.some(p=>p.path===path)?' open':''}><summary>${ar?'المزيد':'More'}</summary><div class="ix-nav-extra">${more.map(link).join('')}</div></details>`:''}</div><div class="ix-nav-utilities">${includeAdmin&&!staticMode?`<a class="ix-workspace-link" href="${escape(urlFor('/admin'))}">${ar?'الإدارة':'Workspace'}</a>`:''}${staticMode?`<a id="lang-link" href="${escape(urlFor(path,ar?'en':'ar'))}" hreflang="${ar?'en':'ar'}">${ar?'English':'العربية'}</a>`:''}<button id="lang" type="button" ${staticMode?'hidden':''} aria-label="${ar?'Switch to English':'التبديل إلى العربية'}">${ar?'English':'العربية'}</button><button id="theme" type="button" aria-label="${ar?'تغيير المظهر':'Change theme'}">◐</button></div>`;
}
export function publicDirectory({lang='ar',site={},rows=[],urlFor=p=>p}={}){
  const ar=lang==='ar',pages=visiblePublicPages(site).filter(page=>page.path!=='/'&&page.path!=='/contact');
  const count=path=>({
    '/about':rows.filter(x=>x.kind==='page').length,
    '/projects':rows.filter(x=>x.kind==='project').length,
    '/services':rows.filter(x=>x.kind==='service').length,
    '/products':rows.filter(x=>x.kind==='product').length,
    '/insights':rows.filter(x=>x.kind==='article').length,
    '/experiences':rows.filter(x=>x.kind==='experience').length,
    '/achievements':rows.filter(x=>['achievement','certification','education','career'].includes(x.kind)).length
  })[path];
  return `<section class="ix-page-directory" aria-labelledby="ix-directory-title"><div class="ix-directory-heading"><div><div class="eyebrow">${ar?'استكشف الموقع':'EXPLORE THE WEBSITE'}</div><h2 id="ix-directory-title">${ar?'كل ما تحتاجه، في مكانه الصحيح':'Find exactly what you need'}</h2></div>${!site.hidden_sections?.includes('contact')?`<a class="secondary" href="${escape(urlFor('/contact'))}">${ar?'تواصل معي':'Get in touch'}</a>`:''}</div><div class="ix-directory-grid">${pages.map(page=>`<a class="ix-directory-card" href="${escape(urlFor(page.path))}"><span class="ix-directory-arrow" aria-hidden="true">↗</span><strong>${escape(pageText(page,lang))}</strong>${count(page.path)?`<small>${count(page.path)} ${ar?'عنصر':'items'}</small>`:`<small>${ar?'استكشف المزيد':'Explore section'}</small>`}</a>`).join('')}</div></section>`;
}
export function collectionIntro({path,lang='ar',count=0,urlFor=p=>p}={}){
  const page=publicPage(path);const ar=lang==='ar';
  return `<section class="ix-page-intro"><a class="ix-back-link" href="${escape(urlFor('/'))}">${ar?'الرئيسية':'Home'} / ${escape(pageText(page,lang))}</a><div class="eyebrow">IBRAXIS / ${ar?'استكشف':'EXPLORE'}</div><h1>${escape(pageText(page,lang))}</h1><p>${ar?'محتوى منظّم لتجد ما تبحث عنه بسهولة.':'A focused space for everything in this section.'}</p>${count?`<span class="ix-count">${count} ${ar?'عنصر منشور':'published items'}</span>`:''}</section>`;
}
