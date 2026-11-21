import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {design} from '../app/design.js';
import {renderPage,ownerFooter} from '../app/seo.mjs';
import {privateInquiryDetails,localBusinessDraft} from '../app/connect.js';
import {normalizeBusinessReview,businessReviewError} from '../app/business-review.mjs';
import {generate} from '../app/integrations.mjs';

const template=readFileSync('app/index.html','utf8');
const render=(site,lang,path='/')=>renderPage({template,origin:'https://example.com',path,lang,site});

test('owner footer is configurable, bilingual, escaped, style and color validated',()=>{
 const site={...design({footer_owner_ar:'محمد علي',footer_owner_en:'Mohamed Ali',footer_owner_color:'#FfD700',footer_owner_style:'badge'}),name:'Fallback'};
 assert.equal(site.footer_owner_color,'#ffd700');
 for(const lang of ['ar','en'])for(const path of ['/','/projects','/project/'+'f'.repeat(32)]){
  const html=render(site,lang,path);
  assert.match(html,/class="ix-owner ix-owner--badge"/);
  assert.match(html,new RegExp(lang==='ar'?'محمد علي':'Mohamed Ali'));
  assert.match(html,/--ix-owner-ink:#ffd700/);
 }
 assert(!render(site,'ar','/admin').includes('class="ix-owner '));
 assert(!render({...site,footer_owner_visible:'off'},'ar').includes('class="ix-owner '));
 assert.match(ownerFooter({...site,footer_owner_en:'',name:'Fallback'},'en'),/Fallback/);
 assert.match(ownerFooter({...site,footer_owner_ar:'<script>alert(1)</script>'},'ar'),/&lt;script&gt;/);
 assert.throws(()=>design({footer_owner_color:'red; background:red'}));
 assert.throws(()=>design({footer_owner_style:'<svg>'}));
 assert.throws(()=>design({footer_owner_ar:'x'.repeat(91)}));
});

test('private inquiry fields render cleanly and sanitize user-controlled text',()=>{
 const html=privateInquiryDetails(JSON.stringify({name:'<img src=x>',email:'a@example.com',message:'Review dashboard',kind:'dashboard',budget:'large',timeline:'flexible'}));
 assert.match(html,/&lt;img src=x&gt;/);
 assert.match(html,/الميزانية/);
 assert.match(html,/المدة/);
 assert(!html.includes('<img'));
 assert.match(privateInquiryDetails('Raw request'),/Raw request/);
});

test('offline proposal is visibly a draft, never claims AI or firm pricing',()=>{
 const v=localBusinessDraft('Analyse dashboard requirements',true);
 assert.match(v.summary,/بدون ذكاء اصطناعي/);
 assert.match(v.summary,/Analyse dashboard/);
 assert.match(v.budget,/لا يوجد تسعير معتمد/);
 assert.throws(()=>localBusinessDraft(''));
 const en=localBusinessDraft('Hello',false);
 assert.match(en.summary,/without AI/);
});

test('AI study accepts normalized data and reports useful provider errors',()=>{
 const result=normalizeBusinessReview({review:{summary:'Summary',scope:'Scope',questions:['Question 1','Question 2']}});
 assert.match(result.questions,/Question 1/);
 assert.equal(result.feasibility,'—');
 assert.throws(()=>normalizeBusinessReview({summary:'Only one'}));
 assert.equal(businessReviewError(new Error('AI_HTTP_429')).reason,'rate-limit');
 assert.equal(businessReviewError(new Error('AI_HTTP_400')).reason,'request-format');
 assert.equal(businessReviewError(new Error('AI_HTTP_503')).reason,'provider-unavailable');
});

test('Gemini structured response falls back once without responseSchema on 400',async()=>{
 const keep={provider:process.env.AI_PROVIDER,model:process.env.AI_MODEL,key:process.env.AI_API_KEY};
 const original=globalThis.fetch,requests=[];
 process.env.AI_PROVIDER='gemini';process.env.AI_MODEL='test-model';process.env.AI_API_KEY='private-dummy-key';
 globalThis.fetch=async (_url,init)=>{
  requests.push(JSON.parse(init.body));
  if(requests.length===1)return {ok:false,status:400};
  return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'```json\n{"summary":"Works","scope":"Build","questions":"What next?"}\n```'}]}}]})};
 };
 try{const out=await generate('system','brief',{responseSchema:{type:'OBJECT',properties:{summary:{type:'STRING'}}}});
  assert.equal(out.summary,'Works');assert.equal(requests.length,2);
  assert.ok(requests[0].generationConfig.responseSchema);
  assert.equal(requests[1].generationConfig.responseSchema,undefined);
  assert.equal(requests[1].generationConfig.responseMimeType,'application/json');
 }finally{globalThis.fetch=original;for(const [key,value] of Object.entries({AI_PROVIDER:keep.provider,AI_MODEL:keep.model,AI_API_KEY:keep.key})){if(value===undefined)delete process.env[key];else process.env[key]=value}}
});

test('owner-only site API persists footer configuration, public pages reflect it',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ix-v22-'));const port=19082;
 const env={...process.env,PORT:String(port),DB_PATH:join(dir,'db.sqlite'),OWNER_PASSWORD:'test-only-password-123'};
 for(const k of ['AI_API_KEY','AI_MODEL','AI_PROVIDER','OLLAMA_MODEL','GITHUB_DATA_REPO','GITHUB_DATA_TOKEN','IBRAXIS_PUBLISH_TOKEN'])delete env[k];
 const p=spawn(process.execPath,['app/server.mjs'],{env});
 try{
  await Promise.race([new Promise((resolve,reject)=>{p.stdout.on('data',d=>{if(d.toString().includes('listening'))resolve()});p.once('exit',()=>reject(Error('server stopped')))}),new Promise((_r,reject)=>setTimeout(()=>reject(Error('server start timeout')),5000))]);
  const url=path=>`http://127.0.0.1:${port}${path}`;
  const call=(path,b,cookie='')=>fetch(url(path),{method:b===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(b===undefined?{}:{body:JSON.stringify(b)})});
  assert.equal((await call('/api/site',{footer_owner_ar:'محمود'})).status,401);
  const login=await call('/api/login',{password:'test-only-password-123'}),cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/site',{footer_owner_ar:'محمد',footer_owner_en:'Mohamed',footer_owner_color:'#ccaa88',footer_owner_style:'signature',footer_owner_visible:'on'},cookie)).status,200);
  const ar=await (await call('/?lang=ar')).text(),en=await (await call('/?lang=en')).text();
  assert.match(ar,/صُنع وأُدير بواسطة/);assert.match(ar,/محمد/);assert.match(en,/Mohamed/);
  assert(!((await (await call('/admin')).text()).includes('class="ix-owner ')));
  assert.equal((await call('/api/site',{footer_owner_color:'javascript:alert(1)'},cookie)).status,400);
 }finally{if(p.exitCode===null&&p.signalCode===null){const done=new Promise(r=>p.once('exit',r));p.kill();await done}rmSync(dir,{recursive:true,force:true})}
});
