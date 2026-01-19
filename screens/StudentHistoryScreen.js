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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { utcToSydneyDate, utcToSydneyTime } from '../utils/timezone';

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

export default function StudentHistoryScreen({ onBookLesson }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBookings(bookings);
    } else {
      const query = searchQuery.toLowerCase().trim();
      const filtered = bookings.filter((booking) => {
        const coachName = booking.coachName?.toLowerCase() || '';
        const serviceName = booking.service_name?.toLowerCase() || '';
        const location = booking.locationName?.toLowerCase() || '';
        return coachName.includes(query) || serviceName.includes(query) || location.includes(query);
      });
      setFilteredBookings(filtered);
    }
  }, [searchQuery, bookings]);

  const loadBookings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const now = new Date().toISOString();
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .eq('user_id', user.id)
        .lt('end_time', now)
        .order('end_time', { ascending: false });

      if (bookingsError) throw bookingsError;

      const bookingsWithCoaches = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          let coachName = null;
          let coachInitials = '?';

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
                  coachName = [coachFirstName, coachLastName].filter(Boolean).join(' ');
                  coachInitials = (coachFirstName?.[0] || '') + (coachLastName?.[0] || '');
                } else {
                  coachName = coachProfile.email || 'Unknown Coach';
                  coachInitials = coachName[0]?.toUpperCase() || '?';
                }
              }
            } catch (err) {
              console.error('Error fetching coach profile:', err);
            }
          }

          return {
            ...booking,
            coachName,
            coachInitials: coachInitials.toUpperCase(),
            locationName: booking.locations?.name || 'Unknown Location',
          };
        })
      );

      setBookings(bookingsWithCoaches);
      setFilteredBookings(bookingsWithCoaches);
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

  const formatDateCompact = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return { day, month };
  };

  const formatTime = (dateString) => {
    return utcToSydneyTime(dateString);
  };

  // Tennis Court SVG for empty state
  const TennisCourtIcon = () => {
    if (Platform.OS === 'web') {
      return (
        <div style={{
          width: 120,
          height: 80,
          opacity: 0.15,
          marginBottom: 20,
        }}>
          <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="116" height="76" rx="4" stroke="#0D9488" strokeWidth="2"/>
            <line x1="60" y1="2" x2="60" y2="78" stroke="#0D9488" strokeWidth="2"/>
            <line x1="2" y1="40" x2="118" y2="40" stroke="#0D9488" strokeWidth="1.5"/>
            <rect x="20" y="15" width="80" height="50" rx="2" stroke="#0D9488" strokeWidth="1.5" strokeDasharray="4 2"/>
          </svg>
        </div>
      );
    }
    return (
      <View style={styles.emptyIconContainer}>
        <Ionicons name="tennisball-outline" size={48} color="#0D9488" style={{ opacity: 0.3 }} />
      </View>
    );
  };

  // History Card Component
  const HistoryCard = ({ booking }) => {
    const dateInfo = formatDateCompact(booking.end_time);
    const serviceColor = getServiceColor(booking.service_name);

    const CardContent = () => (
      <View style={styles.cardContent}>
        {/* Left: Date Block */}
        <View style={[styles.dateBlock, { backgroundColor: serviceColor.light }]}>
          <Text style={[styles.dateDay, { color: serviceColor.primary }]}>{dateInfo.day}</Text>
          <Text style={[styles.dateMonth, { color: serviceColor.primary }]}>{dateInfo.month}</Text>
        </View>

        {/* Center: Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.serviceName} numberOfLines={1}>
            {booking.service_name || 'Tennis Session'}
          </Text>
          
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={13} color="#9CA3AF" />
            <Text style={styles.timeText}>
              {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
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

        {/* Right: Completed Badge */}
        <View style={styles.statusContainer}>
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={styles.completedText}>Completed</Text>
          </View>
        </View>
      </View>
    );

    if (Platform.OS === 'web') {
      return (
        <View style={styles.cardWrapper}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderRadius: '20px',
            border: `0.5px solid ${serviceColor.border}`,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
          }}>
            <CardContent />
          </div>
        </View>
      );
    }

    return (
      <View style={styles.cardWrapper}>
        <View style={[styles.nativeCard, { borderColor: serviceColor.border }]}>
          <CardContent />
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D9488" />
        <Text style={styles.loadingText}>Loading your history...</Text>
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
        <Text style={styles.subtitle}>Your completed tennis sessions</Text>
      </View>

      {/* Search Bar */}
      {bookings.length > 0 && (
        <View style={styles.searchWrapper}>
          {Platform.OS === 'web' ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '14px',
              border: '0.5px solid rgba(13, 148, 136, 0.2)',
              overflow: 'hidden',
            }}>
              <View style={styles.searchContent}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by coach, service, or location..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#9CA3AF"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </div>
          ) : (
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by coach, service, or location..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9CA3AF"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Results Count */}
      {bookings.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            {filteredBookings.length} {filteredBookings.length === 1 ? 'session' : 'sessions'}
            {searchQuery && ` matching "${searchQuery}"`}
          </Text>
        </View>
      )}

      {filteredBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <TennisCourtIcon />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching sessions' : 'No past sessions found'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Your completed lessons and performance data will appear here.'}
          </Text>
          {!searchQuery && onBookLesson && (
            <TouchableOpacity style={styles.bookButton} onPress={onBookLesson}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.bookButtonText}>Book a Lesson</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.bookingsList}>
          {filteredBookings.map((booking) => (
            <HistoryCard key={booking.id} booking={booking} />
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
    paddingBottom: 40,
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
    color: '#6B7280',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Search
  searchWrapper: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(13, 148, 136, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    padding: 0,
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
    }),
  },
  resultsContainer: {
    marginBottom: 16,
  },
  resultsText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Cards
  bookingsList: {
    gap: 0,
  },
  cardWrapper: {
    marginVertical: 8,
  },
  nativeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    borderWidth: 0.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  dateBlock: {
    width: 52,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.8,
  },
  infoSection: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 5,
  },
  timeText: {
    fontSize: 13,
    color: '#6B7280',
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  coachName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  statusContainer: {
    marginLeft: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 4,
  },
  completedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 24,
    lineHeight: 20,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
