import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { memberColors, memberTypography } from '../../theme/memberTheme';

export default function AuthLoadingScreen({ message = 'Loading…' }) {
  return (
    <View style={styles.screen}>
      <View style={styles.accent}>
        <View style={styles.bar} />
        <View style={styles.dot} />
      </View>
      <Text style={styles.brand}>Airdrop Tennis</Text>
      <ActivityIndicator size="small" color={memberColors.court} style={styles.spinner} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: memberColors.bg,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 32,
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  accent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  bar: {
    width: 40,
    height: 3,
    backgroundColor: memberColors.court,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: memberColors.lime,
  },
  brand: {
    ...memberTypography.h2,
    letterSpacing: -0.6,
    marginBottom: 28,
  },
  spinner: {
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    color: memberColors.inkMuted,
  },
});
