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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { utcToSydneyDate, utcToSydneyTime } from '../utils/timezone';

export default function StudentHistoryScreen({ onBookLesson }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  const loadBookings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Server-side filter: Only fetch bookings where user_id matches current user AND end_time is in the past
      const now = new Date().toISOString();
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .eq('user_id', user.id) // Ensure only current user's bookings
        .lt('end_time', now) // Only past bookings
        .order('end_time', { ascending: false }); // Most recent first

      if (bookingsError) throw bookingsError;

      // Fetch coach information for bookings that have a coach_id
      const bookingsWithCoaches = await Promise.all(
        (bookingsData || []).map(async (booking) => {
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
            coachName,
            locationName: booking.locations?.name || 'Unknown Location',
          };
        })
      );

      setBookings(bookingsWithCoaches);
    } catch (error) {
      console.error('Error loading booking history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const formatDate = (dateString) => {
    return utcToSydneyDate(dateString);
  };

  const formatTime = (dateString) => {
    return utcToSydneyTime(dateString);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
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
        <Text style={styles.title}>Session History</Text>
        <Text style={styles.subtitle}>Your past tennis sessions</Text>
      </View>

      {bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No past sessions found</Text>
          <Text style={styles.emptySubtext}>
            Ready to hit the court?
          </Text>
          {onBookLesson && (
            <TouchableOpacity
              style={styles.bookButton}
              onPress={onBookLesson}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.bookButtonText}>Book a Lesson</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.bookingsList}>
          {bookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View style={styles.dateTimeContainer}>
                  <Text style={styles.dateText}>{formatDate(booking.end_time)}</Text>
                  <Text style={styles.timeText}>
                    {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="shield-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailLabel}>Coach:</Text>
                  <Text style={styles.detailValue}>
                    {booking.coachName || 'Not assigned'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailLabel}>Court:</Text>
                  <Text style={styles.detailValue}>{booking.locationName}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  bookingsList: {
    gap: 12,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    }),
  },
  bookingHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  dateTimeContainer: {
    gap: 4,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  timeText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  bookingDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginBottom: 24,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
