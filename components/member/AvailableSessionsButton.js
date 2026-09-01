import React from 'react';
import { Text, StyleSheet, Pressable, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberWebTransition } from '../../theme/memberTheme';

export default function AvailableSessionsButton({ label, onPress, variant = 'secondary' }) {
  const isBooking = variant === 'booking' || variant === 'primary';
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      style={({ pressed, hovered }) => [
        styles.btn,
        isBooking && styles.btnBooking,
        isSecondary && styles.btnSecondary,
        hovered && Platform.OS === 'web' && isBooking && styles.btnBookingHover,
        hovered && Platform.OS === 'web' && isSecondary && styles.btnSecondaryHover,
        pressed && styles.btnPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {isBooking && <View style={styles.limeAccent} />}
      <Text
        style={[
          styles.label,
          isBooking && styles.labelBooking,
          isSecondary && styles.labelSecondary,
        ]}
      >
        {label}
      </Text>
      <Ionicons
        name="arrow-forward"
        size={16}
        color={isBooking ? memberColors.lime : memberColors.court}
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
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: memberRadius.md,
    alignSelf: 'stretch',
    position: 'relative',
    overflow: 'hidden',
    ...memberWebTransition('background-color, transform, box-shadow'),
  },
  btnBooking: {
    backgroundColor: memberColors.court,
  },
  btnBookingHover: {
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 14px rgba(30, 61, 50, 0.22)',
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
  limeAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: memberColors.lime,
  },
  btnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.94,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  labelBooking: {
    color: memberColors.white,
  },
  labelSecondary: {
    color: memberColors.court,
  },
});
