/**
 * Player data and utilities for Airdrop Tennis
 * Defines the comprehensive playerData structure and helper functions.
 */

/**
 * Sample attendance dates for the last 12 weeks.
 * Fixed dates for consistent demo/demo data.
 */
// Each entry = one lesson. Duplicate dates = multiple lessons that day (e.g. clinic + private).
const SAMPLE_ATTENDANCE = [
  '2024-11-15', '2024-11-18', '2024-11-22',
  '2024-11-25', '2024-11-25', '2024-11-29',
  '2024-12-02', '2024-12-06', '2024-12-09',
  '2024-12-13', '2024-12-16', '2024-12-16', '2024-12-20',
  '2024-12-23', '2024-12-27',
  '2025-01-03', '2025-01-06', '2025-01-10',
  '2025-01-13', '2025-01-17', '2025-01-17', '2025-01-20',
  '2025-01-24', '2025-01-27',
  '2025-01-31', '2025-02-03', '2025-02-05', '2025-02-05',
];

/**
 * Comprehensive player data for Airdrop Tennis
 */
export const playerData = {
  skills: {
    serve: 6,
    forehand: 7,
    backhand: 5,
    volleys: 4,
    fitness: 8,
    consistency: 7,
  },

  attendance: SAMPLE_ATTENDANCE,

  badges: [
    { id: 'first-serve', name: 'First Serve', icon: 'tennisball', unlocked: true, description: 'Completed your first lesson' },
    { id: 'rally-master', name: 'Rally Master', icon: 'flash', unlocked: true, description: 'Achieved a 10-ball rally' },
    { id: 'early-bird', name: 'Early Bird', icon: 'sunny', unlocked: true, description: 'Attended 5 morning sessions' },
    { id: 'consistency-king', name: 'Consistency King', icon: 'trophy', unlocked: false, description: '10 sessions in a row without missing' },
    { id: 'fitness-buff', name: 'Fitness Buff', icon: 'fitness', unlocked: false, description: 'Fitness skill level 8+' },
    { id: 'volley-pro', name: 'Volley Pro', icon: 'ribbon', unlocked: false, description: 'Master all volley drills' },
  ],

  roadmap: [
    { task: '5-ball rally', status: 'mastered' },
    { task: '10-ball rally', status: 'mastered' },
    { task: '20-ball rally', status: 'in-progress' },
    { task: 'Consistent serve into box', status: 'in-progress' },
    { task: 'Forehand cross-court control', status: 'in-progress' },
    { task: 'Backhand slice', status: 'locked' },
    { task: 'Approach and volley', status: 'locked' },
    { task: 'Point play (full rally)', status: 'locked' },
  ],
};

/**
 * Returns the Monday (week start) for a given date.
 * @param {Date} d
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function getWeekStart(d) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

/**
 * Returns the current weekly attendance streak.
 * A week counts if the player attended at least one session that week.
 * Streak is counted backward from the most recent week with attendance.
 * @param {string[]} attendance - Array of ISO date strings (YYYY-MM-DD)
 * @returns {{ streak: number; weeks: string[] }} Current streak count and array of week-start dates
 */
export function getStreak(attendance) {
  if (!attendance || attendance.length === 0) return { streak: 0, weeks: [] };

  const weekSet = new Set();
  attendance.forEach((dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    weekSet.add(getWeekStart(d));
  });

  const sortedWeeks = [...weekSet].sort().reverse();
  const today = new Date();
  const currentWeekStart = getWeekStart(today);

  let streak = 0;
  const weeksInStreak = [];
  let expectedWeekStart = currentWeekStart;

  for (const weekStart of sortedWeeks) {
    if (weekStart !== expectedWeekStart) break;
    streak++;
    weeksInStreak.push(weekStart);
    const prevWeek = new Date(weekStart + 'T12:00:00');
    prevWeek.setDate(prevWeek.getDate() - 7);
    expectedWeekStart = prevWeek.toISOString().slice(0, 10);
  }

  return { streak, weeks: weeksInStreak };
}

/**
 * Formats attendance dates for a calendar heatmap grid.
 * Returns an array of { date, count } for each date with activity.
 * @param {string[]} attendance - Array of ISO date strings (YYYY-MM-DD)
 * @param {number} weeks - Number of weeks to include (default 12)
 * @returns {{ date: string; count: number }[]} Data suitable for a calendar heatmap
 */
export function getHeatmapData(attendance, weeks = 12) {
  if (!attendance || attendance.length === 0) return [];

  const countByDate = {};
  attendance.forEach((dateStr) => {
    countByDate[dateStr] = (countByDate[dateStr] || 0) + 1;
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);

  return Object.entries(countByDate)
    .filter(([date]) => date >= cutoff.toISOString().slice(0, 10))
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Heatmap data for a trailing N-day window (e.g. 90 days).
 * @param {string[]} attendance - Array of ISO date strings
 * @param {number} days - Number of days to include (default 90)
 * @returns {{ date: string; count: number }[]}
 */
export function getHeatmapDataForDays(attendance, days = 90) {
  if (!attendance || attendance.length === 0) return [];

  const countByDate = {};
  attendance.forEach((dateStr) => {
    countByDate[dateStr] = (countByDate[dateStr] || 0) + 1;
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return Object.entries(countByDate)
    .filter(([date]) => date >= cutoff.toISOString().slice(0, 10))
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
