/** Map app language codes to BCP 47 locale strings */
export function getLocale(language) {
  return language === 'zh-CN' ? 'zh-CN' : 'en-AU';
}

export function getGreetingKey(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'goodMorning';
  if (h < 17) return 'goodAfternoon';
  return 'goodEvening';
}

export function formatWeekdayShort(dateInput, language) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString(getLocale(language), { weekday: 'short' });
}

export function formatMonthShort(dateInput, language) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString(getLocale(language), { month: 'short' });
}

export function formatDayNumber(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.getDate();
}

export function formatDateShort(dateInput, language) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString(getLocale(language), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateMedium(dateInput, language) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString(getLocale(language), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(dateInput, language) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleTimeString(getLocale(language), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: language !== 'zh-CN',
  });
}

export function formatDurationFromHours(hours, t) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n === 1) return t('durationOneHour');
  if (Number.isInteger(n)) return t('durationHoursCount').replace('{{count}}', String(n));
  return t('durationHoursCount').replace('{{count}}', String(n));
}

export function formatDurationFromMinutes(minutes, t) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n === 60) return t('durationOneHour');
  if (n < 60) return t('minutes').replace('{{n}}', String(n));
  const hours = n / 60;
  if (Number.isInteger(hours)) return formatDurationFromHours(hours, t);
  return t('minutes').replace('{{n}}', String(n));
}

export function formatStreakWeeks(weeks, t) {
  const n = Number(weeks) || 0;
  if (n === 1) return t('weekStreak').replace('{{count}}', '1');
  return t('weeksStreak').replace('{{count}}', String(n));
}

export function getWeekdayLabels(language, style = 'short') {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2024, 0, 7 + i));
    return d.toLocaleDateString(getLocale(language), { weekday: style });
  });
}

export function formatMonthYear(dateInput, language) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString(getLocale(language), { month: 'long', year: 'numeric' });
}

export function formatRelativeBookingDay(dateInput, language, t) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t('today');
  if (diffDays === 1) return t('tomorrow');
  return t('inDays').replace('{{count}}', String(diffDays));
}
