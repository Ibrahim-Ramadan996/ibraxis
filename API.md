# API draft
Base /api/v1; OpenAPI planned. JSON with Zod validation; structured errors, pagination, request IDs. Public: GET /brands/:slug, /brands/:slug/pages/:slug, /brands/:slug/services; POST /inquiries (rate-limited, returns opaque reference only). Authenticated owner: /admin/brands, /content, /projects, /learning, /services, /clients, /inquiries, /proposals, /agents, /posts, /jobs, /analytics, /notifications, /backups. GET/POST/PATCH per resource; archive/restore explicit actions. POST /admin/inquiries/:id/convert (transaction and unique conversion), /actions/:id/approve, /actions/:id/execute (payload-bound approval), /content/:id/publish. Default deny; check ownership and permission on every operation. No generic unrestricted database endpoint. API contracts are proposals, not available endpoints.

## Design configuration
`GET /api/site` public published site configuration. `POST /api/site` owner-only validated settings update (explicit UI confirmation). `GET /api/site/history` owner-only latest 50 snapshots. `POST /api/site/reset` requires `{ "confirm": "RESET DESIGN" }` and owner authentication. `POST /api/site/restore` requires `{ "id": 1, "confirm": true }` and owner authentication. Design changes snapshot previous configuration transactionally. Section visibility is not authorization.

V0.9: GET `/sitemap.xml` (public only, 404 without PUBLIC_SITE_URL), `/robots.txt`, `/projects`, `/project/:id`, `/showcase/:id` return server-rendered public pages (not API data); `?lang=ar|en` selects language. POST `/api/site` (owner) accepts `seo_title_ar/en` (120 chars) and `seo_description_ar/en` (320 chars). Hidden projects and linked showcases give 404. Project detail API adds `navigation` (previous, next, related, more, total; public records only).

### AXIS AI Agent (1.2)
- `POST /api/ai/plan` with `{prompt, language}`: owner-only. Returns an answer, a site change preview or a private record draft preview. No site/record changes yet. The configured AI provider receives the owner prompt and public site configuration fields, not environment secrets or private project records.
- `POST /api/ai/execute` with `{id, confirm:true}`: owner session must match, plan must be unexpired (10 minutes) and the site must not have changed since preview. Saves approved changes with revision history, or creates a private draft. No automatic public release.
- `POST /api/ai/cancel` with `{id}`: invalidates an unexecuted plan for the owning session.
- The legacy draft API remains available for compatibility. Existing GitHub sync and Pages publishing behavior is unchanged.
