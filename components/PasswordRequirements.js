import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const RequirementItem = ({ met, label, accessible = true }) => {
  return (
    <View
      style={styles.requirementItem}
      accessible={accessible}
      accessibilityLabel={`${label}: ${met ? 'met' : 'not met'}`}
      accessibilityRole="text"
    >
      <View style={styles.iconContainer}>
        {met ? (
          <Text style={styles.checkmark} accessibilityLabel="Requirement met">✓</Text>
        ) : (
          <View style={styles.dot} accessibilityLabel="Requirement not met" />
        )}
      </View>
      <Text style={[styles.label, met && styles.labelMet]}>{label}</Text>
    </View>
  );
};

export default function PasswordRequirements({ requirements, shake = false, accessible = true, style }) {
  const requirementList = [
    { key: 'minLength', label: 'At least 8 characters' },
    // maxLength is validated on submit but not shown in real-time
    { key: 'hasNumber', label: 'Contains 1 number' },
    { key: 'hasUppercase', label: 'Contains 1 uppercase letter' },
    { key: 'hasSpecialChar', label: 'Contains 1 special character' },
  ];

  return (
    <View
      style={[styles.container, shake && styles.shake, style]}
      accessible={accessible}
      accessibilityRole="list"
      accessibilityLabel="Password requirements"
    >
      {requirementList.map((req) => (
        <RequirementItem
          key={req.key}
          met={requirements[req.key]}
          label={req.label}
          accessible={accessible}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 16,
    // Mobile: stacked, Desktop: 2 columns
    ...(Platform.OS === 'web'
      ? {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
        }
      : {
          flexDirection: 'column',
        }),
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Platform.OS === 'web' ? 0 : 8,
    ...(Platform.OS === 'web' && {
      width: 'calc(50% - 6px)',
      minWidth: 200,
    }),
  },
  iconContainer: {
    width: 20,
    height: 20,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C7C7CC',
  },
  checkmark: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  labelMet: {
    color: '#34C759',
  },
  shake: Platform.OS === 'web' ? {
    animation: 'shake 0.5s ease-in-out',
  } : {},
});

// Add shake animation for web (will be injected by parent Animated.View)
