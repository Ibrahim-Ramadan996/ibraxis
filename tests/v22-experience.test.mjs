import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homeExperience} from '../app/home-experience.js';
import {visibleGroups,chartCSV,mountChart} from '../app/studio-charts.js';
import {renderPage} from '../app/seo.mjs';

const site={site_name:'IBRAXIS',headline_ar:'بيانات وأفكار',subline_ar:'تصنع أثرًا',headline_en:'Ideas and data',subline_en:'into impact'};
const records=[{id:'a'.repeat(32),kind:'project',status:'published',ar_title:'داشبورد تجريبي',en_title:'Published dashboard',title:'Demo'},{id:'b'.repeat(32),kind:'project',status:'draft',ar_title:'سري',en_title:'Secret draft',title:'Secret'}];

test('premium home has bilingual calls to action and only public projects',()=>{
 for(const lang of ['ar','en']){
  const html=homeExperience({site,rows:records,lang,urlFor:p=>'/base/'+lang+p});
  assert.match(html,/ix-home-hero/);assert.match(html,/ix-featured/);
  assert.match(html,/\/base\/(?:en|ar)\/projects/);
  assert.match(html,lang==='ar'?/داشبورد تجريبي/:/Published dashboard/);
  assert.ok(!html.includes('Secret draft')&&!html.includes('سري'));
 }
 const empty=homeExperience({site,rows:[],lang:'ar'});
 assert.match(empty,/المشروع القادم يبدأ هنا/);assert.ok(!empty.includes('0+'));
 const escaped=homeExperience({site:{headline_en:'<script>attack</script>'},rows:[],lang:'en'});
 assert.ok(escaped.includes('&lt;script&gt;')&&!escaped.includes('<script>'));
});
test('server-rendered homepage uses same upgrade for public visitors',()=>{
 const template=readFileSync('app/index.html','utf8');
 for(const lang of ['ar','en']){
  const html=renderPage({template,origin:'https://example.org',path:'/',lang,site,records:records.filter(x=>x.status==='published')});
  assert.match(html,/ix-home-hero/);assert.match(html,/ix-home-capabilities/);
  assert.ok(html.includes('/project/'+ 'a'.repeat(32)));
  assert.ok(!html.includes('Secret draft')&&!html.includes('سري'));
 }
});
test('chart supports stable sorting, filtered rows and safe aggregate-only CSV',()=>{
 const r=[{label:'B',value:1},{label:'A',value:3},{label:'=2+3',value:-5},{label:'-evil',value:null}];
 assert.deepEqual(visibleGroups(r,'','name').map(x=>x.label),['-evil','=2+3','A','B']);
 assert.deepEqual(visibleGroups(r,'A','desc').map(x=>x.label),['A']);
 assert.deepEqual(visibleGroups(r,'','desc').map(x=>x.value),[3,1,-5,null]);
 assert.throws(()=>visibleGroups(r,'','random'));
 const csv=chartCSV(r,'Revenue');
 assert.match(csv,/"'=2\+3"/);
 assert.match(csv,/"'-evil"/);
 assert.match(csv,/"Group","Revenue"/);
 assert.ok(!csv.includes('SECRET_RAW_ROW'));
 assert.throws(()=>chartCSV([{label:'x',value:Infinity}]));
 assert.throws(()=>mountChart({},[],{mode:'script'}));
});
