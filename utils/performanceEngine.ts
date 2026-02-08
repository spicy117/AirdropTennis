/**
 * Performance Engine - computes metrics from lessons and skills for the Activity Stats UI.
 */

export interface Lesson {
  startTime: string; // ISO timestamp
  endTime: string;   // ISO timestamp
  status: string;    // 'completed' | 'cancelled' | etc.
}

/** Accepts snake_case (DB) or camelCase for compatibility */
export type LessonInput = Lesson | {
  start_time: string;
  end_time: string;
  status?: string;
};

export interface Skills {
  serve: number;
  forehand: number;
  backhand: number;
  volleys: number;
  fitness: number;
  consistency: number;
}

const SKILL_KEYS: (keyof Skills)[] = ['serve', 'forehand', 'backhand', 'volleys', 'fitness', 'consistency'];

function normalizeLesson(lesson: LessonInput): Lesson {
  if ('start_time' in lesson) {
    return {
      startTime: lesson.start_time,
      endTime: lesson.end_time,
      status: lesson.status ?? 'completed', // DB bookings without status = completed (existing row = not cancelled)
    };
  }
  return lesson as Lesson;
}

function getLessonDurationHours(lesson: Lesson): number {
  const start = new Date(lesson.startTime).getTime();
  const end = new Date(lesson.endTime).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  return (end - start) / (1000 * 60 * 60);
}

function isPastLesson(lesson: Lesson): boolean {
  const end = new Date(lesson.endTime).getTime();
  return !isNaN(end) && end < Date.now();
}

/**
 * Total hours from completed lessons.
 * Filters for status === 'completed', sums duration (endTime - startTime), returns rounded integer.
 * Empty array or no completed lessons → 0.
 */
export function totalHours(lessons: LessonInput[]): number {
  if (!lessons || lessons.length === 0) return 0;
  const completed = lessons
    .map(normalizeLesson)
    .filter((l) => l.status === 'completed')
    .filter((l) => l.startTime && l.endTime);
  const sum = completed.reduce((acc, l) => acc + getLessonDurationHours(l), 0);
  const result = Math.round(sum);
  return Number.isFinite(result) ? result : 0;
}

/**
 * Attendance rate: (Completed Lessons / Total Past Lessons) * 100.
 * Future/upcoming lessons are excluded from the total.
 * Returns percentage (e.g., 92). Empty array → 0.
 */
export function attendanceRate(lessons: LessonInput[]): number {
  if (!lessons || lessons.length === 0) return 0;
  const normalized = lessons.map(normalizeLesson).filter((l) => l.startTime && l.endTime);
  const pastLessons = normalized.filter(isPastLesson);
  if (pastLessons.length === 0) return 0;
  const completed = pastLessons.filter((l) => l.status === 'completed');
  const rate = (completed.length / pastLessons.length) * 100;
  const result = Math.round(rate);
  return Number.isFinite(result) ? result : 0;
}

/**
 * Skill growth: currentSkills average minus baselineSkills average.
 * Returns string with '+' prefix (e.g., '+1.2'). Zero or negative gets no '+' for negative.
 * When baselineSkills is null/undefined, uses currentSkills as baseline → '+0.0'.
 */
export function skillGrowth(
  currentSkills: Partial<Skills> | null | undefined,
  baselineSkills: Partial<Skills> | null | undefined
): string {
  const current = currentSkills ?? {};
  const baseline = baselineSkills ?? current;
  const currentAvg =
    SKILL_KEYS.reduce((s, k) => s + (current[k] ?? 0), 0) / SKILL_KEYS.length;
  const baselineAvg =
    SKILL_KEYS.reduce((s, k) => s + (baseline[k] ?? 0), 0) / SKILL_KEYS.length;
  const diff = Math.round((currentAvg - baselineAvg) * 10) / 10;
  const safe = Number.isFinite(diff) ? diff : 0;
  const prefix = safe >= 0 ? '+' : '';
  return `${prefix}${safe}`;
}
