import { supabase } from '../lib/supabase';
import { mergeCreditLedger } from './creditLedger';

const FETCH_LIMIT = 50;

function buildAdminMap(profiles) {
  const adminMap = {};
  (profiles || []).forEach((p) => {
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || p.email || 'Admin';
    adminMap[p.id] = name;
  });
  return adminMap;
}

function describeLoadError(label, error) {
  if (!error) return null;
  const code = error.code || '';
  const message = error.message || 'Unknown error';
  console.warn(`${label} load failed:`, error);
  if (code === 'PGRST116' || code === '42501' || message.toLowerCase().includes('permission')) {
    return `${label}: permission denied. Run migration 023 in Supabase SQL Editor.`;
  }
  if (code === '42703' || message.toLowerCase().includes('column')) {
    return `${label}: schema mismatch (${message}).`;
  }
  if (code === 'PGRST205') {
    return `${label}: table not found or not exposed to API.`;
  }
  return `${label}: ${message}`;
}

/**
 * Load and merge credit history for one student (admin-only tables).
 * @param {string} studentId
 * @returns {Promise<{ items: object[], error: string|null }>}
 */
export async function loadStudentCreditHistory(studentId) {
  const [txRes, stripeRes, bookingsRes, cancelRes, rainRes, adminRes] = await Promise.all([
    supabase
      .from('wallet_transactions')
      .select('id, delta, direction, balance_after, reason, note, source, created_at, created_by')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT),
    supabase
      .from('stripe_processed_sessions')
      .select('session_id, user_id, amount, type, created_at')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT),
    supabase
      .from('bookings')
      .select('id, credit_cost, service_name, start_time, created_at, locations(name)')
      .eq('user_id', studentId)
      .gt('credit_cost', 0)
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT),
    supabase
      .from('user_cancellation_history')
      .select('id, credit_cost, service_name, location_name, cancelled_at, reason')
      .eq('user_id', studentId)
      .gt('credit_cost', 0)
      .order('cancelled_at', { ascending: false })
      .limit(FETCH_LIMIT),
    supabase
      .from('rain_check_history')
      .select('id, credit_cost, service_name, location_name, cancelled_at, reason')
      .eq('user_id', studentId)
      .gt('credit_cost', 0)
      .order('cancelled_at', { ascending: false })
      .limit(FETCH_LIMIT),
    supabase.from('profiles').select('id, first_name, last_name, full_name, email').eq('role', 'admin'),
  ]);

  const errors = [
    describeLoadError('Manual adjustments', txRes.error),
    describeLoadError('Online deposits', stripeRes.error),
    describeLoadError('Bookings', bookingsRes.error),
    describeLoadError('Cancellations', cancelRes.error),
    describeLoadError('Rain checks', rainRes.error),
  ].filter(Boolean);

  const adminMap = buildAdminMap(adminRes.data);

  const items = mergeCreditLedger({
    walletTransactions: txRes.error ? [] : txRes.data || [],
    stripeSessions: stripeRes.error ? [] : stripeRes.data || [],
    bookings: bookingsRes.error ? [] : bookingsRes.data || [],
    userCancellations: cancelRes.error ? [] : cancelRes.data || [],
    rainChecks: rainRes.error ? [] : rainRes.data || [],
    adminMap,
  });

  return {
    items,
    error: items.length === 0 && errors.length > 0 ? errors.join(' ') : null,
  };
}
