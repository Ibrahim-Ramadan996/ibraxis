import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {design} from '../app/design.js';
const css=readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
test('theme presets have contrast-ready light and dark base colors',()=>{
 const d=design();
 assert.equal(d.light_colors.bg,'#f6f8fc');
 assert.equal(d.light_colors.ink,'#182538');
 assert.equal(d.dark_colors.bg,'#091321');
 assert.equal(d.dark_colors.ink,'#f4f7fd');
});
test('skills and controls use surface colors and preserve separate theme states',()=>{
 assert.match(css,/\.ix-skill-card \{background:var\(--panel\);color:var\(--ink\)/);
 assert.match(css,/body\.light \.ix-skill-filters button\[aria-pressed="true"\]/);
 assert.match(css,/body:not\(\.light\) \.ix-skill-filters button\[aria-pressed="true"\]/);
 assert.match(css,/focus-visible/);
 assert.match(css,/html\[lang="ar"\] body/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
