/** Round to 2 decimal places for wallet currency display/calculation. */
export function roundWalletAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function formatWalletAmount(amount) {
  return `$${roundWalletAmount(amount).toFixed(2)}`;
}

export function parseWalletInput(value) {
  const cleaned = String(value || '').replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = roundWalletAmount(parseFloat(cleaned));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function mapWalletRpcError(error) {
  const code = String(error?.code || '');
  const msg = String(error?.message || error || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  const combined = `${msg} ${hint}`;

  if (msg.includes('wallet_transactions_schema_unsupported')) {
    return 'Credit could not be updated. No changes were made.';
  }
  if (msg.includes('rpc_not_deployed') || combined.includes('migration 018')) {
    return 'Credit adjustment is not set up on the server. Run migration 018 in Supabase SQL Editor, then deploy the admin-adjust-wallet Edge Function.';
  }
  if (
    code === 'PGRST202' ||
    combined.includes('could not find the function') ||
    combined.includes('admin-adjust-wallet') ||
    (code === 'PGRST205' && combined.includes('wallet_transactions'))
  ) {
    // Logged in adminAdjustWallet; keep UI generic for missing server setup.
    return 'Credit could not be updated. No changes were made.';
  }

  if (msg.includes('invalid_amount') || code === 'invalid_amount') {
    return 'Enter an amount greater than $0.';
  }
  if (msg.includes('insufficient_balance') || code === 'insufficient_balance') {
    return 'This adjustment would reduce the balance below $0.';
  }
  if (msg.includes('permission_denied') || code === 'permission_denied') {
    return "You don't have permission to change this student's credit.";
  }
  if (msg.includes('reason_required') || code === 'reason_required') {
    return 'Please select a reason for this adjustment.';
  }
  if (msg.includes('note_required_for_other') || code === 'note_required_for_other') {
    return 'Please add a short note when reason is Other.';
  }
  if (msg.includes('user_not_found') || code === 'user_not_found') {
    return 'Student not found.';
  }
  if (msg.includes('not_authenticated') || code === 'not_authenticated') {
    return 'You must be signed in as an admin.';
  }

  return 'Credit could not be updated. No changes were made.';
}

export const CREDIT_ADJUSTMENT_REASONS = [
  'Cash payment',
  'Payment correction',
  'Refund / credit return',
  'Booking correction',
  'Complimentary credit',
  'Other',
];
