import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

export default function SuccessBanner({ message, onDismiss, accessible = true }) {
  if (!message) return null;

  return (
    <View
      style={styles.container}
      accessible={accessible}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.content}>
        <Text style={styles.icon}>✓</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          accessible={true}
          accessibilityLabel="Dismiss success message"
          accessibilityRole="button"
        >
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#34C759',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 4px rgba(52, 199, 89, 0.2)',
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  message: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 12,
  },
  dismissText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 20,
  },
});
