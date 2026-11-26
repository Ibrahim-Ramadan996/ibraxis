import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPublicFeatures,validatePublicFeatures} from '../app/site-features.js';
import {renderPage} from '../app/seo.mjs';
import {design} from '../app/design.js';
const feature={id:'a'.repeat(12),kind:'section',title:'شهاداتي',description:'إنجازات فعلية فقط',url:''};
test('public feature HTML is escaped and feature becomes visible on the experiences page',()=>{
 const list=[feature];assert.match(renderPublicFeatures(list),/شهاداتي/);
 const template=readFileSync('app/index.html','utf8');
 const html=renderPage({template,origin:'https://example.com',path:'/experiences',lang:'ar',site:design({}),records:[],features:list});
 assert.match(html,/data-ibraxis-feature="aaaaaaaaaaaa"/);
 assert.match(html,/إنجازات فعلية فقط/);
});
test('site feature config validation forbids scripts, unsafe links and duplicate identifiers',()=>{
 const unsafeTitle={...feature,title:'<script>alert(1)</script>'};
 assert.doesNotMatch(renderPublicFeatures([unsafeTitle]),/<script>/);
 assert.match(renderPublicFeatures([unsafeTitle]),/&lt;script&gt;/);
 assert.throws(()=>validatePublicFeatures([{...feature,kind:'button',url:'javascript:alert(1)'}]));
 assert.throws(()=>validatePublicFeatures([feature,feature]));
 assert.throws(()=>validatePublicFeatures([{...feature,url:'x',kind:'arbitrary'}]));
});
