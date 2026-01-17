import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardCard from './DashboardCard';

export default function RefundsCard({ refunds = [] }) {
  if (!refunds || refunds.length === 0) {
    return null; // Hide section if no refunds
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'processed':
      case 'completed':
        return '#34C759';
      case 'pending':
        return '#FF9500';
      case 'failed':
      case 'cancelled':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'processed':
      case 'completed':
        return 'checkmark-circle';
      case 'pending':
        return 'time-outline';
      case 'failed':
      case 'cancelled':
        return 'close-circle';
      default:
        return 'information-circle';
    }
  };

  return (
    <DashboardCard
      title="Recent Refunds"
      icon="wallet-outline"
      iconColor="#34C759"
    >
      <View style={styles.refundsList}>
        {refunds.slice(0, 3).map((refund, index) => (
          <View key={index} style={styles.refundItem}>
            <View style={styles.refundLeft}>
              <Ionicons
                name={getStatusIcon(refund.status)}
                size={20}
                color={getStatusColor(refund.status)}
              />
              <View style={styles.refundInfo}>
                <Text style={styles.refundAmount}>${refund.amount || '0.00'}</Text>
                <Text style={styles.refundDate}>
                  {refund.date ? new Date(refund.date).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${getStatusColor(refund.status)}15` },
              ]}
            >
              <Text
                style={[styles.statusText, { color: getStatusColor(refund.status) }]}
              >
                {refund.status || 'Pending'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  refundsList: {
    marginTop: 12,
  },
  refundItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  refundLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  refundInfo: {
    marginLeft: 12,
    flex: 1,
  },
  refundAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  refundDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
