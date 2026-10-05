# Weather Risk Assistant

A chat assistant that explains weather risk for a logistics company's 19 US hubs.

Example questions:

- Which hubs in the Midwest are most exposed to winter disruption?
- Compare Miami and Houston in terms of hurricane and flood exposure.
- What percentage of days in Denver last year had snowfall?
- Why is the Dallas hub's risk high?

## How it works

A Claude agent calls tools that return statistics, FEMA hazard data and risk scores calculated in TypeScript. Claude explains the results and returns a Zod-validated response:

```json
{ "answer": "...", "hubIds": [], "explanation": "...", "assumptions": [] }
```

Hubs are fictional, located in real cities with real data.

**Stack:** React + Vite, Express, TypeScript, LangGraph, Claude API, Zod.

**Data:** [Open-Meteo](https://open-meteo.com/) historical weather (last 3 full years) and the [FEMA National Risk Index](https://hazards.fema.gov/nri/).

## Getting started

```bash
npm install
cp .env.example .env   # set ANTHROPIC_API_KEY and ANTHROPIC_MODEL
npm run dev
```

Data files are committed. To refresh them: `npm run refresh-data`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run server and web |
| `npm test` | Run tests |
| `npm run refresh-data` | Update weather and FEMA data |
| `npm run evals` | Run agent evals |

## Docs

- `DESIGN.md`: architecture and decisions
- `PLAN.md`: implementation phases
- `docs/session-log.md`: development log

## Limitations

Weather data is modelled; FEMA data is county-level; chat history is in memory only.
