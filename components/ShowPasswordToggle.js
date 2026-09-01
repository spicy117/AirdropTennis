import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { memberColors } from '../theme/memberTheme';

export default function ShowPasswordToggle({ show, onToggle, accessible = true }) {
  return (
    <TouchableOpacity
      style={styles.toggle}
      onPress={onToggle}
      accessible={accessible}
      accessibilityLabel={show ? 'Hide password' : 'Show password'}
      accessibilityRole="button"
      accessibilityHint="Toggles password visibility"
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      activeOpacity={0.65}
    >
      <Text style={styles.label}>{show ? 'Hide' : 'Show'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    minWidth: 48,
    zIndex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: memberColors.inkMuted,
  },
});
