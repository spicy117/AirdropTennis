import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { memberColors, memberRadius } from '../../theme/memberTheme';

export default function StreakIndicator({ weeks = 0, onPress, labelActive, labelEmpty }) {
  const hasStreak = weeks > 0;
  const text = hasStreak
    ? `${weeks} week${weeks !== 1 ? 's' : ''}`
    : labelEmpty || 'Start your streak';

  return (
    <TouchableOpacity
      style={[styles.pill, hasStreak && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={hasStreak ? `${weeks} week streak` : 'Start your streak'}
    >
      <Text style={styles.flame}>🔥</Text>
      <Text style={[styles.text, hasStreak && styles.textActive]}>{text}</Text>
    </TouchableOpacity>
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
  },
  pillActive: {
    backgroundColor: memberColors.limeSoft,
    borderColor: 'rgba(212, 249, 52, 0.35)',
  },
  flame: {
    fontSize: 14,
    marginRight: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: memberColors.inkMuted,
  },
  textActive: {
    color: memberColors.ink,
  },
});
