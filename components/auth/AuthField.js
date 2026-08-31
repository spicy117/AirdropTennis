import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { memberColors, memberRadius, memberTypography, memberWebTransition } from '../../theme/memberTheme';

export default function AuthField({
  label,
  error,
  hint,
  containerStyle,
  inputStyle,
  rightElement,
  ...inputProps
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text style={styles.label} nativeID={inputProps.nativeID}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          error && styles.inputRowError,
        ]}
      >
        <TextInput
          style={[styles.input, rightElement && styles.inputWithRight, inputStyle]}
          placeholderTextColor={memberColors.inkFaint}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          accessibilityLabel={label || inputProps.accessibilityLabel}
          {...inputProps}
        />
        {rightElement}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    ...memberTypography.label,
    textTransform: 'none',
    fontSize: 13,
    fontWeight: '600',
    color: memberColors.inkSecondary,
    marginBottom: 6,
    letterSpacing: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: memberColors.border,
    borderRadius: memberRadius.md,
    backgroundColor: memberColors.surfaceRaised,
    ...memberWebTransition('border-color, box-shadow'),
    ...(Platform.OS === 'web' && {
      boxShadow: '0 1px 2px rgba(20, 20, 20, 0.04)',
    }),
  },
  inputRowFocused: {
    borderColor: memberColors.court,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 0 3px rgba(30, 61, 50, 0.12)',
    }),
  },
  inputRowError: {
    borderColor: memberColors.danger,
    backgroundColor: memberColors.dangerSoft,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: memberColors.ink,
    minHeight: 44,
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
      WebkitAppearance: 'none',
    }),
  },
  inputWithRight: {
    paddingRight: 52,
  },
  error: {
    fontSize: 12,
    color: memberColors.danger,
    marginTop: 6,
    lineHeight: 16,
  },
  hint: {
    fontSize: 12,
    color: memberColors.inkMuted,
    marginTop: 6,
    lineHeight: 16,
  },
});
