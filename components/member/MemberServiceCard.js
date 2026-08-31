import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberShadow } from '../../theme/memberTheme';

export default function MemberServiceCard({ service, onPress, onMoreInfo, infoLabel = 'Info', width }) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, width ? { width } : { flex: 1 }]}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, friction: 8 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }).start()}
        activeOpacity={0.95}
        accessibilityRole="button"
        accessibilityLabel={service.name}
      >
        <View style={styles.top}>
          <View style={[styles.iconWrap, { backgroundColor: service.accentBg || memberColors.limeSoft }]}>
            <Ionicons name={service.icon} size={22} color={service.accent || memberColors.court} />
          </View>
          {service.tag ? (
            <View style={[styles.tag, { backgroundColor: service.accentBg || memberColors.limeSoft }]}>
              <Text style={[styles.tagText, { color: service.accent || memberColors.court }]}>{service.tag}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.name}>{service.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>{service.shortDesc}</Text>

        <View style={styles.footer}>
          <View>
            <Text style={[styles.price, { color: service.accent || memberColors.ink }]}>${service.price}</Text>
            <Text style={styles.duration}>{service.duration}</Text>
          </View>
          {onMoreInfo && (
            <TouchableOpacity
              style={styles.infoBtn}
              onPress={(e) => {
                e?.stopPropagation?.();
                onMoreInfo(service);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.infoText}>{infoLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
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
    minHeight: 180,
    ...(Platform.OS === 'web' && { transition: 'box-shadow 0.2s ease, transform 0.2s ease' }),
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: memberRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: memberRadius.sm,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
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
  },
  infoText: {
    fontSize: 11,
    fontWeight: '600',
    color: memberColors.inkMuted,
  },
});
