# Session log

## 2026-10-06 — Planning

- Wrote `DESIGN.md` (architecture, tools, scoring, API, data sources), `PLAN.md` (6 phases), `CLAUDE.md` and the Phase 1 plan.
- Key decisions: TypeScript does all calculations; Claude only explains tool results. Data comes from Open-Meteo and FEMA NRI and is committed as JSON. Memory is LangGraph's in-memory checkpointer, keyed by `threadId`.

## 2026-10-06 — Phase 1: Foundation

- npm workspaces `shared`, `server`, `web`; strict TS (ESM, `moduleResolution: Bundler`), ESLint (typescript-eslint, type-checked), Prettier, Vitest at the root.
- `shared` is consumed as TypeScript source (`exports` → `src/index.ts`): the server runs with `tsx` and the web app with Vite, so there is no build step.
- Shared schemas: `Region`, `HazardType`, `RiskLevel`, `StateCode` and Census state-to-region map; `Hub` (region must match state) and `HubCatalog` (unique IDs); tool result envelope; `FinalAnswer`, `ChatRequest` (`threadId` is a UUID), `ChatResponse`, `ApiError`; `HubsQuery`, `HubsResponse`, `HealthResponse`; `buildHubIdSchema(ids)`.
- `data/hubs.json`: 19 hubs with city-centre coordinates and county FIPS.
- Server: env and hub catalog validated at startup (exits with code 1 if invalid); hubs service; `GET /health`, `GET /hubs`; responses validated before sending; 400/404/500 errors in the `ApiError` shape. Unknown query parameters on `/hubs` are rejected.
- `/health` returns `dataAsOf: null` until Phase 2 adds `data/meta.json`. `ANTHROPIC_*` env vars are optional until Phase 4.
- Web: Vite + React page showing server status. The dev proxy maps `/api/*` to the server and reads `PORT` from the root `.env`.
- Dev-only additions: `concurrently` (run server and web together on Windows), `eslint-plugin-react-hooks`, `globals`. API tests use `fetch` against an ephemeral port instead of adding supertest.
- Checks: 72 tests, typecheck and lint pass. Verified `npm run dev`, both endpoints directly and through the proxy.
