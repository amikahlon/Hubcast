import { defineTool, type ToolDeps } from './tool.js';

export function createGetWeatherStatsTool({ services, meta, schemas }: ToolDeps) {
  return defineTool({
    name: 'get_weather_stats',
    description:
      'Raw historical weather for the given hubs: number and percentage of days with heavy snow, ' +
      'freezing temperatures, heavy rain, high wind gusts, hot weather and any snowfall, plus ' +
      'total snowfall (cm), total precipitation (mm), the largest one-day snowfall and ' +
      'precipitation, the strongest wind gust (km/h) and the highest and lowest temperature (°C). ' +
      'Pass a year for that calendar year, or omit it for the yearly average over all years in ' +
      'the data. period.description says how to read the values. Omit hubIds for all hubs. ' +
      'Pass sortBy to rank hubs by one of these values (lowestTempC lowest first, the others ' +
      'highest first); each hub then has a rank. These are weather values, not risk scores.',
    schema: schemas.get_weather_stats,
    sources: [meta.weather.source],
    dataAsOf: meta.refreshedAt,
    call: (input) => services.weatherStats.getWeatherStats(input.hubIds, input.year, input.sortBy),
  });
}
