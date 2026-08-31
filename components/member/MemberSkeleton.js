import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Platform } from 'react-native';
import { memberColors, memberRadius } from '../../theme/memberTheme';
import { prefersReducedMotion } from '../../theme/memberTheme';

export default function MemberSkeleton({ width = '100%', height = 14, style, radius = memberRadius.sm }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, reduced]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius, opacity: reduced ? 0.55 : opacity },
        style,
      ]}
    />
  );
}

export function HeroSkeleton() {
  return (
    <View style={styles.hero}>
      <MemberSkeleton width={96} height={11} radius={4} style={{ marginBottom: 16 }} />
      <View style={styles.heroRow}>
        <MemberSkeleton width={56} height={72} radius={memberRadius.md} />
        <View style={styles.heroCol}>
          <MemberSkeleton width="75%" height={18} style={{ marginBottom: 10 }} />
          <MemberSkeleton width="45%" height={26} style={{ marginBottom: 10 }} />
          <MemberSkeleton width="60%" height={14} />
        </View>
      </View>
      <MemberSkeleton width="40%" height={14} style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: memberColors.bgDeep,
    ...(Platform.OS === 'web' && { transition: 'opacity 0.2s ease' }),
  },
  hero: {
    backgroundColor: memberColors.surfaceRaised,
    borderRadius: memberRadius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: memberColors.border,
    minHeight: 200,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 20,
  },
  heroCol: {
    flex: 1,
    paddingTop: 4,
  },
});
