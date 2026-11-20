import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {projectNavigation} from '../app/project-navigation.mjs';
import {publicOrigin} from '../app/seo.mjs';

test('project navigation uses only published projects and relevant terms',()=>{
 const rows=[{id:'a',kind:'project',status:'published',title:'Python data analysis'},{id:'b',kind:'project',status:'draft',title:'Python data analysis private'},{id:'c',kind:'project',status:'published',title:'Python forecasting'},{id:'d',kind:'project',status:'published',title:'Garden design'},{id:'e',kind:'client',status:'published',title:'Python client'}];
 const n=projectNavigation(rows,'a');assert.equal(n.total,3);assert.equal(n.next.id,'c');assert.deepEqual(n.related.map(x=>x.id),['c']);assert.deepEqual(n.more.map(x=>x.id),['d']);assert.equal(projectNavigation(rows,'b'),null);
});
test('production origin is explicit and safe',()=>{assert.equal(publicOrigin(''),'');assert.equal(publicOrigin('https://example.com/'),'https://example.com');for(const u of ['http://example.com','https://example.com/x','https://a:b@example.com','https://example.com/?x=1'])assert.throws(()=>publicOrigin(u))});
test('bilingual SSR, crawlable links, sitemap, private exclusions, metadata and asset caching',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'seo-'));const port=18989;
 const p=spawn(process.execPath,['app/server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DB_PATH:join(dir,'db.sqlite'),OWNER_PASSWORD:'test-only-password-123',PUBLIC_SITE_URL:'https://portfolio.example.com'}});
 try{
 await new Promise((resolve,reject)=>{p.stdout.once('data',resolve);p.once('exit',()=>reject(Error('server stopped')))});
 let cookie='';const base='http://127.0.0.1:'+port;
 const call=(path,data,auth=false,headers={})=>fetch(base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(auth?{Cookie:cookie}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const post=async(path,data)=>{const r=await call(path,data,true);assert.equal(r.status,200);return r.json()};
 cookie=(await call('/api/login',{password:'test-only-password-123'})).headers.get('set-cookie').split(';')[0];
 await post('/api/site',{name:'Test Creator',role_en:'Data Analyst',role_ar:'محلل بيانات',bio_en:'Real analytical work',bio_ar:'أعمال تحليلية',seo_title_en:'Test Creator — Data Analyst',seo_description_en:'Verified portfolio description',default_language:'ar'});
 const create=(title,status='published',more={})=>post('/api/records',{kind:'project',brand:'personal',title,body:'Python analytics case study',status,...more});
 const a=await create('Python sales','published',{ar_title:'تحليل المبيعات',en_title:'Python sales',ar_body:'تحليل مبيعات حقيقي',en_body:'Python sales case study'});
 const b=await create('Python analytics');const c=await create('PRIVATE MARKER','draft');
 const show=await post('/api/showcases',{kind:'link',url:'https://example.com/demo',title_en:'Live demo',title_ar:'تجربة حية',project_id:a.id,published:true});
 const home=await(await call('/?lang=en')).text();assert.match(home,/<html lang="en" dir="ltr">/);assert.match(home,/<title>Test Creator — Data Analyst<\/title>/);assert.match(home,/Verified portfolio description/);assert.match(home,/Real analytical work/);assert.match(home,/application\/ld\+json/);assert.match(home,/"@type":"Person"/);assert(!home.includes('PRIVATE MARKER'));
 const ar=await(await call('/?lang=ar')).text();assert.match(ar,/<html lang="ar" dir="rtl">/);assert.match(ar,/محلل بيانات/);assert.match(ar,/تحليل المبيعات/);
 const detail=await(await call('/project/'+a.id+'?lang=en')).text();assert.match(detail,/<h1>Python sales<\/h1>/);assert.match(detail,/Python sales case study/);assert(detail.includes('/project/'+b.id+'?lang=en'));assert(detail.includes('/showcase/'+show.id));assert(!detail.includes(c.id));assert.match(detail,/hreflang="ar"/);assert(detail.includes('https://portfolio.example.com/project/'+a.id+'?lang=en'));
 const sm=()=>call('/sitemap.xml').then(r=>r.text());let xml=await sm();assert(xml.includes(a.id));assert(xml.includes(show.id));assert(!xml.includes(c.id));assert(!xml.includes('/admin'));assert(xml.includes('hreflang="ar"'));
 await post('/api/records/visibility',{id:a.id,action:'hide',confirm:true});xml=await sm();assert(!xml.includes(a.id));assert(!xml.includes(show.id));const missing=await call('/project/'+a.id);assert.equal(missing.status,404);assert.match(missing.headers.get('x-robots-tag'),/noindex/);assert(!(await missing.text()).includes('Python sales'));
 const admin=await call('/admin');assert.match(admin.headers.get('x-robots-tag'),/noindex/);assert(!(await admin.text()).includes('PRIVATE MARKER'));
 const robots=await(await call('/robots.txt')).text();assert.match(robots,/Sitemap: https:\/\/portfolio.example.com\/sitemap.xml/);
 const asset=await call('/public.js',undefined,false,{'Accept-Encoding':'gzip'});assert.equal(asset.headers.get('content-encoding'),'gzip');assert.match(asset.headers.get('cache-control'),/max-age/);const etag=asset.headers.get('etag');assert(etag);assert.equal((await call('/public.js',undefined,false,{'Accept-Encoding':'gzip','If-None-Match':etag})).status,304);
 }finally{p.kill();await new Promise(r=>p.once('exit',r));rmSync(dir,{recursive:true,force:true})}
});
