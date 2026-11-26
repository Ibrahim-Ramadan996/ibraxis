import {PUBLIC_PAGES,publicPage,publicNavigation,publicDirectory,visiblePublicPages,collectionIntro} from './site-navigation.js';
import {renderPublicFeatures} from './site-features.js';
import {renderSkillGallery} from './skill-experience.js';
import {homeExperience} from './home-experience.js';
import {connectMarkup,floatingContact} from './connect.js';
import {renderAchievements} from './achievements.js';
// Server rendering for every visitor; no bot-specific content and no private records.
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function publicOrigin(value){if(!value)return '';const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('PUBLIC_SITE_URL must be an HTTPS origin');return u.origin}
export const language=(query,site)=>['ar','en'].includes(query)?query:site.default_language==='en'?'en':'ar';
export const pageURL=(origin,path,lang)=>`${origin}${path}?lang=${lang}`;
const plain=v=>String(v||'').replace(/\s+/g,' ').trim();
const short=(v,n=160)=>Array.from(plain(v)).slice(0,n).join('');
const loc=(x,l,k)=>x?.[l+'_'+k]||x?.[k+'_'+l]||x?.[k]||'';
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
const ixSocialIcons={
 github:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 19 4.77 5.07 5.07 0 0 0 18.91 1S17.73.65 15 2.48a13.38 13.38 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 8 18.13V22"/></svg>',
 linkedin:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12" rx="1"/><circle cx="4" cy="4" r="2"/></svg>'
};
const ixSocialLink=(kind,url)=>`<a class="ix-social-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" dir="ltr"><span class="ix-social-icon">${ixSocialIcons[kind]}</span><span>${kind==='github'?'GitHub':'LinkedIn'}</span><span class="ix-social-arrow" aria-hidden="true">↗</span></a>`;
export function ownerFooter(site,lang){
 const ar=lang==='ar';
 if(site.footer_owner_visible==='off')return '';
 const name=(ar?site.footer_owner_ar:site.footer_owner_en)||site.name||'';
 if(!name.trim())return '';
 const style=['minimal','badge','signature'].includes(site.footer_owner_style)?site.footer_owner_style:'signature';
 const color=/^#[0-9a-f]{6}$/i.test(site.footer_owner_color||'')?site.footer_owner_color:'#b6e6d7';
 return `<div class="ix-owner ix-owner--${style}" style="--ix-owner-ink:${color}"><span class="ix-owner-caption">${ar?'صُنع وأُدير بواسطة':'Created & managed by'}</span><strong dir="auto">${esc(name)}</strong></div>`;
}
export function renderPage({template,origin,path,lang,site,records=[],showcases=[],item=null,navigation=null,missing=false,urlFor=pageURL,staticMode=false,features=[],achievements=[]}){
 const ar=lang==='ar',tr=(e,a)=>ar?a:e, t=k=>site[k+'_'+lang]||'', name=(ar&&site.site_name_ar)||site.site_name||'IBRAXIS', hidden=new Set(site.hidden_sections||[]), person=!hidden.has('identity')?site.name:'', role=person?t('role'):'', bio=person?t('bio'):'';
 const titleOf=x=>loc(x,lang,'title'), bodyOf=x=>loc(x,lang,'body');
 const link=(p,label,hash='')=>`<a href="${esc(urlFor('',p,lang)+hash)}">${esc(label)}</a>`;
 const projects=records.filter(x=>x.kind==='project'); const card=x=>`<article class="card"><h3>${link('/project/'+x.id,titleOf(x))}</h3><p>${esc(short(bodyOf(x),280))}</p></article>`;
 const showCard=x=>`<article class="card"><h3>${link('/showcase/'+x.id,titleOf(x))}</h3><p>${esc(bodyOf(x))}</p></article>`;
 const itemPath=item?(path.startsWith('/showcase/')?'/showcase/':'/project/')+item.id:path;
 const author=person?{'@type':'Person','@id':urlFor(origin,'/',lang)+'#person',name:person,...(role?{jobTitle:role}:{}),...(bio?{description:bio}:{}),...([site.github,site.linkedin].some(Boolean)?{sameAs:[site.github,site.linkedin].filter(Boolean)}:{})}:null;
 let heading='',description='',content='',schema=null;
 if(missing){heading=tr('Project unavailable','المشروع غير متاح');content=`<h1>${esc(heading)}</h1><p>${link('/projects',tr('All projects','كل المشاريع'))}</p>`;}
 else if(path==='/admin'){heading=tr('Private workspace','مساحة العمل الخاصة');content=`<h1>${esc(heading)}</h1>`;}
 else if(path==='/projects'&&hidden.has('work')){heading=tr('Section unavailable','القسم غير متاح');content=`<section class="ix-page-intro"><h1>${esc(heading)}</h1><p>${link('/',tr('Back to home','العودة للرئيسية'))}</p></section>`;}
 else if(path==='/projects'){heading=tr('All projects','كل المشاريع');description=tr('Explore published projects and live experiences.','استكشف المشاريع المنشورة والتجارب الحية.');content=`<section class="gallery-intro"><h1>${esc(heading)}</h1><p>${esc(description)}</p><div class="grid">${projects.map(card).join('')}</div></section>`;schema={'@type':'CollectionPage',name:heading,mainEntity:{'@type':'ItemList',itemListElement:projects.map((x,i)=>({'@type':'ListItem',position:i+1,url:urlFor(origin,'/project/'+x.id,lang),name:titleOf(x)}))}};}
 else if(item){heading=titleOf(item);description=bodyOf(item);const isShow=path.startsWith('/showcase/');const linked=isShow?(item.project_id?link('/project/'+item.project_id,tr('Back to project','العودة للمشروع')):''):showcases.filter(x=>x.project_id===item.id).map(showCard).join('');const others=navigation?[navigation.previous,navigation.next,...navigation.related,...navigation.more].filter(Boolean).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i):[];
 content=`<section class="project-detail"><p>${link('/projects',tr('All projects','كل المشاريع'))}</p><h1>${esc(heading)}</h1><p class="project-description">${esc(description)}</p>${linked}</section><section class="project-discovery"><h2>${esc(tr('More of my work','المزيد من أعمالي'))}</h2><div class="grid">${others.map(card).join('')}</div><p>${link('/projects',tr('Explore all projects','عرض كل المشاريع'))}</p></section>${person?`<section class="card"><h2>${esc(person)}</h2><p>${esc(role)}</p>${link('/',tr('About me','تعرّف عليّ'),'#identity')}</section>`:''}`;
 schema={'@type':'CreativeWork',name:heading,description,...(author?{creator:author}:{}),url:urlFor(origin,itemPath,lang)};
 }else {
  const isHome=path==='/',route=publicPage(path),hiddenRoute=route?.section&&hidden.has(route.section);
  const groups=[['page','about'],['project','work'],['product','products'],['service','services'],['article','insights'],['experience','experiences']];
  const identityKinds=[['achievement',tr('Achievements','الإنجازات')],['certification',tr('Certifications','الشهادات')],['education',tr('Education','التعليم')],['career',tr('Career','الخبرات المهنية')]];
  const aboutPhoto=site.profile_photo_src&&['both','about'].includes(site.portrait_placement||'both')?`<figure class="ix-profile-about ix-photo--${esc(site.portrait_style||'editorial')} ix-photo-size--${esc(site.portrait_size||'balanced')}" style="--ix-photo-focus:${Number(site.portrait_focus_x??50)}% ${Number(site.portrait_focus_y??35)}%"><img src="${esc(site.profile_photo_src)}" alt="${esc(tr('Portrait of ','الصورة الشخصية لـ ')+(site.name||name))}" loading="lazy" decoding="async"></figure>`:'';
  const intro=(title,count=0)=>collectionIntro({path,lang,count,urlFor:p=>urlFor('',p,lang)});
  const collection=(kind,title,id)=>{const list=records.filter(x=>x.kind===kind);return `<section class="content-section" id="${id}"><h2>${esc(title)}</h2>${list.length?`<div class="grid">${list.map(x=>kind==='project'?card(x):`<article class="card"><h3>${esc(titleOf(x))}</h3><p>${esc(bodyOf(x))}</p></article>`).join('')}</div>`:`<div class="empty">${tr('New content will appear here when published.','سيظهر المحتوى هنا عند نشره.')}</div>`}</section>`};
  if(isHome){
    heading=t('headline')||tr('Beyond ideas.','أبعد من الأفكار.');description=t('seo_description')||bio||tr('Personal technology portfolio, projects, research and services.','منصة شخصية للتكنولوجيا والمشاريع والأبحاث والخدمات.');
    content=`${homeExperience({site,rows:records,lang,urlFor:p=>urlFor('',p,lang)})}${publicDirectory({site,rows:records,lang,urlFor:p=>urlFor('',p,lang)})}`;
    schema={'@graph':[{'@type':'WebSite',name,url:origin+'/'},...(author?[{'@type':'WebPage',name:heading,url:urlFor(origin,'/',lang),mainEntity:author}]:[])]};
  }else if(hiddenRoute){heading=tr('Section unavailable','القسم غير متاح');description=heading;content=`<section class="ix-page-intro"><h1>${esc(heading)}</h1><p>${link('/',tr('Back to home','العودة للرئيسية'))}</p></section>`;}
  else if(route){
    heading=ar?route.ar:route.en;
    description=tr('Explore '+heading+' within IBRAXIS.','تصفح '+heading+' ضمن منصة IBRAXIS.');
    const introHTML=intro(heading,records.filter(x=>x.kind===({'/about':'page','/products':'product','/services':'service','/insights':'article','/experiences':'experience'}[path])).length);
    if(path==='/about')content=`${introHTML}<section id="identity" class="content-section ix-profile-section">${aboutPhoto}<div class="ix-profile-content"><h2>${esc(person||tr('Meet the creator','تعرّف على صاحب المنصة'))}</h2><p>${esc(role)}</p><p>${esc(bio)}</p>${['vision','journey'].map(k=>t(k)?`<h3>${esc(k==='vision'?tr('My vision','رؤيتي'):tr('My journey','رحلتي'))}</h3><p>${esc(t(k))}</p>`:'').join('')}<div class="ix-social-links">${['github','linkedin'].filter(k=>site[k]).map(k=>ixSocialLink(k,site[k])).join('')}</div>${renderSkillGallery(records.filter(x=>x.kind==='skill'),projects,lang,x=>urlFor('', '/project/'+x.id,lang))}</div></section>${!hidden.has('about')?collection('page',tr('More about me','المزيد عني'),'about'):''}`;
    else if(path==='/achievements')content=`${introHTML}${renderAchievements(achievements,lang)}${identityKinds.map(([kind,txt])=>records.some(x=>x.kind===kind)?collection(kind,txt,kind):'').join('')}`;
    else if(path==='/experiences')content=`${introHTML}${collection('experience',heading,'experiences')}${!hidden.has('live')?`<section id="live" class="content-section"><h2>${esc(tr('Live experiences','تجارب مباشرة'))}</h2>${showcases.length?`<div class="grid">${showcases.map(showCard).join('')}</div>`:`<div class="empty">${tr('No live showcases published yet.','لم تُنشر تجارب مباشرة بعد.')}</div>`}</section>`:''}${renderPublicFeatures(features,lang)}`;
    else if(path==='/contact')content=`${introHTML}${connectMarkup(site,ar,staticMode)}`;
    else {const kind=({'/products':'product','/services':'service','/insights':'article'})[path];content=`${introHTML}${collection(kind,heading,route.section)}`;}
    schema={'@type':'CollectionPage',name:heading,url:urlFor(origin,path,lang)};
  }
 }

 const noindex=missing||path==='/admin'||!origin||!!(publicPage(path)?.section&&site.hidden_sections?.includes(publicPage(path).section));
 const fullTitle=path==='/'?(t('seo_title')||[person,role,name].filter(Boolean).join(' — ')):[heading,name].join(' — ');
 const previewImage=site.profile_photo_src&&origin?new URL(site.profile_photo_src,origin).href:null;
 const meta=`<title>${esc(fullTitle)}</title><meta name="description" content="${esc(short(description))}"><meta name="robots" content="${noindex?'noindex, nofollow':'index, follow'}">${!noindex?`<link rel="canonical" href="${esc(urlFor(origin,path,lang))}">${['ar','en','x-default'].map(l=>`<link rel="alternate" hreflang="${l}" href="${esc(urlFor(origin,path,l==='x-default'?language(null,site):l))}">`).join('')}<meta property="og:title" content="${esc(fullTitle)}"><meta property="og:description" content="${esc(short(description))}"><meta property="og:url" content="${esc(urlFor(origin,path,lang))}"><meta property="og:site_name" content="${esc(name)}"><meta property="og:type" content="website"><meta property="og:locale" content="${ar?'ar_AR':'en_US'}">${previewImage?`<meta property="og:image" content="${esc(previewImage)}"><meta property="og:image:alt" content="${esc(person||name)}"><meta name="twitter:image" content="${esc(previewImage)}">`:''}<meta name="twitter:card" content="${previewImage?'summary_large_image':'summary'}">${schema?`<script type="application/ld+json">${json({'@context':'https://schema.org',...schema})}</script>`:''}`:''}`;
 const header=`<header><a class="logo" href="${esc(urlFor('','/',lang))}">✦ ${esc(name)}.</a><nav aria-label="${tr('Site navigation','التنقل في الموقع')}">${publicNavigation({path,lang,site,urlFor:(p,language=lang)=>urlFor('',p,language),staticMode})}</nav></header>`;
 return template.replace('<html lang="en">',`<html lang="${lang}" dir="${ar?'rtl':'ltr'}">`).replace(/<meta name="description"[^>]*><title>.*?<\/title>/,()=>meta).replace(/<header>.*?<\/header>/,()=>header).replace('<main id="app"></main>',()=>`<main id="app">${content}</main>`).replace('<body>',`<body${site.default_theme==='light'?' class="light"':''}>`).replace(/<footer>.*?<\/footer>/,()=>`<footer><a class="logo" href="${esc(urlFor('','/',lang))}">✦ ${esc(name)}.</a><span>${tr('Independent digital studio / Owner managed','استوديو رقمي مستقل / إدارة المالك')}</span>${path!=='/admin'&&!missing?ownerFooter(site,lang):''}</footer>${path!=='/admin'&&!missing?floatingContact(site,ar):''}`);
}
export function sitemap(origin,site,projects,showcases){const paths=[...visiblePublicPages(site).map(p=>p.path),...projects.map(x=>'/project/'+x.id),...showcases.map(x=>'/showcase/'+x.id)];return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+paths.flatMap(p=>['ar','en'].map(l=>`<url><loc>${esc(pageURL(origin,p,l))}</loc>${['ar','en','x-default'].map(a=>`<xhtml:link rel="alternate" hreflang="${a}" href="${esc(pageURL(origin,p,a==='x-default'?language(null,site):a))}"/>`).join('')}</url>`)).join('')+'</urlset>'}
