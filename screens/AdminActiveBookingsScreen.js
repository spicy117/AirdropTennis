import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { utcToSydneyDate, utcToSydneyTime } from '../utils/timezone';

export default function AdminActiveBookingsScreen({ onNavigate }) {
  const { user, userRole } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [groupedByDate, setGroupedByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (userRole === 'admin') {
      loadBookings();
    } else {
      Alert.alert('Access Denied', 'This page is only accessible to administrators.', [{ text: 'OK' }]);
    }
  }, [userRole]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .gte('end_time', now)
        .order('start_time', { ascending: true })
        .limit(200);

      if (bookingsError) throw bookingsError;

      const bookingsWithDetails = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          let studentName = 'Unknown Student';
          let coachName = '—';
          if (booking.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', booking.user_id)
              .single();
            if (profile) {
              const fn = profile.first_name || '';
              const ln = profile.last_name || '';
              studentName = [fn, ln].filter(Boolean).join(' ') || profile.email || 'Unknown Student';
            }
          }
          if (booking.coach_id) {
            const { data: coach } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', booking.coach_id)
              .single();
            if (coach) {
              const fn = coach.first_name || '';
              const ln = coach.last_name || '';
              coachName = [fn, ln].filter(Boolean).join(' ') || '—';
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

      setBookings(bookingsWithDetails);

      const byDate = {};
      bookingsWithDetails.forEach((b) => {
        const dateKey = utcToSydneyDate(b.start_time);
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push(b);
      });
      setGroupedByDate(byDate);
    } catch (error) {
      console.error('Error loading active bookings:', error);
      setBookings([]);
      setGroupedByDate({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const dateKeys = Object.keys(groupedByDate).sort();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Active Bookings</Text>
        <Text style={styles.subtitle}>All upcoming lessons</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0D9488" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : dateKeys.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="calendar-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No upcoming bookings</Text>
          <Text style={styles.emptySub}>Bookings will appear here when students book or you assign lessons.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {dateKeys.map((dateKey) => (
            <View key={dateKey} style={styles.dateSection}>
              <View style={styles.dateHeader}>
                <Ionicons name="calendar" size={18} color="#0D9488" />
                <Text style={styles.dateHeaderText}>{dateKey}</Text>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{groupedByDate[dateKey].length}</Text>
                </View>
              </View>
              {groupedByDate[dateKey].map((b) => (
                <View key={b.id} style={styles.row}>
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeText}>{utcToSydneyTime(b.start_time)}</Text>
                  </View>
                  <View style={styles.detailsBlock}>
                    <Text style={styles.studentText} numberOfLines={1}>{b.studentName}</Text>
                    <Text style={styles.metaText}>
                      {b.locationName} · {b.service_name || 'Session'}
                    </Text>
                    <Text style={styles.coachText}>Coach: {b.coachName}</Text>
                  </View>
                </View>
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  list: {
    gap: 24,
  },
  dateSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0FDFA',
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F766E',
    marginLeft: 8,
  },
  dateBadge: {
    marginLeft: 'auto',
    backgroundColor: '#0D9488',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  timeBlock: {
    width: 72,
    marginRight: 16,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  detailsBlock: {
    flex: 1,
  },
  studentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  coachText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
