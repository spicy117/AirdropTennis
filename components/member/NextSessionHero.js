import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberShadow, memberTypography, memberWebTransition } from '../../theme/memberTheme';
import MemberButton from './MemberButton';
import CourtWatermark from './CourtWatermark';
import { HeroSkeleton } from './MemberSkeleton';
import { formatHeroDateParts } from '../../utils/locale';
import { translateServiceName } from '../../utils/serviceTranslations';
import { getTranslation } from '../../utils/translations';

export default function NextSessionHero({
  booking,
  loading,
  onBook,
  onViewBooking,
  formatDate,
  formatTime,
  language = 'en',
  labels = {},
  compact = false,
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 640 && !compact;

  const {
    nextOnCourt,
    noBooking,
    noBookingSub,
    bookNow,
    viewBooking,
    tennisLesson,
    tbd,
  } = labels;

  if (loading) {
    return <HeroSkeleton />;
  }

  if (!booking) {
    return (
      <View style={[styles.hero, styles.heroEmpty, compact && styles.heroEmptyCompact]}>
        <CourtWatermark variant="hero" />
        <View style={[styles.heroBody, compact && styles.heroBodyCompact]}>
          <Text style={[styles.eyebrow, compact && styles.eyebrowCompact]}>{nextOnCourt}</Text>
          <Text style={styles.emptyTitle}>{noBooking}</Text>
          <Text style={styles.emptySub}>{noBookingSub}</Text>
          <MemberButton label={bookNow} onPress={onBook} variant="lime" icon="arrow-forward" style={styles.cta} />
        </View>
      </View>
    );
  }

  const d = new Date(booking.start_time);
  const dateParts = formatHeroDateParts(d, language);
  const t = (key) => getTranslation(language, key);
  const serviceLabel = translateServiceName(
    booking.service_name,
    t,
    booking.service_name || tennisLesson
  );

  return (
    <Pressable
      style={({ pressed, hovered }) => [
        styles.hero,
        compact && styles.heroCompact,
        hovered && Platform.OS === 'web' && styles.heroHovered,
        pressed && styles.heroPressed,
      ]}
      onPress={onViewBooking}
      accessibilityRole="button"
      accessibilityLabel={`${serviceLabel}, ${formatDate(booking.start_time)}`}
    >
      <CourtWatermark variant="hero" />

      <View style={[styles.heroBody, isWide && styles.heroBodyWide, compact && styles.heroBodyCompact]}>
        <Text style={[styles.eyebrow, compact && styles.eyebrowCompact]}>{nextOnCourt}</Text>

        <View style={[styles.heroRow, compact && styles.heroRowCompact]}>
          <View style={[styles.dateBlock, compact && styles.dateBlockCompact]}>
            {dateParts.layout === 'zh' ? (
              <>
                <Text style={[styles.dayNumZh, compact && styles.dayNumZhCompact]}>{dateParts.primary}</Text>
                <Text style={styles.dayName}>{dateParts.secondary}</Text>
              </>
            ) : (
              <>
                <Text style={styles.dayName}>{dateParts.tertiary}</Text>
                <Text style={[styles.dayNum, compact && styles.dayNumCompact]}>{dateParts.primary}</Text>
                <Text style={styles.month}>{dateParts.secondary}</Text>
              </>
            )}
          </View>

          <View style={[styles.sessionInfo, compact && styles.sessionInfoCompact]}>
            <Text style={[styles.serviceName, compact && styles.serviceNameCompact]} numberOfLines={2}>
              {serviceLabel}
            </Text>
            <Text style={[styles.time, compact && styles.timeCompact]}>{formatTime(booking.start_time)}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={memberColors.inkMuted} />
              <Text style={styles.location} numberOfLines={1}>
                {booking.locations?.name || tbd}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.viewRow, compact && styles.viewRowCompact]}>
          <Text style={styles.viewText}>{viewBooking}</Text>
          <Ionicons name="arrow-forward" size={16} color={memberColors.ink} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: memberColors.surfaceRaised,
    borderRadius: memberRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: memberColors.border,
    ...memberShadow.hero,
    minHeight: 200,
    position: 'relative',
    ...memberWebTransition('box-shadow, transform, border-color'),
  },
  heroCompact: {
    minHeight: 168,
  },
  heroHovered: {
    ...(Platform.OS === 'web' && {
      boxShadow: '0 20px 48px rgba(20, 20, 20, 0.11)',
      borderColor: memberColors.borderStrong,
    }),
  },
  heroPressed: {
    transform: [{ scale: 0.995 }],
    opacity: 0.97,
  },
  heroEmpty: {
    padding: 22,
    minHeight: 220,
  },
  heroEmptyCompact: {
    padding: 16,
    minHeight: 180,
  },
  heroBody: {
    padding: 22,
    zIndex: 1,
    maxWidth: '100%',
  },
  heroBodyCompact: {
    padding: 16,
  },
  heroBodyWide: {
    maxWidth: '62%',
  },
  eyebrow: {
    ...memberTypography.label,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
  },
  eyebrowCompact: {
    marginBottom: 8,
  },
  heroRowCompact: {
    gap: 14,
  },
  dateBlockCompact: {
    minWidth: 56,
    paddingTop: 2,
  },
  dayNumCompact: {
    fontSize: 38,
    lineHeight: 42,
  },
  dayNumZhCompact: {
    fontSize: 20,
    lineHeight: 26,
  },
  sessionInfoCompact: {
    paddingTop: 2,
  },
  serviceNameCompact: {
    marginBottom: 4,
  },
  timeCompact: {
    fontSize: 20,
    marginBottom: 6,
  },
  viewRowCompact: {
    marginTop: 12,
    paddingTop: 10,
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
    fontSize: 12,
    fontWeight: '600',
    color: memberColors.inkMuted,
    marginBottom: 2,
    textAlign: 'center',
  },
  dayNum: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -2,
    color: memberColors.ink,
    lineHeight: 48,
  },
  dayNumZh: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0,
    color: memberColors.ink,
    lineHeight: 28,
    textAlign: 'center',
  },
  month: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
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
