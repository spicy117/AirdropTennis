import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberShadow, memberWebTransition } from '../../theme/memberTheme';

export default function MemberServiceCard({ service, onPress, onMoreInfo, infoLabel = 'Info', width }) {
  const motifStyle =
    service.motif === 'arc'
      ? styles.motifArc
      : service.motif === 'dot'
        ? styles.motifDot
        : service.motif === 'cross'
          ? styles.motifCross
          : styles.motifLines;

  return (
    <View style={[width ? { width } : { flex: 1 }]}>
      <Pressable
        style={({ pressed, hovered }) => [
          styles.card,
          hovered && Platform.OS === 'web' && styles.cardHovered,
          pressed && styles.cardPressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={service.name}
      >
        <View style={[styles.motif, motifStyle]} pointerEvents="none" />

        <View style={styles.top}>
          <View style={styles.iconWrap}>
            <View style={styles.iconRing} />
            <Ionicons name={service.icon} size={22} color={memberColors.court} />
          </View>
          {service.tag ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{service.tag}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={memberColors.inkFaint} style={styles.chevron} />
          )}
        </View>

        <Text style={styles.name}>{service.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>{service.shortDesc}</Text>

        <View style={styles.footer}>
          <View>
            <Text style={styles.price}>${service.price}</Text>
            <Text style={styles.duration}>{service.duration}</Text>
          </View>
          {onMoreInfo && (
            <Pressable
              style={({ pressed }) => [styles.infoBtn, pressed && styles.infoBtnPressed]}
              onPress={(e) => {
                e?.stopPropagation?.();
                onMoreInfo(service);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.infoText}>{infoLabel}</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: memberColors.surfaceRaised,
    borderRadius: memberRadius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: memberColors.border,
    ...memberShadow.sm,
    minHeight: 184,
    overflow: 'hidden',
    position: 'relative',
    ...memberWebTransition('box-shadow, transform, border-color'),
  },
  cardHovered: {
    ...(Platform.OS === 'web' && {
      boxShadow: '0 12px 32px rgba(20, 20, 20, 0.1)',
      borderColor: memberColors.borderStrong,
      transform: [{ translateY: -3 }],
    }),
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.96,
  },
  motif: {
    position: 'absolute',
    pointerEvents: 'none',
    opacity: 0.07,
  },
  motifLines: {
    top: 12,
    right: 12,
    width: 48,
    height: 32,
    borderWidth: 1,
    borderColor: memberColors.court,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 4,
  },
  motifArc: {
    bottom: -20,
    right: -20,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: memberColors.lime,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  motifDot: {
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: memberColors.lime,
  },
  motifCross: {
    top: 16,
    right: 16,
    width: 24,
    height: 1,
    backgroundColor: memberColors.court,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: memberRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: memberColors.courtMuted,
    position: 'relative',
  },
  iconRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: memberRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 61, 50, 0.12)',
  },
  chevron: {
    marginTop: 4,
    opacity: 0.6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: memberRadius.sm,
    backgroundColor: memberColors.limeSoft,
    borderWidth: 1,
    borderColor: 'rgba(212, 249, 52, 0.3)',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: memberColors.court,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: memberColors.ink,
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    color: memberColors.inkMuted,
    flex: 1,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: memberColors.ink,
  },
  duration: {
    fontSize: 11,
    color: memberColors.inkMuted,
    marginTop: 2,
  },
  infoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: memberRadius.sm,
    backgroundColor: memberColors.bg,
    ...memberWebTransition('background-color, transform'),
  },
  infoBtnPressed: {
    backgroundColor: memberColors.bgDeep,
    transform: [{ scale: 0.96 }],
  },
  infoText: {
    fontSize: 11,
    fontWeight: '600',
    color: memberColors.inkMuted,
  },
});
