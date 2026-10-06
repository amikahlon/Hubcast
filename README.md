# Hubcast

A chat assistant that explains weather risk for 19 fictional logistics hubs in real US cities. It uses historical weather from Open-Meteo and county hazard data from the FEMA National Risk Index.

Built with React, Vite, Express, TypeScript, LangChain, LangGraph, Claude and Zod.

## How it works

```text
React UI -> Express API -> Chat service -> Agent <-> Tools -> Services -> JSON data
```

The agent chooses from four tools: list hubs, get weather statistics, get hazard exposure and get risk scores. Services calculate the statistics, scores and rankings. Tool results return to the agent, which writes the answer and explanation.

The server validates the answer with Zod and adds the tools used, sources and data date. LangGraph keeps conversation history in memory by thread ID so follow-up questions keep their context.

## Structure

```text
web/src/                 React chat UI and API client
server/src/
  routes/                HTTP endpoints and request validation
  agent/                 Agent loop, prompt, memory and answer validation
  tools/                 Four tools that call the services
  services/              Weather statistics, risk scoring and rankings
  config/, data/         Settings and data loading
  runtime.ts             Connects services, tools and the agent
shared/src/              Zod schemas and shared types
data/                    Hub, weather and FEMA JSON files
server/scripts/          Data refresh
```

## Run locally

Use Node.js 22.12 or newer. Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:5173. The API runs on port 3001 by default. Data files are included, so no data download is needed to start.
