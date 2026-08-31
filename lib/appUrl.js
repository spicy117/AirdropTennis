import { Platform } from 'react-native';

/** Canonical production host — used only as last-resort fallback, not hard-coded into all redirects. */
export const PRODUCTION_APP_URL = 'https://app.airdroptennis.com';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function normalizeOrigin(url) {
  if (!url || typeof url !== 'string') return null;
  return url.replace(/\/$/, '');
}

function parseHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function isLocalhostUrl(url) {
  if (!url) return false;
  const host = parseHostname(url);
  if (host) return LOCAL_HOSTS.has(host);
  return /localhost|127\.0\.0\.1/.test(url);
}

/**
 * Build-time / deploy-time app URL from environment (Vercel, Expo, etc.).
 * Set EXPO_PUBLIC_APP_URL=https://app.airdroptennis.com in production.
 */
export function getConfiguredAppUrl() {
  const fromEnv =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_APP_URL) ||
    (typeof process !== 'undefined' && process.env?.APP_URL) ||
    null;
  return normalizeOrigin(fromEnv);
}

/**
 * Origin used for Supabase auth redirects (signup confirm, password reset, resend).
 *
 * Priority:
 * 1. Browser runtime origin when it is a real deployed host (production or preview)
 * 2. Configured EXPO_PUBLIC_APP_URL / APP_URL (required for native; safety net on web)
 * 3. localhost when developing in the browser
 * 4. Production canonical URL as last resort
 */
export function getAppOrigin() {
  const configured = getConfiguredAppUrl();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const runtime = normalizeOrigin(window.location.origin);
    if (runtime && !isLocalhostUrl(runtime)) {
      return runtime;
    }
    if (runtime && isLocalhostUrl(runtime)) {
      return runtime;
    }
  }

  if (configured && !isLocalhostUrl(configured)) {
    return configured;
  }

  if (configured && isLocalhostUrl(configured)) {
    return configured;
  }

  return PRODUCTION_APP_URL;
}

/**
 * Full URL for Supabase emailRedirectTo / redirectTo.
 * @param {string} [path='/'] - App path, e.g. '/reset-password'
 */
export function getAuthRedirectUrl(path = '/') {
  const origin = getAppOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}
