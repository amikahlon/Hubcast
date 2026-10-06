import type { RiskScoresResult, RiskSortBy } from '@hubcast/shared';
import type { Dataset } from '../data/load.js';
import { resolveHubIds } from './common.js';
import { scoreHub, type RawHubRisk } from './riskScoring.js';
import { dataYears } from './weatherMetrics.js';

export function createRiskScoresService(dataset: Dataset) {
  const yearCount = dataYears(dataset.meta).count;

  return {
    /** Scores for the hubs (default: all), ranked by `sortBy`. Ties are broken by hub ID. */
    getRiskScores(hubIds?: readonly string[], sortBy: RiskSortBy = 'overall'): RiskScoresResult {
      const ids = resolveHubIds(dataset, hubIds ?? [...dataset.weather.keys()]);
      const sortValue = (hub: RawHubRisk): number =>
        sortBy === 'overall' ? hub.overall : hub.hazards[sortBy];

      // Rank on the unrounded score; rounding is only for output.
      const ranked = ids
        .map((hubId) => scoreHub(dataset, hubId, yearCount))
        .sort((a, b) => sortValue(b) - sortValue(a) || a.hubId.localeCompare(b.hubId));

      return {
        sortBy,
        hubs: ranked.map((hub, index) => ({ rank: index + 1, ...hub.output })),
      };
    },
  };
}

export type RiskScoresService = ReturnType<typeof createRiskScoresService>;
