import type { HazardType, NriHazard, RiskLevel, WeatherDay, WeatherMetric } from '@hubcast/shared';

// All values in this file are judgment-based prioritization values chosen for this project.
// They are not official FEMA or Open-Meteo thresholds. Change them here only; the services
// read everything from this file.

type WeatherField = Exclude<keyof WeatherDay, 'date'>;

export const WEATHER_FIELDS: Record<WeatherField, { label: string; unit: string }> = {
  tempMax: { label: 'daily max temperature', unit: '°C' },
  tempMin: { label: 'daily min temperature', unit: '°C' },
  precipitation: { label: 'daily precipitation', unit: 'mm' },
  snowfall: { label: 'daily snowfall', unit: 'cm' },
  windGustMax: { label: 'daily max wind gust', unit: 'km/h' },
};

export interface MetricConfig {
  label: string;
  field: WeatherField;
  /** `gte`: value ≥ threshold counts. `lt`: value < threshold counts. */
  comparison: 'gte' | 'lt';
  threshold: number;
  reason: string;
  /** Only scored metrics have a hazard and cap. `snowfallDays` is for statistics only. */
  scoring?: {
    hazard: HazardType;
    /** Days per year at which the metric scores 100. Chosen from the 2023–2025 hub data. */
    cap: number;
  };
}

export const WEATHER_METRICS: Record<WeatherMetric, MetricConfig> = {
  heavySnow: {
    label: 'Heavy snow days',
    field: 'snowfall',
    comparison: 'gte',
    threshold: 5,
    reason: '5 cm in a day is enough to slow road and rail freight.',
    scoring: { hazard: 'winter', cap: 10 },
  },
  freezing: {
    label: 'Freezing days',
    field: 'tempMin',
    comparison: 'lt',
    threshold: 0,
    reason: 'Below 0 °C overnight means ice risk on roads and at docks.',
    scoring: { hazard: 'winter', cap: 120 },
  },
  heavyRain: {
    label: 'Heavy rain days',
    field: 'precipitation',
    comparison: 'gte',
    threshold: 25,
    reason: '25 mm in a day is a common heavy-rain level that can cause local flooding.',
    scoring: { hazard: 'flood', cap: 20 },
  },
  highWind: {
    label: 'High wind gust days',
    field: 'windGustMax',
    comparison: 'gte',
    threshold: 60,
    reason: 'Gusts of 60 km/h or more can stop high-profile trucks and crane work.',
    scoring: { hazard: 'severeStorm', cap: 30 },
  },
  hot: {
    label: 'Hot days',
    field: 'tempMax',
    comparison: 'gte',
    threshold: 35,
    reason: '35 °C or more is a common extreme-heat level for outdoor work and cargo.',
    scoring: { hazard: 'heat', cap: 60 },
  },
  snowfallDays: {
    label: 'Snowfall days',
    field: 'snowfall',
    comparison: 'gte',
    threshold: 0.1,
    reason: 'Any measurable snowfall. Used for statistics only, not for risk scores.',
  },
};

/** FEMA NRI hazards behind each hazard. The hazard's FEMA score is the highest of these. */
export const HAZARD_NRI: Record<HazardType, readonly NriHazard[]> = {
  winter: ['winterWeather', 'iceStorm', 'coldWave'],
  flood: ['inlandFlooding', 'coastalFlooding'],
  hurricane: ['hurricane'],
  severeStorm: ['tornado', 'strongWind', 'hail'],
  heat: ['heatWave'],
  wildfire: ['wildfire'],
};

/** Hazard score = weather × weather + fema × fema (FEMA only if the hazard has no weather metrics). */
export const WEIGHTS = { weather: 0.5, fema: 0.5 } as const;

/** Score cutoffs for every score: below `moderate` is low, `high` and above is high. */
export const LEVEL_CUTOFFS = { moderate: 40, high: 70 } as const;

export function levelFor(score: number): RiskLevel {
  if (score >= LEVEL_CUTOFFS.high) return 'high';
  if (score >= LEVEL_CUTOFFS.moderate) return 'moderate';
  return 'low';
}

/** True if a day's value counts for the metric. `null` (missing) never counts. */
export function matchesMetric(config: MetricConfig, value: number): boolean {
  return config.comparison === 'gte' ? value >= config.threshold : value < config.threshold;
}

/** Human-readable rule, e.g. "daily snowfall ≥ 5 cm". */
export function describeMetric(config: MetricConfig): string {
  const { label, unit } = WEATHER_FIELDS[config.field];
  const symbol = config.comparison === 'gte' ? '≥' : '<';
  return `${label} ${symbol} ${config.threshold} ${unit}`;
}
