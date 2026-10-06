# Phase 3: Services and scoring

**Goal:** weather stats, hazard exposure, risk scores and ranking, calculated in TypeScript and unit tested. No tools or agent yet.

## Tasks

1. **Scoring config** (`server/src/config/scoring.ts`)
   - Weather metrics, each with a day test and a short reason:

     | Metric | Day counts when | Cap (days/year = 100) | Hazard |
     | --- | --- | --- | --- |
     | heavySnow | snowfall ≥ 5 cm | 10 | winter |
     | freezing | min temp < 0 °C | 120 | winter |
     | heavyRain | precipitation ≥ 25 mm | 20 | flood |
     | highWind | wind gust ≥ 60 km/h | 30 | severeStorm |
     | hot | max temp ≥ 35 °C | 60 | heat |
     | snowfallDays | snowfall ≥ 0.1 cm | stats only, no score | — |

   - Related NRI hazards per hazard, as defined in `DESIGN.md`.
   - Weights: 50% weather, 50% FEMA.
   - Level cutoffs: low < 40, moderate 40 to < 70, high ≥ 70.
   - Keep thresholds, caps and cutoffs in this config with a short explanation that they are judgment-based prioritization values.

2. **Schemas** (`shared/src/schemas/risk.ts`)
   - Result schemas for weather stats, hazard exposure and risk scores.
   - Derive TypeScript types with `z.infer`.
   - These schemas will be reused as tool output schemas in Phase 4.

3. **Weather stats service** (`services/weatherStats.ts`)
   - Input: hub IDs and optional year.
   - Per hub and metric, return days and percentage of days.
   - With a year, calculate that year.
   - Without a year, return the yearly average across the available years.
   - Days with a missing metric value are excluded from that metric's percentage denominator.
   - A year outside the available data period returns an error with code `OUT_OF_RANGE`.
   - `snowfallDays` is available for statistics but does not affect risk scoring.

4. **Hazard exposure service** (`services/hazardExposure.ts`)
   - Input: hub IDs and optional hazards.
   - Per hub and hazard, return the related NRI hazards with their score and rating from `hazards.json`.
   - Preserve FEMA `null` values in the output.

5. **Risk scores service** (`services/riskScores.ts`)
   - Input: optional hub IDs, defaulting to all 19, and `sortBy`, defaulting to `overall`.
   - `sortBy` can be `overall` or one of the six hazards.
   - Follow the formula in `DESIGN.md`:
     - weather score = average of `min(days per year / cap, 1) × 100`, using yearly averages
     - FEMA score = highest related NRI score
     - FEMA `null` values remain `null` in source data and exposure results, but are treated as 0 only when calculating the FEMA score
     - hazard score = 50% weather + 50% FEMA, or FEMA only for hurricane and wildfire
     - overall score = average of the 6 hazard scores
     - level = low, moderate or high using the configured cutoffs
   - Output per hub: rank, overall score, hazard scores with levels, and the weather and FEMA risk drivers behind each hazard score.
   - Rank descending using the unrounded score, with ties broken by hub ID.
   - Round scores to 1 decimal only for output.

6. **Wiring**
   - Create the services from the loaded dataset at startup, like the hubs service.
   - No new endpoints.

7. **Tests**
   - Config:
     - weights sum to 1
     - cutoffs are ordered
     - every hazard has a FEMA mapping
   - Test services with a small synthetic dataset and hand-calculated expected values:
     - metric threshold boundaries
     - year vs yearly average
     - missing values
     - `OUT_OF_RANGE`
     - FEMA maximum and `null` handling
     - hazards without weather metrics
     - overall average
     - level cutoff boundaries
     - ranking and hub ID tie breaking
     - `sortBy` hazard
     - hub subset
   - With committed data, verify:
     - all 19 hubs receive scores
     - scores stay within 0–100
     - ranking is deterministic across calls

## Decisions

- `snowfallDays` is a stats-only metric so questions such as "what percentage of days in Denver had snowfall?" can be answered. It does not affect risk scoring.
- FEMA `null` means the source has no applicable score. It remains `null` in the source and hazard exposure output and is treated as 0 only during risk score calculation.
- Days with a missing metric value are excluded from that metric's percentage denominator.
- Thresholds, caps and level cutoffs are judgment-based prioritization values. They are documented in the scoring config and are not presented as official FEMA or Open-Meteo thresholds.

## Out of scope

Tools, agent, chat API, UI and evals. No new endpoints or dependencies.

## Done when

- Weather stats, hazard exposure, risk scores and ranking pass unit tests
- All 19 hubs get deterministic scores from the committed data
- `npm test`, `npm run typecheck` and `npm run lint` pass