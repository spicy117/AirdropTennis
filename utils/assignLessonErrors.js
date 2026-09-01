/**
 * Map Supabase/Postgres booking errors to admin-friendly messages.
 * Raw SQL/constraint text must never reach the UI.
 */
export function mapBookingError(error) {
  const msg = (error?.message || error?.details || String(error || '')).toLowerCase();
  const code = (error?.code || '').toLowerCase();

  if (
    msg.includes('bookings_start_time_future') ||
    msg.includes('start_time') && msg.includes('future') ||
    msg.includes('check constraint') && msg.includes('start_time')
  ) {
    return 'That lesson time has already passed. Choose a later time.';
  }

  if (msg.includes('bookings_minimum_duration') || msg.includes('minimum duration')) {
    return 'The lesson duration is invalid for this service. Check the time and service selected.';
  }

  if (
    msg.includes('duplicate') ||
    msg.includes('unique') ||
    msg.includes('already exists') ||
    code === '23505'
  ) {
    return 'This time is no longer available. Choose another time.';
  }

  if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
    return 'One of the selected values is no longer valid. Refresh and try again.';
  }

  if (msg.includes('permission') || msg.includes('policy') || msg.includes('rls')) {
    return 'You do not have permission to assign this lesson.';
  }

  if (msg.includes('insufficient') || msg.includes('balance')) {
    return "The student's wallet balance is too low for this assignment.";
  }

  return "We couldn't assign this lesson. Please try again.";
}
