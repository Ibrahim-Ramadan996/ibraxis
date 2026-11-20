# Changelog
0.0.1 — Phase 00 architecture draft and original requirements preserved. No application features released.

## 0.1 local prototype
Added Node HTTP/SQLite runnable MVP and HTTP integration test. See PROJECT_STATUS.md and RUN-AR.md for deviations and limitations.

## 0.2.0
Unified public site; Arabic default; motion system and reduced motion support.

## 0.3
Unified IBRAXIS identity, bilingual fields, floating draft assistant, Windows and Codespaces launch configuration.

## 0.4
Bilingual identity editor, editorial identity section, palette settings, revisions and inquiry conversion. HTTP tests passed; browser blocked.

## 0.5.0
- Project folder import and private archive; optional private GitHub commit.
- Configurable server-side AI provider adapters, Gemini default example.
- Bilingual import workspace UI and visual polish.
- Import validation and access-control tests.

## 0.6.0
- Live report gallery and learning activity cards; controlled public publishing and source attribution.

## 0.7.0
Expanded import inputs, selection preview, bounded ZIP decoder and tests.

## 0.8.0
- Design Studio: bilingual branding, custom theme tokens, typography, motion, layout, section order and visibility, preview, import/export, reset and revisions.
- Added validation and authenticated settings history endpoints, tested reset preserving project records.

## 0.9.0 — Discovery & SEO
- Public share routes, gallery, project visibility/trash/restore, automatic identity icons and bilingual configurable welcome.
- Public-only previous/next and related projects; creator links and navigation across the site.
- Server-rendered public content, bilingual metadata/canonical/alternate URLs, dynamic sitemap and robots, structured data and social share metadata, staging noindex.
- Precompressed assets with ETag/conditional requests and HTML gzip; 14 passing tests.

## 1.0.0 (development)
- Replace persistent SQLite with hybrid native-file checkpoints and optional private GitHub synchronization.
- Bilingual Markdown, JSON metadata, raw imported files, integrity manifest, migration and local-only owner authentication.
- Taxonomy, public cross-content search, approved CSV aggregate experience, opt-in per-project downloads, data sync panel.
- Add 5 tests (19 total) covering persistence, migration, path portability, classification and mocked remote sync.

## 1.1.0
- GitHub Pages static build and deployment workflow; private admin remains available via Codespaces.
- Private automatic data catalog with bounded parsing and format recognition.
- Database files accepted as private archive inputs (sidecars excluded), no imported SQL or model execution.
