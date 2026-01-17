import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import DashboardCard from '../components/DashboardCard';
import BookingCard from '../components/BookingCard';
import RefundsCard from '../components/RefundsCard';
import FloatingActionButton from '../components/FloatingActionButton';

const { width } = Dimensions.get('window');
const isDesktop = Platform.OS === 'web' && width > 768;

export default function DashboardScreen({ onBookLesson, refreshTrigger }) {
  const { user } = useAuth();
  const [creditBalance] = useState(125.50); // Mock data - replace with actual data
  const [nextBooking, setNextBooking] = useState(null);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [refunds] = useState([]); // Mock data - empty array to hide refunds section
  const userName =
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ') ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Student';

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  // Refresh when refreshTrigger changes (e.g., when navigating back from booking)
  useEffect(() => {
    if (user && refreshTrigger !== undefined) {
      loadBookings();
    }
  }, [refreshTrigger]);

  const loadBookings = async () => {
    if (!user) return;

    try {
      setLoadingBooking(true);
      
      // Fetch ALL upcoming bookings for the current user - exact same query as BookingsScreen
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .eq('user_id', user.id)
        .gte('start_time', new Date().toISOString()) // Only upcoming bookings
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      // Fetch coach information for bookings that have a coach_id
      const bookingsWithCoaches = await Promise.all(
        (data || []).map(async (booking) => {
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
                let coachName = null;
                if (coachFirstName || coachLastName) {
                  coachName = [coachFirstName, coachLastName]
                    .filter(Boolean)
                    .join(' ');
                } else {
                  coachName = coachProfile.email || 'Unknown Coach';
                }
                return { ...booking, coachName };
              }
            } catch (err) {
              console.error('Error fetching coach profile:', err);
            }
          }
          return booking;
        })
      );
      
      // Set the first booking (earliest) as next booking
      setNextBooking(bookingsWithCoaches.length > 0 ? bookingsWithCoaches[0] : null);
      // Set all upcoming bookings for the list
      setUpcomingBookings(bookingsWithCoaches);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setNextBooking(null);
      setUpcomingBookings([]);
    } finally {
      setLoadingBooking(false);
    }
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

  const formatDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const minutes = (end - start) / (1000 * 60);
    const hours = minutes / 60;
    return hours.toFixed(1);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back, {userName}!</Text>
          <Text style={styles.subtitle}>Here's what's happening today</Text>
        </View>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={onBookLesson}
          accessible={true}
          accessibilityLabel="Book a lesson"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.bookButtonText}>Book Lesson</Text>
        </TouchableOpacity>
      </View>

      {/* Grid Layout */}
      <View style={styles.grid}>
        {/* Credit Balance Card */}
        <View style={styles.gridItem}>
          <DashboardCard
            title="Credit Balance"
            value={`$${creditBalance.toFixed(2)}`}
            subtitle="Available credits"
            icon="wallet-outline"
            iconColor="#34C759"
            actionLabel="Top up"
            onAction={() => {
              // Handle top up
              console.log('Top up clicked');
            }}
          />
        </View>

        {/* Next Booking Card */}
        <View style={styles.gridItem}>
          <BookingCard booking={nextBooking} onBookLesson={onBookLesson} />
        </View>

        {/* Refunds Card - Only show if there are refunds */}
        {refunds && refunds.length > 0 && (
          <View style={styles.gridItem}>
            <RefundsCard refunds={refunds} />
          </View>
        )}
      </View>

      {/* Upcoming Bookings Section */}
      <View style={styles.upcomingSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
          {upcomingBookings.length > 0 && (
            <Text style={styles.sectionCount}>{upcomingBookings.length} {upcomingBookings.length === 1 ? 'booking' : 'bookings'}</Text>
          )}
        </View>

        {loadingBooking ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : upcomingBookings.length === 0 ? (
          <View style={styles.emptyBookingsContainer}>
            <Ionicons name="calendar-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyBookingsText}>No upcoming bookings</Text>
            <Text style={styles.emptyBookingsSubtext}>
              Book your first lesson to get started
            </Text>
          </View>
        ) : (
          <View style={styles.bookingsList}>
            {upcomingBookings.map((booking, index) => (
              <View key={booking.id} style={[styles.bookingCard, index > 0 && { marginTop: 12 }]}>
                <View style={styles.bookingCardHeader}>
                  <View style={styles.bookingDateContainer}>
                    <Ionicons name="calendar" size={20} color="#007AFF" />
                    <Text style={[styles.bookingDate, { marginLeft: 8 }]}>{formatDate(booking.start_time)}</Text>
                  </View>
                </View>
                
                <View style={styles.bookingCardDetails}>
                  <View style={[styles.bookingDetailRow, { marginBottom: 10 }]}>
                    <Ionicons name="time-outline" size={18} color="#8E8E93" />
                    <Text style={styles.bookingDetailText}>
                      {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                    </Text>
                  </View>
                  <View style={[styles.bookingDetailRow, { marginBottom: 10 }]}>
                    <Ionicons name="location-outline" size={18} color="#8E8E93" />
                    <Text style={styles.bookingDetailText}>
                      {booking.locations?.name || 'Location TBD'}
                    </Text>
                  </View>
                  <View style={styles.bookingDetailRow}>
                    <Ionicons name="hourglass-outline" size={18} color="#8E8E93" />
                    <Text style={styles.bookingDetailText}>
                      {formatDuration(booking.start_time, booking.end_time)} {formatDuration(booking.start_time, booking.end_time) === '1.0' ? 'hour' : 'hours'}
                    </Text>
                  </View>
                  {booking.coachName && (
                    <View style={styles.bookingDetailRow}>
                      <Ionicons name="person-circle-outline" size={18} color="#8E8E93" />
                      <Text style={styles.bookingDetailText}>
                        Coach: {booking.coachName}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Floating Action Button for Mobile */}
      <FloatingActionButton onPress={onBookLesson} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: isDesktop ? 32 : 20,
    paddingBottom: Platform.OS !== 'web' ? 100 : 32, // Space for bottom nav
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    ...(Platform.OS !== 'web' && {
      flexDirection: 'column',
    }),
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    ...(Platform.OS !== 'web' && {
      marginTop: 16,
      width: '100%',
      justifyContent: 'center',
    }),
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    }),
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  grid: {
    ...(Platform.OS === 'web' && {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -8,
    }),
  },
  gridItem: {
    width: '100%',
    ...(Platform.OS === 'web' && {
      width: 'calc(50% - 16px)',
      marginHorizontal: 8,
      maxWidth: 400,
    }),
  },
  upcomingSection: {
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyBookingsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  emptyBookingsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptyBookingsSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
  },
  bookingsList: {
    // gap: 12, // Not supported in all React Native versions
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap: 8, // Not supported in all React Native versions
  },
  bookingDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  bookingCardDetails: {
    // gap: 10, // Not supported in all React Native versions
  },
  bookingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap: 8, // Not supported in all React Native versions
  },
  bookingDetailText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
});
