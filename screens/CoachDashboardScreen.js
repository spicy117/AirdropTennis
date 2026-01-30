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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import GroupedSessionCard, { groupBookingsBySession } from '../components/GroupedSessionCard';

export default function CoachDashboardScreen({ onNavigate }) {
  const { user, userRole } = useAuth();
  const [groupedSessions, setGroupedSessions] = useState([]);
  const [pastBookings, setPastBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [rainCheckConfirm, setRainCheckConfirm] = useState({ visible: false, message: '', bookings: [] });
  const [rainCheckResult, setRainCheckResult] = useState({ visible: false, success: true, title: '', message: '' });

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

  const runRainCheckCancel = async (bookings) => {
    const ids = bookings.map((b) => b.id);
    await supabase
      .from('booking_requests')
      .update({ status: 'rejected' })
      .in('booking_id', ids)
      .eq('status', 'pending');
    let refundFailures = 0;
    for (const b of bookings) {
      const { error: delErr } = await supabase.from('bookings').delete().eq('id', b.id);
      if (delErr) {
        console.error('Error cancelling booking:', b.id, delErr);
        refundFailures++;
        continue;
      }
      if (b.credit_cost > 0 && b.user_id) {
        const { error: refErr } = await supabase.rpc('add_wallet_balance', {
          user_id: b.user_id,
          amount: b.credit_cost,
        });
        if (refErr) {
          console.error('Error refunding:', b.user_id, refErr);
          refundFailures++;
        }
      }
    }
    await loadBookings();
    return refundFailures;
  };

  const handleRainCheckBookings = (bookings) => {
    if (!bookings?.length) return;
    const n = bookings.length;
    const message = `Cancel ${n} booking${n !== 1 ? 's' : ''} and refund ${n} student${n !== 1 ? 's' : ''}?`;
    setRainCheckConfirm({ visible: true, message, bookings });
  };

  const handleRainCheckConfirmAction = async () => {
    const { bookings } = rainCheckConfirm;
    setRainCheckConfirm((prev) => ({ ...prev, visible: false }));
    try {
      const refundFailures = await runRainCheckCancel(bookings);
      if (refundFailures > 0) {
        setRainCheckResult({
          visible: true,
          success: false,
          title: 'Partially complete',
          message: `${refundFailures} refund(s) failed – please refund manually if needed.`,
        });
      } else {
        setRainCheckResult({
          visible: true,
          success: true,
          title: 'Success',
          message: `Booking${bookings.length !== 1 ? 's' : ''} cancelled and student${bookings.length !== 1 ? 's' : ''} refunded.`,
        });
      }
    } catch (err) {
      console.error('Rain check error:', err);
      setRainCheckResult({
        visible: true,
        success: false,
        title: 'Error',
        message: 'Failed to rain check. Please try again.',
      });
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
              onRainCheckBookings={handleRainCheckBookings}
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

      {/* Rain check confirmation modal (in-app) */}
      <Modal
        visible={rainCheckConfirm.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRainCheckConfirm((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rain check</Text>
            <Text style={styles.modalMessage}>{rainCheckConfirm.message}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setRainCheckConfirm((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleRainCheckConfirmAction}
              >
                <Text style={styles.modalButtonPrimaryText}>Rain check</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rain check result modal (in-app) */}
      <Modal
        visible={rainCheckResult.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRainCheckResult((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[
              styles.resultIconContainer,
              rainCheckResult.success ? styles.resultIconSuccess : styles.resultIconError,
            ]}>
              <Ionicons
                name={rainCheckResult.success ? 'checkmark-circle' : 'close-circle'}
                size={48}
                color={rainCheckResult.success ? '#10B981' : '#EF4444'}
              />
            </View>
            <Text style={styles.modalTitle}>{rainCheckResult.title}</Text>
            <Text style={styles.modalMessage}>{rainCheckResult.message}</Text>
            <TouchableOpacity
              style={[styles.modalButton, rainCheckResult.success ? styles.resultButtonSuccess : styles.resultButtonError]}
              onPress={() => setRainCheckResult((prev) => ({ ...prev, visible: false }))}
            >
              <Text style={styles.modalButtonPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // In-app modals (rain check)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 10,
    }),
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#E5E7EB',
  },
  modalButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resultIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultIconSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  resultIconError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  resultButtonSuccess: {
    backgroundColor: '#10B981',
  },
  resultButtonError: {
    backgroundColor: '#EF4444',
  },
});
