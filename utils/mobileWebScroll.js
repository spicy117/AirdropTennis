import { Platform } from 'react-native';

const POST_AUTH_SCROLL_KEY = 'airdrop_post_auth_scroll_reset';

/** Mark that the next Home render should reset scroll (after successful sign-in). */
export function markPostAuthScrollReset() {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(POST_AUTH_SCROLL_KEY, '1');
  }
}

/** Returns true while a post-auth scroll reset is pending (does not clear the flag). */
export function shouldResetPostAuthScroll() {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(POST_AUTH_SCROLL_KEY) === '1';
}

/** Returns true once per sign-in; clears the flag when read. */
export function consumePostAuthScrollReset() {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return false;
  const shouldReset = sessionStorage.getItem(POST_AUTH_SCROLL_KEY) === '1';
  if (shouldReset) {
    sessionStorage.removeItem(POST_AUTH_SCROLL_KEY);
  }
  return shouldReset;
}

export function blurActiveElement() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active && active !== document.body && typeof active.blur === 'function') {
    active.blur();
  }
}

export function resetWebScrollPosition() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch {
    window.scrollTo(0, 0);
  }

  if (typeof document !== 'undefined') {
    document.documentElement && (document.documentElement.scrollTop = 0);
    document.body && (document.body.scrollTop = 0);
  }
}

export function resetElementScroll(node) {
  if (!node) return;
  if (typeof node.scrollTo === 'function') {
    try {
      node.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      node.scrollTo(0, 0);
    }
  }
  if (typeof node.scrollTop === 'number') {
    node.scrollTop = 0;
  }
}

/**
 * Blur focused inputs and allow the mobile keyboard viewport to begin settling
 * before route transition. Uses rAF — no arbitrary timeouts.
 */
export function prepareForPostAuthNavigation() {
  blurActiveElement();
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

/**
 * Reset window scroll after authentication. Temporarily disables browser scroll
 * restoration so /home does not reopen at a remembered position.
 */
export function resetScrollAfterAuth() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const previousRestoration =
    typeof history !== 'undefined' && 'scrollRestoration' in history
      ? history.scrollRestoration
      : null;

  if (previousRestoration != null) {
    history.scrollRestoration = 'manual';
  }

  resetWebScrollPosition();

  requestAnimationFrame(() => {
    resetWebScrollPosition();
    if (previousRestoration != null) {
      history.scrollRestoration = previousRestoration;
    }
  });
}

/** Ensure a single correct viewport meta tag (no user-scalable=no). */
export function ensureViewportMeta() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  const existing = document.querySelectorAll('meta[name="viewport"]');
  let primary = existing[0];

  if (!primary) {
    primary = document.createElement('meta');
    primary.setAttribute('name', 'viewport');
    document.head.appendChild(primary);
  }

  primary.setAttribute('content', content);

  for (let i = 1; i < existing.length; i += 1) {
    existing[i].parentNode?.removeChild(existing[i]);
  }
}
