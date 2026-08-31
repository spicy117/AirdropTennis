import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Animated, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberTypography, memberWebTransition, prefersReducedMotion } from '../../theme/memberTheme';

export default function MemberButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'right',
  loading = false,
  disabled = false,
  compact = false,
  style,
  textStyle,
  accessibilityLabel,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = prefersReducedMotion();

  const onPressIn = () => {
    if (reduced) return;
    Animated.timing(scale, { toValue: 0.97, duration: 100, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    if (reduced) return;
    Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  };

  const variantStyle =
    variant === 'secondary'
      ? styles.secondary
      : variant === 'ghost'
        ? styles.ghost
        : variant === 'lime'
          ? styles.lime
          : styles.primary;

  const textVariantStyle =
    variant === 'secondary' || variant === 'ghost' ? styles.textDark : styles.textLight;

  return (
    <Animated.View style={[{ transform: [{ scale: reduced ? 1 : scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        activeOpacity={0.92}
        style={[styles.base, compact && styles.compact, variantStyle, (disabled || loading) && styles.disabled, memberWebTransition('background-color, opacity')]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'lime' ? memberColors.ink : memberColors.white} size="small" />
        ) : (
          <View style={styles.inner}>
            {icon && iconPosition === 'left' && <Ionicons name={icon} size={18} color={variant === 'lime' ? memberColors.ink : memberColors.white} style={styles.iconLeft} />}
            <Text style={[styles.label, compact && styles.labelCompact, textVariantStyle, textStyle]}>{label}</Text>
            {icon && iconPosition === 'right' && <Ionicons name={icon} size={18} color={variant === 'lime' ? memberColors.ink : memberColors.white} style={styles.iconRight} />}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: memberRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primary: {
    backgroundColor: memberColors.ink,
  },
  lime: {
    backgroundColor: memberColors.lime,
  },
  secondary: {
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.45,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...memberTypography.bodyStrong,
    fontSize: 15,
  },
  labelCompact: {
    fontSize: 14,
  },
  textLight: {
    color: memberColors.white,
  },
  textDark: {
    color: memberColors.ink,
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});
