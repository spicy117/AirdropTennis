import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getPhoneDisplayLabel } from '../utils/phone';
import { formatWalletAmount } from '../utils/wallet';
import AdminAdjustCreditModal from '../components/AdminAdjustCreditModal';
import AdminCreditHistory from '../components/AdminCreditHistory';

export default function StudentsScreen({ onNavigate }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [adjustStudent, setAdjustStudent] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

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

  const toggleExpanded = (studentId) => {
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId));
  };

  const handleAdjustSuccess = ({ studentId, balanceAfter }) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, walletBalance: balanceAfter } : s))
    );
    setHistoryRefreshKey((k) => k + 1);
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
          return (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.studentHeader}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color="#8E8E93" />
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.fullName}</Text>
                  <Text style={styles.studentEmail}>{student.email}</Text>
                  <Text style={styles.studentPhone}>{getPhoneDisplayLabel(student.phone)}</Text>
                  {!isExpanded ? (
                    <Text style={styles.studentCreditPreview}>
                      {formatWalletAmount(student.walletBalance)} credit
                    </Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                style={styles.viewBtn}
                onPress={() => toggleExpanded(student.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewBtnText}>{isExpanded ? 'Hide details' : 'View details'}</Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#334155"
                />
              </TouchableOpacity>

              {isExpanded && (
                <AdminCreditHistory
                  studentId={student.id}
                  currentBalance={student.walletBalance}
                  onAdjustPress={() => setAdjustStudent(student)}
                  refreshKey={historyRefreshKey}
                />
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
  studentCreditPreview: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0D9488',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  viewBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  studentMeta: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    marginTop: 8,
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
