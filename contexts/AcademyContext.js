import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const AcademyContext = createContext(null);

/**
 * Get subdomain from hostname.
 * Example: airdroptennis.servestream.com → 'airdroptennis'
 * On native or localhost, returns null (use fallback / env).
 */
export function getSubdomainFromHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return null;
  const lower = hostname.split(':')[0].toLowerCase();
  const rootHosts = ['localhost', '127.0.0.1'];
  if (rootHosts.includes(lower)) return null;
  const parts = lower.split('.');
  if (parts.length >= 2) return parts[0];
  return null;
}

/**
 * Fetch academy by subdomain_prefix. Returns { id, name, subdomain_prefix, stripe_connect_id } or null.
 */
export async function fetchAcademyBySubdomain(supabaseClient, subdomain) {
  if (!subdomain) return null;
  const { data, error } = await supabaseClient
    .from('academies')
    .select('id, name, subdomain_prefix, stripe_connect_id')
    .eq('subdomain_prefix', subdomain)
    .maybeSingle();
  if (error) {
    console.warn('[AcademyContext] fetchAcademyBySubdomain error:', error.message);
    return null;
  }
  return data;
}

export function useAcademy() {
  const ctx = useContext(AcademyContext);
  if (!ctx) {
    throw new Error('useAcademy must be used within an AcademyProvider');
  }
  return ctx;
}

export function AcademyProvider({ children, fallbackSubdomain = null }) {
  const [academy, setAcademy] = useState(null);
  const [academyId, setAcademyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolveAcademy = useCallback(async (subdomain) => {
    const resolved = subdomain || fallbackSubdomain;
    if (!resolved) {
      setAcademy(null);
      setAcademyId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await fetchAcademyBySubdomain(supabase, resolved);
      setAcademy(row);
      setAcademyId(row?.id ?? null);
    } catch (e) {
      setError(e);
      setAcademy(null);
      setAcademyId(null);
    } finally {
      setLoading(false);
    }
  }, [fallbackSubdomain]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      resolveAcademy(fallbackSubdomain);
      return;
    }
    const hostname = window.location.hostname;
    const subdomain = getSubdomainFromHost(hostname);
    resolveAcademy(subdomain);
  }, [resolveAcademy]);

  const value = {
    academy,
    academyId,
    loading,
    error,
    refetch: () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        resolveAcademy(getSubdomainFromHost(window.location.hostname));
      } else {
        resolveAcademy(fallbackSubdomain);
      }
    },
  };

  return (
    <AcademyContext.Provider value={value}>
      {children}
    </AcademyContext.Provider>
  );
}

export default AcademyContext;
