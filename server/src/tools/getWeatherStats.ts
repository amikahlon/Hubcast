import { defineTool, type ToolDeps } from './tool.js';

export function createGetWeatherStatsTool({ services, meta, schemas }: ToolDeps) {
  return defineTool({
    name: 'get_weather_stats',
    description:
      'Number of days and percentage of days with heavy snow, freezing temperatures, heavy rain, ' +
      'high wind gusts, hot weather and any snowfall, for the given hubs. Pass a year for that ' +
      'calendar year, or omit it for the yearly average over all years in the data. The result ' +
      'includes the period covered and the rule behind each metric.',
    schema: schemas.get_weather_stats,
    sources: [meta.weather.source],
    dataAsOf: meta.refreshedAt,
    call: (input) => services.weatherStats.getWeatherStats(input.hubIds, input.year),
  });
}
