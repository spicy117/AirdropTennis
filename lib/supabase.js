import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Replace these with your Supabase project URL and anon key
// You can find these in your Supabase project settings
// IMPORTANT: Use the "anon" or "public" key, NOT the "service_role" or "secret" key!
// The anon key is safe to use in client-side code. The secret key bypasses all security.
export const SUPABASE_URL = 'https://qdlzumzkhbnxpkprbuju.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbHp1bXpraGJueHBrcHJidWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzcyOTQsImV4cCI6MjA4MzkxMzI5NH0.eT8PBsjdPxRodqIf5e_JRKVV-PztvkG06DDaKjc7fas'; // Replace with your anon/public key from Supabase dashboard

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

// Custom fetch with timeout wrapper
const fetchWithTimeout = (url, options = {}) => {
  // Only apply timeout on web platform
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof AbortController === 'undefined') {
    return fetch(url, options);
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 8000); // 8 second timeout
  
  const fetchPromise = fetch(url, {
    ...options,
    signal: controller.signal,
  });
  
  fetchPromise.finally(() => {
    clearTimeout(timeoutId);
  });
  
  return fetchPromise.catch((error) => {
    if (error.name === 'AbortError' || error.message === 'The user aborted a request.') {
      const timeoutError = new Error('Request timeout after 8 seconds');
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
