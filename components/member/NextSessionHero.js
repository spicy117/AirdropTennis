import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberShadow, memberTypography } from '../../theme/memberTheme';
import MemberButton from './MemberButton';

export default function NextSessionHero({
  booking,
  loading,
  onBook,
  onViewBooking,
  formatDate,
  formatTime,
  labels = {},
}) {
  const {
    nextOnCourt = 'Next on court',
    noBooking = 'Nothing booked yet',
    noBookingSub = 'Find a session and get back on court.',
    bookNow = 'Find a session',
    viewBooking = 'View booking',
    tennisLesson = 'Tennis lesson',
    tbd = 'TBD',
  } = labels;

  if (loading) {
    return (
      <View style={[styles.hero, styles.heroLoading]}>
        <ActivityIndicator color={memberColors.inkMuted} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.hero, styles.heroEmpty]}>
        <View style={styles.courtLines} pointerEvents="none">
          <View style={styles.courtLineH} />
          <View style={styles.courtLineV} />
        </View>
        <Text style={styles.eyebrow}>{nextOnCourt}</Text>
        <Text style={styles.emptyTitle}>{noBooking}</Text>
        <Text style={styles.emptySub}>{noBookingSub}</Text>
        <MemberButton label={bookNow} onPress={onBook} variant="lime" icon="arrow-forward" style={styles.cta} />
      </View>
    );
  }

  const d = new Date(booking.start_time);
  const dayNum = d.getDate();
  const dayName = d.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase();
  const month = d.toLocaleDateString('en-AU', { month: 'short' }).toUpperCase();

  return (
    <TouchableOpacity
      style={styles.hero}
      onPress={onViewBooking}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${booking.service_name || tennisLesson}, ${formatDate(booking.start_time)}`}
    >
      <View style={styles.courtLines} pointerEvents="none">
        <View style={styles.courtLineH} />
        <View style={styles.courtLineV} />
        <View style={[styles.limeOrb, { top: -20, right: -20 }]} />
      </View>

      <Text style={styles.eyebrow}>{nextOnCourt}</Text>

      <View style={styles.heroRow}>
        <View style={styles.dateBlock}>
          <Text style={styles.dayName}>{dayName}</Text>
          <Text style={styles.dayNum}>{dayNum}</Text>
          <Text style={styles.month}>{month}</Text>
        </View>

        <View style={styles.sessionInfo}>
          <Text style={styles.serviceName} numberOfLines={2}>
            {booking.service_name || tennisLesson}
          </Text>
          <Text style={styles.time}>{formatTime(booking.start_time)}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={memberColors.inkMuted} />
            <Text style={styles.location} numberOfLines={1}>
              {booking.locations?.name || tbd}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.viewRow}>
        <Text style={styles.viewText}>{viewBooking}</Text>
        <Ionicons name="arrow-forward" size={16} color={memberColors.ink} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: memberColors.surfaceRaised,
    borderRadius: memberRadius.xl,
    padding: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: memberColors.border,
    ...memberShadow.hero,
    minHeight: 200,
  },
  heroLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  heroEmpty: {
    minHeight: 220,
  },
  courtLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  courtLineH: {
    position: 'absolute',
    top: '55%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: memberColors.court,
    opacity: 0.12,
  },
  courtLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '38%',
    width: 1,
    backgroundColor: memberColors.court,
    opacity: 0.1,
  },
  limeOrb: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: memberColors.limeMuted,
    ...(Platform.OS === 'web' && { filter: 'blur(40px)' }),
  },
  eyebrow: {
    ...memberTypography.label,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
    flex: 1,
  },
  dateBlock: {
    alignItems: 'center',
    minWidth: 64,
    paddingTop: 4,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: memberColors.inkMuted,
    marginBottom: 2,
  },
  dayNum: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -2,
    color: memberColors.ink,
    lineHeight: 48,
  },
  month: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: memberColors.court,
    marginTop: 2,
  },
  sessionInfo: {
    flex: 1,
    paddingTop: 6,
  },
  serviceName: {
    ...memberTypography.h3,
    marginBottom: 6,
  },
  time: {
    ...memberTypography.statSm,
    fontSize: 22,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 14,
    color: memberColors.inkMuted,
    flex: 1,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: memberColors.border,
  },
  viewText: {
    fontSize: 14,
    fontWeight: '600',
    color: memberColors.ink,
  },
  emptyTitle: {
    ...memberTypography.h2,
    marginBottom: 6,
  },
  emptySub: {
    ...memberTypography.body,
    marginBottom: 20,
    maxWidth: 280,
  },
  cta: {
    alignSelf: 'flex-start',
  },
});
