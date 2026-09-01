/** Stable service identifiers → translation keys for names/descriptions */
export const SERVICE_ID_KEYS = {
  'stroke-clinic': { name: 'serviceStrokeClinic', desc: 'serviceStrokeClinicDesc' },
  'boot-camp': { name: 'serviceBootCamp', desc: 'serviceBootCampDesc' },
  'private-lessons': { name: 'servicePrivateLessons', desc: 'servicePrivateLessonsDesc' },
  'utr-points-play': { name: 'serviceUtrPoints', desc: 'serviceUtrPointsDesc' },
};

/** English DB / config names → service id */
export const SERVICE_NAME_TO_ID = {
  'Stroke Clinic': 'stroke-clinic',
  'Boot Camp': 'boot-camp',
  'Private Lessons': 'private-lessons',
  'UTR Points': 'utr-points-play',
  'UTR Points Play': 'utr-points-play',
};

export function translateServiceName(name, t, fallback = '') {
  if (!name) return fallback;
  const id = SERVICE_NAME_TO_ID[name];
  if (id && SERVICE_ID_KEYS[id]?.name) return t(SERVICE_ID_KEYS[id].name);
  return name;
}

export function translateServiceDescription(nameOrId, t, fallback = '') {
  const id = SERVICE_NAME_TO_ID[nameOrId] || nameOrId;
  if (id && SERVICE_ID_KEYS[id]?.desc) return t(SERVICE_ID_KEYS[id].desc);
  return fallback;
}

export function getServiceDurationHours(serviceIdOrName) {
  const id = SERVICE_NAME_TO_ID[serviceIdOrName] || serviceIdOrName;
  const map = {
    'stroke-clinic': 1,
    'boot-camp': 3,
    'private-lessons': 1,
    'utr-points-play': 2,
  };
  return map[id] || 1;
}
