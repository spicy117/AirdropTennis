import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { getTranslation } from '../utils/translations';
import { getSydneyToday, sydneyDateToUTCStart, sydneyDateToUTCEnd } from '../utils/timezone';
import BookingEditModal from '../components/BookingEditModal';

export default function BookingsScreen({ onBookLesson }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  const loadBookings = async () => {
    if (!user) return;

    try {
      setLoading(true);
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

      setBookings(bookingsWithCoaches);
    } catch (error) {
      console.error('Error loading bookings:', error);
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('upcomingBookings')}</Text>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={onBookLesson}
          accessible={true}
          accessibilityLabel={t('bookLesson')}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.bookButtonText}>{t('bookLesson')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>{t('noUpcomingBookings')}</Text>
          <Text style={styles.emptyText}>
            {t('bookLesson')}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={onBookLesson}
            accessible={true}
            accessibilityLabel={t('bookLesson')}
            accessibilityRole="button"
          >
            <Text style={styles.emptyButtonText}>{t('bookLesson')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bookingsList}>
          {bookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View style={styles.bookingDateContainer}>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                  <Text style={styles.bookingDate}>{formatDate(booking.start_time)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setSelectedBooking(booking);
                    setEditModalVisible(true);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#007AFF" />
                  <Text style={styles.editButtonText}>{t('edit')}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.bookingDetails}>
                <View style={styles.bookingRow}>
                  <Ionicons name="time-outline" size={18} color="#8E8E93" />
                  <Text style={styles.bookingDetailText}>
                    {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                  </Text>
                </View>
                <View style={styles.bookingRow}>
                  <Ionicons name="location-outline" size={18} color="#8E8E93" />
                  <Text style={styles.bookingDetailText}>
                    {booking.locations?.name || t('location')}
                  </Text>
                </View>
                <View style={styles.bookingRow}>
                  <Ionicons name="hourglass-outline" size={18} color="#8E8E93" />
                  <Text style={styles.bookingDetailText}>
                    {formatDuration(booking.start_time, booking.end_time)} {formatDuration(booking.start_time, booking.end_time) === '1.0' ? t('hour') : t('hours')}
                  </Text>
                </View>
                {booking.coachName && (
                  <View style={styles.bookingRow}>
                    <Ionicons name="person-circle-outline" size={18} color="#8E8E93" />
                    <Text style={styles.bookingDetailText}>
                      {t('coach')}: {booking.coachName}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <BookingEditModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bookingsList: {
    gap: 16,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  statusBadgeConfirmed: {
    backgroundColor: '#E3F2FD',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'capitalize',
  },
  bookingDetails: {
    gap: 8,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingDetailText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});
