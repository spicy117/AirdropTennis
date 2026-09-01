import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { utcToSydneyDate, utcToSydneyTime } from '../utils/timezone';
import { assignCoachToSession, loadCoaches } from '../utils/coachAssignment';

const DESKTOP_BREAKPOINT = 768;

export default function AssignCoachModal({
  visible,
  session,
  onClose,
  onAssigned,
}) {
  const { user } = useAuth();
  const { width } = useWindowDimensions?.() ?? { width: 400 };
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [coaches, setCoaches] = useState([]);
  const [selectedCoachId, setSelectedCoachId] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [assignedCoachName, setAssignedCoachName] = useState(null);

  useEffect(() => {
    if (!visible) {
      setSelectedCoachId(null);
      setShowDropdown(false);
      setError(null);
      setSuccess(false);
      setAssignedCoachName(null);
      return;
    }
    setLoadingCoaches(true);
    loadCoaches(supabase)
      .then(setCoaches)
      .catch((err) => console.error('Error loading coaches:', err))
      .finally(() => setLoadingCoaches(false));
  }, [visible]);

  if (!session) return null;

  const dateStr = utcToSydneyDate(session.startTime);
  const timeStr = utcToSydneyTime(session.startTime);
  const studentLabel =
    session.students?.length > 1
      ? `${session.students.length} students`
      : session.studentNames?.[0] || session.students?.[0]?.name || 'Student';

  const selectedCoach = coaches.find((c) => c.id === selectedCoachId);
  const selectedCoachLabel = selectedCoach
    ? [selectedCoach.first_name, selectedCoach.last_name].filter(Boolean).join(' ') ||
      selectedCoach.email
    : null;

  const handleAssign = async () => {
    if (!selectedCoachId) {
      setError('Please select a coach');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await assignCoachToSession(supabase, user?.id, session, selectedCoachId);
    setLoading(false);

    if (result.alreadyAssigned) {
      setError('This booking already has a coach assigned.');
      if (onAssigned) onAssigned();
      return;
    }
    if (!result.success) {
      setError(result.error || "Couldn't assign coach. No changes were made.");
      return;
    }

    setSuccess(true);
    setAssignedCoachName(selectedCoachLabel);
    if (onAssigned) onAssigned();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          <View style={styles.header}>
            <Text style={styles.title}>ASSIGN COACH</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.serviceName}>{session.serviceName || 'Session'}</Text>
            <Text style={styles.datetime}>
              {dateStr} · {timeStr}
            </Text>
            <Text style={styles.location}>{session.locationName}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Student(s)</Text>
              {session.students?.length > 1 ? (
                session.students.map((s) => (
                  <Text key={s.id} style={styles.studentName}>
                    {s.name}
                  </Text>
                ))
              ) : (
                <Text style={styles.studentName}>{studentLabel}</Text>
              )}
            </View>

            {success ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={22} color="#059669" />
                <View style={styles.successTextWrap}>
                  <Text style={styles.successTitle}>Coach assigned</Text>
                  <Text style={styles.successCoach}>Coach: {assignedCoachName}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Coach</Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setShowDropdown(!showDropdown)}
                  disabled={loadingCoaches || loading}
                >
                  <Text style={[styles.dropdownText, !selectedCoachId && styles.dropdownPlaceholder]}>
                    {loadingCoaches ? 'Loading...' : selectedCoachLabel || 'Select coach'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </TouchableOpacity>
                {showDropdown && (
                  <View style={styles.dropdownMenu}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                      {coaches.map((coach) => {
                        const label =
                          [coach.first_name, coach.last_name].filter(Boolean).join(' ') ||
                          coach.email;
                        return (
                          <TouchableOpacity
                            key={coach.id}
                            style={[
                              styles.dropdownItem,
                              selectedCoachId === coach.id && styles.dropdownItemActive,
                            ]}
                            onPress={() => {
                              setSelectedCoachId(coach.id);
                              setShowDropdown(false);
                              setError(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.dropdownItemText,
                                selectedCoachId === coach.id && styles.dropdownItemTextActive,
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                {error.includes('already has a coach') ? null : (
                  <TouchableOpacity onPress={handleAssign} disabled={loading}>
                    <Text style={styles.tryAgain}>Try again</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>{success ? 'Close' : 'Cancel'}</Text>
            </TouchableOpacity>
            {!success && (
              <TouchableOpacity
                style={[styles.assignBtn, (!selectedCoachId || loading) && styles.assignBtnDisabled]}
                onPress={handleAssign}
                disabled={!selectedCoachId || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.assignBtnText}>Assign coach</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    overflow: 'hidden',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    }),
  },
  cardDesktop: {
    maxWidth: 480,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.5,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  datetime: {
    fontSize: 15,
    color: '#374151',
    marginTop: 4,
  },
  location: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  studentName: {
    fontSize: 15,
    color: '#111827',
    marginBottom: 2,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  dropdownText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  dropdownPlaceholder: {
    color: '#9CA3AF',
  },
  dropdownMenu: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFF',
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemActive: {
    backgroundColor: '#F0FDFA',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#374151',
  },
  dropdownItemTextActive: {
    color: '#0D9488',
    fontWeight: '600',
  },
  errorBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
  },
  tryAgain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 8,
  },
  successBox: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successTextWrap: {
    flex: 1,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#065F46',
  },
  successCoach: {
    fontSize: 14,
    color: '#047857',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  assignBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  assignBtnDisabled: {
    opacity: 0.5,
  },
  assignBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
