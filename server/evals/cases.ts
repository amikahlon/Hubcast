import type { ChatResult } from '../src/agent/chat.js';
import type { Services } from '../src/services/index.js';

// Eval cases for the real agent. Every check is plain code (no LLM judge).
// Expected values come from the deterministic services, so they stay correct after a data refresh.

/** A check passes when `run` returns true. A string is the reason for a failure. */
export interface Check {
  name: string;
  run: (result: ChatResult) => boolean | string;
}

export interface EvalCase {
  id: string;
  description: string;
  /** Sent one after another in the same conversation. The checks look at the last answer. */
  messages: string[];
  checks: Check[];
}

export interface EvalContext {
  services: Services;
}

// --- Helpers ---

const DATA_TOOLS = ['get_weather_stats', 'get_hazard_exposure', 'get_risk_scores'];

const check = (name: string, run: Check['run']): Check => ({ name, run });

/** Answer, explanation and assumptions as one text. */
const textOf = (r: ChatResult): string => [r.answer, r.explanation, ...r.assumptions].join('\n');

function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`Eval setup: no ${what}`);
  return value;
}

const numberTokens = (text: string): string[] => text.match(/\d+(?:\.\d+)?/g) ?? [];

/**
 * True if the text contains the number. Normal formatting differences are fine: `100` and
 * `100.0` match 100, and `99.96` matches 99.96. A number with decimals needs a token with at
 * least one decimal (so `100` does not match 99.96), unless `loose` allows rounding to whole numbers.
 */
function hasNumber(text: string, value: number, loose = false): boolean {
  return numberTokens(text).some((token) => {
    const decimals = token.includes('.') ? (token.split('.')[1]?.length ?? 0) : 0;
    const sameWhenRounded = Number(value.toFixed(decimals)) === Number(token);
    return sameWhenRounded && (decimals > 0 || Number.isInteger(value) || loose);
  });
}

const hasAnyNumber = (text: string, values: number[], loose = false): boolean =>
  values.some((value) => hasNumber(text, value, loose));

const round1 = (value: number): number => Math.round(value * 10) / 10;

const usedTool = (r: ChatResult, name: string, ok?: boolean): boolean =>
  r.toolCalls.some((call) => call.name === name && (ok === undefined || call.ok === ok));

const usedDataTool = (r: ChatResult): boolean =>
  r.toolCalls.some((c) => DATA_TOOLS.includes(c.name));

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item) => b.includes(item));

function hazardScore(services: Services, hubId: string, hazard: string): number {
  const hub = services.riskScores.getRiskScores([hubId]).hubs[0];
  return must(hub?.hazards.find((h) => h.hazard === hazard)?.score, `${hazard} score for ${hubId}`);
}

function hurricaneScore(services: Services, hubId: string): number {
  const exposure = services.hazardExposure.getHazardExposure([hubId], ['hurricane']);
  return must(exposure.hubs[0]?.hazards[0]?.nri[0]?.score, `hurricane score for ${hubId}`);
}

function snowfallPercentage(services: Services, hubId: string, year: number): number {
  const stats = services.weatherStats.getWeatherStats([hubId], year);
  const metric = stats.hubs[0]?.metrics.find((m) => m.metric === 'snowfallDays');
  return must(metric?.percentage, `snowfall percentage for ${hubId} ${year}`);
}

/** Real hot-day values for a hub (per year and on average), so quoting them is not "inventing". */
function hotValues(services: Services, hubId: string): number[] {
  return [undefined, 2023, 2024, 2025].flatMap((year) => {
    const metric = services.weatherStats
      .getWeatherStats([hubId], year)
      .hubs[0]?.metrics.find((m) => m.metric === 'hot');
    return metric ? [metric.days, metric.percentage] : [];
  });
}

/** Numbers in the text that are not in the allowed list. */
function unexpectedNumbers(text: string, allowed: number[]): string[] {
  return numberTokens(text).filter(
    (token) => !allowed.some((value) => Number(token) === round(value, token)),
  );
}

/** Round `value` to as many decimals as `token` has, to compare it with the token. */
function round(value: number, token: string): number {
  const decimals = token.includes('.') ? (token.split('.')[1]?.length ?? 0) : 0;
  return Number(value.toFixed(decimals));
}

// --- Checks that apply to every case ---

const MAX_WORDS = 200;

export const COMMON_CHECKS: Check[] = [
  check('plain text (no Markdown)', (r) => {
    const markdown = /\*\*|__|`|^\s*#{1,6}\s|^\s*[-*•]\s/m;
    return !markdown.test(textOf(r)) || 'the answer contains Markdown';
  }),
  check(`short (under ${MAX_WORDS} words)`, (r) => {
    const words = `${r.answer} ${r.explanation}`.split(/\s+/).filter(Boolean).length;
    return words < MAX_WORDS || `${words} words in answer and explanation`;
  }),
];

// --- Cases ---

export function buildCases({ services }: EvalContext): EvalCase[] {
  const topOverall = must(services.riskScores.getRiskScores().hubs[0], 'top overall hub');

  const midwestIds = services.hubs.listHubs({ region: 'Midwest' }).map((hub) => hub.id);
  const topMidwestWinter = must(
    services.riskScores.getRiskScores(midwestIds, 'winter').hubs[0],
    'top Midwest winter hub',
  );

  const topWinter = must(
    services.riskScores.getRiskScores(undefined, 'winter').hubs[0],
    'top winter hub',
  );
  const topWinterCity = must(
    services.hubs.listHubs().find((hub) => hub.id === topWinter.hubId)?.city,
    'top winter city',
  );
  const refusal =
    /\b(cannot|can't|can not|unable|not (?:available|included|supported)|do(?:es)?n't|do(?:es)? not|no data)\b/i;

  return [
    {
      id: 'ranking-global',
      description: 'Highest overall risk hub comes from the ranking, with its score',
      messages: ['Which hub has the highest overall weather risk?'],
      checks: [
        check('used get_risk_scores', (r) => usedTool(r, 'get_risk_scores', true)),
        check(`hubIds contains ${topOverall.hubId}`, (r) => r.hubIds.includes(topOverall.hubId)),
        check(`text has the top score ${topOverall.overall.score}`, (r) =>
          hasNumber(textOf(r), topOverall.overall.score, true),
        ),
      ],
    },
    {
      id: 'ranking-region',
      description: 'Highest winter risk hub in the Midwest, without hubs from other regions',
      messages: ['Which Midwest hub has the highest winter risk?'],
      checks: [
        check('used get_risk_scores', (r) => usedTool(r, 'get_risk_scores', true)),
        check(`hubIds contains ${topMidwestWinter.hubId}`, (r) =>
          r.hubIds.includes(topMidwestWinter.hubId),
        ),
        check('hubIds are all Midwest hubs', (r) => {
          const outside = r.hubIds.filter((id) => !midwestIds.includes(id));
          return outside.length === 0 || `hubs outside the Midwest: ${outside.join(', ')}`;
        }),
        check('text has the winter score', (r) =>
          hasNumber(textOf(r), hazardScore(services, topMidwestWinter.hubId, 'winter'), true),
        ),
      ],
    },
    {
      id: 'comparison',
      description: 'Miami vs Houston hurricane exposure, with both scores',
      messages: ['Compare Miami and Houston in terms of hurricane exposure.'],
      checks: [
        check(
          'used a hazard or risk tool',
          (r) => usedTool(r, 'get_hazard_exposure', true) || usedTool(r, 'get_risk_scores', true),
        ),
        check('hubIds are exactly Miami and Houston', (r) =>
          sameSet(r.hubIds, ['miami-fl', 'houston-tx']),
        ),
        ...(['miami-fl', 'houston-tx'] as const).map((hubId) => {
          const score = hurricaneScore(services, hubId);
          return check(`text has the ${hubId} hurricane score (${score})`, (r) =>
            hasAnyNumber(textOf(r), [score, round1(score)]),
          );
        }),
      ],
    },
    {
      id: 'historical-weather',
      description: 'Percentage of snowfall days in Denver in 2024',
      messages: ['What percentage of days in Denver in 2024 had snowfall?'],
      checks: [
        check('used get_weather_stats', (r) => usedTool(r, 'get_weather_stats', true)),
        check('hubIds is Denver', (r) => sameSet(r.hubIds, ['denver-co'])),
        check('text has the percentage', (r) =>
          hasNumber(textOf(r), snowfallPercentage(services, 'denver-co', 2024), true),
        ),
        check('text mentions 2024', (r) => textOf(r).includes('2024')),
      ],
    },
    {
      id: 'follow-up-memory',
      description: '"its" in the second question means Dallas',
      messages: ["Why is the Dallas hub's risk high?", 'What is its flood risk?'],
      checks: [
        check('hubIds is Dallas', (r) => sameSet(r.hubIds, ['dallas-tx'])),
        check('text has the Dallas flood score', (r) =>
          hasNumber(textOf(r), hazardScore(services, 'dallas-tx', 'flood'), true),
        ),
      ],
    },
    {
      id: 'unknown-hub',
      description: 'Seattle is not a company hub, and no data is invented',
      messages: ['What is the weather risk for Seattle?'],
      checks: [
        check('hubIds is empty', (r) => r.hubIds.length === 0),
        check('says Seattle is not a company hub', (r) =>
          /not (?:a|one of)[^.]{0,40}hub/i.test(textOf(r)),
        ),
        check('no data tool was used', (r) => !usedDataTool(r)),
        check('no scores in the text', (r) => !/\d+\.\d/.test(textOf(r))),
      ],
    },
    {
      id: 'unsupported-year',
      description: 'Phoenix hot days in 2019: the year is not in the data',
      messages: ['How many hot days did Phoenix have in 2019?'],
      checks: [
        check('get_weather_stats failed', (r) => usedTool(r, 'get_weather_stats', false)),
        check('text mentions 2019', (r) => textOf(r).includes('2019')),
        check(
          'text mentions the covered years',
          (r) => /2023/.test(textOf(r)) && /2025/.test(textOf(r)),
        ),
        check('no invented 2019 value', (r) => {
          const allowed = [2019, 2023, 2024, 2025, ...hotValues(services, 'phoenix-az')];
          const extra = unexpectedNumbers(textOf(r), allowed);
          return extra.length === 0 || `unexpected numbers: ${extra.join(', ')}`;
        }),
      ],
    },
    {
      id: 'unsupported-hazard',
      description: 'Earthquake is not a supported hazard',
      messages: ['What is the earthquake risk for Denver?'],
      checks: [
        check('hubIds is empty', (r) => r.hubIds.length === 0),
        check(
          'says earthquake is not supported',
          (r) => /earthquake/i.test(textOf(r)) && /not (?:included|supported)/i.test(textOf(r)),
        ),
        check('no data tool was used', (r) => !usedDataTool(r)),
        check('no scores in the text', (r) => !/\d+\.\d/.test(textOf(r))),
      ],
    },
    {
      id: 'false-premise',
      description: "Phoenix's winter risk is not the highest: correct the user",
      messages: ["Why is Phoenix's winter risk the highest of all hubs?"],
      checks: [
        check('used get_risk_scores', (r) => usedTool(r, 'get_risk_scores', true)),
        check(`text names the real top winter hub (${topWinterCity})`, (r) =>
          textOf(r).toLowerCase().includes(topWinterCity.toLowerCase()),
        ),
        check('text has the real top winter score', (r) =>
          hasNumber(textOf(r), hazardScore(services, topWinter.hubId, 'winter'), true),
        ),
        check('text has the Phoenix winter score', (r) =>
          hasNumber(textOf(r), hazardScore(services, 'phoenix-az', 'winter'), true),
        ),
        check('does not say Phoenix is the highest', (r) => {
          // A sentence about Phoenix that says "highest" must also deny it.
          const claim = textOf(r)
            .split(/(?<=[.!?])\s+/)
            .find(
              (sentence) =>
                /phoenix/i.test(sentence) &&
                /highest/i.test(sentence) &&
                !/\b(not|no|isn't|never)\b/i.test(sentence),
            );
          return claim === undefined || `claims it: "${claim}"`;
        }),
      ],
    },
    {
      id: 'missing-data',
      description: 'Revenue at risk is not in the data, and no value is invented',
      messages: ['What is the revenue at risk at the Houston hub?'],
      checks: [
        check('says it cannot answer', (r) => refusal.test(textOf(r))),
        check(
          'no money amount',
          (r) => !/\$|\bdollars?\b|\busd\b|\d\s*(?:million|billion)\b/i.test(textOf(r)),
        ),
      ],
    },
  ];
}
