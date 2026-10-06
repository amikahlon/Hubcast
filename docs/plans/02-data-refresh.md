# Phase 2: Data refresh

**Goal:** fetch and store valid weather and FEMA data for all 19 hubs. No scoring yet.

## Tasks

1. **Data schemas**
   - Add Zod schemas for historical weather data, FEMA hazard data and data metadata.
   - Allow missing source values where needed.

2. **Open-Meteo**
   - Fetch the last 3 full calendar years of daily weather for every hub.
   - Keep only the fields needed later for weather risk:
     - max and min temperature
     - precipitation
     - snowfall
     - max wind gust
   - Validate and convert the API response before saving it.

3. **FEMA NRI**
   - Fetch county-level hazard data for all hub counties.
   - Keep the FEMA scores and ratings needed for the hazards defined in `DESIGN.md`.
   - Verify the current official FEMA service URL and field names before implementation.
   - Validate and convert the response before saving it.

4. **Refresh script**
   - Add `npm run refresh-data`.
   - Load the 19 hubs and fetch Open-Meteo and FEMA data.
   - Save:
     - `data/weather/<hubId>.json`
     - `data/hazards.json`
     - `data/meta.json`
   - Fail clearly if the refresh cannot complete.

5. **Server**
   - Load and validate the generated data files.
   - Make `/health` return the data refresh date.

6. **Tests**
   - Test the data schemas and API response conversion without network calls.
   - Verify committed data exists for all 19 hubs.
   - Verify `/health` returns the data date.

## Out of scope

Weather statistics, scoring, ranking, tools and the agent.

## Done when

- `npm run refresh-data` creates valid Open-Meteo and FEMA data for all 19 hubs
- The server loads the generated data successfully
- `npm test`, `npm run typecheck` and `npm run lint` pass