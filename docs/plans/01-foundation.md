# Phase 1: Foundation

**Goal:** a tested skeleton with shared schemas, the hub catalog and basic endpoints. No agent or external APIs yet.

## Tasks

1. **Repo setup**
   - npm workspaces: `shared`, `server`, `web`
   - Strict TypeScript, ESM, ESLint, Prettier, Vitest
   - `.env.example` with `PORT`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (placeholders only)
   - Root scripts: `dev`, `test`, `typecheck`, `lint`

2. **Shared schemas** (`shared/src/schemas/`)
   - `Region`, `HazardType`, `RiskLevel`, state-to-region mapping
   - `Hub`
   - Tool result envelope
   - `FinalAnswer`, `ChatRequest` (`threadId`, `message`), `ChatResponse`, `ApiError`
   - `buildHubIdSchema(ids)` to create a hub ID enum from the catalog

3. **Hub catalog** (`data/hubs.json`)

   | Region | Cities |
   |---|---|
   | Northeast | Boston MA, Newark NJ, Philadelphia PA |
   | Midwest | Chicago IL, Minneapolis MN, Detroit MI, Kansas City MO, Indianapolis IN |
   | South | Miami FL, Houston TX, Dallas TX, Atlanta GA, New Orleans LA, Memphis TN |
   | West | Denver CO, Phoenix AZ, Los Angeles CA, Sacramento CA, Salt Lake City UT |

   Fields: `id` (e.g. `kansas-city-mo`), `name`, `city`, `state`, `region`, `lat`, `lon`, `countyFips`, `countyName`.

4. **Server**
   - Validate env and `hubs.json` at startup; exit if invalid
   - Hubs service: `listHubs({ region?, state? })`, `getHubIds()`
   - `GET /health`, `GET /hubs`
   - Error middleware with the `ApiError` shape

5. **Web**
   - Vite + React app with a dev proxy to the server
   - One page showing the server status

6. **Tests**
   - Schemas: valid and invalid input
   - Hub catalog: 19 hubs, unique IDs, region matches state
   - Hubs service filters
   - API: `/health`, `/hubs`, invalid query returns 400

7. **Docs**
   - Create `docs/session-log.md` with the planning session and Phase 1 entries

## Done when

- `npm run dev` starts server and web
- `npm test`, `npm run typecheck` and `npm run lint` pass
- `/health` and `/hubs` return validated responses
