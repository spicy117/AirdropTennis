import { formatWalletAmount, roundWalletAmount } from './wallet';

/** @typedef {'all' | 'deposits' | 'admin' | 'bookings' | 'refunds'} CreditLedgerFilter */

export const CREDIT_LEDGER_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'deposits', label: 'Deposits' },
  { id: 'admin', label: 'Admin adjustments' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'refunds', label: 'Refunds' },
];

const REFUND_REASON = 'Refund / credit return';
const MANUAL_REFUND_DEDUP_MS = 10 * 60 * 1000;

export function formatLedgerDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLedgerTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatLedgerDateTime(iso) {
  if (!iso) return '';
  return `${formatLedgerDate(iso)} · ${formatLedgerTime(iso)}`;
}

export function formatLedgerAmount(delta) {
  const n = Number(delta) || 0;
  const prefix = n >= 0 ? '+' : '−';
  return `${prefix}${formatWalletAmount(Math.abs(n))}`;
}

/** Safe shortened provider reference — never full secrets. */
export function shortenReference(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  if (s.length <= 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function getLedgerTypeLabel(type) {
  switch (type) {
    case 'manual_admin_adjustment':
      return 'Admin adjustment';
    case 'online_topup':
      return 'Online deposit';
    case 'booking_deduction':
      return 'Lesson booking';
    case 'booking_refund':
      return 'Booking refund';
    case 'failed_payment':
      return 'Failed payment';
    default:
      return 'Credit activity';
  }
}

function resolveAdminName(createdById, adminMap) {
  if (!createdById) return null;
  if (typeof createdById === 'string') return adminMap?.[createdById] || 'Admin';
  const name = [createdById.first_name, createdById.last_name].filter(Boolean).join(' ');
  return name || createdById.full_name || createdById.email || 'Admin';
}

function manualAdjustmentTitle(row) {
  return row.reason || 'Manual credit adjustment';
}

function isManualRefundDuplicate(manualRows, refundRow) {
  const refundAmount = Math.abs(Number(refundRow.credit_cost) || 0);
  if (refundAmount <= 0) return false;
  const refundAt = new Date(refundRow.cancelled_at).getTime();

  return manualRows.some((tx) => {
    if (tx.reason !== REFUND_REASON) return false;
    const txAmount = Math.abs(Number(tx.delta) || 0);
    if (Math.abs(txAmount - refundAmount) > 0.009) return false;
    const txAt = new Date(tx.created_at).getTime();
    return Math.abs(txAt - refundAt) <= MANUAL_REFUND_DEDUP_MS;
  });
}

/**
 * Map wallet_transactions row (manual admin adjustments only).
 * @param {object} row
 * @param {Record<string, string>} adminMap
 */
export function mapManualAdjustment(row, adminMap) {
  let delta = Number(row.delta);
  if (!Number.isFinite(delta) && row.amount != null) {
    const amt = Math.abs(Number(row.amount) || 0);
    delta = row.direction === 'remove' ? -amt : amt;
  }

  const balanceAfter = row.balance_after != null ? Number(row.balance_after) : null;

  return {
    id: `tx-${row.id}`,
    occurredAt: row.created_at,
    delta,
    balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : null,
    type: 'manual_admin_adjustment',
    category: 'admin',
    title: manualAdjustmentTitle(row),
    subtitle: null,
    typeLabel: getLedgerTypeLabel('manual_admin_adjustment'),
    adminName: resolveAdminName(row.created_by, adminMap),
    reason: row.reason || null,
    note: row.note || null,
    paymentMethod: null,
    reference: null,
    locationName: null,
    status: 'success',
  };
}

/** Map stripe_processed_sessions row (successful top-ups only). */
export function mapStripeTopup(row) {
  const amount = roundWalletAmount(Number(row.amount) || 0);
  const sessionType = String(row.type || 'topup').toLowerCase();
  if (amount <= 0) return null;
  // Wallet credit only for top-ups; booking sessions are recorded with amount 0 or type booking.
  if (sessionType === 'booking') return null;

  return {
    id: `stripe-${row.session_id}`,
    occurredAt: row.created_at,
    delta: amount,
    balanceAfter: null,
    type: 'online_topup',
    category: 'deposits',
    title: 'Online deposit',
    subtitle: null,
    typeLabel: getLedgerTypeLabel('online_topup'),
    adminName: null,
    reason: null,
    note: null,
    paymentMethod: 'Card',
    reference: shortenReference(row.session_id),
    referenceFull: row.session_id,
    locationName: null,
    status: 'success',
  };
}

/** Map cancellation / rain-check history row as credit return. */
export function mapCancellationRefund(row, source) {
  const amount = roundWalletAmount(Number(row.credit_cost) || 0);
  if (amount <= 0) return null;

  const isRainCheck = source === 'rain_check' || row.reason === 'rain_check';
  const service = row.service_name || 'Lesson';
  const title = isRainCheck ? 'Rain check refund' : 'Booking cancellation refund';

  return {
    id: `${source}-${row.id}`,
    occurredAt: row.cancelled_at,
    delta: amount,
    balanceAfter: null,
    type: 'booking_refund',
    category: 'refunds',
    title,
    subtitle: service,
    typeLabel: getLedgerTypeLabel('booking_refund'),
    adminName: null,
    reason: row.reason || (isRainCheck ? 'Rain check' : 'Cancellation'),
    note: null,
    paymentMethod: null,
    reference: null,
    locationName: row.location_name || null,
    status: 'success',
  };
}

/**
 * Merge ledger sources into one chronological list (newest first).
 * Does not include booking deductions — no reliable wallet audit trail exists.
 */
export function mergeCreditLedger({
  walletTransactions = [],
  stripeSessions = [],
  userCancellations = [],
  rainChecks = [],
  adminMap = {},
}) {
  const manualRows = walletTransactions.filter(
    (row) => row.source === 'manual_admin_adjustment' || !row.source
  );

  const manualItems = manualRows.map((row) => mapManualAdjustment(row, adminMap));

  const stripeItems = stripeSessions
    .map(mapStripeTopup)
    .filter(Boolean);

  const refundItems = [
    ...userCancellations
      .filter((row) => !isManualRefundDuplicate(manualRows, row))
      .map((row) => mapCancellationRefund(row, 'cancel')),
    ...rainChecks
      .filter((row) => !isManualRefundDuplicate(manualRows, row))
      .map((row) => mapCancellationRefund(row, 'rain_check')),
  ].filter(Boolean);

  return [...manualItems, ...stripeItems, ...refundItems].sort(
    (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)
  );
}

/** @param {CreditLedgerFilter} filter */
export function filterLedgerItems(items, filter) {
  if (!filter || filter === 'all') return items;
  switch (filter) {
    case 'deposits':
      return items.filter((item) => item.category === 'deposits');
    case 'admin':
      return items.filter((item) => item.category === 'admin');
    case 'bookings':
      return items.filter((item) => item.category === 'bookings');
    case 'refunds':
      return items.filter((item) => item.category === 'refunds');
    default:
      return items;
  }
}

export const LEDGER_PAGE_SIZE = 20;
