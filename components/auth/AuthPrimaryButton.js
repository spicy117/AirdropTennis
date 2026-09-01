import React, { useRef, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Animated, Platform, View } from 'react-native';
import { memberColors, memberTypography, memberWebTransition, prefersReducedMotion } from '../../theme/memberTheme';

export default function AuthPrimaryButton({ label, onPress, loading, disabled, variant = 'primary' }) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = prefersReducedMotion();
  const [hovered, setHovered] = useState(false);

  const onPressIn = () => {
    if (reduced) return;
    Animated.timing(scale, { toValue: 0.985, duration: 90, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    if (reduced) return;
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };

  const isLime = variant === 'lime';
  const webHoverProps =
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {};

  return (
    <Animated.View style={{ transform: [{ scale: reduced ? 1 : scale }] }}>
      <TouchableOpacity
        style={[
          styles.btn,
          isLime && styles.btnLime,
          hovered && !disabled && !loading && styles.btnHovered,
          isLime && hovered && !disabled && !loading && styles.btnLimeHovered,
          (disabled || loading) && styles.btnDisabled,
          memberWebTransition('background-color, opacity, transform'),
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        activeOpacity={0.9}
        {...webHoverProps}
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

export function AuthTextLink({ label, onPress, disabled, subtle, inline }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.linkWrap, inline && styles.linkWrapInline]}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Text style={[styles.link, subtle && styles.linkSubtle, disabled && styles.linkDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AuthDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: memberColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnLime: {
    backgroundColor: memberColors.lime,
  },
  btnHovered: {
    backgroundColor: '#2A2A2A',
  },
  btnLimeHovered: {
    backgroundColor: '#C8EB2E',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  text: {
    ...memberTypography.bodyStrong,
    fontSize: 15,
    color: memberColors.white,
    letterSpacing: -0.1,
  },
  textDark: {
    color: memberColors.ink,
  },
  linkWrap: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkWrapInline: {
    paddingVertical: 0,
    alignItems: 'flex-start',
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: memberColors.court,
    letterSpacing: -0.1,
  },
  linkSubtle: {
    fontWeight: '500',
    color: memberColors.inkMuted,
  },
  linkDisabled: {
    opacity: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: memberColors.border,
    marginVertical: 16,
    width: '100%',
  },
});
