import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_PAGES,publicDirectory,publicNavigation,visiblePublicPages} from '../app/site-navigation.js';
import {ADMIN_GROUPS,adminNavigation} from '../app/admin-navigation.js';
import {renderPage,sitemap} from '../app/seo.mjs';
import {design} from '../app/design.js';
const template=readFileSync('app/index.html','utf8');
const id=k=>k.repeat(32);
const rows=[
 {id:id('1'),kind:'project',title:'WORK_ONLY',ar_title:'مشروع تجريبي',status:'published'},
 {id:id('2'),kind:'product',title:'PRODUCT_ONLY',ar_title:'منتج تجريبي',status:'published'},
 {id:id('3'),kind:'service',title:'SERVICE_ONLY',ar_title:'خدمة تجريبية',status:'published'},
 {id:id('4'),kind:'article',title:'ARTICLE_ONLY',ar_title:'مقال تجريبي',status:'published'},
 {id:id('5'),kind:'experience',title:'EXPERIENCE_ONLY',ar_title:'تجربة تجريبية',status:'published'},
 {id:id('6'),kind:'skill',title:'SKILL_ONLY',ar_title:'مهارة تجريبية',status:'published'},
 {id:id('7'),kind:'page',title:'ABOUT_ONLY',ar_title:'نبذة إضافية',status:'published'}
];
const site={...design(),site_name:'IBRAXIS',name:'Owner',bio_en:'Public biography',contact_email:'public@example.com',section_order:['contact','work','identity']};
const render=(path,lang='en',extra={})=>renderPage({template,origin:'https://example.org',path,lang,site:{...site,...extra},records:rows,features:[{id:'a'.repeat(12),kind:'section',title:'CUSTOM_FEATURE',description:'Public extra'}]});
test('homepage is an index, never the old long page, with unique active navigation',()=>{
 assert.equal(PUBLIC_PAGES.length,9);
 assert.equal(new Set(PUBLIC_PAGES.map(p=>p.path)).size,PUBLIC_PAGES.length);
 for(const lang of ['ar','en']){
  const home=render('/',lang);
  assert.match(home,/ix-home-hero/);assert.match(home,/ix-page-directory/);
  assert.doesNotMatch(home,/id="contact"|id="identity"|id="services"|id="products"|id="insights"|id="experiences"/);
  assert.equal((home.match(/aria-current="page"/g)||[]).length,1);
  assert.match(home,lang==='ar'?/الرئيسية/:/Home/);
 }
});
test('focused pages keep content isolated and accessible in both languages',()=>{
 const cases=[['/about','ABOUT_ONLY','PRODUCT_ONLY'],['/services','SERVICE_ONLY','PRODUCT_ONLY'],['/products','PRODUCT_ONLY','SERVICE_ONLY'],['/insights','ARTICLE_ONLY','PRODUCT_ONLY'],['/experiences','EXPERIENCE_ONLY','ARTICLE_ONLY']];
 for(const [path,expected,unwanted] of cases){
  const html=render(path);
  assert(html.includes(expected),path+' must show its public content');
  assert(!html.includes(unwanted),path+' must not show unrelated content');
  assert.match(html,/class="ix-page-intro"/);
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 }
 const about=render('/about');assert.match(about,/SKILL_ONLY/);assert.doesNotMatch(about,/id="contact"/);
 const contact=render('/contact');assert.match(contact,/id="contact"/);assert.doesNotMatch(contact,/SKILL_ONLY/);
});
test('hidden sections are excluded from directory, navigation, sitemaps and page contents',()=>{
 const hidden={...site,hidden_sections:['services','contact','work']};
 const nav=publicNavigation({path:'/',lang:'ar',site:hidden,urlFor:p=>'/ar'+p});
 assert(!nav.includes('href="/ar/services"'));assert(!nav.includes('href="/ar/contact"'));assert(!nav.includes('href="/ar/projects"'));
 const directory=publicDirectory({site:hidden,lang:'ar',rows,urlFor:p=>'/ar'+p});
 assert(!directory.includes('href="/ar/contact"'));
 assert(!directory.includes('href="/ar/services"'));
 assert(!visiblePublicPages(hidden).some(p=>p.path==='/projects'));
 for(const path of ['/services','/projects']){
  const html=render(path,'ar',{hidden_sections:hidden.hidden_sections});
  assert.match(html,/القسم غير متاح/);assert.doesNotMatch(html,/SERVICE_ONLY|WORK_ONLY/);
  assert.match(html,/noindex, nofollow/);
 }
 const xml=sitemap('https://example.org',hidden,[],[]);
 assert(!xml.includes('/services?'));assert(!xml.includes('/contact?'));assert(!xml.includes('/projects?'));
});
test('workspace navigation preserves every record destination and exactly one selected panel',()=>{
 const kinds=['brand','page','project','product','service','article','learning','resource','study','client','inquiry','proposal','agreement','task','milestone','social','agent','experience','notification','skill','achievement','certification','education','career'];
 const entries=ADMIN_GROUPS.flatMap(g=>g.items.map(item=>item[0]));
 assert.equal(new Set(entries).size,entries.length);
 assert(kinds.every(k=>entries.includes(k)));
 const html=adminNavigation('ai-manager',true);
 assert.match(html,/data-kind="ai-manager" class="active" aria-current="page"/);
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 assert.match(html,/الذكاء الاصطناعي والتعلّم/);
});
