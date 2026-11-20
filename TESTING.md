# Testing
No application tests exist or were run. Plan Vitest unit/integration, Playwright bilingual and admin journeys, database RLS tests for anonymous/owner/other user, upload abuse, duplicate conversion and approval replay tests. Run build, lint, typecheck and tests in CI. Test backup restoration before production. Documentation integrity check is not a runtime test.

V0.8: `npm run check` and `npm test` passed (9 tests). New tests cover invalid CSS tokens and section ordering, authorization, settings persistence, reset and restore preserving records. Chromium browser test blocked by ERR_BLOCKED_BY_ADMINISTRATOR on local navigation; no visual validation claimed.

V0.9: `npm run check` and `npm test` passed (14 tests). SEO tests cover explicit HTTPS origin, public-only navigation, bilingual server HTML, metadata, sitemap, private/hidden record exclusions, linked showcases, gzip and 304 conditional asset responses. Browser performance and live indexing are unverified.

## V1.0
`npm run check`, `npm test`: 19 passing tests on Node 22.16.0. Added tests in `tests/hybrid.test.mjs` for byte preservation/restart, private downloads and CSV, read-only legacy migration, portable paths, taxonomy and aggregate calculations, GitHub mock sync/restore/conflict/private enforcement. No live external connection tested. No browser visual or load verification.
