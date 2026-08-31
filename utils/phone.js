/** Normalize a phone number for Twilio SMS (E.164). Defaults AU mobile format. */
export function normalizePhone(phone) {
  const trimmed = (phone || '').trim().replace(/[\s\-()]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('0')) return `+61${trimmed.slice(1)}`;
  if (trimmed.startsWith('61')) return `+${trimmed}`;
  return `+${trimmed}`;
}

export function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  return normalized.length >= 10 && /^\+[0-9]{9,15}$/.test(normalized);
}
