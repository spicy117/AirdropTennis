/** Normalize a phone number for Twilio SMS (E.164). Defaults AU mobile format. */
export function normalizePhone(phone) {
  const trimmed = (phone || '').trim().replace(/[\s\-()]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('0')) return `+61${trimmed.slice(1)}`;
  if (trimmed.startsWith('61')) return `+${trimmed}`;
  return `+${trimmed}`;
}

/** Display-friendly phone formatting without mutating stored values. */
export function formatPhoneForDisplay(phone) {
  const raw = (phone || '').trim();
  if (!raw) return null;

  const normalized = normalizePhone(raw);

  if (normalized.startsWith('+61') && normalized.length === 12) {
    const local = `0${normalized.slice(3)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }

  if (normalized.startsWith('+') && normalized.length > 4) {
    return normalized.replace(/(\+\d{1,3})(\d+)/, (_, cc, rest) => {
      const grouped = rest.replace(/(\d{3,4})(?=\d)/g, '$1 ').trim();
      return `${cc} ${grouped}`;
    });
  }

  return raw;
}

export function getPhoneDisplayLabel(phone, noPhoneLabel = 'No phone number') {
  return formatPhoneForDisplay(phone) || noPhoneLabel;
}

export function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  return normalized.length >= 10 && /^\+[0-9]{9,15}$/.test(normalized);
}
