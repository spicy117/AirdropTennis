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

export default function AdminHistoryScreen() {
  const { user, userRole } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (userRole === 'admin') {
      loadBookings();
    } else {
      // Redirect if not admin
      Alert.alert(
        'Access Denied',
        'This page is only accessible to administrators.',
        [{ text: 'OK' }]
      );
    }
  }, [userRole]);

  useEffect(() => {
    // Filter bookings based on search query
    if (!searchQuery.trim()) {
      setFilteredBookings(bookings);
    } else {
      const query = searchQuery.toLowerCase().trim();
      const filtered = bookings.filter((booking) => {
        const studentName = booking.studentName?.toLowerCase() || '';
        const coachName = booking.coachName?.toLowerCase() || '';
        return studentName.includes(query) || coachName.includes(query);
      });
      setFilteredBookings(filtered);
    }
  }, [searchQuery, bookings]);

  const loadBookings = async () => {
    try {
      setLoading(true);

      // Server-side verification: Check admin role
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

      // Fetch all past bookings (end_time < current time)
      const now = new Date().toISOString();
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .lt('end_time', now)
        .order('end_time', { ascending: false }); // Most recent first

      if (bookingsError) throw bookingsError;

      // Fetch student and coach names for each booking
      const bookingsWithNames = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          let studentName = 'Unknown Student';
          let coachName = null;

          // Fetch student name
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

          // Fetch coach name if assigned
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
        <Text style={styles.loadingText}>Loading booking history...</Text>
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
        <Text style={styles.title}>Booking History</Text>
        <Text style={styles.subtitle}>Past sessions and completed bookings</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Student Name or Coach Name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8E8E93"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredBookings.length} {filteredBookings.length === 1 ? 'session' : 'sessions'}
          {searchQuery && ` matching "${searchQuery}"`}
        </Text>
      </View>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No matching sessions found' : 'No past sessions'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Completed bookings will appear here'}
          </Text>
        </View>
      ) : (
        <View style={styles.bookingsList}>
          {filteredBookings.map((booking) => (
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
                  <Ionicons name="person-outline" size={16} color="#8E8E93" />
                  <Text style={styles.detailLabel}>Student:</Text>
                  <Text style={styles.detailValue}>{booking.studentName}</Text>
                </View>

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    }),
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  resultsContainer: {
    marginBottom: 16,
  },
  resultsText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
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
  },
});
