import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { utcToSydneyDate, utcToSydneyTime } from '../utils/timezone';
import {
  fetchCoachAssignmentSessions,
  groupSessionsByUrgency,
  getSessionUrgencyLabel,
} from '../utils/coachAssignment';
import AssignCoachModal from '../components/AssignCoachModal';
import AdminGuideHelpLink from '../components/AdminGuideHelpLink';

const DESKTOP_BREAKPOINT = 768;

function SessionQueueCard({ session, onAssign }) {
  const dateStr = utcToSydneyDate(session.startTime);
  const startTime = utcToSydneyTime(session.startTime);
  const endTime = utcToSydneyTime(session.endTime);
  const urgency = getSessionUrgencyLabel(session.startTime);
  const studentCount = session.students?.length || session.studentNames?.length || 0;

  return (
    <View style={styles.queueCard}>
      <View style={styles.queueCardHeader}>
        <View style={styles.requiredPill}>
          <Text style={styles.requiredPillText}>COACH REQUIRED</Text>
        </View>
        {urgency === 'TODAY' && (
          <View style={styles.urgentPill}>
            <Text style={styles.urgentPillText}>TODAY</Text>
          </View>
        )}
      </View>
      <Text style={styles.queueDate}>{dateStr}</Text>
      <Text style={styles.queueTime}>
        {startTime} – {endTime}
      </Text>
      <Text style={styles.queueService}>{session.serviceName || 'Session'}</Text>
      <Text style={styles.queueLocation}>{session.locationName}</Text>
      <View style={styles.queueStudentRow}>
        <Ionicons name="person-outline" size={16} color="#6B7280" />
        <Text style={styles.queueStudentText}>
          {studentCount > 1
            ? `${studentCount} students`
            : session.studentNames?.[0] || 'Student'}
        </Text>
      </View>
      <TouchableOpacity style={styles.assignBtn} onPress={() => onAssign(session)} activeOpacity={0.8}>
        <Text style={styles.assignBtnText}>Assign coach</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminCoachAssignmentsScreen({ onNavigate }) {
  const { userRole } = useAuth();
  const { width } = useWindowDimensions?.() ?? { width: 400 };
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignSession, setAssignSession] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const data = await fetchCoachAssignmentSessions(supabase);
      setSessions(data);
    } catch (err) {
      console.error('Error loading coach assignments:', err);
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === 'admin') {
      loadSessions();
    }
  }, [userRole, loadSessions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  const handleAssign = (session) => {
    setAssignSession(session);
    setModalVisible(true);
  };

  const handleAssigned = () => {
    loadSessions();
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setAssignSession(null);
    loadSessions();
  };

  const grouped = groupSessionsByUrgency(sessions);
  const groupOrder = ['TODAY', 'TOMORROW', 'THIS WEEK', 'LATER'];

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Coach Assignments</Text>
            <Text style={styles.subtitle}>Bookings that still need a coach.</Text>
            <AdminGuideHelpLink
              section="new-booking"
              onNavigate={onNavigate}
              label="How coach assignments work"
            />
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

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0D9488" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={56} color="#10B981" />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySub}>
              All upcoming bookings have coaches assigned.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {groupOrder.map((groupLabel) => {
              const items = grouped[groupLabel];
              if (!items?.length) return null;
              return (
                <View key={groupLabel} style={styles.groupSection}>
                  <Text style={styles.groupLabel}>{groupLabel}</Text>
                  {items.map((session) => (
                    <SessionQueueCard
                      key={session.sessionKey}
                      session={session}
                      onAssign={handleAssign}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AssignCoachModal
        visible={modalVisible}
        session={assignSession}
        onClose={handleCloseModal}
        onAssigned={handleAssigned}
      />
    </>
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
  contentDesktop: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 0,
  },
  dashboardBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D9488',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  list: {
    gap: 24,
  },
  groupSection: {
    gap: 12,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  queueCard: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  queueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requiredPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requiredPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
    letterSpacing: 0.3,
  },
  urgentPill: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  queueDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  queueTime: {
    fontSize: 15,
    color: '#374151',
    marginTop: 2,
  },
  queueService: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
  },
  queueLocation: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  queueStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  queueStudentText: {
    fontSize: 14,
    color: '#374151',
  },
  assignBtn: {
    marginTop: 14,
    backgroundColor: '#0D9488',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  assignBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});
