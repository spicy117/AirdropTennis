import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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

// Get initials from name
const getInitials = (name) => {
  if (!name || name === 'Unknown Student') return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] || '?').toUpperCase();
};

// Generate avatar color from name
const getAvatarColor = (name) => {
  const colors = ['#0D9488', '#7C3AED', '#2563EB', '#D97706', '#DC2626', '#059669', '#6366F1', '#EC4899'];
  if (!name) return colors[0];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function AdminHistoryScreen({ onNavigate }) {
  const { user, userRole } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [groupedBookings, setGroupedBookings] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (userRole === 'admin') {
      loadBookings();
    } else {
      Alert.alert('Access Denied', 'This page is only accessible to administrators.', [{ text: 'OK' }]);
    }
  }, [userRole]);

  useEffect(() => {
    let filtered = bookings;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = bookings.filter((booking) => {
        const studentName = booking.studentName?.toLowerCase() || '';
        const coachName = booking.coachName?.toLowerCase() || '';
        const serviceName = booking.service_name?.toLowerCase() || '';
        return studentName.includes(query) || coachName.includes(query) || serviceName.includes(query);
      });
    }
    setFilteredBookings(filtered);
    
    // Group by date
    const grouped = {};
    filtered.forEach((booking) => {
      const dateKey = utcToSydneyDate(booking.end_time);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(booking);
    });
    setGroupedBookings(grouped);
  }, [searchQuery, bookings]);

  const loadBookings = async () => {
    try {
      setLoading(true);

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
        throw new Error('Access denied: Admin role required');
      }

      const now = new Date().toISOString();
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .lt('end_time', now)
        .order('end_time', { ascending: false });

      if (bookingsError) throw bookingsError;

      const bookingsWithNames = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          let studentName = 'Unknown Student';
          let coachName = null;

          if (booking.user_id) {
            try {
              const { data: studentProfile, error: studentError } = await supabase
                .from('profiles')
                .select('first_name, last_name, email')
                .eq('id', booking.user_id)
                .single();

              if (!studentError && studentProfile) {
                const firstName = studentProfile.first_name || null;
                const lastName = studentProfile.last_name || null;
                if (firstName || lastName) {
                  studentName = [firstName, lastName].filter(Boolean).join(' ');
                } else {
                  studentName = studentProfile.email || 'Unknown Student';
                }
              }
            } catch (err) {
              console.error('Error fetching student profile:', err);
            }
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
            ...booking,
            studentName,
            coachName,
            locationName: booking.locations?.name || 'Unknown Location',
          };
        })
      );

      setBookings(bookingsWithNames);
      setFilteredBookings(bookingsWithNames);
    } catch (error) {
      console.error('Error loading booking history:', error);
      Alert.alert('Error', 'Failed to load booking history. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
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

  // History Row Component (for admin view)
  const HistoryRow = ({ booking }) => {
    const serviceColor = getServiceColor(booking.service_name);
    const isSeasonPass = booking.is_season_pass_booking;

    return (
      <View style={styles.rowWrapper}>
        {Platform.OS === 'web' ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderRadius: '14px',
            border: `0.5px solid ${serviceColor.border}`,
            overflow: 'hidden',
          }}>
            <View style={styles.rowContent}>
              {/* Student Avatar */}
              <View style={[styles.studentAvatar, { backgroundColor: getAvatarColor(booking.studentName) }]}>
                <Text style={styles.studentAvatarText}>{getInitials(booking.studentName)}</Text>
              </View>

              {/* Student Name */}
              <View style={styles.studentInfo}>
                <Text style={styles.studentName} numberOfLines={1}>{booking.studentName}</Text>
                <Text style={styles.timeText}>{formatTime(booking.start_time)}</Text>
              </View>

              {/* Service Type */}
              <View style={[styles.serviceTag, { backgroundColor: serviceColor.light }]}>
                <Text style={[styles.serviceTagText, { color: serviceColor.primary }]} numberOfLines={1}>
                  {booking.service_name || 'Session'}
                </Text>
              </View>

              {/* Credit/Pass Indicator */}
              <View style={styles.indicatorContainer}>
                {isSeasonPass ? (
                  <View style={styles.passBadge}>
                    <Ionicons name="star" size={12} color="#D97706" />
                    <Text style={styles.passBadgeText}>Pass</Text>
                  </View>
                ) : (
                  <View style={styles.creditBadge}>
                    <Text style={styles.creditText}>${booking.credit_cost?.toFixed(0) || '0'}</Text>
                  </View>
                )}
              </View>
            </View>
          </div>
        ) : (
          <View style={[styles.nativeRow, { borderColor: serviceColor.border }]}>
            <View style={styles.rowContent}>
              <View style={[styles.studentAvatar, { backgroundColor: getAvatarColor(booking.studentName) }]}>
                <Text style={styles.studentAvatarText}>{getInitials(booking.studentName)}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName} numberOfLines={1}>{booking.studentName}</Text>
                <Text style={styles.timeText}>{formatTime(booking.start_time)}</Text>
              </View>
              <View style={[styles.serviceTag, { backgroundColor: serviceColor.light }]}>
                <Text style={[styles.serviceTagText, { color: serviceColor.primary }]} numberOfLines={1}>
                  {booking.service_name || 'Session'}
                </Text>
              </View>
              <View style={styles.indicatorContainer}>
                {isSeasonPass ? (
                  <View style={styles.passBadge}>
                    <Ionicons name="star" size={12} color="#D97706" />
                    <Text style={styles.passBadgeText}>Pass</Text>
                  </View>
                ) : (
                  <View style={styles.creditBadge}>
                    <Text style={styles.creditText}>${booking.credit_cost?.toFixed(0) || '0'}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Date Header Component
  const DateHeader = ({ date }) => (
    <View style={styles.dateHeader}>
      <View style={styles.dateHeaderLine} />
      <Text style={styles.dateHeaderText}>{date}</Text>
      <View style={styles.dateHeaderLine} />
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D9488" />
        <Text style={styles.loadingText}>Loading booking history...</Text>
      </View>
    );
  }

  const dateKeys = Object.keys(groupedBookings);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Booking History</Text>
          <Text style={styles.subtitle}>Past sessions and completed bookings</Text>
        </View>
        {onNavigate && (
          <TouchableOpacity
            style={styles.dashboardBtn}
            onPress={() => onNavigate('admin-dashboard')}
            activeOpacity={0.7}
          >
            <Ionicons name="grid-outline" size={18} color="#0D9488" />
            <Text style={styles.dashboardBtnText}>Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
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
                placeholder="Search students, coaches, or services..."
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
              placeholder="Search students, coaches, or services..."
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

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredBookings.length} {filteredBookings.length === 1 ? 'session' : 'sessions'}
          {searchQuery && ` matching "${searchQuery}"`}
        </Text>
      </View>

      {/* Bookings List Grouped by Date */}
      {dateKeys.length === 0 ? (
        <View style={styles.emptyState}>
          <TennisCourtIcon />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching sessions' : 'No past sessions found'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Completed bookings and session data will appear here.'}
          </Text>
        </View>
      ) : (
        <View style={styles.bookingsList}>
          {dateKeys.map((date) => (
            <View key={date}>
              <DateHeader date={date} />
              {groupedBookings[date].map((booking) => (
                <HistoryRow key={booking.id} booking={booking} />
              ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
    flexShrink: 0,
  },
  dashboardBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D9488',
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
  // Date Header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Row Styles
  bookingsList: {
    gap: 0,
  },
  rowWrapper: {
    marginVertical: 4,
  },
  nativeRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 14,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentInfo: {
    flex: 1,
    marginRight: 12,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  serviceTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 10,
    maxWidth: 120,
  },
  serviceTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  indicatorContainer: {
    alignItems: 'flex-end',
    minWidth: 50,
  },
  passBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  passBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
  },
  creditBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  creditText: {
    fontSize: 12,
    fontWeight: '700',
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
    lineHeight: 20,
  },
});
