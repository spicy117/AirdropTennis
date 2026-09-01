import React from 'react';
import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import { memberColors, memberRadius, memberWebTransition } from '../../theme/memberTheme';
import { formatStreakWeeks } from '../../utils/locale';

export default function StreakIndicator({ weeks = 0, onPress, labelEmpty, labelActive, t, compact = false }) {
  const hasStreak = weeks > 0;
  const text = hasStreak
    ? (labelActive || (t ? formatStreakWeeks(weeks, t) : `${weeks} weeks`))
    : (labelEmpty || 'Start your streak');

  const a11yLabel = hasStreak
    ? (labelActive || (t ? formatStreakWeeks(weeks, t) : `${weeks} week streak`))
    : (labelEmpty || 'Start your streak');

  return (
    <Pressable
      style={({ pressed, hovered }) => [
        styles.pill,
        compact && styles.pillCompact,
        hasStreak && styles.pillActive,
        hovered && Platform.OS === 'web' && styles.pillHovered,
        pressed && styles.pillPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <Text style={[styles.flame, compact && styles.flameCompact]}>🔥</Text>
      <Text style={[styles.text, compact && styles.textCompact, hasStreak && styles.textActive]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: memberRadius.pill,
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.border,
    marginBottom: 20,
    ...memberWebTransition('background-color, transform, border-color'),
  },
  pillCompact: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderColor: memberColors.border,
  },
  pillActive: {
    backgroundColor: memberColors.limeSoft,
    borderColor: 'rgba(212, 249, 52, 0.3)',
  },
  pillHovered: {
    ...(Platform.OS === 'web' && {
      borderColor: memberColors.borderStrong,
    }),
  },
  pillPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.94,
  },
  flame: {
    fontSize: 14,
    marginRight: 6,
  },
  flameCompact: {
    fontSize: 11,
    marginRight: 3,
    opacity: 0.85,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: memberColors.inkMuted,
  },
  textCompact: {
    fontSize: 11,
    fontWeight: '500',
    color: memberColors.inkFaint,
  },
  textActive: {
    color: memberColors.ink,
  },
});
