import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import GroupedSessionCard, { groupBookingsBySession } from '../components/GroupedSessionCard';
import CoachRainCheckModal from '../components/CoachRainCheckModal';

export default function CoachDashboardScreen({ onNavigate }) {
  const { user, userRole } = useAuth();
  const [groupedSessions, setGroupedSessions] = useState([]);
  const [pastBookings, setPastBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [rainCheckModalVisible, setRainCheckModalVisible] = useState(false);
  const [pendingRainChecks, setPendingRainChecks] = useState(0);

  // Redirect if not a coach
  useEffect(() => {
    if (userRole && userRole !== 'coach' && onNavigate) {
      Alert.alert(
        'Access Denied',
        'This page is only accessible to coaches.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to appropriate screen based on role
              if (userRole === 'admin') {
                onNavigate('admin-dashboard');
              } else {
                onNavigate('dashboard');
              }
            },
          },
        ]
      );
    }
  }, [userRole, onNavigate]);

  useEffect(() => {
    if (user && userRole === 'coach') {
      loadBookings();
      loadPastBookings();
      loadPendingRainCheckCount();
    }
  }, [user, userRole]);

  const loadPendingRainCheckCount = async () => {
    if (!user || userRole !== 'coach') return;

    try {
      // Get all pending rain check requests
      const { data, error } = await supabase
        .from('booking_requests')
        .select(`
          id,
          booking:booking_id (coach_id)
        `)
        .eq('status', 'pending')
        .eq('request_type', 'raincheck');

      if (error) throw error;

      // Count only those assigned to this coach
      const coachRainChecks = (data || []).filter(
        request => request.booking?.coach_id === user.id
      );
      setPendingRainChecks(coachRainChecks.length);
    } catch (error) {
      console.error('Error loading rain check count:', error);
    }
  };

  const loadBookings = async () => {
    if (!user || userRole !== 'coach') return;

    try {
      setLoading(true);
      
      // Server-side access control: Only fetch bookings where coach_id matches authenticated user's ID
      // AND end_time is in the future (current/future bookings)
      const now = new Date().toISOString();
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .eq('coach_id', user.id) // Server-side filter: only current coach's bookings
        .gte('end_time', now) // Only future/current bookings
        .order('start_time', { ascending: true });

      if (bookingsError) throw bookingsError;

      // Fetch student profiles for each booking
      const bookingsWithDetails = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          let studentName = 'Unknown Student';
          let studentEmail = null;
          
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

          return {
            ...booking,
            studentName,
            studentEmail,
            locationName: booking.locations?.name || 'Unknown Location',
          };
        })
      );

      // Group bookings by session (same time slot and location)
      const sessions = groupBookingsBySession(bookingsWithDetails);
      setGroupedSessions(sessions);
    } catch (error) {
      console.error('Error loading bookings:', error);
      Alert.alert('Error', 'Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPastBookings = async () => {
    if (!user || userRole !== 'coach') return;

    try {
      setLoadingHistory(true);
      
      // Server-side access control: Only fetch past bookings where coach_id matches authenticated user's ID
      const now = new Date().toISOString();
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .eq('coach_id', user.id) // Server-side filter: only current coach's bookings
        .lt('end_time', now) // Only past bookings
        .order('end_time', { ascending: false }); // Most recent first

      if (bookingsError) throw bookingsError;

      // Group bookings by session (same location, start_time, end_time) and fetch student names
      const sessionMap = new Map();

      for (const booking of bookingsData || []) {
        const sessionKey = `${booking.location_id}_${booking.start_time}_${booking.end_time}`;
        
        if (!sessionMap.has(sessionKey)) {
          sessionMap.set(sessionKey, {
            locationId: booking.location_id,
            locationName: booking.locations?.name || 'Unknown Location',
            startTime: booking.start_time,
            endTime: booking.end_time,
            studentIds: new Set(),
            studentNames: [],
          });
        }

        const session = sessionMap.get(sessionKey);
        if (booking.user_id && !session.studentIds.has(booking.user_id)) {
          session.studentIds.add(booking.user_id);
        }
      }

      // Fetch student names for each session
      const sessionsWithStudents = await Promise.all(
        Array.from(sessionMap.values()).map(async (session) => {
          const studentNames = await Promise.all(
            Array.from(session.studentIds).map(async (studentId) => {
              try {
                const { data: profile, error: profileError } = await supabase
                  .from('profiles')
                  .select('first_name, last_name, email')
                  .eq('id', studentId)
                  .single();

                if (!profileError && profile) {
                  const firstName = profile.first_name || null;
                  const lastName = profile.last_name || null;
                  if (firstName || lastName) {
                    return [firstName, lastName].filter(Boolean).join(' ');
                  }
                  return profile.email || 'Unknown Student';
                }
              } catch (err) {
                console.error('Error fetching student profile:', err);
              }
              return 'Unknown Student';
            })
          );

          // Calculate duration
          const start = new Date(session.startTime);
          const end = new Date(session.endTime);
          const minutes = (end - start) / (1000 * 60);
          const hours = minutes / 60;
          const duration = `${hours.toFixed(1)} ${hours === 1 ? 'hour' : 'hours'}`;

          return {
            ...session,
            studentNames: studentNames.filter(Boolean),
            duration,
          };
        })
      );

      setPastBookings(sessionsWithStudents);
    } catch (error) {
      console.error('Error loading past bookings:', error);
      Alert.alert('Error', 'Failed to load session history. Please try again.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
    loadPastBookings();
    loadPendingRainCheckCount();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  };

  // Count total students across all sessions
  const totalStudents = groupedSessions.reduce((sum, session) => sum + session.students.length, 0);

  // Don't render if not a coach
  if (userRole && userRole !== 'coach') {
    return null;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Coach Dashboard</Text>
          {/* Rain Check Requests Button */}
          <TouchableOpacity
            style={styles.rainCheckButton}
            onPress={() => setRainCheckModalVisible(true)}
          >
            <Ionicons name="rainy" size={18} color="#007AFF" />
            <Text style={styles.rainCheckButtonText}>Rain Checks</Text>
            {pendingRainChecks > 0 && (
              <View style={styles.rainCheckBadge}>
                <Text style={styles.rainCheckBadgeText}>{pendingRainChecks}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {groupedSessions.length} {groupedSessions.length === 1 ? 'session' : 'sessions'} • {totalStudents} {totalStudents === 1 ? 'student' : 'students'}
        </Text>
      </View>

      {/* Current/Future Sessions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0D9488" />
            <Text style={styles.loadingText}>Loading sessions...</Text>
          </View>
        ) : groupedSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No sessions assigned</Text>
            <Text style={styles.emptySubtext}>
              Sessions assigned to you will appear here
            </Text>
          </View>
        ) : (
          groupedSessions.map((session) => (
            <GroupedSessionCard
              key={session.key}
              session={session}
              isAdmin={false}
            />
          ))
        )}
      </View>

      {/* Session History Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.historyHeader}
          onPress={() => setShowHistory(!showHistory)}
        >
          <Text style={styles.sectionTitle}>Session History</Text>
          <Ionicons
            name={showHistory ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#8E8E93"
          />
        </TouchableOpacity>

        {showHistory && (
          <>
            {loadingHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            ) : pastBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyText}>No past sessions</Text>
                <Text style={styles.emptySubtext}>
                  Completed sessions will appear here
                </Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {pastBookings.map((session, index) => {
                  const dateTime = formatDateTime(session.startTime);
                  return (
                    <View key={index} style={styles.historyCard}>
                      <View style={styles.historyCardHeader}>
                        <Text style={styles.historyDate}>{dateTime.date}</Text>
                        <Text style={styles.historyTime}>
                          {formatTime(session.startTime)} - {formatTime(session.endTime)}
                        </Text>
                      </View>
                      <View style={styles.historyDetails}>
                        <View style={styles.detailRow}>
                          <Ionicons name="location-outline" size={16} color="#8E8E93" />
                          <Text style={styles.detailText}>{session.locationName}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="people-outline" size={16} color="#8E8E93" />
                          <Text style={styles.detailText}>
                            {session.studentNames.length > 0
                              ? session.studentNames.join(', ')
                              : 'No students'}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="time-outline" size={16} color="#8E8E93" />
                          <Text style={styles.detailText}>Duration: {session.duration}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>

      {/* Rain Check Modal */}
      <CoachRainCheckModal
        visible={rainCheckModalVisible}
        onClose={() => setRainCheckModalVisible(false)}
        coachId={user?.id}
        onRequestProcessed={() => {
          loadPendingRainCheckCount();
          loadBookings();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  rainCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  rainCheckButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  rainCheckBadge: {
    backgroundColor: '#FF3B30',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  rainCheckBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
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
    paddingVertical: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }),
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    }),
  },
  historyCardHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  historyDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 13,
    color: '#6B7280',
  },
  historyDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 8,
  },
});
