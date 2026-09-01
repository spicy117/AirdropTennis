import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { memberColors, memberTypography, memberWebTransition } from '../../theme/memberTheme';

/** iOS Safari auto-zooms inputs below 16px computed font-size. */
const MOBILE_WEB_INPUT_FONT_SIZE = 16;
const DESKTOP_INPUT_FONT_SIZE = 15;

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
  const { width } = useWindowDimensions();
  const inputFontSize =
    Platform.OS === 'web' && width <= 768 ? MOBILE_WEB_INPUT_FONT_SIZE : DESKTOP_INPUT_FONT_SIZE;

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
          style={[
            styles.input,
            { fontSize: inputFontSize },
            rightElement && styles.inputWithRight,
            inputStyle,
          ]}
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
    marginBottom: 14,
    width: '100%',
  },
  label: {
    ...memberTypography.bodyStrong,
    fontSize: 14,
    fontWeight: '500',
    color: memberColors.ink,
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: memberColors.borderStrong,
    borderRadius: 8,
    backgroundColor: '#FEFEFE',
    ...memberWebTransition('border-color, box-shadow, background-color'),
  },
  inputRowFocused: {
    borderColor: memberColors.court,
    backgroundColor: memberColors.white,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 0 2px rgba(30, 61, 50, 0.1)',
    }),
  },
  inputRowError: {
    borderColor: memberColors.danger,
    backgroundColor: memberColors.dangerSoft,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: memberColors.ink,
    minHeight: 44,
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
      WebkitAppearance: 'none',
    }),
  },
  inputWithRight: {
    paddingRight: 56,
  },
  error: {
    fontSize: 12,
    color: memberColors.danger,
    marginTop: 5,
    lineHeight: 16,
  },
  hint: {
    fontSize: 12,
    color: memberColors.inkMuted,
    marginTop: 5,
    lineHeight: 16,
  },
});
