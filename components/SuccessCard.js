import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

export default function SuccessCard({ email, embedded = false }) {
  return (
    <View
      style={[styles.container, embedded && styles.embedded]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🎾</Text>
      </View>
      <Text style={styles.heading}>Welcome to the Court!</Text>
      <Text style={styles.message}>
        We've sent a verification link to your email. Check your inbox to activate your account and start your tennis journey.
      </Text>
      {email && (
        <View style={styles.emailContainer}>
          <Text style={styles.emailLabel}>Email sent to:</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  embedded: {
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 400,
  },
  emailContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    width: '100%',
    maxWidth: 400,
  },
  emailLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
});
