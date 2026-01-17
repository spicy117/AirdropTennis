import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';

export default function ShowPasswordToggle({ show, onToggle, accessible = true }) {
  return (
    <TouchableOpacity
      style={styles.toggle}
      onPress={onToggle}
      accessible={accessible}
      accessibilityLabel={show ? 'Hide password' : 'Show password'}
      accessibilityRole="button"
      accessibilityHint="Toggles password visibility"
    >
      <Text style={styles.icon}>{show ? 'Hide' : 'Show'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    zIndex: 1,
  },
  icon: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#8E8E93',
  },
});
