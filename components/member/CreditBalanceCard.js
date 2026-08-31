import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberShadow, memberTypography } from '../../theme/memberTheme';

export default function CreditBalanceCard({ balance, loading, onTopUp, labels = {} }) {
  const { availableCredit = 'Available credit', topUp = 'Add credit' } = labels;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{availableCredit}</Text>
      {loading ? (
        <ActivityIndicator color={memberColors.inkMuted} style={{ marginVertical: 12 }} />
      ) : (
        <Text style={styles.amount}>${balance.toFixed(2)}</Text>
      )}
      <TouchableOpacity style={styles.topUpBtn} onPress={onTopUp} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={topUp}>
        <Ionicons name="add" size={18} color={memberColors.ink} />
        <Text style={styles.topUpText}>{topUp}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: memberColors.surfaceRaised,
    borderRadius: memberRadius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: memberColors.border,
    ...memberShadow.md,
    minWidth: 160,
    justifyContent: 'space-between',
    flex: 1,
  },
  label: {
    ...memberTypography.label,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  amount: {
    ...memberTypography.stat,
    marginBottom: 16,
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: memberRadius.pill,
    backgroundColor: memberColors.limeSoft,
    borderWidth: 1,
    borderColor: 'rgba(212, 249, 52, 0.4)',
  },
  topUpText: {
    fontSize: 14,
    fontWeight: '600',
    color: memberColors.ink,
  },
});
