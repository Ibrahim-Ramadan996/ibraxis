import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const stylesheet = readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');

// Two renderers: live owner preview (profile() in public.js) and public
// GitHub Pages export (renderPublicHtml() in seo.mjs).
test('approved About portrait aligns with the heading rather than middle of long bio', () => {
  assert.match(stylesheet,
    /\.identity:has\(> \.portrait\[class\*="ix-photo--"\]\),\s*\.ix-profile-section:has\(> \.ix-profile-about\)\s*\{\s*align-items:\s*start;/);
  assert.match(stylesheet,
    /\.identity > \.portrait\[class\*="ix-photo--"\],\s*\.ix-profile-section > \.ix-profile-about\s*\{\s*align-self:\s*start;/);
});

test('About portrait remains centered and bounded on narrow mobile layouts', () => {
  assert.match(stylesheet,
    /@media\s*\(max-width:\s*760px\)\s*\{\s*\.identity > \.portrait\[class\*="ix-photo--"\],\s*\.ix-profile-section > \.ix-profile-about\s*\{\s*justify-self:\s*center;\s*max-width:\s*min\(100%,\s*330px\);/);
});
