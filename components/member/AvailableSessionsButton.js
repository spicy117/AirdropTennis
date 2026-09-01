import React from 'react';
import { Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberWebTransition } from '../../theme/memberTheme';

export default function AvailableSessionsButton({ label, onPress, variant = 'primary' }) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      style={({ pressed, hovered }) => [
        styles.btn,
        isPrimary ? styles.btnPrimary : styles.btnSecondary,
        hovered && Platform.OS === 'web' && (isPrimary ? styles.btnPrimaryHover : styles.btnSecondaryHover),
        pressed && styles.btnPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>{label}</Text>
      <Ionicons
        name="arrow-forward"
        size={16}
        color={isPrimary ? memberColors.ink : memberColors.court}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: memberRadius.md,
    alignSelf: 'stretch',
    ...memberWebTransition('background-color, transform, box-shadow'),
  },
  btnPrimary: {
    backgroundColor: memberColors.lime,
  },
  btnPrimaryHover: {
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 16px rgba(212, 249, 52, 0.35)',
    }),
  },
  btnSecondary: {
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.border,
  },
  btnSecondaryHover: {
    ...(Platform.OS === 'web' && { backgroundColor: memberColors.limeSoft }),
  },
  btnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.94,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  labelPrimary: {
    color: memberColors.ink,
  },
  labelSecondary: {
    color: memberColors.court,
  },
});
