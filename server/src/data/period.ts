const FULL_YEARS = 3;

/** The last 3 full calendar years before `today`, as inclusive YYYY-MM-DD dates. */
export function lastFullYears(today: Date): { startDate: string; endDate: string } {
  const lastYear = today.getUTCFullYear() - 1;
  return {
    startDate: `${lastYear - FULL_YEARS + 1}-01-01`,
    endDate: `${lastYear}-12-31`,
  };
}
