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
import { supabase } from '../lib/supabase';
import { getSydneyToday, sydneyDateToUTCStart, sydneyDateToUTCEnd } from '../utils/timezone';

export default function BookingsScreen() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, today, upcoming
  const [coaches, setCoaches] = useState([]);
  const [showCoachDropdown, setShowCoachDropdown] = useState({}); // { bookingId: boolean }
  const [updatingCoachId, setUpdatingCoachId] = useState(null);

  useEffect(() => {
    loadBookings();
    loadCoaches();
  }, [filter]);

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

  const loadBookings = async () => {
    try {
      setLoading(true);

      // First, try to get bookings without joins to see if basic query works
      let query = supabase
        .from('bookings')
        .select('*')
        .order('start_time', { ascending: true });

      // Apply filters - convert Sydney local dates to UTC for queries
      if (filter === 'today') {
        const todayStr = getSydneyToday();
        const startOfDay = sydneyDateToUTCStart(todayStr);
        const endOfDay = sydneyDateToUTCEnd(todayStr);
        query = query
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', endOfDay.toISOString());
      } else if (filter === 'upcoming') {
        query = query.gte('start_time', new Date().toISOString());
      }

      const { data: bookingsData, error: bookingsError } = await query;

      if (bookingsError) {
        console.error('Error loading bookings:', bookingsError);
        console.error('Error details:', {
          message: bookingsError.message,
          details: bookingsError.details,
          hint: bookingsError.hint,
          code: bookingsError.code,
          status: bookingsError.status,
        });
        
        // Show user-friendly error message
        if (bookingsError.code === '42501' || bookingsError.status === 403) {
          Alert.alert(
            'Permission Denied',
            'You may not have permission to view bookings. Please check your admin role in Supabase.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Error Loading Bookings',
            bookingsError.message || 'Failed to load bookings. Please try again.',
            [{ text: 'OK' }]
          );
        }
        
        setBookings([]);
        return;
      }

      if (!bookingsData || bookingsData.length === 0) {
        console.log('No bookings found in database');
        setBookings([]);
        return;
      }

      console.log('Bookings loaded (raw):', bookingsData.length);

      // Now fetch related data separately to avoid join issues
      const bookingsWithDetails = await Promise.all(
        bookingsData.map(async (booking) => {
          // Fetch location
          let locationName = 'Unknown Location';
          if (booking.location_id) {
            try {
              const { data: location, error: locError } = await supabase
                .from('locations')
                .select('name')
                .eq('id', booking.location_id)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .single();
              if (!locError && location) {
                locationName = location.name;
              }
            } catch (err) {
              console.error('Error fetching location:', err);
            }
          }

          // Fetch user profile
          let studentFirstName = null;
          let studentLastName = null;
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
                studentFirstName = profile.first_name || null;
                studentLastName = profile.last_name || null;
                
                // Build full name from first_name and last_name
                if (studentFirstName || studentLastName) {
                  studentName = [studentFirstName, studentLastName]
                    .filter(Boolean)
                    .join(' ');
                } else {
                  // Fallback to email if no name available
                  studentName = profile.email || 'Unknown Student';
                }
                studentEmail = profile.email;
              }
            } catch (err) {
              console.error('Error fetching profile:', err);
            }
          }

          // Fetch coach profile if coach_id exists
          let coachName = null;
          if (booking.coach_id) {
            try {
              const { data: coachProfile, error: coachError } = await supabase
                .from('profiles')
                .select('first_name, last_name, email')
                .eq('id', booking.coach_id)
                .single();
              if (!coachError && coachProfile) {
                const coachFirstName = coachProfile.first_name || null;
                const coachLastName = coachProfile.last_name || null;
                if (coachFirstName || coachLastName) {
                  coachName = [coachFirstName, coachLastName]
                    .filter(Boolean)
                    .join(' ');
                } else {
                  coachName = coachProfile.email || 'Unknown Coach';
                }
              }
            } catch (err) {
              console.error('Error fetching coach profile:', err);
            }
          }

          return {
            ...booking,
            locationName,
            studentFirstName,
            studentLastName,
            studentName,
            studentEmail,
            coachName,
          };
        })
      );

      console.log('Bookings with details:', bookingsWithDetails.length);
      if (bookingsWithDetails.length > 0) {
        console.log('Sample booking:', {
          id: bookingsWithDetails[0].id,
          location: bookingsWithDetails[0].locationName,
          student: bookingsWithDetails[0].studentName,
          start_time: bookingsWithDetails[0].start_time,
          service_name: bookingsWithDetails[0].service_name,
        });
      }

      setBookings(bookingsWithDetails);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
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

  const handleAssignCoach = async (bookingId, coachId) => {
    try {
      setUpdatingCoachId(bookingId);
      const { error } = await supabase
        .from('bookings')
        .update({ coach_id: coachId || null })
        .eq('id', bookingId);

      if (error) throw error;

      // Refresh bookings to show updated coach
      await loadBookings();
      setShowCoachDropdown({});
      Alert.alert('Success', coachId ? 'Coach assigned successfully' : 'Coach removed successfully');
    } catch (error) {
      console.error('Error assigning coach:', error);
      Alert.alert('Error', 'Failed to assign coach. Please try again.');
    } finally {
      setUpdatingCoachId(null);
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    try {
      // First, get the booking details to update availability status
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('location_id, start_time, end_time')
        .eq('id', bookingId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the booking
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      // Check remaining bookings for this slot
      const { count: remainingCount, error: countError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', booking.location_id)
        .eq('start_time', booking.start_time)
        .eq('end_time', booking.end_time);

      if (!countError && remainingCount !== undefined) {
        // Get the availability to check its max_capacity
        const { data: availabilityData, error: availError } = await supabase
          .from('availabilities')
          .select('max_capacity')
          .eq('location_id', booking.location_id)
          .eq('start_time', booking.start_time)
          .eq('end_time', booking.end_time)
          .limit(1)
          .single();

        // Use max_capacity from availability, default to 10 if not set
        const MAX_CAPACITY = availabilityData?.max_capacity || 10;
        const shouldBeBooked = remainingCount >= MAX_CAPACITY;

        // Update availability status if needed
        const { error: updateError } = await supabase
          .from('availabilities')
          .update({ is_booked: shouldBeBooked })
          .eq('location_id', booking.location_id)
          .eq('start_time', booking.start_time)
          .eq('end_time', booking.end_time);

        if (updateError) {
          console.error('Error updating availability status:', updateError);
        }
      }

      loadBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadBookings} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>{bookings.length} total bookings</Text>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'today' && styles.filterActive]}
          onPress={() => setFilter('today')}
        >
          <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'upcoming' && styles.filterActive]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[styles.filterText, filter === 'upcoming' && styles.filterTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No bookings found</Text>
          <Text style={styles.emptySubtext}>
            Bookings will appear here once students make reservations
          </Text>
        </View>
      ) : (
        bookings.map((booking) => {
          const dateTime = formatDateTime(booking.start_time);
          const endTime = new Date(booking.end_time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });

          return (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View style={styles.bookingInfo}>
                  <Text style={styles.locationName}>
                    {booking.locationName || 'Unknown Location'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteBooking(booking.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
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
                    {booking.locationName || 'Unknown Location'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailText}>
                    {booking.studentFirstName && booking.studentLastName
                      ? `${booking.studentFirstName} ${booking.studentLastName}`
                      : booking.studentName || booking.studentEmail || 'Unknown Student'}
                  </Text>
                </View>
                {booking.service_name && (
                  <View style={styles.detailRow}>
                    <Ionicons name="tennisball-outline" size={16} color="#8E8E93" />
                    <Text style={styles.detailText}>
                      {booking.service_name}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailText}>
                    ${parseFloat(booking.credit_cost || 0).toFixed(2)} credits
                  </Text>
                </View>
                <View style={styles.coachRow}>
                  <Ionicons name="person-circle-outline" size={16} color="#8E8E93" />
                  <View style={styles.coachDropdownContainer}>
                    <Text style={styles.coachLabel}>Assign Coach:</Text>
                    <TouchableOpacity
                      style={styles.coachDropdown}
                      onPress={() => {
                        setShowCoachDropdown({
                          ...showCoachDropdown,
                          [booking.id]: !showCoachDropdown[booking.id],
                        });
                      }}
                      disabled={updatingCoachId === booking.id}
                    >
                      <Text style={styles.coachDropdownText}>
                        {booking.coachName || 'No coach assigned'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                    </TouchableOpacity>
                    {showCoachDropdown[booking.id] && (
                      <Modal
                        visible={true}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => {
                          setShowCoachDropdown({
                            ...showCoachDropdown,
                            [booking.id]: false,
                          });
                        }}
                      >
                        <TouchableOpacity
                          style={styles.dropdownOverlay}
                          activeOpacity={1}
                          onPress={() => {
                            setShowCoachDropdown({
                              ...showCoachDropdown,
                              [booking.id]: false,
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
                                  handleAssignCoach(booking.id, null);
                                  setShowCoachDropdown({
                                    ...showCoachDropdown,
                                    [booking.id]: false,
                                  });
                                }}
                              >
                                <Text style={[
                                  styles.dropdownMenuItemText,
                                  !booking.coach_id && styles.dropdownMenuItemTextActive
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
                                      handleAssignCoach(booking.id, coach.id);
                                      setShowCoachDropdown({
                                        ...showCoachDropdown,
                                        [booking.id]: false,
                                      });
                                    }}
                                  >
                                    <Text style={[
                                      styles.dropdownMenuItemText,
                                      booking.coach_id === coach.id && styles.dropdownMenuItemTextActive
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
        })
      )}
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
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  filterActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  filterTextActive: {
    color: '#fff',
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
  deleteButton: {
    padding: 4,
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
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  coachDropdownContainer: {
    flex: 1,
    marginLeft: 8,
  },
  coachLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  coachDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
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
});
