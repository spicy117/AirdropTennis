import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { memberColors } from '../../theme/memberTheme';

/**
 * Subtle Airdrop Tennis court geometry — watermark-level, no imagery.
 * variant: 'hero' (right side of Next on Court) | 'ambient' (page backgrounds)
 */
export default function CourtWatermark({ variant = 'ambient', style }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const isHero = variant === 'hero';

  if (isHero && isCompact) {
    return (
      <View style={[styles.compactWrap, style]} pointerEvents="none">
        <View style={styles.compactLine} />
        <View style={[styles.ballDot, styles.compactBall]} />
      </View>
    );
  }

  if (isHero) {
    return (
      <View style={[styles.heroWrap, style]} pointerEvents="none">
        <View style={styles.heroCourt}>
          <View style={styles.heroBaseline} />
          <View style={styles.heroServiceLine} />
          <View style={styles.heroCenterLine} />
          <View style={styles.heroSinglesLine} />
          <View style={styles.heroArc} />
          <View style={[styles.ballDot, styles.heroBall]} />
        </View>
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
    width: '42%',
    overflow: 'hidden',
  },
  heroCourt: {
    flex: 1,
    marginRight: -8,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: lineColor,
    borderLeftWidth: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    opacity: 0.09,
  },
  heroBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '18%',
    height: 1,
    backgroundColor: lineColor,
  },
  heroServiceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '38%',
    height: 1,
    backgroundColor: lineColor,
    opacity: 0.85,
  },
  heroCenterLine: {
    position: 'absolute',
    top: '38%',
    bottom: '18%',
    left: '50%',
    width: 1,
    marginLeft: -0.5,
    backgroundColor: lineColor,
    opacity: 0.7,
  },
  heroSinglesLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '22%',
    width: 1,
    backgroundColor: lineColor,
    opacity: 0.45,
  },
  heroArc: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: memberColors.lime,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    top: '8%',
    right: '-20%',
    opacity: 0.35,
    transform: [{ rotate: '-25deg' }],
  },
  heroBall: {
    top: '22%',
    right: '28%',
    opacity: 0.5,
  },
  compactWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  compactLine: {
    position: 'absolute',
    right: 24,
    top: '30%',
    bottom: '25%',
    width: 1,
    backgroundColor: lineColor,
    opacity: 0.08,
  },
  compactBall: {
    top: '35%',
    right: 20,
    width: 6,
    height: 6,
    opacity: 0.35,
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
