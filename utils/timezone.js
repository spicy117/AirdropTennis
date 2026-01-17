/**
 * Timezone utilities for Sydney (Australia/Sydney)
 * Handles conversion between Sydney local time and UTC for database storage
 * 
 * Database: Always stores UTC
 * UI: Always displays Sydney local time (AEST/AEDT)
 * 
 * Note: Sydney is UTC+10 (AEST) or UTC+11 (AEDT during DST)
 * DST runs from first Sunday in October to first Sunday in April
 */

const SYDNEY_OFFSET_AEST = 10 * 60; // UTC+10 in minutes
const SYDNEY_OFFSET_AEDT = 11 * 60; // UTC+11 in minutes

/**
 * Check if a date is in DST period (AEDT) in Sydney
 * DST: First Sunday in October to first Sunday in April
 * Note: date should be a UTC date, and we use UTC methods to get the date components
 */
function isDST(date) {
  // Use UTC methods to get date components (date is already in UTC)
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-11
  const day = date.getUTCDate();
  
  // DST period: October (9) to March (2), or April (3) if before first Sunday
  if (month >= 9 || month <= 2) {
    // October to March: likely DST, but check April boundary
    if (month === 3) {
      // April: check if before first Sunday
      const firstSunday = getFirstSundayOfMonth(year, 3);
      return day < firstSunday;
    }
    // October to March: DST
    if (month === 9) {
      // October: check if on or after first Sunday
      const firstSunday = getFirstSundayOfMonth(year, 9);
      return day >= firstSunday;
    }
    return true; // November, December, January, February, March
  }
  return false; // April (after first Sunday) to September: AEST
}

/**
 * Get the first Sunday of a month
 */
function getFirstSundayOfMonth(year, month) {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  return 1 + daysUntilSunday;
}

/**
 * Get Sydney timezone offset in minutes for a given date
 * date should be a UTC date (created with Date.UTC or from ISO string)
 */
function getSydneyOffset(date) {
  // date is already in UTC, just check if DST applies
  if (isDST(date)) {
    return SYDNEY_OFFSET_AEDT; // UTC+11
  }
  return SYDNEY_OFFSET_AEST; // UTC+10
}

/**
 * Convert Sydney local date string (YYYY-MM-DD) to UTC start of day
 */
export function sydneyDateToUTCStart(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create a UTC date representing midnight UTC on the given date
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  
  // Get the Sydney offset for this date
  const tempDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  const offset = getSydneyOffset(tempDate);
  
  // Convert to actual UTC by subtracting the Sydney offset
  const actualUTC = new Date(utcDate.getTime() - offset * 60000);
  
  return actualUTC;
}

/**
 * Convert Sydney local date string (YYYY-MM-DD) to UTC end of day
 */
export function sydneyDateToUTCEnd(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create a UTC date representing end of day UTC on the given date
  const utcDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  
  // Get the Sydney offset for this date
  const tempDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  const offset = getSydneyOffset(tempDate);
  
  // Convert to actual UTC by subtracting the Sydney offset
  const actualUTC = new Date(utcDate.getTime() - offset * 60000);
  
  return actualUTC;
}

/**
 * Convert Sydney local date and time to UTC ISO string
 */
export function sydneyDateTimeToUTC(dateStr, hours, minutes) {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create a UTC date from the components (treating them as if they were UTC)
  // This represents "hours:minutes UTC" on the given date
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  
  // Get the Sydney offset for this date
  // We need to check DST for the date we're creating
  // Create a temporary date to check DST (using UTC methods to avoid timezone issues)
  const tempDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)); // Use noon to avoid DST boundary issues
  const offset = getSydneyOffset(tempDate);
  
  // Convert to actual UTC by subtracting the Sydney offset
  // If Sydney is UTC+11, then 9am Sydney = 9am UTC - 11 hours = 22:00 previous day UTC
  const actualUTC = new Date(utcDate.getTime() - offset * 60000);
  
  return actualUTC.toISOString();
}

/**
 * Convert UTC ISO string to Sydney local date string (YYYY-MM-DD)
 */
export function utcToSydneyDate(utcISOString) {
  const date = new Date(utcISOString);
  
  // Get offset for this UTC date (in minutes)
  const offset = getSydneyOffset(date);
  
  // Convert to Sydney local by adding offset (offset is in minutes, convert to ms)
  const sydneyTime = date.getTime() + offset * 60000;
  const sydneyDate = new Date(sydneyTime);
  
  // Use UTC methods because we've already adjusted the time
  const year = sydneyDate.getUTCFullYear();
  const month = String(sydneyDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(sydneyDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Convert UTC ISO string to Sydney local time string (HH:mm)
 */
export function utcToSydneyTime(utcISOString) {
  const date = new Date(utcISOString);
  
  // Get offset for this UTC date (in minutes)
  const offset = getSydneyOffset(date);
  
  // Convert to Sydney local by adding offset
  const sydneyTime = date.getTime() + offset * 60000;
  const sydneyDate = new Date(sydneyTime);
  
  // Use UTC methods because we've already adjusted the time
  const hours = String(sydneyDate.getUTCHours()).padStart(2, '0');
  const minutes = String(sydneyDate.getUTCMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Get today's date in Sydney local time (YYYY-MM-DD)
 */
export function getSydneyToday() {
  const now = new Date();
  return utcToSydneyDate(now.toISOString());
}

/**
 * Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday) from a date string (YYYY-MM-DD)
 * Treats the date string as a Sydney local date
 * Uses a formula that works regardless of browser timezone
 */
export function getDayOfWeekFromDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Use Zeller's congruence algorithm to calculate day of week
  // This works with date components directly, independent of timezone
  let m = month;
  let y = year;
  
  // Adjust for January and February (they are months 13 and 14 of previous year)
  if (m < 3) {
    m += 12;
    y -= 1;
  }
  
  const k = y % 100; // Year of century
  const j = Math.floor(y / 100); // Century
  
  // Zeller's congruence: day of week (0 = Saturday, 1 = Sunday, ..., 6 = Friday)
  // Note: The result can be negative, so we normalize it to 0-6 range
  let h = (day + Math.floor(13 * (m + 1) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7;
  
  // Normalize to positive range (0-6)
  if (h < 0) {
    h = h + 7;
  }
  
  // Convert to JavaScript format (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // Zeller: 0=Sat, 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri
  // JS:     0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Mapping: Zeller 0->6, 1->0, 2->1, 3->2, 4->3, 5->4, 6->5
  return (h + 6) % 7;
}

/**
 * Add days to a date string (YYYY-MM-DD) and return a new date string
 * Works purely with date arithmetic, avoiding timezone issues
 */
export function addDaysToDateString(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create a date object using UTC to avoid timezone conversion
  // We'll treat the input as if it were UTC, do the math, then extract the result
  const date = new Date(Date.UTC(year, month - 1, day + days));
  
  const newYear = date.getUTCFullYear();
  const newMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const newDay = String(date.getUTCDate()).padStart(2, '0');
  
  return `${newYear}-${newMonth}-${newDay}`;
}
