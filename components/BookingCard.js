import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardCard from './DashboardCard';

export default function BookingCard({ booking, onBookLesson }) {
  if (!booking) {
    return (
      <DashboardCard
        title="Next Upcoming Booking"
        icon="calendar-outline"
        iconColor="#007AFF"
        actionLabel="Book a lesson"
        onAction={onBookLesson}
      >
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color="#C7C7CC" />
          <Text style={styles.emptyText}>No upcoming lessons</Text>
          <Text style={styles.emptySubtext}>
            Book your first lesson to get started
          </Text>
        </View>
      </DashboardCard>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
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
    <DashboardCard
      title="Next Upcoming Booking"
      icon="calendar-outline"
      iconColor="#007AFF"
      actionLabel="View all bookings"
      onAction={onBookLesson}
    >
      <View style={styles.bookingContent}>
        <View style={styles.dateTimeContainer}>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar" size={18} color="#007AFF" />
            <Text style={styles.dateText}>{formatDate(booking.start_time)}</Text>
          </View>
          <View style={styles.timeBadge}>
            <Ionicons name="time" size={18} color="#34C759" />
            <Text style={styles.timeText}>
              {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
            </Text>
          </View>
        </View>
        
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={20} color="#8E8E93" />
            <Text style={styles.detailText}>
              {booking.locations?.name || 'Location TBD'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="hourglass" size={20} color="#8E8E93" />
            <Text style={styles.detailText}>
              {formatDuration(booking.start_time, booking.end_time)} {formatDuration(booking.start_time, booking.end_time) === '1.0' ? 'hour' : 'hours'}
            </Text>
          </View>
          {booking.coachName && (
            <View style={styles.detailRow}>
              <Ionicons name="person-circle" size={20} color="#8E8E93" />
              <Text style={styles.detailText}>
                Coach: {booking.coachName}
              </Text>
            </View>
          )}
        </View>
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
  },
  bookingContent: {
    marginTop: 12,
  },
  dateTimeContainer: {
    marginBottom: 16,
    gap: 8,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
    marginLeft: 8,
  },
  detailsContainer: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 15,
    color: '#000',
    flex: 1,
  },
});
