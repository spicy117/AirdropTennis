import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberWebTransition } from '../../theme/memberTheme';

export default function SessionRow({
  time,
  serviceName,
  locationName,
  duration,
  price,
  bookLabel,
  onBook,
  onPress,
}) {
  return (
    <Pressable
      style={({ pressed, hovered }) => [
        styles.row,
        hovered && Platform.OS === 'web' && styles.rowHovered,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress || onBook}
      accessibilityRole="button"
    >
      <View style={styles.timeCol}>
        <Text style={styles.time}>{time}</Text>
        <View style={styles.timeLine} />
      </View>

      <View style={styles.body}>
        <Text style={styles.service} numberOfLines={1}>
          {serviceName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {locationName}
          {duration ? ` · ${duration}` : ''}
        </Text>
      </View>

      <View style={styles.actionCol}>
        {price != null ? <Text style={styles.price}>${Number(price).toFixed(2)}</Text> : null}
        {onBook && (
          <Pressable
            style={({ pressed }) => [styles.bookBtn, pressed && styles.bookBtnPressed]}
            onPress={(e) => {
              e?.stopPropagation?.();
              onBook();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.bookText}>{bookLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color={memberColors.court} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 14,
    ...memberWebTransition('background-color'),
  },
  rowHovered: {
    ...(Platform.OS === 'web' && {
      backgroundColor: memberColors.limeSoft,
      borderRadius: 8,
      marginHorizontal: -8,
      paddingHorizontal: 8,
    }),
  },
  rowPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  timeCol: {
    width: 52,
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  time: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: memberColors.ink,
  },
  timeLine: {
    width: 1,
    height: 20,
    backgroundColor: memberColors.borderStrong,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  body: {
    flex: 1,
    paddingTop: 1,
  },
  service: {
    fontSize: 16,
    fontWeight: '600',
    color: memberColors.ink,
    marginBottom: 3,
    lineHeight: 22,
  },
  meta: {
    fontSize: 13,
    color: memberColors.inkMuted,
    lineHeight: 18,
  },
  actionCol: {
    alignItems: 'flex-end',
    minWidth: 72,
    paddingTop: 1,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: memberColors.ink,
    marginBottom: 6,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    ...memberWebTransition('opacity, transform'),
  },
  bookBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  bookText: {
    fontSize: 13,
    fontWeight: '600',
    color: memberColors.court,
  },
});
