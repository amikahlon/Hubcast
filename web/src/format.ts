import type { Hub } from '@hubcast/shared';

/** "2026-10-06" -> "Oct 6, 2026" (the date has no time zone, so format it as UTC). */
export function formatDataDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Safety net: the assistant is asked for plain text, so remove any Markdown that slips through. */
export function plainText(text: string): string {
  return text
    .replace(/\*\*|__|`/g, '')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*[-*•][ \t]+/gm, '');
}

/** "dallas-tx" -> "Dallas, TX". Falls back to the hub ID if the hub list is not available. */
export function hubLabel(hubId: string, hubs: ReadonlyMap<string, Hub>): string {
  const hub = hubs.get(hubId);
  return hub ? `${hub.city}, ${hub.state}` : hubId;
}
