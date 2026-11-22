import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {design} from '../app/design.js';

const source=readFileSync(new URL('../app/public.js',import.meta.url),'utf8');
const profileFunction=source.slice(source.indexOf('function profile(site,rows=[])'),source.indexOf('\nasync function identityEditor('));
const tr=(a,b)=>b;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const profile=runInNewContext(`(${profileFunction})`,{ar:true,tr,esc,design,identityCards:()=>''});
const photo='/profile-photo.webp?v=abcdef123456';

test('approved photo is shown in live About section without IX placeholder',()=>{
 const markup=profile({...design({portrait_placement:'both',portrait_style:'circle'}),profile_photo_src:photo,name:'Ibrahim'});
 assert.match(markup,/class="portrait ix-photo--circle/);
 assert.match(markup,/src="\/profile-photo\.webp\?v=abcdef123456"/);
 assert.match(markup,/الصورة الشخصية لـ Ibrahim/);
 assert.doesNotMatch(markup,/class="portrait-mark"/);
});

test('home-only and hidden portrait placements do not show photo in live About',()=>{
 for(const placement of ['hero','off']){
  const markup=profile({...design({portrait_placement:placement}),profile_photo_src:photo});
  assert.doesNotMatch(markup,/<img /);
  assert.match(markup,/class="portrait-mark"/);
 }
});

test('unapproved or forged src never shows up as an image',()=>{
 for(const src of [undefined,'javascript:alert(1)', '/profile-photo.webp?v=x']){
  const markup=profile({...design({portrait_placement:'both'}),profile_photo_src:src});
  assert.doesNotMatch(markup,/<img /);
 }
});
