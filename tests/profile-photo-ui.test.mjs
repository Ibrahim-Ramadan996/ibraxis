import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('personal identity panel includes the existing private portrait editor',()=>{
  const publicScript=readFileSync(new URL('../app/public.js',import.meta.url),'utf8');
  assert.match(publicScript,/import\s*\{\s*mountProfileEditor\s*\}\s*from\s*['"]\.\/profile-editor\.js['"]/);
  const identity=publicScript.split('async function identityEditor(p)')[1]?.split('async function historyEditor(id)')[0]||'';
  assert.match(identity,/await mountProfileEditor\(p,\{ar,api\}\)/);
  const editor=readFileSync(new URL('../app/profile-editor.js',import.meta.url),'utf8');
  assert.match(editor,/panel\.insertBefore\(block,panel\.querySelector\('#identity-form'\)\)/);
  assert.match(editor,/api\('profile-photo'/);
});
