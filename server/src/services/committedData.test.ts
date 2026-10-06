import {
  HazardExposureResultSchema,
  HazardTypeSchema,
  RiskScoresResultSchema,
  WeatherStatsResultSchema,
} from '@hubcast/shared';
import { describe, expect, it } from 'vitest';
import { loadDataset } from '../data/dataset.js';
import { loadHubCatalog } from '../data/hubs.js';
import { createServices } from './index.js';

const hubs = await loadHubCatalog();
const dataset = await loadDataset(hubs);
const services = createServices(hubs, dataset);
const hubIds = hubs.map((hub) => hub.id);

describe('services with the committed data', () => {
  it('scores all 19 hubs, with every score within 0–100', () => {
    const result = RiskScoresResultSchema.parse(services.riskScores.getRiskScores());
    expect(result.hubs.map((hub) => hub.hubId).sort()).toEqual([...hubIds].sort());
    for (const hub of result.hubs) {
      expect(hub.hazards).toHaveLength(6);
      for (const score of [hub.overall.score, ...hub.hazards.map((h) => h.score)]) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('ranks from 1 to 19, highest overall score first', () => {
    const { hubs: ranked } = services.riskScores.getRiskScores();
    expect(ranked.map((hub) => hub.rank)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]?.overall.score ?? 0).toBeGreaterThanOrEqual(
        ranked[i]?.overall.score ?? 0,
      );
    }
  });

  it('sorts by each hazard, highest first', () => {
    for (const hazard of HazardTypeSchema.options) {
      const { hubs: ranked } = services.riskScores.getRiskScores(undefined, hazard);
      const scores = ranked.map((hub) => hub.hazards.find((h) => h.hazard === hazard)?.score ?? -1);
      expect(scores, hazard).toEqual([...scores].sort((a, b) => b - a));
    }
  });

  it('returns the same ranking on every call', () => {
    expect(services.riskScores.getRiskScores()).toEqual(services.riskScores.getRiskScores());
  });

  it('gives weather drivers to winter, flood, severeStorm and heat only', () => {
    const [hub] = services.riskScores.getRiskScores(['denver-co']).hubs;
    const withWeather = hub?.hazards.filter((h) => h.weather !== null).map((h) => h.hazard);
    expect(withWeather).toEqual(['winter', 'flood', 'severeStorm', 'heat']);
  });

  it('returns valid weather stats for all hubs, for a year and for the average', () => {
    for (const year of [undefined, 2023, 2025]) {
      const result = WeatherStatsResultSchema.parse(
        services.weatherStats.getWeatherStats(hubIds, year),
      );
      expect(result.hubs).toHaveLength(19);
    }
  });

  it('answers "what percentage of days in Denver last year had snowfall?"', () => {
    const [hub] = services.weatherStats.getWeatherStats(['denver-co'], 2025).hubs;
    const snowfall = hub?.metrics.find((m) => m.metric === 'snowfallDays');
    expect(snowfall?.percentage).toBeGreaterThan(0);
    expect(snowfall?.percentage).toBeLessThan(50);
  });

  it('rejects a year outside the data period', () => {
    expect(() => services.weatherStats.getWeatherStats(['denver-co'], 2022)).toThrow(/2023–2025/);
  });

  it('returns valid hazard exposure for all hubs', () => {
    const result = HazardExposureResultSchema.parse(
      services.hazardExposure.getHazardExposure(hubIds),
    );
    expect(result.hubs).toHaveLength(19);
  });
});
