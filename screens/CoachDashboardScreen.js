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

export default function CoachDashboardScreen({ onNavigate }) {
  const { user, userRole } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [pastBookings, setPastBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
    }
  }, [user, userRole]);

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

      setBookings(bookingsWithDetails);
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
        <Text style={styles.title}>Coach Dashboard</Text>
        <Text style={styles.subtitle}>
          {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} assigned
        </Text>
      </View>

      {/* Current/Future Bookings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>Loading bookings...</Text>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No bookings assigned</Text>
            <Text style={styles.emptySubtext}>
              Bookings assigned to you will appear here
            </Text>
          </View>
        ) : (
          bookings.map((booking) => {
          const dateTime = formatDateTime(booking.start_time);
          const endTime = formatTime(booking.end_time);

          return (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View style={styles.bookingInfo}>
                  <Text style={styles.locationName}>
                    {booking.locationName}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailText}>{dateTime.date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailText}>
                    {dateTime.time} - {endTime}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailText}>
                    {booking.locationName}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailText}>
                    Student: {booking.studentName}
                  </Text>
                </View>
                {booking.studentEmail && (
                  <View style={styles.detailRow}>
                    <Ionicons name="mail-outline" size={16} color="#8E8E93" />
                    <Text style={styles.detailText}>
                      {booking.studentEmail}
                    </Text>
                  </View>
                )}
                {booking.service_name && (
                  <View style={styles.detailRow}>
                    <Ionicons name="tennisball-outline" size={16} color="#8E8E93" />
                    <Text style={styles.detailText}>
                      {booking.service_name}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  bookingDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  historyCardHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  historyDetails: {
    gap: 8,
  },
});
