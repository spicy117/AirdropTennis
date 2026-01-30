import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import StatCard from '../components/StatCard';
import GroupedSessionCard, { groupBookingsBySession } from '../components/GroupedSessionCard';
import AdminAssignLessonModal from '../components/AdminAssignLessonModal';
import { getSydneyToday, sydneyDateToUTCStart, sydneyDateToUTCEnd } from '../utils/timezone';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';

// Nav items matching Sidebar (excluding admin-dashboard) so mobile users can reach all sections
const ADMIN_NAV_BUTTONS = [
  { id: 'admin-active-bookings', labelKey: 'navActiveBookings', icon: 'calendar-outline' },
  { id: 'admin-locations-courts', labelKey: 'navLocations', icon: 'location-outline' },
  { id: 'admin-availability', labelKey: 'navAvailability', icon: 'time-outline' },
  { id: 'admin-students', labelKey: 'navStudents', icon: 'people-outline' },
  { id: 'admin-coaches', labelKey: 'navCoaches', icon: 'shield-outline' },
  { id: 'admin-history', labelKey: 'navBookingHistory', icon: 'archive-outline' },
  { id: 'profile', labelKey: 'profile', icon: 'person-outline' },
];

export default function AdminDashboardScreen({ onNavigate }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [assignLessonVisible, setAssignLessonVisible] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalBookings: 0,
    todayBookings: 0,
    totalRevenue: 0,
  });
  const [groupedSessions, setGroupedSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    loadStats();
    loadUpcomingSessions();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Get total students (users with student role)
      const { count: studentCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      // Get total bookings
      const { count: bookingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

      // Get today's bookings - convert Sydney local date to UTC for query
      const todayStr = getSydneyToday();
      const startOfDay = sydneyDateToUTCStart(todayStr);
      const endOfDay = sydneyDateToUTCEnd(todayStr);

      const { count: todayCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

      // Get total revenue (sum of credit_cost)
      const { data: bookings } = await supabase
        .from('bookings')
        .select('credit_cost');

      const revenue = bookings?.reduce((sum, b) => sum + (parseFloat(b.credit_cost) || 0), 0) || 0;

      setStats({
        totalStudents: studentCount || 0,
        totalBookings: bookingCount || 0,
        todayBookings: todayCount || 0,
        totalRevenue: revenue,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUpcomingSessions = async () => {
    try {
      setLoadingSessions(true);
      
      // Fetch all upcoming bookings (admin sees all)
      const now = new Date().toISOString();
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .gte('end_time', now)
        .order('start_time', { ascending: true })
        .limit(50); // Limit to reasonable number

      if (bookingsError) throw bookingsError;

      // Fetch student and coach profiles for each booking
      const bookingsWithDetails = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          let studentName = 'Unknown Student';
          let studentEmail = null;
          let coachName = null;
          
          // Fetch student profile
          if (booking.user_id) {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('first_name, last_name, email')
                .eq('id', booking.user_id)
                .single();

              if (!profileError && profile) {
                const firstName = profile.first_name || null;
                const lastName = profile.last_name || null;
                
                if (firstName || lastName) {
                  studentName = [firstName, lastName].filter(Boolean).join(' ');
                } else {
                  studentName = profile.email || 'Unknown Student';
                }
                studentEmail = profile.email;
              }
            } catch (err) {
              console.error('Error fetching student profile:', err);
            }
          }

          // Fetch coach profile
          if (booking.coach_id) {
            try {
              const { data: coachProfile, error: coachError } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', booking.coach_id)
                .single();

              if (!coachError && coachProfile) {
                const firstName = coachProfile.first_name || null;
                const lastName = coachProfile.last_name || null;
                if (firstName || lastName) {
                  coachName = [firstName, lastName].filter(Boolean).join(' ');
                }
              }
            } catch (err) {
              console.error('Error fetching coach profile:', err);
            }
          }

          return {
            ...booking,
            studentName,
            studentEmail,
            coachName,
            locationName: booking.locations?.name || 'Unknown Location',
          };
        })
      );

      // Group bookings by session
      const sessions = groupBookingsBySession(bookingsWithDetails);
      setGroupedSessions(sessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const onRefresh = () => {
    loadStats();
    loadUpcomingSessions();
  };

  // Count total students
  const totalUpcomingStudents = groupedSessions.reduce((sum, s) => sum + s.students.length, 0);

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} />
      }
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Overview of your tennis court bookings</Text>
        </View>
        <TouchableOpacity
          style={styles.assignLessonBtn}
          onPress={() => setAssignLessonVisible(true)}
        >
          <Ionicons name="add-circle" size={20} color="#FFF" />
          <Text style={styles.assignLessonBtnText}>Assign lesson</Text>
        </TouchableOpacity>
      </View>

      {/* Nav buttons (replaces Total Students / Total Revenue on mobile so side tabs are accessible) */}
      <View style={styles.navButtonsSection}>
        <Text style={styles.navButtonsLabel}>Menu</Text>
        <View style={styles.navButtonsGrid}>
          {ADMIN_NAV_BUTTONS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.navButton}
              onPress={() => onNavigate && onNavigate(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.navButtonIconWrap}>
                <Ionicons name={item.icon} size={22} color="#0D9488" />
              </View>
              <Text style={styles.navButtonText} numberOfLines={1}>{t(item.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.statWrap}>
          <StatCard
            title="Total Bookings"
            value={stats.totalBookings.toString()}
            icon="calendar-outline"
            iconColor="#2563EB"
          />
        </View>
        <View style={styles.statWrap}>
          <StatCard
            title="Today's Bookings"
            value={stats.todayBookings.toString()}
            icon="today-outline"
            iconColor="#D97706"
          />
        </View>
      </View>

      {/* Upcoming Sessions Section */}
      <View style={styles.sessionsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
          <View style={styles.sessionsBadge}>
            <Text style={styles.sessionsBadgeText}>
              {groupedSessions.length} {groupedSessions.length === 1 ? 'session' : 'sessions'} • {totalUpcomingStudents} {totalUpcomingStudents === 1 ? 'student' : 'students'}
            </Text>
          </View>
        </View>

        {loadingSessions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0D9488" />
            <Text style={styles.loadingText}>Loading sessions...</Text>
          </View>
        ) : groupedSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No upcoming sessions</Text>
            <Text style={styles.emptySubtext}>
              Sessions will appear here when booked
            </Text>
          </View>
        ) : (
          groupedSessions.map((session) => (
            <GroupedSessionCard
              key={session.key}
              session={session}
              isAdmin={true}
            />
          ))
        )}
      </View>
    </ScrollView>
    <AdminAssignLessonModal
      visible={assignLessonVisible}
      onClose={() => setAssignLessonVisible(false)}
      onAssigned={() => { loadStats(); loadUpcomingSessions(); }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 12,
    ...(Platform.OS === 'web' && { flexWrap: 'wrap' }),
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 0,
  },
  assignLessonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 6,
  },
  assignLessonBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  navButtonsSection: {
    marginBottom: 24,
  },
  navButtonsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  navButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    gap: 10,
  },
  navButton: {
    width: '30%',
    minWidth: 100,
    flexGrow: 1,
    maxWidth: 140,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    }),
  },
  navButtonIconWrap: {
    marginBottom: 6,
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 32,
  },
  statWrap: {
    width: '50%',
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  sessionsSection: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  sessionsBadge: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  sessionsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }),
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
});
