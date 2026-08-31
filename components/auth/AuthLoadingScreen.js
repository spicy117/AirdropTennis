import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { memberColors, memberTypography } from '../../theme/memberTheme';

export default function AuthLoadingScreen({ message = 'Loading…' }) {
  return (
    <View style={styles.screen}>
      <View style={styles.orb} />
      <Text style={styles.logo}>🎾</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  orb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: memberColors.limeSoft,
    top: '30%',
    ...(Platform.OS === 'web' && { filter: 'blur(60px)' }),
  },
  logo: {
    fontSize: 40,
    marginBottom: 8,
  },
  brand: {
    ...memberTypography.h3,
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    color: memberColors.inkMuted,
  },
});
