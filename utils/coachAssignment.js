import { getSydneyToday, addDaysToDateString, utcToSydneyDate } from './timezone';

/** Coach is stored on each booking row (`bookings.coach_id`). Sessions are grouped client-side. */
export function buildSessionKey(booking) {
  return `${booking.location_id}_${booking.start_time}_${booking.end_time}`;
}

export function bookingNeedsCoach(booking) {
  return !booking?.coach_id;
}

export function sessionNeedsCoach(session) {
  if (session?.bookings?.length) {
    return session.bookings.some((b) => !b.coach_id);
  }
  return !session?.coachId;
}

export async function loadCoaches(supabase) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('role', 'coach')
    .order('first_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchUpcomingBookings(supabase) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      locations:location_id (id, name)
    `)
    .gte('end_time', now)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data || [];
}

function groupRawBookingsIntoSessions(bookings) {
  const sessionMap = new Map();

  for (const booking of bookings) {
    const sessionKey = buildSessionKey(booking);
    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, {
        sessionKey,
        key: sessionKey,
        locationId: booking.location_id,
        locationName: booking.locations?.name || 'Unknown Location',
        startTime: booking.start_time,
        endTime: booking.end_time,
        serviceName: booking.service_name || 'Tennis Session',
        bookings: [],
        coachId: null,
        coachName: null,
        students: [],
        studentNames: [],
      });
    }
    const session = sessionMap.get(sessionKey);
    session.bookings.push(booking);
    if (booking.coach_id && !session.coachId) {
      session.coachId = booking.coach_id;
    }
  }

  return Array.from(sessionMap.values());
}

async function enrichSession(supabase, session) {
  const studentNames = [];
  const students = [];

  for (const booking of session.bookings) {
    let studentName = 'Unknown Student';
    if (booking.user_id) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', booking.user_id)
          .single();
        if (!error && profile) {
          const firstName = profile.first_name || null;
          const lastName = profile.last_name || null;
          if (firstName || lastName) {
            studentName = [firstName, lastName].filter(Boolean).join(' ');
          } else {
            studentName = profile.email || 'Unknown Student';
          }
        }
      } catch (err) {
        console.error('Error fetching student profile:', err);
      }
    }
    studentNames.push(studentName);
    if (booking.user_id && !students.find((s) => s.id === booking.user_id)) {
      students.push({
        id: booking.user_id,
        name: studentName,
        bookingId: booking.id,
      });
    }
  }

  let coachName = null;
  if (session.coachId) {
    try {
      const { data: coachProfile, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', session.coachId)
        .single();
      if (!error && coachProfile) {
        const firstName = coachProfile.first_name || null;
        const lastName = coachProfile.last_name || null;
        coachName =
          [firstName, lastName].filter(Boolean).join(' ') ||
          coachProfile.email ||
          'Unknown Coach';
      }
    } catch (err) {
      console.error('Error fetching coach profile:', err);
    }
  }

  return {
    ...session,
    studentNames,
    students,
    coachName,
  };
}

export async function fetchCoachAssignmentSessions(supabase) {
  const bookings = await fetchUpcomingBookings(supabase);
  const sessions = groupRawBookingsIntoSessions(bookings);
  const enriched = await Promise.all(sessions.map((s) => enrichSession(supabase, s)));
  return enriched
    .filter(sessionNeedsCoach)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export async function countSessionsNeedingCoach(supabase) {
  const sessions = await fetchCoachAssignmentSessions(supabase);
  return sessions.length;
}

export function getSessionUrgencyLabel(startTimeIso) {
  const today = getSydneyToday();
  const sessionDate = utcToSydneyDate(startTimeIso);
  if (sessionDate === today) return 'TODAY';
  const tomorrow = addDaysToDateString(today, 1);
  if (sessionDate === tomorrow) return 'TOMORROW';
  const weekEnd = addDaysToDateString(today, 7);
  if (sessionDate <= weekEnd) return 'THIS WEEK';
  return 'LATER';
}

export function groupSessionsByUrgency(sessions) {
  const groups = { TODAY: [], TOMORROW: [], 'THIS WEEK': [], LATER: [] };
  for (const session of sessions) {
    const label = getSessionUrgencyLabel(session.startTime);
    groups[label].push(session);
  }
  return groups;
}

export async function verifyAdmin(supabase, userId) {
  if (!userId) return false;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !profile) return false;
  return profile.role === 'admin';
}

/**
 * Assign coach to all bookings in a session. Reuses existing bookings.coach_id update path.
 */
export async function assignCoachToSession(supabase, userId, session, coachId) {
  const isAdmin = await verifyAdmin(supabase, userId);
  if (!isAdmin) {
    return { success: false, error: 'Access denied: Only administrators can assign coaches' };
  }

  if (!coachId) {
    return { success: false, error: 'Please select a coach' };
  }

  const bookingIds = session.bookings.map((b) => b.id);
  const alreadyAssigned = session.bookings.every((b) => b.coach_id);
  if (alreadyAssigned) {
    return { success: false, alreadyAssigned: true };
  }

  const { error } = await supabase
    .from('bookings')
    .update({ coach_id: coachId })
    .in('id', bookingIds);

  if (error) {
    console.error('Error assigning coach:', error);
    return { success: false, error: "Couldn't assign coach. No changes were made." };
  }

  return { success: true };
}
