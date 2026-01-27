import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { getTranslation } from '../utils/translations';
import BookingEditModal from '../components/BookingEditModal';

// Service color configuration
const SERVICE_COLORS = {
  'Stroke Clinic': { primary: '#0D9488', light: 'rgba(13, 148, 136, 0.1)', border: 'rgba(13, 148, 136, 0.3)' },
  'Boot Camp': { primary: '#D97706', light: 'rgba(217, 119, 6, 0.1)', border: 'rgba(217, 119, 6, 0.3)' },
  'UTR Points Play': { primary: '#7C3AED', light: 'rgba(124, 58, 237, 0.1)', border: 'rgba(124, 58, 237, 0.3)' },
  'Private Lesson': { primary: '#2563EB', light: 'rgba(37, 99, 235, 0.1)', border: 'rgba(37, 99, 235, 0.3)' },
  default: { primary: '#0D9488', light: 'rgba(13, 148, 136, 0.1)', border: 'rgba(13, 148, 136, 0.3)' },
};

const getServiceColor = (serviceName) => {
  return SERVICE_COLORS[serviceName] || SERVICE_COLORS.default;
};

export default function BookingsScreen({ onBookLesson, refreshTrigger }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = (key, params) => (params && Object.keys(params).length ? tWithParams(language, key, params) : getTranslation(language, key));
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

  useEffect(() => {
    if (user && refreshTrigger != null) {
      loadBookings();
    }
  }, [refreshTrigger]);

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
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      const bookingsWithCoaches = await Promise.all(
        (data || []).map(async (booking) => {
          // Check for pending rain check request
          let hasPendingRainCheck = false;
          try {
            const { data: rainCheckRequest } = await supabase
              .from('booking_requests')
              .select('id')
              .eq('booking_id', booking.id)
              .eq('request_type', 'raincheck')
              .eq('status', 'pending')
              .limit(1);
            
            hasPendingRainCheck = rainCheckRequest && rainCheckRequest.length > 0;
          } catch (err) {
            console.error('Error checking rain check status:', err);
          }

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
                let coachInitials = '?';
                if (coachFirstName || coachLastName) {
                  coachName = [coachFirstName, coachLastName].filter(Boolean).join(' ');
                  coachInitials = (coachFirstName?.[0] || '') + (coachLastName?.[0] || '');
                } else {
                  coachName = coachProfile.email || 'Unknown Coach';
                  coachInitials = coachName[0]?.toUpperCase() || '?';
                }
                return { ...booking, coachName, coachInitials: coachInitials.toUpperCase(), hasPendingRainCheck };
              }
            } catch (err) {
              console.error('Error fetching coach profile:', err);
            }
          }
          return { ...booking, hasPendingRainCheck };
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

  const formatDateCompact = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return { day, month };
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
    const hrs = (end - start) / (1000 * 60 * 60);
    if (hrs === 1) return t('oneHr');
    if (hrs < 1) return t('minutes', { n: Math.round(hrs * 60) });
    return t('hours', { n: hrs });
  };

  const getStatusInfo = (startTime) => {
    const now = new Date();
    const bookingDate = new Date(startTime);
    const diffMs = bookingDate - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return { text: 'Today', color: '#DC2626', bgColor: 'rgba(220, 38, 38, 0.1)' };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', color: '#D97706', bgColor: 'rgba(217, 119, 6, 0.1)' };
    } else if (diffDays <= 7) {
      return { text: `In ${diffDays} days`, color: '#0D9488', bgColor: 'rgba(13, 148, 136, 0.1)' };
    } else {
      return { text: 'Confirmed', color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.1)' };
    }
  };

  // Elite Booking Card Component
  const BookingCard = ({ booking }) => {
    const dateInfo = formatDateCompact(booking.start_time);
    const serviceColor = getServiceColor(booking.service_name);
    const statusInfo = getStatusInfo(booking.start_time);
    const duration = formatDuration(booking.start_time, booking.end_time);

    const CardContent = () => (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => {
          setSelectedBooking(booking);
          setEditModalVisible(true);
        }}
        style={styles.cardTouchable}
      >
        {/* Status Pill - Top Right */}
        <View style={[styles.statusPill, { backgroundColor: statusInfo.bgColor }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
        </View>

        {/* Rain Check Pending Tag */}
        {booking.hasPendingRainCheck && (
          <View style={styles.rainCheckTag}>
            <Ionicons name="rainy" size={12} color="#007AFF" />
            <Text style={styles.rainCheckTagText}>{t('rainCheckPending')}</Text>
          </View>
        )}

        <View style={styles.cardLayout}>
          {/* Left: Date Block */}
          <View style={[styles.dateBlock, { backgroundColor: serviceColor.light }]}>
            <Text style={[styles.dateDay, { color: serviceColor.primary }]}>{dateInfo.day}</Text>
            <Text style={[styles.dateMonth, { color: serviceColor.primary }]}>{dateInfo.month}</Text>
          </View>

          {/* Middle: Info Section */}
          <View style={styles.infoSection}>
            {/* Service Name */}
            <Text style={styles.serviceName} numberOfLines={1}>
              {booking.service_name || 'Tennis Session'}
            </Text>

            {/* Time & Duration */}
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text style={styles.timeText}>
                {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
              </Text>
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{duration}</Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#9CA3AF" />
              <Text style={styles.locationText} numberOfLines={1}>
                {booking.locations?.name || t('locationTbd')}
              </Text>
            </View>

            {/* Coach with Avatar */}
            {booking.coachName && (
              <View style={styles.coachRow}>
                <View style={[styles.coachAvatar, { backgroundColor: serviceColor.primary }]}>
                  <Text style={styles.coachAvatarText}>{booking.coachInitials || '?'}</Text>
                </View>
                <Text style={styles.coachName}>{booking.coachName}</Text>
              </View>
            )}
          </View>

          {/* Right: Chevron Arrow */}
          <View style={styles.chevronContainer}>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </View>
        </View>
      </TouchableOpacity>
    );

    // Web: Glassmorphism with CSS
    if (Platform.OS === 'web') {
      return (
        <View style={styles.cardWrapper}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            borderRadius: '24px',
            border: `0.5px solid ${serviceColor.border}`,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          }}>
            <CardContent />
          </div>
        </View>
      );
    }

    // Native fallback
    return (
      <View style={styles.cardWrapper}>
        <View style={[styles.nativeCard, { borderColor: serviceColor.border }]}>
          <CardContent />
        </View>
      </View>
    );
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
        <View>
          <Text style={styles.title}>{t('upcomingBookings')}</Text>
          <Text style={styles.subtitle}>
            {bookings.length === 1 ? t('sessionsScheduled', { count: bookings.length }) : t('sessionsScheduledPlural', { count: bookings.length })}
          </Text>
        </View>
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
          <ActivityIndicator size="large" color="#0D9488" />
          <Text style={styles.loadingText}>{t('loadingSessions')}</Text>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="calendar-outline" size={48} color="#0D9488" />
          </View>
          <Text style={styles.emptyTitle}>{t('noUpcomingBookings')}</Text>
          <Text style={styles.emptyText}>{t('readyToHitCourt')}</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={onBookLesson}
            accessible={true}
            accessibilityLabel={t('bookLesson')}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.emptyButtonText}>{t('bookLesson')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bookingsList}>
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
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
        onBookingCancelled={() => {
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 8px rgba(13, 148, 136, 0.3)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#0D9488',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    }),
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bookingsList: {
    gap: 0, // We use marginVertical on cards instead
  },
  // Card Styles
  cardWrapper: {
    marginVertical: 12,
  },
  nativeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    borderWidth: 0.5,
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 3,
    }),
  },
  cardTouchable: {
    padding: 18,
  },
  statusPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardLayout: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Date Block
  dateBlock: {
    width: 56,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.8,
  },
  // Info Section
  infoSection: {
    flex: 1,
    paddingRight: 8,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    paddingRight: 60, // Space for status pill
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  durationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: '#9CA3AF',
    flex: 1,
  },
  // Coach Row
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  coachAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  coachName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Chevron
  chevronContainer: {
    paddingLeft: 8,
  },
  // Rain Check Tag
  rainCheckTag: {
    position: 'absolute',
    top: 40,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    zIndex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  rainCheckTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: 0.2,
  },
});
