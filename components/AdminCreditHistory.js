import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatWalletAmount } from '../utils/wallet';
import { loadStudentCreditHistory } from '../utils/loadStudentCreditHistory';
import {
  CREDIT_LEDGER_FILTERS,
  filterLedgerItems,
  formatLedgerAmount,
  formatLedgerDate,
  formatLedgerDateTime,
  LEDGER_PAGE_SIZE,
} from '../utils/creditLedger';

function LedgerRow({ item, expanded, onToggle }) {
  const isPositive = item.delta >= 0;
  const isFailed = item.status === 'failed';

  return (
    <View style={styles.rowWrap}>
      <TouchableOpacity
        style={styles.row}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.rowMain}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowDate}>{formatLedgerDate(item.occurredAt)}</Text>
            <Text
              style={[
                styles.rowAmount,
                isFailed ? styles.rowAmountFailed : isPositive ? styles.rowAmountPositive : styles.rowAmountNegative,
              ]}
            >
              {isFailed ? formatWalletAmount(Math.abs(item.delta)) : formatLedgerAmount(item.delta)}
            </Text>
          </View>

          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowTypeLabel}>{item.typeLabel}</Text>

          {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}

          {item.balanceAfter != null ? (
            <Text style={styles.rowBalance}>Balance {formatWalletAmount(item.balanceAfter)}</Text>
          ) : null}

          {isFailed ? (
            <Text style={styles.rowFailedNote}>No credit added</Text>
          ) : null}
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#94A3B8"
          style={styles.rowChevron}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.rowDetails}>
          <DetailLine label="Date & time" value={formatLedgerDateTime(item.occurredAt)} />

          {item.adminName ? <DetailLine label="Adjusted by" value={item.adminName} /> : null}
          {item.reason ? <DetailLine label="Reason" value={item.reason} /> : null}
          {item.note ? <DetailLine label="Note" value={item.note} /> : null}
          {item.paymentMethod ? <DetailLine label="Payment method" value={item.paymentMethod} /> : null}
          {item.lessonTime ? (
            <DetailLine label="Lesson time" value={formatLedgerDateTime(item.lessonTime)} />
          ) : null}
          {item.locationName ? <DetailLine label="Location" value={item.locationName} /> : null}
          {item.reference ? (
            <DetailLine label="Reference" value={item.reference} />
          ) : null}
          {item.status === 'success' && item.type === 'online_topup' ? (
            <DetailLine label="Payment status" value="Successful" />
          ) : null}
          {item.balanceAfter != null ? (
            <DetailLine label="Balance after" value={formatWalletAmount(item.balanceAfter)} />
          ) : null}
        </View>
      )}
    </View>
  );
}

function DetailLine({ label, value, adminOnly }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>
        {label}
        {adminOnly ? '' : ''}
      </Text>
      <Text style={[styles.detailValue, adminOnly && styles.detailValueNote]}>{value}</Text>
    </View>
  );
}

export default function AdminCreditHistory({
  studentId,
  currentBalance,
  onAdjustPress,
  refreshKey = 0,
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 430;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(LEDGER_PAGE_SIZE);

  const fetchHistory = useCallback(async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setLoadError(null);
      const result = await loadStudentCreditHistory(studentId);
      if (result.error) {
        setLoadError(result.error);
        setItems([]);
      } else {
        setItems(result.items);
      }
      setVisibleCount(LEDGER_PAGE_SIZE);
      setExpandedId(null);
    } catch (error) {
      console.error('Error loading credit history:', error);
      setLoadError('Credit history could not be loaded.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshKey]);

  const filtered = filterLedgerItems(items, filter);
  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  return (
    <View style={styles.section}>
      <View style={[styles.balanceHeader, isCompact && styles.balanceHeaderCompact]}>
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>Current credit</Text>
          <Text style={styles.balanceValue}>{formatWalletAmount(currentBalance)}</Text>
        </View>
        <TouchableOpacity style={styles.adjustBtn} onPress={onAdjustPress} activeOpacity={0.8}>
          <Text style={styles.adjustBtnText}>Adjust credits</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.historyTitle}>Credit history</Text>

      <View style={styles.filterRow}>
        {CREDIT_LEDGER_FILTERS.map((chip) => {
          const active = filter === chip.id;
          return (
            <TouchableOpacity
              key={chip.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => {
                setFilter(chip.id);
                setVisibleCount(LEDGER_PAGE_SIZE);
                setExpandedId(null);
              }}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loadError ? (
        <Text style={styles.loadError}>{loadError}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color="#0D9488" style={styles.loader} />
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>
          {filter === 'all' ? 'No credit activity yet.' : 'No matching credit activity.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {visible.map((item, index) => (
            <View key={item.id}>
              {index > 0 && <View style={styles.divider} />}
              <LedgerRow
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
              />
            </View>
          ))}
        </View>
      )}

      {!loading && hasMore ? (
        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={() => setVisibleCount((n) => n + LEDGER_PAGE_SIZE)}
        >
          <Text style={styles.loadMoreText}>Load more</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
    paddingTop: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  balanceHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  balanceBlock: {
    flex: 1,
    minWidth: 0,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0D9488',
  },
  adjustBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1E3D32',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  adjustBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: '#0D9488',
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#0D9488',
  },
  loader: {
    marginVertical: 16,
  },
  empty: {
    fontSize: 13,
    color: '#94A3B8',
    paddingVertical: 8,
  },
  loadError: {
    fontSize: 13,
    color: '#B45309',
    marginBottom: 8,
    lineHeight: 18,
  },
  list: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  rowWrap: {
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  rowDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flexShrink: 1,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 0,
  },
  rowAmountPositive: { color: '#0D9488' },
  rowAmountNegative: { color: '#B45309' },
  rowAmountFailed: { color: '#64748B', textDecorationLine: 'line-through' },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  rowTypeLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  rowBalance: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  rowFailedNote: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontStyle: 'italic',
  },
  rowChevron: {
    marginTop: 2,
  },
  rowDetails: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 0,
    backgroundColor: '#F8FAFC',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  detailLine: {
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  detailValueNote: {
    fontStyle: 'italic',
    color: '#475569',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
  },
  loadMoreBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
});
