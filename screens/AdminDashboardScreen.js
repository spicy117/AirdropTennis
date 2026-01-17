import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import StatCard from '../components/StatCard';
import { getSydneyToday, sydneyDateToUTCStart, sydneyDateToUTCEnd } from '../utils/timezone';

export default function DashboardScreen() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalBookings: 0,
    todayBookings: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Get total students (users with student role)
      const { count: studentCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      // Get total bookings
      const { count: bookingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

      // Get today's bookings - convert Sydney local date to UTC for query
      const todayStr = getSydneyToday();
      const startOfDay = sydneyDateToUTCStart(todayStr);
      const endOfDay = sydneyDateToUTCEnd(todayStr);

      const { count: todayCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

      // Get total revenue (sum of credit_cost)
      const { data: bookings } = await supabase
        .from('bookings')
        .select('credit_cost');

      const revenue = bookings?.reduce((sum, b) => sum + (parseFloat(b.credit_cost) || 0), 0) || 0;

      setStats({
        totalStudents: studentCount || 0,
        totalBookings: bookingCount || 0,
        todayBookings: todayCount || 0,
        totalRevenue: revenue,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadStats} />
      }
    >
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Overview of your tennis court bookings</Text>

      <View style={styles.grid}>
        <StatCard
          title="Total Students"
          value={stats.totalStudents.toString()}
          icon="people-outline"
          iconColor="#007AFF"
        />
        <StatCard
          title="Total Bookings"
          value={stats.totalBookings.toString()}
          icon="calendar-outline"
          iconColor="#34C759"
        />
        <StatCard
          title="Today's Bookings"
          value={stats.todayBookings.toString()}
          icon="today-outline"
          iconColor="#FF9500"
        />
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toFixed(2)}`}
          icon="cash-outline"
          iconColor="#34C759"
        />
      </View>
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 24,
  },
  grid: {
    ...(Platform.OS === 'web' && {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -8,
    }),
  },
});
