import { describe, expect, it } from 'vitest';
import { lastFullYears } from './period.js';

describe('lastFullYears', () => {
  it('returns the 3 full calendar years before the current year', () => {
    expect(lastFullYears(new Date('2026-10-06T12:00:00Z'))).toEqual({
      startDate: '2023-01-01',
      endDate: '2025-12-31',
    });
  });

  it('does not include the current year on January 1st', () => {
    expect(lastFullYears(new Date('2027-01-01T00:00:00Z'))).toEqual({
      startDate: '2024-01-01',
      endDate: '2026-12-31',
    });
  });

  it('does not change on December 31st', () => {
    expect(lastFullYears(new Date('2026-12-31T23:59:59Z')).endDate).toBe('2025-12-31');
  });
});
