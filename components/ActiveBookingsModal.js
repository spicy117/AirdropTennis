import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { utcToSydneyDate, utcToSydneyTime } from '../utils/timezone';

export default function ActiveBookingsModal({
  visible,
  onClose,
  onCoachAssigned,
}) {
  const { user, userRole } = useAuth();
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState([]);
  const [showCoachDropdown, setShowCoachDropdown] = useState({}); // { sessionKey: boolean }
  const [updatingCoachId, setUpdatingCoachId] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Check admin role on mount and when visible changes
  useEffect(() => {
    if (visible) {
      checkAdminAccess();
    }
  }, [visible, userRole]);

  const checkAdminAccess = async () => {
    // Client-side check
    if (userRole !== 'admin') {
      setAccessDenied(true);
      setLoading(false);
      Alert.alert(
        'Access Denied',
        'This feature is only available to administrators.',
        [{ text: 'OK', onPress: onClose }]
      );
      return;
    }

    // Server-side verification: Check role in database
    try {
      if (!user?.id) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (!profile || profile.role !== 'admin') {
        setAccessDenied(true);
        setLoading(false);
        Alert.alert(
          'Access Denied',
          'You do not have permission to access this feature. Administrator access required.',
          [{ text: 'OK', onPress: onClose }]
        );
        return;
      }

      // Access granted - proceed with loading data
      setAccessDenied(false);
      loadActiveSessions();
      loadCoaches();
    } catch (error) {
      console.error('Error checking admin access:', error);
      setAccessDenied(true);
      setLoading(false);
      Alert.alert(
        'Error',
        'Unable to verify access permissions. Please try again.',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  };

  // Removed - now handled in checkAdminAccess

  const loadCoaches = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'coach')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setCoaches(data || []);
    } catch (error) {
      console.error('Error loading coaches:', error);
    }
  };

  const loadActiveSessions = async () => {
    // Server-side role check: Verify admin access before loading
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Verify admin role via database
      const { data: profile, error: roleError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (roleError) throw roleError;
      if (!profile || profile.role !== 'admin') {
        throw new Error('Access denied: Admin role required');
      }

      setLoading(true);

      // Fetch all bookings that haven't ended yet (end_time >= current time)
      const now = new Date().toISOString();
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .gte('end_time', now) // Only bookings that haven't ended
        .order('start_time', { ascending: true });

      if (bookingsError) throw bookingsError;

      // Group bookings by location, start_time, and end_time (same session)
      const sessionMap = new Map();

      for (const booking of bookings || []) {
        // Create a unique key for this session (location + start_time + end_time)
        const sessionKey = `${booking.location_id}_${booking.start_time}_${booking.end_time}`;

        if (!sessionMap.has(sessionKey)) {
          sessionMap.set(sessionKey, {
            locationId: booking.location_id,
            locationName: booking.locations?.name || 'Unknown Location',
            startTime: booking.start_time,
            endTime: booking.end_time,
            bookings: [],
            coachId: null,
            coachName: null,
          });
        }

        const session = sessionMap.get(sessionKey);
        session.bookings.push(booking);

        // If this booking has a coach assigned, use it (assuming all bookings in a session share the same coach)
        if (booking.coach_id && !session.coachId) {
          session.coachId = booking.coach_id;
        }
      }

      // Fetch student names and coach names for each session
      const sessionsWithDetails = await Promise.all(
        Array.from(sessionMap.values()).map(async (session) => {
          // Fetch student names for all bookings in this session
          const studentNames = await Promise.all(
            session.bookings.map(async (booking) => {
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
                      return [firstName, lastName].filter(Boolean).join(' ');
                    }
                    return profile.email || 'Unknown Student';
                  }
                } catch (err) {
                  console.error('Error fetching student profile:', err);
                }
              }
              return 'Unknown Student';
            })
          );

          // Fetch coach name if coach is assigned
          let coachName = null;
          if (session.coachId) {
            try {
              const { data: coachProfile, error: coachError } = await supabase
                .from('profiles')
                .select('first_name, last_name, email')
                .eq('id', session.coachId)
                .single();

              if (!coachError && coachProfile) {
                const coachFirstName = coachProfile.first_name || null;
                const coachLastName = coachProfile.last_name || null;
                if (coachFirstName || coachLastName) {
                  coachName = [coachFirstName, coachLastName].filter(Boolean).join(' ');
                } else {
                  coachName = coachProfile.email || 'Unknown Coach';
                }
              }
            } catch (err) {
              console.error('Error fetching coach profile:', err);
            }
          }

          return {
            ...session,
            studentNames,
            coachName,
            sessionKey: `${session.locationId}_${session.startTime}_${session.endTime}`,
          };
        })
      );

      setActiveSessions(sessionsWithDetails);
    } catch (error) {
      console.error('Error loading active sessions:', error);
      Alert.alert('Error', 'Failed to load active bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCoach = async (session, coachId) => {
    try {
      // Server-side role check before allowing assignment
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data: profile, error: roleError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (roleError) throw roleError;
      if (!profile || profile.role !== 'admin') {
        throw new Error('Access denied: Only administrators can assign coaches');
      }

      setUpdatingCoachId(session.sessionKey);

      // Update all bookings in this session with the new coach_id
      const bookingIds = session.bookings.map(b => b.id);
      
      const { error } = await supabase
        .from('bookings')
        .update({ coach_id: coachId || null })
        .in('id', bookingIds);

      if (error) throw error;

      // Refresh the sessions list
      await loadActiveSessions();
      setShowCoachDropdown({});
      
      // Notify parent component to update badge count
      if (onCoachAssigned) {
        onCoachAssigned();
      }
      
      Alert.alert('Success', coachId ? 'Coach assigned successfully' : 'Coach removed successfully');
    } catch (error) {
      console.error('Error assigning coach:', error);
      Alert.alert('Error', 'Failed to assign coach. Please try again.');
    } finally {
      setUpdatingCoachId(null);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return utcToSydneyTime(dateString);
  };

  const formatDate = (dateString) => {
    return utcToSydneyDate(dateString);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Active Bookings</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {accessDenied ? (
            <View style={styles.emptyState}>
              <Ionicons name="lock-closed-outline" size={64} color="#FF3B30" />
              <Text style={styles.emptyText}>Access Denied</Text>
              <Text style={styles.emptySubtext}>
                This feature is only available to administrators.
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading active bookings...</Text>
            </View>
          ) : activeSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyText}>No active bookings</Text>
              <Text style={styles.emptySubtext}>
                Bookings with students will appear here
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
              {activeSessions.map((session) => {
                const sessionKey = session.sessionKey;
                const dateStr = formatDate(session.startTime);
                const timeStr = `${formatTime(session.startTime)} - ${formatTime(session.endTime)}`;

                return (
                  <View key={sessionKey} style={styles.sessionCard}>
                    <View style={styles.sessionHeader}>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionTime}>{timeStr}</Text>
                        <Text style={styles.sessionDate}>{dateStr}</Text>
                        <Text style={styles.sessionLocation}>{session.locationName}</Text>
                      </View>
                    </View>

                    <View style={styles.sessionDetails}>
                      <View style={styles.detailRow}>
                        <Ionicons name="people-outline" size={16} color="#8E8E93" />
                        <Text style={styles.detailLabel}>Students:</Text>
                        <Text style={styles.detailValue}>
                          {session.studentNames.join(', ')}
                        </Text>
                      </View>

                      {/* Status Indicator */}
                      <View style={styles.statusRow}>
                        {session.coachId ? (
                          <View style={styles.statusIndicatorAssigned}>
                            <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                            <Text style={styles.statusTextAssigned}>
                              Coach Assigned: {session.coachName || 'Unknown Coach'}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.statusIndicatorUnassigned}>
                            <Text style={styles.statusIconUnassigned}>⚠️</Text>
                            <Text style={styles.statusTextUnassigned}>
                              Coach Needs Assigning
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.coachRow}>
                        <Ionicons name="person-circle-outline" size={16} color="#8E8E93" />
                        <Text style={styles.detailLabel}>Coach:</Text>
                        <View style={styles.coachDropdownContainer}>
                          <TouchableOpacity
                            style={styles.coachDropdown}
                            onPress={() => {
                              setShowCoachDropdown({
                                ...showCoachDropdown,
                                [sessionKey]: !showCoachDropdown[sessionKey],
                              });
                            }}
                            disabled={updatingCoachId === sessionKey}
                          >
                            <Text style={styles.coachDropdownText}>
                              {session.coachName || 'No coach assigned'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                          </TouchableOpacity>
                          {showCoachDropdown[sessionKey] && (
                            <Modal
                              visible={true}
                              transparent={true}
                              animationType="fade"
                              onRequestClose={() => {
                                setShowCoachDropdown({
                                  ...showCoachDropdown,
                                  [sessionKey]: false,
                                });
                              }}
                            >
                              <TouchableOpacity
                                style={styles.dropdownOverlay}
                                activeOpacity={1}
                                onPress={() => {
                                  setShowCoachDropdown({
                                    ...showCoachDropdown,
                                    [sessionKey]: false,
                                  });
                                }}
                              >
                                <View style={styles.dropdownMenu}>
                                  <ScrollView
                                    style={styles.dropdownMenuScroll}
                                    nestedScrollEnabled
                                    showsVerticalScrollIndicator={true}
                                  >
                                    <TouchableOpacity
                                      style={styles.dropdownMenuItem}
                                      onPress={() => {
                                        handleAssignCoach(session, null);
                                        setShowCoachDropdown({
                                          ...showCoachDropdown,
                                          [sessionKey]: false,
                                        });
                                      }}
                                    >
                                      <Text style={[
                                        styles.dropdownMenuItemText,
                                        !session.coachId && styles.dropdownMenuItemTextActive
                                      ]}>
                                        No coach assigned
                                      </Text>
                                    </TouchableOpacity>
                                    {coaches.map((coach) => {
                                      const coachFullName = [coach.first_name, coach.last_name]
                                        .filter(Boolean)
                                        .join(' ') || coach.email;
                                      return (
                                        <TouchableOpacity
                                          key={coach.id}
                                          style={styles.dropdownMenuItem}
                                          onPress={() => {
                                            handleAssignCoach(session, coach.id);
                                            setShowCoachDropdown({
                                              ...showCoachDropdown,
                                              [sessionKey]: false,
                                            });
                                          }}
                                        >
                                          <Text style={[
                                            styles.dropdownMenuItemText,
                                            session.coachId === coach.id && styles.dropdownMenuItemTextActive
                                          ]}>
                                            {coachFullName}
                                          </Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </ScrollView>
                                </View>
                              </TouchableOpacity>
                            </Modal>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    padding: 4,
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
  content: {
    flex: 1,
    padding: 20,
  },
  sessionCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sessionHeader: {
    marginBottom: 12,
  },
  sessionInfo: {
    gap: 4,
  },
  sessionTime: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  sessionDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  sessionLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 4,
  },
  sessionDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    minWidth: 70,
  },
  detailValue: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachDropdownContainer: {
    flex: 1,
  },
  coachDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  coachDropdownText: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    maxHeight: 300,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    }),
  },
  dropdownMenuScroll: {
    maxHeight: 300,
  },
  dropdownMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dropdownMenuItemText: {
    fontSize: 14,
    color: '#000',
  },
  dropdownMenuItemTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  statusRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  statusIndicatorAssigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  statusTextAssigned: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    flex: 1,
  },
  statusIndicatorUnassigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  statusIconUnassigned: {
    fontSize: 18,
  },
  statusTextUnassigned: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    flex: 1,
  },
});
