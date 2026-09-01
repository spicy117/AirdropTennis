import {
  addDaysToDateString,
  getDayOfWeekFromDateString,
  getSydneyToday,
  sydneyDateTimeToUTC,
  utcToSydneyDate,
} from './timezone';

export { getSydneyToday };

export function parseTimeStr(timeStr) {
  const match = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export function buildSingleBookingTimes(dateStr, timeStr, durationHours = 1) {
  const parsed = parseTimeStr(timeStr);
  if (!parsed || !dateStr?.trim()) return null;
  try {
    const startTime = sydneyDateTimeToUTC(dateStr.trim(), parsed.hours, parsed.minutes);
    const startDate = new Date(startTime);
    if (Number.isNaN(startDate.getTime())) return null;
    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
    return { startTime, endTime: endDate.toISOString() };
  } catch {
    return null;
  }
}

export function isPastSydneyDateTime(dateStr, timeStr) {
  const times = buildSingleBookingTimes(dateStr, timeStr, 1);
  if (!times) return false;
  return new Date(times.startTime).getTime() <= Date.now();
}

export function buildBulkSlots({
  bulkStartDate,
  bulkEndDate,
  bulkDaysOfWeek,
  bulkStartTime,
  bulkEndTime,
  durationHours,
  skipPast = true,
}) {
  const [startH, startM] = bulkStartTime.split(':').map(Number);
  const [endH, endM] = bulkEndTime.split(':').map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  const selectedDays = Object.entries(bulkDaysOfWeek)
    .filter(([, on]) => on)
    .map(([key]) => {
      const map = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      return map[key];
    });

  const slots = [];
  const uniqueDates = new Set();
  let current = bulkStartDate;

  while (current <= bulkEndDate) {
    const dow = getDayOfWeekFromDateString(current);
    if (selectedDays.includes(dow)) {
      uniqueDates.add(current);
      for (let m = startMinutes; m + durationHours * 60 <= endMinutes; m += durationHours * 60) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const startTime = sydneyDateTimeToUTC(current, h, min);
        if (skipPast && new Date(startTime).getTime() <= Date.now()) continue;
        const startDate = new Date(startTime);
        const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
        slots.push({
          dateStr: current,
          startTime,
          endTime: endDate.toISOString(),
          timeLabel: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
        });
      }
    }
    current = addDaysToDateString(current, 1);
  }

  return { slots, uniqueDates: [...uniqueDates].sort() };
}

export function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateTimeLabel(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  return `${formatDateLabel(dateStr)} · ${timeStr}`;
}

export function validateAssignForm(fields, mode, t) {
  const tr = (key, fallback) => (t ? t(key) : null) || fallback;
  const fieldErrors = {};
  const messages = {
    student: tr('assignLessonSelectStudent', 'Select a student.'),
    date: tr('assignLessonSelectDate', 'Choose a date.'),
    time: tr('assignLessonSelectTime', 'Choose a start time.'),
    dateTime: tr('assignLessonSelectDateTime', 'Choose a date and time.'),
    location: tr('assignLessonSelectLocation', 'Choose a location.'),
    service: tr('assignLessonSelectService', 'Choose a session.'),
    cost: tr('assignLessonEnterCost', 'Enter a valid cost.'),
    bulkRange: tr('assignLessonBulkRange', 'Choose a start and end date.'),
    bulkDays: tr('assignLessonBulkDays', 'Select at least one day of the week.'),
    bulkTime: tr('assignLessonBulkTime', 'End time must be after start time.'),
    past: tr('assignLessonPastTime', 'That lesson time has already passed. Choose a later time.'),
    invalidDateTime: tr('assignLessonInvalidDateTime', 'Invalid date or time.'),
  };

  if (!fields.selectedStudentId) fieldErrors.student = messages.student;
  if (!fields.locationId) fieldErrors.location = messages.location;
  if (!fields.selectedServiceId) fieldErrors.service = messages.service;

  const costNum = parseFloat(String(fields.cost).replace(/,/g, '.'));
  if (isNaN(costNum) || costNum < 0) fieldErrors.cost = messages.cost;

  if (mode === 'single') {
    if (!fields.dateStr?.trim()) fieldErrors.date = messages.date;
    if (!fields.timeStr?.trim()) fieldErrors.time = messages.time;
    else if (!parseTimeStr(fields.timeStr)) fieldErrors.time = messages.time;

    if (fields.dateStr?.trim() && fields.timeStr?.trim() && parseTimeStr(fields.timeStr)) {
      const svc = fields.service;
      const times = buildSingleBookingTimes(fields.dateStr, fields.timeStr, svc?.durationHours || 1);
      if (!times) fieldErrors.dateTime = messages.invalidDateTime;
      else if (isPastSydneyDateTime(fields.dateStr, fields.timeStr)) fieldErrors.time = messages.past;
    }
  } else {
    if (!fields.bulkStartDate || !fields.bulkEndDate) fieldErrors.bulkRange = messages.bulkRange;
    const anyDay = Object.values(fields.bulkDaysOfWeek || {}).some(Boolean);
    if (!anyDay) fieldErrors.bulkDays = messages.bulkDays;

    const [startH, startM] = (fields.bulkStartTime || '').split(':').map(Number);
    const [endH, endM] = (fields.bulkEndTime || '').split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);
    if (endMinutes <= startMinutes) fieldErrors.bulkTime = messages.bulkTime;
  }

  const count = Object.keys(fieldErrors).length;
  const summary =
    count === 0
      ? null
      : count === 1
        ? tr('assignLessonCompleteOneField', 'Complete 1 required field')
        : tr('assignLessonCompleteNFields', `Complete ${count} required fields`).replace('{{count}}', String(count));

  return { valid: count === 0, fieldErrors, summary, costNum };
}
