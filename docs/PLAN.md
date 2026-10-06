# Plan

Each phase ends with working code. Detailed plans go in `docs/plans/`.

| # | Phase | Done when |
|---|---|---|
| 1 | Foundation | Workspaces, shared schemas, 19 hubs, `GET /health` and `GET /hubs` working, web app loads |
| 2 | Data refresh | `npm run refresh-data` writes valid weather and FEMA data for all hubs |
| 3 | Services and scoring | Weather stats, hazard exposure, risk scores and ranking work |
| 4 | Agent and chat API | 4 tools, Claude agent, Structured Output, memory, `POST /chat` working |
| 5 | Chat UI | Chat with follow-ups, "New chat" and structured answers |
| 6 | Evals | Eval cases and runner, pass rate reported, docs updated |
