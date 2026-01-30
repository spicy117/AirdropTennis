import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { supabase } from '../lib/supabase';
import { getWalletBalance, deductFromWallet } from '../lib/stripe';
import { SERVICE_PRICES } from '../utils/pricing';

// Four services: name (stored in DB), duration in hours. Duration drives end_time to satisfy bookings_minimum_duration.
const ASSIGN_SERVICES = [
  { id: 'stroke-clinic', name: 'Stroke Clinic', durationHours: 1 },
  { id: 'boot-camp', name: 'Boot Camp', durationHours: 3 },
  { id: 'private-lessons', name: 'Private Lessons', durationHours: 1 },
  { id: 'utr-points-play', name: 'UTR Points Play', durationHours: 2 },
];

export default function AdminAssignLessonModal({ visible, onClose, onAssigned }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [students, setStudents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [locationId, setLocationId] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [cost, setCost] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { type: 'success' | 'error', message: string }

  useEffect(() => {
    if (visible) {
      loadStudents();
      loadLocations();
      const today = new Date();
      setDateStr(today.toISOString().slice(0, 10));
      setTimeStr('09:00');
    }
  }, [visible]);

  const loadStudents = async () => {
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'student')
        .order('first_name', { ascending: true });
      if (err) throw err;
      setStudents((data || []).map((p) => ({
        id: p.id,
        label: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id,
        email: p.email,
      })));
    } catch (e) {
      console.error('Error loading students:', e);
      setError(t('assignLessonLoadError') || 'Failed to load students');
    }
  };

  const loadLocations = async () => {
    try {
      const { data, error: err } = await supabase
        .from('locations')
        .select('id, name')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('name');
      if (err) throw err;
      setLocations(data || []);
    } catch (e) {
      console.error('Error loading locations:', e);
      setError(t('assignLessonLoadError') || 'Failed to load locations');
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      !studentSearch.trim() ||
      s.label.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedLocation = locations.find((l) => l.id === locationId);

  const handleSelectService = (id) => {
    setSelectedServiceId(id);
    const svc = ASSIGN_SERVICES.find((s) => s.id === id);
    if (svc && (cost === '' || cost === undefined)) {
      const price = SERVICE_PRICES[svc.name];
      if (typeof price === 'number') setCost(String(price));
    }
  };

  const handleAssign = async () => {
    setError(null);
    if (!selectedStudentId) {
      setError(t('assignLessonSelectStudent') || 'Please select a student');
      return;
    }
    if (!dateStr.trim() || !timeStr.trim()) {
      setError(t('assignLessonSelectDateTime') || 'Please enter date and time');
      return;
    }
    if (!locationId) {
      setError(t('assignLessonSelectLocation') || 'Please select a location');
      return;
    }
    if (!selectedServiceId) {
      setError(t('assignLessonSelectService') || 'Please select a service');
      return;
    }
    const costNum = parseFloat(String(cost).replace(/,/g, '.'));
    if (isNaN(costNum) || costNum < 0) {
      setError(t('assignLessonEnterCost') || 'Please enter a valid cost (e.g. 50)');
      return;
    }

    try {
      setSubmitting(true);
      const svc = ASSIGN_SERVICES.find((s) => s.id === selectedServiceId);
      const durationMs = (svc?.durationHours || 1) * 60 * 60 * 1000;
      const start = new Date(`${dateStr}T${timeStr}:00`);
      if (isNaN(start.getTime())) {
        setError(t('assignLessonInvalidDateTime') || 'Invalid date or time');
        return;
      }
      const end = new Date(start.getTime() + durationMs);
      const startTime = start.toISOString();
      const endTime = end.toISOString();

      if (costNum > 0) {
        const balance = await getWalletBalance(selectedStudentId);
        if (balance < costNum) {
          setError(
            (t('assignLessonInsufficientBalance') || 'Insufficient balance')
              .replace('{{balance}}', balance.toFixed(2))
              .replace('{{cost}}', costNum.toFixed(2))
          );
          return;
        }
        await deductFromWallet(selectedStudentId, costNum);
      }

      const { error: insertErr } = await supabase.from('bookings').insert({
        user_id: selectedStudentId,
        location_id: locationId,
        start_time: startTime,
        end_time: endTime,
        credit_cost: costNum,
        service_name: svc?.name || null,
      });

      if (insertErr) {
        if (costNum > 0) {
          try {
            await supabase.rpc('add_wallet_balance', {
              user_id: selectedStudentId,
              amount: costNum,
            });
          } catch (refundErr) {
            console.error('Refund failed after insert error:', refundErr);
          }
        }
        throw insertErr;
      }

      setResult({
        type: 'success',
        message: (t('assignLessonSuccessMessage') || "The lesson has been assigned and will appear on the student's home page.").replace('{{name}}', selectedStudent?.label || ''),
      });
    } catch (e) {
      console.error('Error assigning lesson:', e);
      const errMsg = e.message || (t('assignLessonError') || 'Failed to assign lesson');
      setError(errMsg);
      setResult({ type: 'error', message: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResultDismiss = () => {
    const wasSuccess = result?.type === 'success';
    setResult(null);
    if (wasSuccess) {
      onAssigned?.();
      onClose();
    }
  };

  const handleClose = () => {
    setError(null);
    setResult(null);
    setSelectedStudentId(null);
    setStudentSearch('');
    setDateStr('');
    setTimeStr('');
    setLocationId(null);
    setSelectedServiceId(null);
    setCost('');
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {result ? (
            <View style={styles.resultOverlay}>
              <View style={[styles.resultCard, result.type === 'success' ? styles.resultCardSuccess : styles.resultCardError]}>
                <Ionicons
                  name={result.type === 'success' ? 'checkmark-circle' : 'close-circle'}
                  size={56}
                  color={result.type === 'success' ? '#059669' : '#DC2626'}
                />
                <Text style={styles.resultTitle}>
                  {result.type === 'success' ? (t('assignLessonSuccessTitle') || 'Success') : (t('assignLessonFailedTitle') || 'Failed')}
                </Text>
                <Text style={styles.resultMessage}>{result.message}</Text>
                <TouchableOpacity style={[styles.resultOkBtn, result.type === 'success' ? styles.resultOkBtnSuccess : styles.resultOkBtnError]} onPress={handleResultDismiss}>
                  <Text style={styles.resultOkBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
          <View style={styles.header}>
            <Text style={styles.title}>{t('assignLesson') || 'Assign lesson'}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>{t('assignLessonStudent') || 'Student'}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('assignLessonSearchStudent') || 'Search by name or email...'}
              value={studentSearch}
              onChangeText={setStudentSearch}
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.listWrap}>
              <FlatList
                data={filteredStudents.slice(0, 8)}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.option, selectedStudentId === item.id && styles.optionSelected]}
                    onPress={() => setSelectedStudentId(item.id)}
                  >
                    <Text style={styles.optionText} numberOfLines={1}>{item.label}</Text>
                    {item.email ? <Text style={styles.optionSub} numberOfLines={1}>{item.email}</Text> : null}
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </View>
            {selectedStudent && (
              <Text style={styles.hint}>{t('assignLessonSelected') || 'Selected'}: {selectedStudent.label}</Text>
            )}

            <Text style={styles.label}>{t('assignLessonDate') || 'Date'}</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={dateStr}
              onChangeText={setDateStr}
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>{t('assignLessonTime') || 'Time'}</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:MM (e.g. 09:00)"
              value={timeStr}
              onChangeText={setTimeStr}
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>{t('assignLessonLocation') || 'Location'}</Text>
            <View style={styles.listWrap}>
              {locations.map((loc) => (
                <TouchableOpacity
                  key={loc.id}
                  style={[styles.option, locationId === loc.id && styles.optionSelected]}
                  onPress={() => setLocationId(loc.id)}
                >
                  <Text style={styles.optionText}>{loc.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('assignLessonService') || 'Service'}</Text>
            <View style={styles.listWrap}>
              {ASSIGN_SERVICES.map((svc) => (
                <TouchableOpacity
                  key={svc.id}
                  style={[styles.option, selectedServiceId === svc.id && styles.optionSelected]}
                  onPress={() => handleSelectService(svc.id)}
                >
                  <Text style={styles.optionText}>{svc.name}</Text>
                  <Text style={styles.optionSub}>{svc.durationHours}h</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('assignLessonCost') || 'Cost (charged from student)'}</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.hint}>{t('assignLessonCostHint') || 'Amount in dollars to deduct from the student\'s wallet. Use 0 for no charge.'}</Text>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleAssign}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>{t('assignLessonSubmit') || 'Assign lesson'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scroll: { maxHeight: 420 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
  },
  listWrap: { marginTop: 4 },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 6,
  },
  optionSelected: {
    borderColor: '#0D9488',
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
  },
  optionText: { fontSize: 15, color: '#0F172A', fontWeight: '500' },
  optionSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  hint: { fontSize: 12, color: '#64748B', marginTop: 4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 14, color: '#DC2626' },
  submitBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  resultOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 280,
  },
  resultCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
  },
  resultCardSuccess: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
  resultCardError: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  resultMessage: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  resultOkBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  resultOkBtnSuccess: { backgroundColor: '#059669' },
  resultOkBtnError: { backgroundColor: '#DC2626' },
  resultOkBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
