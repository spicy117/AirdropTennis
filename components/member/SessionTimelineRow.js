import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberWebTransition } from '../../theme/memberTheme';

export default function SessionTimelineRow({ booking, onPress, formatTime, tennisLesson = 'Tennis lesson', showDivider = true }) {
  const d = new Date(booking.start_time);
  const day = d.getDate();
  const month = d.toLocaleDateString('en-AU', { month: 'short' });

  return (
    <>
      <Pressable
        style={({ pressed, hovered }) => [
          styles.row,
          hovered && Platform.OS === 'web' && styles.rowHovered,
          pressed && styles.rowPressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
      >
        <View style={styles.dateTile}>
          <Text style={styles.month}>{month}</Text>
          <Text style={styles.day}>{day}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.time}>{formatTime(booking.start_time)}</Text>
          <Text style={styles.title} numberOfLines={1}>{booking.service_name || tennisLesson}</Text>
          <Text style={styles.meta} numberOfLines={1}>{booking.locations?.name || 'TBD'}</Text>
        </View>
        {booking.hasPendingRainCheck && (
          <View style={styles.rainTag}>
            <Ionicons name="rainy" size={12} color="#2563EB" />
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={memberColors.inkFaint} />
      </Pressable>
      {showDivider && <View style={styles.divider} />}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderRadius: memberRadius.sm,
    marginHorizontal: -4,
    paddingHorizontal: 4,
    ...memberWebTransition('background-color'),
  },
  rowHovered: {
    ...(Platform.OS === 'web' && { backgroundColor: memberColors.limeSoft }),
  },
  rowPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  dateTile: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: memberRadius.md,
    backgroundColor: memberColors.bg,
    borderWidth: 1,
    borderColor: memberColors.border,
  },
  month: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: memberColors.inkMuted,
    textTransform: 'capitalize',
  },
  day: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: memberColors.ink,
    lineHeight: 26,
  },
  info: {
    flex: 1,
  },
  time: {
    fontSize: 13,
    fontWeight: '600',
    color: memberColors.court,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: memberColors.ink,
    marginBottom: 2,
  },
  meta: {
    fontSize: 13,
    color: memberColors.inkMuted,
  },
  rainTag: {
    padding: 6,
    borderRadius: memberRadius.sm,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  divider: {
    height: 1,
    backgroundColor: memberColors.border,
    marginLeft: 66,
  },
});
