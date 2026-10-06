# Phase 6: Evals

**Goal:** A small eval set that runs the real agent with the real Claude model and reports PASS or FAIL for each case using simple deterministic checks.

No LLM judge and no new dependencies. The agent, scoring, tools, API and architecture do not change.

## Tasks

### 1. Files

Create:

- `server/evals/cases.ts`
- `server/evals/run.ts`

The evals stay inside `server/evals/`, next to the server code they use.

Add `evals` to `server/tsconfig.json` so typecheck and lint cover them.

Evals use the real Claude API, require an API key and cost money.

### 2. Runner

`server/evals/run.ts` should:

- Load `.env` and the project data.
- Build the services and agent the same way as `server/src/index.ts`.
- Call the real chat service directly. The HTTP server does not need to be running.
- Run cases one after another.
- Give every case a new `threadId`.
- Messages inside the same case share the same `threadId`.
- Print PASS or FAIL, case ID and execution time.
- On FAIL, print the failed checks and the final answer.
- Print the final pass rate, for example `8/10 passed (80%)`.
- Exit with code 0 only when all selected cases pass.
- Support running one case with `npm run eval -- <case-id>`.
- Stop with a clear message if `ANTHROPIC_API_KEY` or `ANTHROPIC_MODEL` is missing.
- Do not retry failed model calls.

### 3. Eval cases

Each case should have:

- `id`
- description
- one or more messages
- deterministic checks

Checks can use:

- final answer
- explanation
- `hubIds`
- `toolCalls`
- `sources`
- `dataAsOf`

Expected scores and rankings should come from the Phase 3 services at runtime when possible, instead of hardcoding values.

Create these 10 cases:

| ID | Question | Main checks |
|---|---|---|
| `ranking-global` | Which hub has the highest overall weather risk? | Uses `get_risk_scores`. Contains the real top hub and its score. |
| `ranking-region` | Which Midwest hub has the highest winter risk? | Contains the expected Midwest hub. Does not return hubs outside the Midwest. |
| `comparison` | Compare Miami and Houston in terms of hurricane exposure. | Returns exactly Miami and Houston. Includes the correct hurricane scores for both hubs. |
| `historical-weather` | What percentage of days in Denver in 2024 had snowfall? | Uses `get_weather_stats`. Returns Denver and the correct percentage. |
| `follow-up-memory` | 1. Why is the Dallas hub's risk high? 2. What is its flood risk? | The second answer still understands that "its" means Dallas and gives Dallas's flood risk. |
| `unknown-hub` | What is the weather risk for Seattle? | Says Seattle is not a company hub. `hubIds` is empty. Does not invent Seattle data. |
| `unsupported-year` | How many hot days did Phoenix have in 2019? | Tool call fails correctly. Mentions that 2019 is unavailable and explains the supported data years. Does not invent a 2019 hot-day value. |
| `unsupported-hazard` | What is the earthquake risk for Denver? | Says earthquake is not supported by this system. `hubIds` is empty. Does not invent an earthquake score. |
| `false-premise` | Why is Phoenix's winter risk the highest of all hubs? | Corrects the false premise. Gives Phoenix's real winter score and identifies the real top winter hub. |
| `missing-data` | What is the revenue at risk at the Houston hub? | Says the system cannot answer from the available data and does not invent a revenue value. Valid unrelated numbers such as supported data years should not cause this case to fail. |

### 4. Common checks

Apply these checks to every case:

- The chat call succeeds.
- Final user-facing text is plain text.
- No Markdown such as `**`, headings or backticks.
- The answer and explanation together stay under 200 words.

Do not make the text checks too strict. The model can phrase a correct answer in different ways.

For numeric checks, allow normal formatting differences such as `100` and `100.0` when they represent the same value.

### 5. Scripts

Add to `server/package.json`:

```json
"eval": "tsx evals/run.ts"
```

Add a root command so these work:

```bash
npm run eval
npm run eval -- ranking-global
```

Update old references from `npm run evals` to `npm run eval`.

If `docs/DESIGN.md` currently refers to `cases.json`, update it to `cases.ts`.

### 6. README

Add a short `Evals` section to `README.md`.

Explain:

- What the evals check.
- That they run against the real configured Claude model.
- That they require `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- That running them uses API credits.
- How to run all cases:

```bash
npm run eval
```

- How to run one case:

```bash
npm run eval -- ranking-global
```

- PASS means all deterministic checks for that case passed.
- FAIL prints the failed checks and answer.
- Claude is not fully deterministic, so results can sometimes vary between runs.

Also update old eval command or file name references in `README.md`, `CLAUDE.md` and `docs/DESIGN.md`.

### 7. Verification

After implementation:

1. Run `npm run typecheck`.
2. Run `npm run lint`.
3. Run `npm run eval` using the real configured model.
4. Report the final eval pass rate.

If an eval case fails because of the agent's behavior, report it. Do not change the agent, prompt, scoring or tools just to make the eval pass.

The failure can be handled separately later.

## Decisions

- Evals live in `server/evals/`.
- The command is `npm run eval`.
- Cases are stored in `cases.ts`.
- The runner calls the chat service in-process.
- The HTTP server does not need to be running.
- There are 10 eval cases.
- Each case runs once.
- There are no retries.
- No LLM judge.
- No new dependencies.

## Out of scope

- LLM judges
- New dependencies
- Agent changes
- Prompt changes
- Scoring changes
- Tool changes
- Retries
- Parallel eval runs
- Saved eval reports
- CI integration
- Cost tracking

## Done when

- `npm run eval` runs all 10 cases against the real configured Claude model.
- Every case prints PASS or FAIL.
- The final pass rate is printed.
- `npm run eval -- <case-id>` runs one case.
- README explains how to run and understand the evals.
- `npm run typecheck` passes.
- `npm run lint` passes.