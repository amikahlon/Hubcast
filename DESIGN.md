# Design

A chat assistant that explains weather risk for a logistics company's 19 US hubs.

**Core rule:** TypeScript calculates all numbers, scores and rankings. Claude only uses tool results to answer and explain.

## Architecture

```
React chat ──POST /chat──▶ Express ──▶ LangGraph agent (Claude)
                                          │ tools (Zod in/out)
                                          ▼
                                  Services (TypeScript)
                                          │
                                  data/*.json  ◀── refresh-data script (Open-Meteo, FEMA)
```

| Layer    | Responsibility                                       |
| -------- | ---------------------------------------------------- |
| Routes   | HTTP, request validation, response assembly          |
| Agent    | System prompt, tool calls, memory, Structured Output |
| Tools    | Validate input, call one service, return result      |
| Services | Stats, scoring, ranking. No LLM.                     |
| Data     | JSON files, validated on load                        |

Stack: React + Vite, Node.js + TypeScript + Express, LangChain/LangGraph, Anthropic Claude API, Zod, Vitest. npm workspaces: `shared`, `server`, `web`.

## Tools

| Tool                  | Input                | Returns                                                                     |
| --------------------- | -------------------- | --------------------------------------------------------------------------- |
| `list_hubs`           | `region?`, `state?`  | Matching hubs                                                               |
| `get_weather_stats`   | `hubIds`, `year?`    | Day counts and percentages per weather metric (one year, or yearly average) |
| `get_hazard_exposure` | `hubIds`, `hazards?` | FEMA NRI source data per hazard                                             |
| `get_risk_scores`     | `hubIds?`, `sortBy?` | Ranked hazard and overall scores with risk drivers                          |

- Hub IDs are a `z.enum` built from `data/hubs.json`, so tools only accept company hubs.
- Tools return `{ ok: true, data, meta }` or `{ ok: false, error: { code, message } }`. Errors are returned to the agent, not thrown.

## Structured Output

Claude's final response is validated with Zod:

```ts
{
  answer: string,        // direct answer
  hubIds: string[],      // hubs the answer is about (catalog IDs, may be empty)
  explanation: string,   // why, based only on tool results
  assumptions: string[]  // assumptions or limitations (may be empty)
}
```

The server adds `toolCalls`, `sources` and `dataAsOf` from the tool results.

## API

| Method | Path      | Description                                                                             |
| ------ | --------- | --------------------------------------------------------------------------------------- |
| POST   | `/chat`   | `{ threadId, message }` → final output + `threadId`, `toolCalls`, `sources`, `dataAsOf` |
| GET    | `/hubs`   | List hubs (`?region=&state=`)                                                           |
| GET    | `/health` | Status and data dates                                                                   |

Errors: `{ error: { code, message } }` with `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `AGENT_ERROR` (502), `INTERNAL_ERROR` (500).

## Data

| Source                            | Data                             | Stored in                   |
| --------------------------------- | -------------------------------- | --------------------------- |
| Open-Meteo Historical Weather API | Daily weather, last 3 full years | `data/weather/<hubId>.json` |
| FEMA National Risk Index          | County hazard scores (0–100)     | `data/hazards.json`         |

- `data/hubs.json` is hand-written: 19 fictional hubs in real cities, with coordinates, region and county FIPS.
- `npm run refresh-data` downloads both sources, validates with Zod and writes JSON. Data files are committed.
- Metric units: °C, mm, cm, km/h. No API keys needed for either source.

## Risk scoring

Six hazards: winter, flood, hurricane, severeStorm, heat, wildfire.

| Hazard      | Weather metrics                | FEMA NRI hazards                     |
| ----------- | ------------------------------ | ------------------------------------ |
| winter      | heavy snow days, freezing days | Winter Weather, Ice Storm, Cold Wave |
| flood       | heavy rain days                | Riverine Flooding, Coastal Flooding  |
| severeStorm | high wind gust days            | Tornado, Strong Wind, Hail           |
| heat        | hot days                       | Heat Wave                            |
| hurricane   | —                              | Hurricane                            |
| wildfire    | —                              | Wildfire                             |

- **Weather score** (0–100): each metric = `min(days / cap, 1) × 100`, averaged.
- **FEMA score** (0–100): highest score among the related NRI hazards.
- **Hazard score** = `50% weather + 50% FEMA`, or FEMA only if there are no weather metrics.
- **Overall score** = average of the 6 hazard scores.
- **Levels:** low, moderate, high.
- **Ranking:** descending by score, ties broken by hub ID.
- **Risk drivers:** the weather metric values and FEMA scores behind each hazard score.

Thresholds, caps and level cutoffs live in `server/src/config/scoring.ts`, each with a short reason.

## Memory

The frontend creates a `threadId` per chat. The server passes `thread_id: threadId` to LangGraph's in-memory checkpointer, which keeps the message history. History is lost on restart.

## Validation

- Zod on API requests and responses, tool inputs and outputs, final output and data files.
- Unknown cities: rejected by the hub enum; the agent says the city is not a company hub.
- Years outside the data period: tool returns `OUT_OF_RANGE`.
- False premises: the agent checks tool results and corrects the user.
- Invalid final output or Claude API errors: `AGENT_ERROR`.
- Invalid data files: server does not start.

## Evals

`npm run evals` runs a small set of cases against Claude, with code-based checks:

- correct tool usage
- correct hubs
- deterministic ranking
- follow-up questions
- unknown hubs
- false premises
- valid Structured Output
- explanations based on tool results
- number grounding (optional)

## Repo structure

```
data/            hubs.json, hazards.json, meta.json, weather/
shared/src/      Zod schemas and types
server/src/      routes/, agent/, tools/, services/, config/, data/
server/scripts/  refresh-data.ts
server/evals/    cases.json, run.ts
web/src/         chat UI
docs/            plans/, session-log.md
```

## Limitations and out of scope

- Weather data is modelled (Open-Meteo), not station observations. FEMA data is county-level.
- Score weights and thresholds are judgment-based and documented in config.
- Chat history is in memory only.
- Out of scope: live alerts, database, auth, streaming, dashboard, multiple agents, deployment.
