/**
 * Performance page utilities for Airdrop Tennis
 * Heatmap data generation and related helpers.
 */

export interface HeatmapValue {
  date: string;
  count: number;
}

export interface GenerateHeatmapDataOptions {
  /** Trailing window in days (e.g. 90 for 3 months). Omit to include all dates. */
  days?: number;
}

/**
 * Maps a list of lesson dates to the { date, count } format required by react-calendar-heatmap.
 * Multiple lessons on the same day (e.g. clinic + private) produce a higher count,
 * causing the heatmap square to glow brighter (higher intensity yellow).
 *
 * @param attendanceArray - Array of ISO date strings (YYYY-MM-DD). Each entry = one lesson.
 *   Duplicate dates = multiple lessons that day.
 * @param options - Optional { days } to filter to a trailing window.
 * @returns Array of { date, count } for the heatmap library
 */
export function generateHeatmapData(
  attendanceArray: string[],
  options?: GenerateHeatmapDataOptions
): HeatmapValue[] {
  if (!attendanceArray || attendanceArray.length === 0) return [];

  const countByDate: Record<string, number> = {};

  attendanceArray.forEach((dateStr) => {
    const normalized = dateStr.slice(0, 10); // ensure YYYY-MM-DD
    countByDate[normalized] = (countByDate[normalized] || 0) + 1;
  });

  let entries = Object.entries(countByDate);

  if (options?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - options.days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    entries = entries.filter(([date]) => date >= cutoffStr);
  }

  return entries
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
