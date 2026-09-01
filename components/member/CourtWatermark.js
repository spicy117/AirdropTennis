import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { memberColors } from '../../theme/memberTheme';

/**
 * Subtle Airdrop Tennis court geometry — watermark-level, no imagery.
 * variant: 'hero' (right side of Next on Court) | 'ambient' (page backgrounds)
 */
export default function CourtWatermark({ variant = 'ambient', style }) {
  const { width } = useWindowDimensions();
  const isHero = variant === 'hero';

  if (isHero) {
    // Mobile: remove decoration — card content needs full clarity
    if (width < 640) {
      return null;
    }

    // Tablet: single soft orb only
    if (width < 1024) {
      return (
        <View style={[styles.heroWrap, style]} pointerEvents="none">
          <View style={styles.heroSoftOrb} />
        </View>
      );
    }

    // Desktop: orb + one faint line + cropped arc — no grid/box
    return (
      <View style={[styles.heroWrap, style]} pointerEvents="none">
        <View style={styles.heroSoftOrb} />
        <View style={styles.heroServiceLine} />
        <View style={styles.heroArc} />
      </View>
    );
  }

  return (
    <View style={[styles.ambientWrap, style]} pointerEvents="none">
      <View style={styles.ambientLine1} />
      <View style={styles.ambientLine2} />
      <View style={[styles.ballDot, styles.ambientBall]} />
    </View>
  );
}

const lineColor = memberColors.court;

const styles = StyleSheet.create({
  heroWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '38%',
    overflow: 'hidden',
  },
  heroSoftOrb: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -48,
    top: '18%',
    backgroundColor: memberColors.limeSoft,
    opacity: 0.45,
    ...(Platform.OS === 'web' && { filter: 'blur(1px)' }),
  },
  heroServiceLine: {
    position: 'absolute',
    right: 16,
    left: '8%',
    top: '46%',
    height: 1,
    backgroundColor: lineColor,
    opacity: 0.05,
  },
  heroArc: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    right: -12,
    bottom: '12%',
    borderWidth: 1,
    borderColor: memberColors.lime,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    opacity: 0.12,
    transform: [{ rotate: '-18deg' }],
  },
  ambientWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientLine1: {
    position: 'absolute',
    top: '22%',
    right: '-5%',
    width: '55%',
    height: 1,
    backgroundColor: lineColor,
    opacity: 0.05,
    transform: [{ rotate: '-6deg' }],
  },
  ambientLine2: {
    position: 'absolute',
    bottom: '30%',
    left: '-8%',
    width: '45%',
    height: 1,
    backgroundColor: lineColor,
    opacity: 0.04,
    transform: [{ rotate: '4deg' }],
  },
  ambientBall: {
    top: '18%',
    right: '12%',
    width: 8,
    height: 8,
    opacity: 0.25,
    ...(Platform.OS === 'web' && { filter: 'blur(0.5px)' }),
  },
  ballDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: memberColors.lime,
    opacity: 0.4,
  },
});
