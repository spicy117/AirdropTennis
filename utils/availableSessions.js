import { supabase } from '../lib/supabase';
import {
  getSydneyToday,
  sydneyDateToUTCStart,
  sydneyDateToUTCEnd,
  utcToSydneyDate,
  utcToSydneyTime,
} from './timezone';
import { calculateBookingCost } from './pricing';
import { SERVICE_NAME_TO_ID, getServiceDurationHours } from './serviceTranslations';

const SERVICE_DURATION_HOURS = {
  'Boot Camp': 3,
  'Stroke Clinic': 1,
  'UTR Points Play': 2,
  'UTR Points': 2,
  'Private Lessons': 1,
  'Private Lesson': 1,
};

export const SERVICE_FILTER_OPTIONS = [
  { key: 'all', dbName: null, labelKey: 'filterAllSessions' },
  { key: 'private', dbName: 'Private Lessons', labelKey: 'filterPrivate' },
  { key: 'clinic', dbName: 'Stroke Clinic', labelKey: 'filterClinic' },
  { key: 'bootcamp', dbName: 'Boot Camp', labelKey: 'filterBootCamp' },
  { key: 'utr', dbName: 'UTR Points Play', labelKey: 'filterUtr' },
];

export const PERIOD_OPTIONS = [
  { key: 'today', labelKey: 'filterToday' },
  { key: 'thisWeek', labelKey: 'filterThisWeek' },
  { key: 'nextWeek', labelKey: 'filterNextWeek' },
];

function getDurationHours(serviceName) {
  if (SERVICE_DURATION_HOURS[serviceName] != null) return SERVICE_DURATION_HOURS[serviceName];
  const id = SERVICE_NAME_TO_ID[serviceName];
  return id ? getServiceDurationHours(id) : 1;
}

function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function getDateRangeForPeriod(period, todayStr = getSydneyToday()) {
  switch (period) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };
    case 'nextWeek':
      return { startDate: addDaysToDateStr(todayStr, 7), endDate: addDaysToDateStr(todayStr, 13) };
    case 'thisWeek':
    default:
      return { startDate: todayStr, endDate: addDaysToDateStr(todayStr, 6) };
  }
}

function addMinutesToTime24(time24, minutes) {
  const [h, m] = time24.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function availabilityToSlot(av) {
  return {
    id: av.id,
    time24: utcToSydneyTime(av.start_time),
    startTime: av.start_time,
    endTime: av.end_time,
    locationId: av.location_id,
    locationName: av.locations?.name || '',
    serviceName: av.service_name || 'Private Lessons',
  };
}

function findConsecutiveSlots(slots, startSlot, count) {
  const sorted = [...slots].sort((a, b) => a.time24.localeCompare(b.time24));
  const result = [startSlot];
  let current = startSlot;
  for (let i = 1; i < count; i++) {
    const nextTime = addMinutesToTime24(current.time24, 30);
    const next = sorted.find((s) => s.time24 === nextTime);
    if (!next) return null;
    result.push(next);
    current = next;
  }
  return result;
}

/** Turn raw 30-min availability rows into bookable sessions (matches booking-discovery rules). */
export function buildBookableSessions(availabilities) {
  const groups = {};

  for (const av of availabilities) {
    const dateStr = utcToSydneyDate(av.start_time);
    const serviceName = av.service_name || 'Private Lessons';
    const key = `${dateStr}::${av.location_id}::${serviceName}`;
    if (!groups[key]) {
      groups[key] = {
        dateStr,
        serviceName,
        locationId: av.location_id,
        locationName: av.locations?.name || '',
        slots: [],
      };
    }
    groups[key].slots.push(availabilityToSlot(av));
  }

  const sessions = [];
  const usedSlotIds = new Set();

  Object.values(groups).forEach((group) => {
    const requiredCount = getDurationHours(group.serviceName) * 2;
    const sorted = group.slots.sort((a, b) => a.time24.localeCompare(b.time24));

    for (const slot of sorted) {
      if (usedSlotIds.has(slot.id)) continue;
      const chain = findConsecutiveSlots(sorted, slot, requiredCount);
      if (!chain) continue;

      chain.forEach((s) => usedSlotIds.add(s.id));
      const durationHours = getDurationHours(group.serviceName);
      sessions.push({
        id: `${group.dateStr}-${group.locationId}-${group.serviceName}-${slot.time24}`,
        dateStr: group.dateStr,
        time24: slot.time24,
        startTime: slot.startTime,
        locationId: group.locationId,
        locationName: group.locationName,
        serviceName: group.serviceName,
        durationHours,
        price: calculateBookingCost(group.serviceName, durationHours),
        firstSlotId: slot.id,
      });
    }
  });

  return sessions.sort((a, b) => {
    const d = a.dateStr.localeCompare(b.dateStr);
    if (d !== 0) return d;
    return a.time24.localeCompare(b.time24);
  });
}

export async function fetchAvailabilitiesInRange({ startDate, endDate, serviceFilter, locationId }) {
  const startOfDay = sydneyDateToUTCStart(startDate);
  const endOfDay = sydneyDateToUTCEnd(endDate);

  let query = supabase
    .from('availabilities')
    .select(`
      *,
      locations:location_id (id, name, address, latitude, longitude)
    `)
    .eq('is_booked', false)
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())
    .order('start_time', { ascending: true });

  if (locationId) query = query.eq('location_id', locationId);
  if (serviceFilter) query = query.eq('service_name', serviceFilter);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export function groupSessionsByDate(sessions) {
  const map = new Map();
  for (const session of sessions) {
    if (!map.has(session.dateStr)) map.set(session.dateStr, []);
    map.get(session.dateStr).push(session);
  }
  return Array.from(map.entries()).map(([dateStr, items]) => ({ dateStr, sessions: items }));
}
