import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getPhoneDisplayLabel } from '../utils/phone';
import { formatWalletAmount } from '../utils/wallet';
import AdminAdjustCreditModal from '../components/AdminAdjustCreditModal';

function formatHistoryDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatHistoryAmount(delta) {
  const n = Number(delta) || 0;
  const prefix = n >= 0 ? '+' : '−';
  return `${prefix}${formatWalletAmount(Math.abs(n))}`;
}

export default function StudentsScreen({ onNavigate }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [historyByStudent, setHistoryByStudent] = useState({});
  const [historyLoadingId, setHistoryLoadingId] = useState(null);
  const [adjustStudent, setAdjustStudent] = useState(null);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, phone, first_name, last_name, full_name, wallet_balance, created_at, role')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const studentsList = (profiles || []).map((profile) => {
        const nameFromParts = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
        return {
          id: profile.id,
          email: profile.email || 'N/A',
          phone: profile.phone || null,
          fullName: nameFromParts || profile.full_name || profile.email || 'Unknown student',
          walletBalance: parseFloat(profile.wallet_balance) || 0,
          createdAt: profile.created_at,
        };
      });

      setStudents(studentsList);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const loadCreditHistory = useCallback(async (studentId) => {
    if (historyByStudent[studentId]) return;
    try {
      setHistoryLoadingId(studentId);
      const [txRes, bookingsRes, adminRes] = await Promise.all([
        supabase
          .from('wallet_transactions')
          .select('id, delta, amount, direction, balance_after, reason, note, source, created_at, created_by')
          .eq('user_id', studentId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('bookings')
          .select('id, credit_cost, service_name, start_time, created_at')
          .eq('user_id', studentId)
          .gt('credit_cost', 0)
          .order('start_time', { ascending: false })
          .limit(30),
        supabase.from('profiles').select('id, first_name, last_name, full_name, email'),
      ]);

      const adminMap = {};
      (adminRes.data || []).forEach((p) => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || p.email || 'Admin';
        adminMap[p.id] = name;
      });

      const manualItems = (txRes.error ? [] : txRes.data || []).map((row) => {
        let delta = Number(row.delta);
        if (!Number.isFinite(delta) && row.amount != null) {
          const amt = Math.abs(Number(row.amount) || 0);
          delta = row.direction === 'remove' ? -amt : amt;
        }
        return {
        id: `tx-${row.id}`,
        occurredAt: row.created_at,
        delta,
        balanceAfter: Number(row.balance_after),
        reason: row.reason,
        subtitle:
          row.source === 'manual_admin_adjustment'
            ? `Added by ${adminMap[row.created_by] || 'Admin'}`
            : row.source,
        note: row.note,
      };
      });

      const bookingItems = (bookingsRes.error ? [] : bookingsRes.data || []).map((row) => ({
        id: `booking-${row.id}`,
        occurredAt: row.start_time || row.created_at,
        delta: -Math.abs(Number(row.credit_cost) || 0),
        balanceAfter: null,
        reason: row.service_name ? `${row.service_name} booking` : 'Lesson booking',
        subtitle: 'Automatic booking deduction',
        note: null,
      }));

      const merged = [...manualItems, ...bookingItems]
        .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
        .slice(0, 40);

      setHistoryByStudent((prev) => ({ ...prev, [studentId]: merged }));
    } catch (error) {
      console.error('Error loading credit history:', error);
      setHistoryByStudent((prev) => ({ ...prev, [studentId]: [] }));
    } finally {
      setHistoryLoadingId(null);
    }
  }, [historyByStudent]);

  const filteredStudents = students.filter((student) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const phoneHaystack = (student.phone || '').replace(/[\s\-()]/g, '').toLowerCase();
    return (
      student.email.toLowerCase().includes(query) ||
      student.fullName.toLowerCase().includes(query) ||
      (phoneHaystack && phoneHaystack.includes(query.replace(/[\s\-()]/g, '')))
    );
  });

  const toggleHistory = (studentId) => {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
      return;
    }
    setExpandedStudentId(studentId);
    loadCreditHistory(studentId);
  };

  const handleAdjustSuccess = ({ studentId, balanceAfter }) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, walletBalance: balanceAfter } : s))
    );
    setHistoryByStudent((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    if (expandedStudentId === studentId) {
      loadCreditHistory(studentId);
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStudents} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Students</Text>
          <Text style={styles.subtitle}>{students.length} total students</Text>
        </View>
        {onNavigate && (
          <TouchableOpacity
            style={styles.dashboardBtn}
            onPress={() => onNavigate('admin-dashboard')}
            activeOpacity={0.7}
          >
            <Ionicons name="grid-outline" size={18} color="#0D9488" />
            <Text style={styles.dashboardBtnText}>Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          fontSize={16}
        />
      </View>

      {filteredStudents.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No students found</Text>
        </View>
      ) : (
        filteredStudents.map((student) => {
          const isExpanded = expandedStudentId === student.id;
          const history = historyByStudent[student.id];
          return (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.studentHeader}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color="#8E8E93" />
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.fullName}</Text>
                  <Text style={styles.studentEmail}>{student.email}</Text>
                  <Text style={styles.studentPhone}>
                    {getPhoneDisplayLabel(student.phone)}
                  </Text>
                  <Text style={styles.studentCredit}>{formatWalletAmount(student.walletBalance)}</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryAction} onPress={() => toggleHistory(student.id)}>
                  <Text style={styles.secondaryActionText}>{isExpanded ? 'Hide history' : 'View'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryAction} onPress={() => setAdjustStudent(student)}>
                  <Text style={styles.primaryActionText}>Adjust credits</Text>
                </TouchableOpacity>
              </View>

              {isExpanded && (
                <View style={styles.historySection}>
                  <Text style={styles.historyTitle}>Credit history</Text>
                  {historyLoadingId === student.id ? (
                    <ActivityIndicator color="#0D9488" style={{ marginVertical: 12 }} />
                  ) : history && history.length > 0 ? (
                    history.map((item, index) => (
                      <View key={item.id}>
                        {index > 0 && <View style={styles.historyDivider} />}
                        <View style={styles.historyItem}>
                          <View style={styles.historyTopRow}>
                            <Text style={styles.historyDate}>{formatHistoryDate(item.occurredAt)}</Text>
                            <Text
                              style={[
                                styles.historyAmount,
                                item.delta >= 0 ? styles.historyAmountPositive : styles.historyAmountNegative,
                              ]}
                            >
                              {formatHistoryAmount(item.delta)}
                            </Text>
                          </View>
                          <Text style={styles.historyReason}>{item.reason}</Text>
                          <Text style={styles.historyMeta}>{item.subtitle}</Text>
                          {item.balanceAfter != null ? (
                            <Text style={styles.historyBalance}>
                              Balance: {formatWalletAmount(item.balanceAfter)}
                            </Text>
                          ) : null}
                          {item.note ? <Text style={styles.historyNote}>{item.note}</Text> : null}
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.historyEmpty}>No credit history available yet.</Text>
                  )}
                </View>
              )}

              <View style={styles.studentMeta}>
                <Text style={styles.metaText}>Joined: {formatDate(student.createdAt)}</Text>
              </View>
            </View>
          );
        })
      )}

      <AdminAdjustCreditModal
        visible={!!adjustStudent}
        student={adjustStudent}
        onClose={() => setAdjustStudent(null)}
        onSuccess={handleAdjustSuccess}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
  },
  dashboardBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D9488',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
    minWidth: 0,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  studentPhone: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
  },
  studentCredit: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D9488',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  secondaryAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  primaryAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1E3D32',
    alignItems: 'center',
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  historySection: {
    marginBottom: 12,
    paddingTop: 4,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  historyItem: {
    paddingVertical: 8,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyAmountPositive: { color: '#0D9488' },
  historyAmountNegative: { color: '#B45309' },
  historyReason: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
  },
  historyMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  historyBalance: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  historyNote: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    fontStyle: 'italic',
  },
  historyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
  },
  historyEmpty: {
    fontSize: 13,
    color: '#94A3B8',
    paddingVertical: 8,
  },
  studentMeta: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
});
