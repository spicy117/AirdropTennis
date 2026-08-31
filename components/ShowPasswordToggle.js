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
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{show ? 'Hide' : 'Show'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggle: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    minWidth: 44,
    zIndex: 1,
  },
  icon: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: memberColors.court,
  },
});
