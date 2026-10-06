# Phase 4: Agent and chat API

**Goal:** connect Claude to the deterministic services through tools and expose the agent through `POST /chat`. Claude chooses tools and explains their results. TypeScript remains responsible for all statistics, scores and rankings.

## Tasks

1. **Dependencies and environment**
   - Add the LangChain, LangGraph and Anthropic packages required by the architecture in `docs/DESIGN.md`.
   - Read `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` from the environment.
   - Keep both values out of the source code.
   - Verify the current LangChain and Anthropic APIs during implementation instead of assuming outdated model or SDK behavior.

2. **Tool input schemas**
   - Add Zod input schemas for the 4 tools.
   - Restrict hub IDs to the company hub catalog.
   - Tools:
     - `list_hubs(region?, state?)`
     - `get_weather_stats(hubIds, year?)`
     - `get_hazard_exposure(hubIds, hazards?)`
     - `get_risk_scores(hubIds?, sortBy?)`

3. **Tools**
   - Create one thin tool for each existing service.
   - Tools only validate input, call the deterministic service and return the result.
   - Return a simple structured result:
     - success: `{ ok: true, data, meta }`
     - failure: `{ ok: false, error }`
   - Include the relevant data source and data date in metadata.
   - Service errors such as `NOT_FOUND` and `OUT_OF_RANGE` should be returned to Claude as readable tool errors instead of crashing the request.

4. **Agent**
   - Create one Claude agent with the 4 tools.
   - Use `FinalAnswerSchema` as the structured final response.
   - Use LangGraph memory so messages with the same `threadId` share conversation history.
   - Keep a reasonable step limit to prevent accidental tool loops.
   - System prompt rules:
     - answer from tool results
     - never invent or calculate statistics, scores or rankings
     - explain risk reasons only from tool results and risk drivers
     - preserve numbers returned by the tools
     - correct false assumptions when the data disagrees
     - handle unknown cities or hubs clearly
     - explain relevant data limitations and assumptions when needed

5. **Chat service**
   - Add `chat(threadId, message)`.
   - Pass `threadId` to LangGraph as `thread_id`.
   - Validate the final Claude response with `FinalAnswerSchema`.
   - Reject final hub IDs that are not in the company hub catalog.
   - Collect the tool calls, sources and data date used for the current answer.
   - Convert agent or model failures into a clear `AGENT_ERROR`.

6. **Chat API**
   - Add `POST /chat`.
   - Validate the request with `ChatRequestSchema`.
   - Call the chat service and return a validated `ChatResponse`.
   - Keep the existing API error format.

7. **Manual verification**
   - Run the agent with a real Anthropic key.
   - Check the main README examples:
     - Midwest winter risk
     - Miami vs Houston hurricane and flood risk
     - Denver snowfall percentage
     - why Dallas has high risk
   - Check a follow-up question using the same `threadId`.
   - Check an unknown city and a false premise.
   - Confirm that Claude uses tool results instead of inventing calculations.

## Decisions

- Claude chooses tools and explains results. TypeScript calculates all statistics, scores and rankings.
- Risk explanations must come from deterministic risk drivers.
- The public API uses `threadId`; LangGraph internally uses `thread_id`.
- Conversation memory is in memory only and may be lost when the server restarts.
- Invalid hub IDs in the final structured response are treated as an agent error.
- No streaming, persistent memory or additional agent infrastructure.

## Out of scope

Chat UI, evals, streaming, persistent storage, authentication, new data sources and scoring changes.

## Done when

- All 4 tools work against the existing Phase 3 services
- Claude can select the correct tools and return a valid structured answer
- `POST /chat` works with a real Claude model
- Follow-up questions work with the same `threadId`
- The main example questions return answers grounded in the deterministic data
- Typecheck and lint pass