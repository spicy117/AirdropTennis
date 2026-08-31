import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Animated, View } from 'react-native';
import { memberColors, memberRadius, memberTypography, memberWebTransition, prefersReducedMotion } from '../../theme/memberTheme';

export default function AuthPrimaryButton({ label, onPress, loading, disabled, variant = 'primary' }) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = prefersReducedMotion();

  const onPressIn = () => {
    if (reduced) return;
    Animated.timing(scale, { toValue: 0.98, duration: 100, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    if (reduced) return;
    Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  };

  const isLime = variant === 'lime';

  return (
    <Animated.View style={{ transform: [{ scale: reduced ? 1 : scale }] }}>
      <TouchableOpacity
        style={[
          styles.btn,
          isLime && styles.btnLime,
          (disabled || loading) && styles.btnDisabled,
          memberWebTransition('background-color, opacity'),
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        activeOpacity={0.92}
      >
        {loading ? (
          <ActivityIndicator color={isLime ? memberColors.ink : memberColors.white} />
        ) : (
          <Text style={[styles.text, isLime && styles.textDark]}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function AuthTextLink({ label, onPress, disabled, subtle }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={styles.linkWrap}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Text style={[styles.link, subtle && styles.linkSubtle, disabled && styles.linkDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: memberRadius.md,
    backgroundColor: memberColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLime: {
    backgroundColor: memberColors.lime,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  text: {
    ...memberTypography.bodyStrong,
    fontSize: 16,
    color: memberColors.white,
  },
  textDark: {
    color: memberColors.ink,
  },
  linkWrap: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: memberColors.court,
  },
  linkSubtle: {
    fontWeight: '500',
    color: memberColors.inkMuted,
  },
  linkDisabled: {
    opacity: 0.5,
  },
});
