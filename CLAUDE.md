# CLAUDE.md

Weather risk chat assistant for 19 logistics hubs. See `DESIGN.md` and `PLAN.md`.

## Workflow

- Read `DESIGN.md` and the current phase plan in `docs/plans/` before coding.
- Work on one phase at a time. Ask before changing the design.
- After each session, add a short entry to `docs/session-log.md`.

## Rules

- TypeScript calculates all numbers, scores and rankings in `server/src/services/`. Claude never calculates or invents reasons.
- Tools are thin: validate input, call one service, return `{ ok, data, meta }` or `{ ok: false, error }`.
- Use Zod for all schemas (`shared/src/schemas/`). Derive types with `z.infer`.
- Final output must match the `FinalAnswer` schema: `answer`, `hubIds`, `explanation`, `assumptions`.
- Only hub IDs from `data/hubs.json` are valid.
- Use `threadId` in the API and frontend; pass `thread_id: threadId` to LangGraph.
- Scoring parameters live in `server/src/config/scoring.ts`.
- Read `ANTHROPIC_API_KEY` from env. Never hardcode or commit keys.
- No new infrastructure or dependencies without a clear reason.

## Code

- TypeScript strict, ESM, no `any`.
- Add Vitest tests for services and schemas.
- Don't edit generated files in `data/` by hand; use `npm run refresh-data`.

## Commands

```
npm run dev            # server + web
npm test               # unit and API tests
npm run typecheck
npm run lint
npm run refresh-data   # update data/
npm run evals          # agent evals (needs ANTHROPIC_API_KEY)
```
