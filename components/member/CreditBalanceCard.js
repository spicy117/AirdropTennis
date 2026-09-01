import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberShadow, memberTypography, memberWebTransition } from '../../theme/memberTheme';
import CourtWatermark from './CourtWatermark';
import MemberSkeleton from './MemberSkeleton';

export default function CreditBalanceCard({ balance, loading, onTopUp, labels = {}, compact = false }) {
  const {
    creditBalance = 'Credit balance',
    availableForBookings = 'Available for bookings',
    topUp = 'Top Up',
  } = labels;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <CourtWatermark variant="ambient" />

      <View style={[styles.inner, compact && styles.innerCompact]}>
        <View style={styles.headerRow}>
          <View style={styles.limeMark} />
          <Text style={styles.label}>{creditBalance}</Text>
        </View>

        {loading ? (
          <MemberSkeleton width={120} height={36} radius={8} style={{ marginVertical: 10 }} />
        ) : (
          <Text style={styles.amount}>${balance.toFixed(2)}</Text>
        )}

        <Text style={styles.sub}>{availableForBookings}</Text>

        <Pressable
          style={({ pressed, hovered }) => [
            styles.topUpBtn,
            hovered && Platform.OS === 'web' && styles.topUpHovered,
            pressed && styles.topUpPressed,
          ]}
          onPress={onTopUp}
          accessibilityRole="button"
          accessibilityLabel={topUp}
        >
          <Ionicons name="add" size={16} color={memberColors.ink} />
          <Text style={styles.topUpText}>{topUp}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: memberColors.surfaceRaised,
    borderRadius: memberRadius.xl,
    borderWidth: 1,
    borderColor: memberColors.border,
    ...memberShadow.md,
    minWidth: 160,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardCompact: {
    minHeight: undefined,
  },
  inner: {
    padding: 22,
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  innerCompact: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  limeMark: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: memberColors.lime,
    opacity: 0.85,
  },
  label: {
    ...memberTypography.label,
    textTransform: 'none',
    fontSize: 13,
    fontWeight: '600',
    color: memberColors.inkMuted,
    letterSpacing: 0,
  },
  amount: {
    ...memberTypography.stat,
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    color: memberColors.inkMuted,
    marginBottom: 18,
    lineHeight: 18,
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: memberRadius.pill,
    backgroundColor: memberColors.limeSoft,
    borderWidth: 1,
    borderColor: 'rgba(212, 249, 52, 0.35)',
    ...memberWebTransition('background-color, transform, border-color'),
  },
  topUpHovered: {
    ...(Platform.OS === 'web' && {
      backgroundColor: 'rgba(212, 249, 52, 0.14)',
      borderColor: 'rgba(212, 249, 52, 0.55)',
    }),
  },
  topUpPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  topUpText: {
    fontSize: 14,
    fontWeight: '600',
    color: memberColors.ink,
  },
});
