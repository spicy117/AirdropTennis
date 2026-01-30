/**
 * Academy-scoped Supabase helpers: auto-include academy_id on INSERT
 * and filter by academy_id on SELECT.
 *
 * Usage:
 *   const { insertWithAcademy, selectWithAcademy } = useAcademySupabase();
 *   await insertWithAcademy('bookings', { user_id, location_id, ... });
 *   const { data } = await selectWithAcademy('bookings').select('*');
 *
 * Or use the hook from a component that’s inside AcademyProvider:
 *   const scoped = useAcademySupabase();
 *   scoped.from('bookings').insert({ ... })  // merges academy_id
 *   scoped.from('bookings').select('*')       // adds .eq('academy_id', id)
 */

import { supabase } from './supabase';

/**
 * Get a scoped client that:
 * - On insert: merges academy_id into the payload.
 * - On select/update/delete: applies .eq('academy_id', academyId) when the table
 *   is one of the tenant-scoped tables.
 */
export function createAcademyScopedClient(academyId) {
  const TENANT_TABLES = new Set([
    'profiles',
    'locations',
    'bookings',
    'availabilities',
    'booking_requests',
    'courts',
    'court_types',
  ]);

  function isTenantTable(table) {
    return TENANT_TABLES.has(table);
  }

  return {
    from(table) {
      const base = supabase.from(table);
      const tableLower = (table || '').toLowerCase();

      return {
        select(...args) {
          const q = base.select(...args);
          if (academyId && isTenantTable(tableLower)) {
            return q.eq('academy_id', academyId);
          }
          return q;
        },
        insert(values, options) {
          const payload = Array.isArray(values)
            ? values.map((row) => ({ ...row, ...(academyId && isTenantTable(tableLower) ? { academy_id: academyId } : {}) }))
            : { ...values, ...(academyId && isTenantTable(tableLower) ? { academy_id: academyId } : {}) };
          return base.insert(payload, options);
        },
        update(values, options) {
          let chain = base.update(values, options);
          if (academyId && isTenantTable(tableLower)) {
            chain = chain.eq('academy_id', academyId);
          }
          return chain;
        },
        delete(options) {
          let chain = base.delete(options);
          if (academyId && isTenantTable(tableLower)) {
            chain = chain.eq('academy_id', academyId);
          }
          return chain;
        },
      };
    },
    get academyId() {
      return academyId;
    },
  };
}

/**
 * Hook-friendly factory: call with academyId from useAcademy().
 * Returns a scoped client and raw supabase for non-tenant tables.
 *
 * In a component:
 *   const { academyId } = useAcademy();
 *   const scoped = useMemo(() => createAcademyScopedClient(academyId), [academyId]);
 */
export { createAcademyScopedClient as getAcademyScopedClient };
