import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Replace these with your Supabase project URL and anon key
// You can find these in your Supabase project settings
// IMPORTANT: Use the "anon" or "public" key, NOT the "service_role" or "secret" key!
// The anon key is safe to use in client-side code. The secret key bypasses all security.
export const SUPABASE_URL = 'https://rozxeqqwxpnfqbyvtvch.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvenhlcXF3eHBuZnFieXZ0dmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDMyMjAsImV4cCI6MjA5NTI3OTIyMH0.B3yitpbI_JWRiBpkYfZG2D4CIH5AGrjgn_lgIBjjK-4'; // Replace with your anon/public key from Supabase dashboard

/** Supabase auth token key in storage (sb-<project-ref>-auth-token). */
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${SUPABASE_URL.replace('https://', '').split('.')[0]}-auth-token`;

export function isAuthSessionMissingError(error) {
  if (!error) return false;
  const name = String(error.name || '');
  const message = String(error.message || '').toLowerCase();
  return name === 'AuthSessionMissingError' || message.includes('auth session missing');
}

// Use AsyncStorage for native platforms, localStorage for web
const storage = Platform.OS === 'web' 
  ? {
      getItem: (key) => {
        if (typeof window !== 'undefined') {
          return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key, value) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key) => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
        return Promise.resolve();
      },
    }
  : AsyncStorage;

/** Remove persisted Supabase session when signOut cannot run (expired/missing session). */
export async function clearPersistedAuthSession() {
  await storage.removeItem(SUPABASE_AUTH_STORAGE_KEY);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
      .forEach((key) => window.localStorage.removeItem(key));
  }
}

// Custom fetch with timeout wrapper
const fetchWithTimeout = (url, options = {}) => {
  // Only apply timeout on web platform
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof AbortController === 'undefined') {
    return fetch(url, options);
  }
  
  const urlString = typeof url === 'string' ? url : url?.toString?.() || '';
  const isAuthRequest = urlString.includes('/auth/v1/');
  const isFunctionRequest = urlString.includes('/functions/v1/');
  const timeoutMs = isAuthRequest || isFunctionRequest ? 25000 : 10000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  const fetchPromise = fetch(url, {
    ...options,
    signal: controller.signal,
  });
  
  fetchPromise.finally(() => {
    clearTimeout(timeoutId);
  });
  
  return fetchPromise.catch((error) => {
    if (error.name === 'AbortError' || error.message === 'The user aborted a request.') {
      const timeoutError = new Error(`Request timeout after ${timeoutMs / 1000} seconds`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  });
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

// Validate configuration on import (web only)
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  if (SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE' || !SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_ANON_KEY is not set! Please configure it in lib/supabase.js');
  } else if (SUPABASE_ANON_KEY.startsWith('sb_secret_') || SUPABASE_ANON_KEY.includes('service_role')) {
    console.error('❌ You are using a SECRET key! Use the ANON/PUBLIC key instead.');
    console.error('Get your anon key from: Settings → API → anon public');
  }
}
