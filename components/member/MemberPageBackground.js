import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { memberColors, memberTextBase } from '../../theme/memberTheme';
import CourtWatermark from './CourtWatermark';

export default function MemberPageBackground({ children, style }) {
  return (
    <View style={[styles.screen, style]}>
      <View style={styles.bg} pointerEvents="none">
        <View style={[styles.orb, styles.orb1]} />
        <View style={[styles.orb, styles.orb2]} />
        <CourtWatermark variant="ambient" />
        <View style={styles.courtAccent} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: memberColors.bg,
    ...memberTextBase,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    ...(Platform.OS === 'web' && { filter: 'blur(80px)' }),
  },
  orb1: {
    width: 280,
    height: 280,
    top: -60,
    right: -40,
    backgroundColor: 'rgba(212, 249, 52, 0.1)',
  },
  orb2: {
    width: 200,
    height: 200,
    bottom: 120,
    left: -50,
    backgroundColor: 'rgba(30, 61, 50, 0.05)',
  },
  courtAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '35%',
    height: 1,
    backgroundColor: memberColors.court,
    opacity: 0.05,
    transform: [{ rotate: '-8deg' }, { translateY: 180 }],
  },
});
