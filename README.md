# IBRAXIS — Where Intelligence Meets Innovation
Development preview 0.3. One bilingual personal technology platform with a private workspace and AI-assisted draft creation. See RUN-AR.md for Windows, Codespaces, Ollama and deployment instructions. Node.js 22.13+ (22.x), no npm dependencies. `npm test` and `npm run check`. See PROJECT_STATUS.md for limitations. Original requirements: docs/MASTER_BUILD_PROMPT.md. Not production-ready.

Current release: 0.4 Identity edition. See PROJECT_STATUS.md and RUN-AR.md.

## 0.5 Project Import Studio
See RUN-AR.md and PROJECT_STATUS.md. Copy `.env.example` to `.env` for optional external providers; keep it untracked. No external account is required for local import. This is a development release, not production-ready.

Version 0.6 adds Live showcase & activity in the owner workspace. See RUN-AR.md and PROJECT_STATUS.md for supported integrations and limitations.

### V0.8 Design Studio
Owner workspace → Design studio. Customize branding, both appearance color palettes, typography, motion, layout and sections; preview, publish, export/import and restore. See RUN-AR.md. Visual browser validation blocked; production deployment not verified.

### V0.9 — Search visibility
Set `PUBLIC_SITE_URL` to your actual public HTTPS origin on production only. Without it, the site runs locally but opts out of indexing. The server generates public-only sitemap.xml, robots.txt, translated HTML and SEO metadata. Use the identity editor for bilingual search titles/descriptions. See RUN-AR.md for Search Console and performance checks. No ranking or indexing guarantee.

## V1.0 — Hybrid File Storage & Discovery (development release)
**Current storage architecture supersedes older SQLite/hosting instructions.** Read [STORAGE-AR.md](STORAGE-AR.md) first. Native source files, Markdown descriptions and JSON metadata are authoritative local checkpoints; optional private GitHub data repository automatically mirrors checkpoints. SQLite is in-memory only, with read-only legacy migration. GitHub authentication secrets are server configuration, never committed; owner credentials remain local. Added catalog inference/overrides, global public search, opt-in single-file download, CSV aggregate previews, and a storage status panel. 19 automated tests pass; real GitHub/AI and production deployment not verified. Single writer; persistent local disk required. No external database subscription needed.

## GitHub-only deployment
Read [GITHUB-ONLY-AR.md](GITHUB-ONLY-AR.md). `npm run build:pages` needs `PAGES_DATA_DIR` pointing at a valid private data snapshot and `PAGES_SITE_URL` set to the real HTTPS Pages URL. The generated `dist/` is public-only; never publish the raw data repo.
