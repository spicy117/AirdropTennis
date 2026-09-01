import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { getSydneyToday } from '../utils/timezone';
import { mapBookingError } from '../utils/assignLessonErrors';
import {
  buildSingleBookingTimes,
  buildBulkSlots,
  formatDateLabel,
  formatDateTimeLabel,
  validateAssignForm,
} from '../utils/assignLessonHelpers';

const ASSIGN_SERVICES = [
  { id: 'stroke-clinic', name: 'Stroke Clinic', durationHours: 1 },
  { id: 'boot-camp', name: 'Boot Camp', durationHours: 3 },
  { id: 'private-lessons', name: 'Private Lessons', durationHours: 1 },
  { id: 'utr-points-play', name: 'UTR Points Play', durationHours: 2 },
];

const DAY_KEYS = [
  { key: 'sunday', label: 'Sun', jsDow: 0 },
  { key: 'monday', label: 'Mon', jsDow: 1 },
  { key: 'tuesday', label: 'Tue', jsDow: 2 },
  { key: 'wednesday', label: 'Wed', jsDow: 3 },
  { key: 'thursday', label: 'Thu', jsDow: 4 },
  { key: 'friday', label: 'Fri', jsDow: 5 },
  { key: 'saturday', label: 'Sat', jsDow: 6 },
];

const CalendarDatePicker = ({ value, onChange, placeholder, onOpen, hasError }) => (
  <TouchableOpacity
    style={[styles.datePickerButton, hasError && styles.inputErrorBorder]}
    onPress={onOpen}
    activeOpacity={0.7}
  >
    <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
    <Text style={[styles.datePickerText, !value && styles.datePickerPlaceholder]}>
      {value ? formatDateLabel(value) : placeholder}
    </Text>
    <Ionicons name="chevron-down" size={20} color="#8E8E93" />
  </TouchableOpacity>
);

const CalendarModal = ({ visible, onClose, value, onChange, minDate }) => {
  const todayStr = getSydneyToday();
  const [todayY, todayM, todayD] = todayStr.split('-').map(Number);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number);
      return { year, month: month - 1 };
    }
    return { year: todayY, month: todayM - 1 };
  });

  useEffect(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number);
      setSelectedMonth({ year, month: month - 1 });
    }
  }, [value]);

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const isDateDisabled = (day) => {
    if (!minDate) return false;
    const [minYear, minMonth, minDay] = minDate.split('-').map(Number);
    const currentDate = new Date(selectedMonth.year, selectedMonth.month, day);
    const minDateObj = new Date(minYear, minMonth - 1, minDay);
    return currentDate < minDateObj;
  };

  const handleDateSelect = (day) => {
    if (isDateDisabled(day)) return;
    const year = selectedMonth.year;
    const month = String(selectedMonth.month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    onChange(`${year}-${month}-${dayStr}`);
    onClose();
  };

  const handleTodaySelect = () => {
    if (!minDate || todayStr >= minDate) {
      onChange(todayStr);
      onClose();
    }
  };

  const isToday = (day) =>
    day === todayD &&
    selectedMonth.year === todayY &&
    selectedMonth.month === todayM - 1;

  const navigateMonth = (dir) => {
    setSelectedMonth((prev) => {
      let newMonth = prev.month + dir;
      let newYear = prev.year;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
      return { year: newYear, month: newMonth };
    });
  };

  const daysInMonth = getDaysInMonth(selectedMonth.year, selectedMonth.month);
  const firstDay = getFirstDayOfMonth(selectedMonth.year, selectedMonth.month);
  const monthName = new Date(selectedMonth.year, selectedMonth.month).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
  });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.calendarModalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.calendarModalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.calendarNavButton}>
              <Ionicons name="chevron-back" size={20} color="#000" />
            </TouchableOpacity>
            <Text style={styles.calendarMonthText}>{monthName}</Text>
            <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.calendarNavButton}>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.todayButton} onPress={handleTodaySelect}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
          <View style={styles.calendarWeekDays}>
            {weekDays.map((d) => (
              <View key={d} style={styles.calendarWeekDay}>
                <Text style={styles.calendarWeekDayText}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={styles.calendarDays}>
            {days.map((day, i) => {
              const selected =
                day &&
                value &&
                (() => {
                  const [y, m, d] = value.split('-').map(Number);
                  return day === d && selectedMonth.year === y && selectedMonth.month === m - 1;
                })();
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.calendarDay,
                    day && isDateDisabled(day) && styles.calendarDayDisabled,
                    day && isToday(day) && !selected && styles.calendarDayToday,
                    selected && styles.calendarDaySelected,
                  ]}
                  onPress={() => day && handleDateSelect(day)}
                  disabled={!day || isDateDisabled(day)}
                >
                  {day && (
                    <Text
                      style={[
                        styles.calendarDayText,
                        isDateDisabled(day) && styles.calendarDayTextDisabled,
                        isToday(day) && !selected && styles.calendarDayTextToday,
                        selected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

function FieldError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.fieldErrorRow}>
      <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  );
}

function Section({ step, title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {step}. {title}
      </Text>
      {children}
    </View>
  );
}

export default function AdminAssignLessonModal({ visible, onClose, onAssigned }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const scrollRef = useRef(null);

  const [students, setStudents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [locationId, setLocationId] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [cost, setCost] = useState('');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [validationSummary, setValidationSummary] = useState(null);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('single');
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [bulkDaysOfWeek, setBulkDaysOfWeek] = useState({
    sunday: false,
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
  });
  const [bulkStartTime, setBulkStartTime] = useState('09:00');
  const [bulkEndTime, setBulkEndTime] = useState('17:00');
  const [excludedBulkDates, setExcludedBulkDates] = useState(new Set());
  const [openCalendar, setOpenCalendar] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = ASSIGN_SERVICES.find((s) => s.id === selectedServiceId);

  const bulkPreview = useMemo(() => {
    if (mode !== 'bulk' || !bulkStartDate || !bulkEndDate) return { slots: [], uniqueDates: [] };
    const { slots, uniqueDates } = buildBulkSlots({
      bulkStartDate,
      bulkEndDate,
      bulkDaysOfWeek,
      bulkStartTime,
      bulkEndTime,
      durationHours: selectedService?.durationHours || 1,
      skipPast: true,
    });
    const filteredSlots = slots.filter((s) => !excludedBulkDates.has(s.dateStr));
    const filteredDates = uniqueDates.filter((d) => !excludedBulkDates.has(d));
    return { slots: filteredSlots, uniqueDates: filteredDates };
  }, [
    mode,
    bulkStartDate,
    bulkEndDate,
    bulkDaysOfWeek,
    bulkStartTime,
    bulkEndTime,
    selectedService,
    excludedBulkDates,
  ]);

  useEffect(() => {
    if (visible) {
      loadStudents();
      loadLocations();
      resetForm(false);
    }
  }, [visible]);

  const resetForm = (keepMode = true) => {
    const todayStr = getSydneyToday();
    setStudentSearch('');
    setSelectedStudentId(null);
    setDateStr(todayStr);
    setTimeStr('09:00');
    setLocationId(null);
    setSelectedServiceId(null);
    setCost('');
    setError(null);
    setFieldErrors({});
    setValidationSummary(null);
    setResult(null);
    if (!keepMode) setMode('single');
    setBulkStartDate(todayStr);
    setBulkEndDate(todayStr);
    setBulkDaysOfWeek({
      sunday: false,
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
    });
    setBulkStartTime('09:00');
    setBulkEndTime('17:00');
    setExcludedBulkDates(new Set());
    setOpenCalendar(null);
  };

  const loadStudents = async () => {
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'student')
        .order('first_name', { ascending: true });
      if (err) throw err;
      setStudents(
        (data || []).map((p) => ({
          id: p.id,
          label: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id,
          email: p.email,
        }))
      );
    } catch (e) {
      console.error('Error loading students:', e);
      setError(t('assignLessonLoadError') || 'Failed to load data');
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
      setError(t('assignLessonLoadError') || 'Failed to load data');
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

  const clearFieldError = (key) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const runValidation = () => {
    const validation = validateAssignForm(
      {
        selectedStudentId,
        locationId,
        selectedServiceId,
        cost,
        dateStr,
        timeStr,
        service: selectedService,
        bulkStartDate,
        bulkEndDate,
        bulkDaysOfWeek,
        bulkStartTime,
        bulkEndTime,
      },
      mode,
      t
    );
    setFieldErrors(validation.fieldErrors);
    setValidationSummary(validation.summary);
    setError(validation.summary);
    return validation;
  };

  const handleSelectService = (id) => {
    setSelectedServiceId(id);
    clearFieldError('service');
    const svc = ASSIGN_SERVICES.find((s) => s.id === id);
    if (svc && (cost === '' || cost === undefined)) {
      const price = SERVICE_PRICES[svc.name];
      if (typeof price === 'number') setCost(String(price));
    }
  };

  const handleSubmit = () => {
    if (submitting) return;
    setError(null);
    const validation = runValidation();
    if (!validation.valid) {
      scrollRef.current?.scrollTo?.({ y: 0, animated: true });
      return;
    }
    if (mode === 'bulk') {
      if (bulkPreview.slots.length === 0) {
        setError(t('assignLessonBulkNoSlots') || 'No upcoming lessons match your selection. Adjust dates, days, or time.');
        return;
      }
      handleBulkAssign(validation.costNum);
    } else {
      handleAssign(validation.costNum);
    }
  };

  const handleAssign = async (costNum) => {
    try {
      setSubmitting(true);
      const svc = selectedService;
      const times = buildSingleBookingTimes(dateStr, timeStr, svc?.durationHours || 1);
      if (!times) {
        setFieldErrors({ dateTime: t('assignLessonInvalidDateTime') || 'Invalid date or time.' });
        return;
      }

      if (costNum > 0) {
        const balance = await getWalletBalance(selectedStudentId);
        if (balance < costNum) {
          const msg = (t('assignLessonInsufficientBalance') || "Student's wallet balance ({{balance}}) is less than the cost ({{cost}}).")
            .replace('{{balance}}', balance.toFixed(2))
            .replace('{{cost}}', costNum.toFixed(2));
          setError(msg);
          return;
        }
        await deductFromWallet(selectedStudentId, costNum);
      }

      const { error: insertErr } = await supabase.from('bookings').insert({
        user_id: selectedStudentId,
        location_id: locationId,
        start_time: times.startTime,
        end_time: times.endTime,
        credit_cost: costNum,
        service_name: svc?.name || null,
      });

      if (insertErr) {
        if (costNum > 0) {
          try {
            await supabase.rpc('add_wallet_balance', { user_id: selectedStudentId, amount: costNum });
          } catch (refundErr) {
            console.error('Refund failed after insert error:', refundErr);
          }
        }
        throw insertErr;
      }

      setResult({
        type: 'success',
        mode: 'single',
        student: selectedStudent?.label,
        service: svc?.name,
        when: formatDateTimeLabel(dateStr, timeStr),
        location: selectedLocation?.name,
      });
    } catch (e) {
      console.error('Error assigning lesson:', e);
      const friendly = mapBookingError(e);
      setError(friendly);
      setResult({ type: 'error', message: friendly });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAssign = async (costNum) => {
    const svc = selectedService;
    const slots = bulkPreview.slots;

    try {
      setSubmitting(true);
      const totalCost = costNum * slots.length;
      if (costNum > 0) {
        const balance = await getWalletBalance(selectedStudentId);
        if (balance < totalCost) {
          const msg = (t('assignLessonInsufficientBalance') || "Student's wallet balance ({{balance}}) is less than the cost ({{cost}}).")
            .replace('{{balance}}', balance.toFixed(2))
            .replace('{{cost}}', totalCost.toFixed(2));
          setError(msg);
          return;
        }
      }

      let created = 0;
      const failures = [];

      for (const slot of slots) {
        if (costNum > 0) {
          await deductFromWallet(selectedStudentId, costNum);
        }
        const { error: insertErr } = await supabase.from('bookings').insert({
          user_id: selectedStudentId,
          location_id: locationId,
          start_time: slot.startTime,
          end_time: slot.endTime,
          credit_cost: costNum,
          service_name: svc?.name || null,
        });
        if (insertErr) {
          failures.push({
            label: `${formatDateLabel(slot.dateStr)} · ${slot.timeLabel}`,
            reason: mapBookingError(insertErr),
          });
          if (costNum > 0) {
            try {
              await supabase.rpc('add_wallet_balance', { user_id: selectedStudentId, amount: costNum });
            } catch {}
          }
        } else {
          created++;
        }
      }

      if (created === 0) {
        const friendly = failures[0]?.reason || "We couldn't assign these lessons. Please try again.";
        setError(friendly);
        setResult({ type: 'error', message: friendly, failures });
        return;
      }

      setResult({
        type: created === slots.length ? 'success' : 'partial',
        mode: 'bulk',
        created,
        total: slots.length,
        student: selectedStudent?.label,
        service: svc?.name,
        time: bulkStartTime,
        location: selectedLocation?.name,
        dates: bulkPreview.uniqueDates.map(formatDateLabel),
        failures,
      });
    } catch (e) {
      console.error('Bulk assign error:', e);
      const friendly = mapBookingError(e);
      setError(friendly);
      setResult({ type: 'error', message: friendly });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResultDone = () => {
    const wasSuccess = result?.type === 'success' || result?.type === 'partial';
    setResult(null);
    if (wasSuccess) {
      onAssigned?.();
      onClose();
    }
  };

  const handleAssignAnother = () => {
    resetForm(true);
  };

  const handleClose = () => {
    resetForm(false);
    onClose();
  };

  const handleBulkDayToggle = (key) => {
    setBulkDaysOfWeek((prev) => ({ ...prev, [key]: !prev[key] }));
    setExcludedBulkDates(new Set());
    clearFieldError('bulkDays');
  };

  const removeBulkDate = (dateStr) => {
    setExcludedBulkDates((prev) => new Set([...prev, dateStr]));
  };

  const submitLabel =
    mode === 'bulk'
      ? bulkPreview.slots.length > 0
        ? `Assign ${bulkPreview.slots.length} lesson${bulkPreview.slots.length !== 1 ? 's' : ''}`
        : t('assignLessonBulkSubmit') || 'Assign lessons'
      : t('assignLessonSubmit') || 'Assign lesson';

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {result ? (
            <View style={styles.resultOverlay}>
              <View
                style={[
                  styles.resultCard,
                  result.type === 'success' || result.type === 'partial'
                    ? styles.resultCardSuccess
                    : styles.resultCardError,
                ]}
              >
                <Ionicons
                  name={result.type === 'error' ? 'close-circle' : 'checkmark-circle'}
                  size={48}
                  color={result.type === 'error' ? '#DC2626' : '#059669'}
                />
                <Text style={styles.resultTitle}>
                  {result.type === 'error'
                    ? t('assignLessonFailedTitle') || 'Could not assign'
                    : result.mode === 'bulk'
                      ? `${result.created} lesson${result.created !== 1 ? 's' : ''} assigned`
                      : t('assignLessonSuccessTitleFull') || 'Lesson assigned'}
                </Text>

                {result.type !== 'error' && (
                  <View style={styles.resultDetails}>
                    {result.student ? (
                      <Text style={styles.resultDetailLine}>
                        <Text style={styles.resultDetailLabel}>Student </Text>
                        {result.student}
                      </Text>
                    ) : null}
                    {result.service ? (
                      <Text style={styles.resultDetailLine}>
                        <Text style={styles.resultDetailLabel}>Session </Text>
                        {result.service}
                      </Text>
                    ) : null}
                    {result.when ? (
                      <Text style={styles.resultDetailLine}>
                        <Text style={styles.resultDetailLabel}>When </Text>
                        {result.when}
                      </Text>
                    ) : null}
                    {result.time && !result.when ? (
                      <Text style={styles.resultDetailLine}>
                        <Text style={styles.resultDetailLabel}>Time </Text>
                        {result.time}
                      </Text>
                    ) : null}
                    {result.location ? (
                      <Text style={styles.resultDetailLine}>
                        <Text style={styles.resultDetailLabel}>Where </Text>
                        {result.location}
                      </Text>
                    ) : null}
                    {result.dates?.length ? (
                      <Text style={styles.resultDetailLine}>
                        <Text style={styles.resultDetailLabel}>Dates </Text>
                        {result.dates.join(', ')}
                      </Text>
                    ) : null}
                  </View>
                )}

                {result.type === 'partial' && result.failures?.length ? (
                  <View style={styles.failuresBox}>
                    <Text style={styles.failuresTitle}>
                      {result.created} of {result.total} lessons assigned
                    </Text>
                    <Text style={styles.failuresSubtitle}>Could not assign:</Text>
                    {result.failures.map((f, i) => (
                      <Text key={i} style={styles.failureLine}>
                        {f.label} — {f.reason}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {result.type === 'error' && result.message ? (
                  <Text style={styles.resultMessage}>{result.message}</Text>
                ) : null}

                <View style={styles.resultActions}>
                  {(result.type === 'success' || result.type === 'partial') && (
                    <TouchableOpacity style={styles.resultSecondaryBtn} onPress={handleAssignAnother}>
                      <Text style={styles.resultSecondaryBtnText}>
                        {t('assignLessonAssignAnother') || 'Assign another'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.resultPrimaryBtn, result.type === 'error' && styles.resultPrimaryBtnError]}
                    onPress={result.type === 'error' ? () => setResult(null) : handleResultDone}
                  >
                    <Text style={styles.resultPrimaryBtnText}>
                      {result.type === 'error'
                        ? t('assignLessonTryAgain') || 'Try again'
                        : t('assignLessonDone') || 'Done'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>{t('assignLessonTitle') || 'Assign a lesson'}</Text>
                  <Text style={styles.subtitle}>
                    {t('assignLessonSubtitle') || 'Create a booking for a student'}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {validationSummary || error ? (
                  <View style={styles.validationBanner}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text style={styles.validationBannerText}>{validationSummary || error}</Text>
                  </View>
                ) : null}

                <View style={styles.modeToggle}>
                  <Text style={styles.modeToggleLabel}>{t('assignLessonAssignmentType') || 'Assignment type'}</Text>
                  <View style={styles.modeToggleRow}>
                    <TouchableOpacity
                      style={[styles.modeTab, mode === 'single' && styles.modeTabActive]}
                      onPress={() => {
                        setMode('single');
                        setFieldErrors({});
                        setValidationSummary(null);
                        setError(null);
                      }}
                    >
                      <Text style={[styles.modeTabText, mode === 'single' && styles.modeTabTextActive]}>
                        {t('assignLessonSingle') || 'Single lesson'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeTab, mode === 'bulk' && styles.modeTabActive]}
                      onPress={() => {
                        setMode('bulk');
                        setFieldErrors({});
                        setValidationSummary(null);
                        setError(null);
                      }}
                    >
                      <Text style={[styles.modeTabText, mode === 'bulk' && styles.modeTabTextActive]}>
                        {t('assignLessonBulk') || 'Bulk lessons'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Section step={1} title={t('assignLessonStudent') || 'Student'}>
                  <TextInput
                    style={[styles.input, fieldErrors.student && styles.inputErrorBorder]}
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
                          onPress={() => {
                            setSelectedStudentId(item.id);
                            clearFieldError('student');
                          }}
                        >
                          <Text style={styles.optionText} numberOfLines={1}>
                            {item.label}
                          </Text>
                          {item.email ? (
                            <Text style={styles.optionSub} numberOfLines={1}>
                              {item.email}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      )}
                      scrollEnabled={false}
                    />
                  </View>
                  {selectedStudent && (
                    <View style={styles.selectedChip}>
                      <Ionicons name="person" size={14} color="#0D9488" />
                      <Text style={styles.selectedChipText}>{selectedStudent.label}</Text>
                    </View>
                  )}
                  <FieldError message={fieldErrors.student} />
                </Section>

                <Section step={2} title={t('assignLessonService') || 'Session'}>
                  <View style={styles.serviceGrid}>
                    {ASSIGN_SERVICES.map((svc) => (
                      <TouchableOpacity
                        key={svc.id}
                        style={[styles.serviceCard, selectedServiceId === svc.id && styles.serviceCardSelected]}
                        onPress={() => handleSelectService(svc.id)}
                      >
                        <Text style={[styles.serviceName, selectedServiceId === svc.id && styles.serviceNameSelected]}>
                          {svc.name}
                        </Text>
                        <Text style={styles.serviceDuration}>{svc.durationHours} hour{svc.durationHours !== 1 ? 's' : ''}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <FieldError message={fieldErrors.service} />
                </Section>

                <Section step={3} title={mode === 'bulk' ? 'Date & time' : t('assignLessonDateTime') || 'Date & time'}>
                  {mode === 'single' ? (
                    <>
                      <Text style={styles.fieldLabel}>{t('assignLessonDate') || 'Date'}</Text>
                      <CalendarDatePicker
                        value={dateStr}
                        onChange={(d) => {
                          setDateStr(d);
                          clearFieldError('date');
                        }}
                        placeholder={t('assignLessonSelectDate') || 'Choose a date'}
                        onOpen={() => setOpenCalendar('singleDate')}
                        hasError={!!fieldErrors.date}
                      />
                      <FieldError message={fieldErrors.date} />

                      <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
                        {t('assignLessonTime') || 'Time'}
                      </Text>
                      <TextInput
                        style={[styles.input, fieldErrors.time && styles.inputErrorBorder]}
                        placeholder="HH:MM (e.g. 09:00)"
                        value={timeStr}
                        onChangeText={(v) => {
                          setTimeStr(v);
                          clearFieldError('time');
                        }}
                        placeholderTextColor="#94A3B8"
                      />
                      <FieldError message={fieldErrors.time || fieldErrors.dateTime} />

                      {dateStr && timeStr ? (
                        <View style={styles.selectedSummaryBox}>
                          <Text style={styles.selectedSummaryLabel}>Selected</Text>
                          <Text style={styles.selectedSummaryValue}>{formatDateTimeLabel(dateStr, timeStr)}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text style={styles.bulkHint}>
                        {t('assignLessonBulkHint') || 'Create the same lesson across multiple dates.'}
                      </Text>

                      <Text style={styles.fieldLabel}>Start date</Text>
                      <CalendarDatePicker
                        value={bulkStartDate}
                        onChange={(d) => {
                          setBulkStartDate(d);
                          if (bulkEndDate && d > bulkEndDate) setBulkEndDate('');
                          setExcludedBulkDates(new Set());
                          clearFieldError('bulkRange');
                        }}
                        placeholder="Select start date"
                        onOpen={() => setOpenCalendar('startDate')}
                        hasError={!!fieldErrors.bulkRange}
                      />

                      <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>End date</Text>
                      <CalendarDatePicker
                        value={bulkEndDate}
                        onChange={(d) => {
                          setBulkEndDate(d);
                          setExcludedBulkDates(new Set());
                          clearFieldError('bulkRange');
                        }}
                        placeholder="Select end date"
                        onOpen={() => setOpenCalendar('endDate')}
                        hasError={!!fieldErrors.bulkRange}
                      />
                      <FieldError message={fieldErrors.bulkRange} />

                      <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Repeat on</Text>
                      <View style={styles.daysContainer}>
                        {DAY_KEYS.map(({ key, label }) => (
                          <TouchableOpacity
                            key={key}
                            style={[styles.dayButton, bulkDaysOfWeek[key] && styles.dayButtonActive]}
                            onPress={() => handleBulkDayToggle(key)}
                          >
                            <Text style={[styles.dayButtonText, bulkDaysOfWeek[key] && styles.dayButtonTextActive]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <FieldError message={fieldErrors.bulkDays} />

                      <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Time</Text>
                      <View style={styles.timeRow}>
                        <View style={styles.timeInputWrap}>
                          <Text style={styles.timeLabel}>Start</Text>
                          <TextInput
                            style={[styles.input, fieldErrors.bulkTime && styles.inputErrorBorder]}
                            placeholder="09:00"
                            value={bulkStartTime}
                            onChangeText={(v) => {
                              setBulkStartTime(v);
                              setExcludedBulkDates(new Set());
                              clearFieldError('bulkTime');
                            }}
                            placeholderTextColor="#94A3B8"
                          />
                        </View>
                        <View style={styles.timeInputWrap}>
                          <Text style={styles.timeLabel}>End window</Text>
                          <TextInput
                            style={[styles.input, fieldErrors.bulkTime && styles.inputErrorBorder]}
                            placeholder="17:00"
                            value={bulkEndTime}
                            onChangeText={(v) => {
                              setBulkEndTime(v);
                              setExcludedBulkDates(new Set());
                              clearFieldError('bulkTime');
                            }}
                            placeholderTextColor="#94A3B8"
                          />
                        </View>
                      </View>
                      <FieldError message={fieldErrors.bulkTime} />

                      {bulkPreview.uniqueDates.length > 0 && (
                        <View style={styles.bulkDatesPreview}>
                          <Text style={styles.bulkDatesPreviewTitle}>
                            Selected dates — {bulkPreview.uniqueDates.length}
                          </Text>
                          <Text style={styles.bulkPreviewCount}>
                            {bulkPreview.slots.length} lesson{bulkPreview.slots.length !== 1 ? 's' : ''} will be created
                          </Text>
                          <View style={styles.dateChips}>
                            {bulkPreview.uniqueDates.map((d) => (
                              <View key={d} style={styles.dateChip}>
                                <Text style={styles.dateChipText}>{formatDateLabel(d)}</Text>
                                <TouchableOpacity onPress={() => removeBulkDate(d)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <Ionicons name="close-circle" size={18} color="#64748B" />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </>
                  )}
                </Section>

                <Section step={4} title={t('assignLessonLocation') || 'Location'}>
                  <View style={styles.listWrap}>
                    {locations.map((loc) => (
                      <TouchableOpacity
                        key={loc.id}
                        style={[styles.option, locationId === loc.id && styles.optionSelected]}
                        onPress={() => {
                          setLocationId(loc.id);
                          clearFieldError('location');
                        }}
                      >
                        <Text style={styles.optionText}>{loc.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <FieldError message={fieldErrors.location} />
                </Section>

                <Section step={5} title={t('assignLessonReview') || 'Review & assign'}>
                  <Text style={styles.fieldLabel}>{t('assignLessonCost') || 'Cost (charged from student)'}</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.cost && styles.inputErrorBorder]}
                    placeholder="0"
                    value={cost}
                    onChangeText={(v) => {
                      setCost(v);
                      clearFieldError('cost');
                    }}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={styles.hint}>
                    {t('assignLessonCostHint') || "Amount in dollars to deduct from the student's wallet. Use 0 for no charge."}
                  </Text>
                  <FieldError message={fieldErrors.cost} />

                  {(selectedStudent || selectedService || selectedLocation) && (
                    <View style={styles.reviewBox}>
                      <Text style={styles.reviewTitle}>Review</Text>
                      {selectedStudent ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewLabel}>Student</Text>
                          <Text style={styles.reviewValue}>{selectedStudent.label}</Text>
                        </View>
                      ) : null}
                      {selectedService ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewLabel}>Session</Text>
                          <Text style={styles.reviewValue}>{selectedService.name}</Text>
                        </View>
                      ) : null}
                      {mode === 'single' && dateStr && timeStr ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewLabel}>When</Text>
                          <Text style={styles.reviewValue}>{formatDateTimeLabel(dateStr, timeStr)}</Text>
                        </View>
                      ) : null}
                      {mode === 'bulk' && bulkStartTime ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewLabel}>Time</Text>
                          <Text style={styles.reviewValue}>{bulkStartTime}</Text>
                        </View>
                      ) : null}
                      {mode === 'bulk' && bulkPreview.uniqueDates.length > 0 ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewLabel}>Dates</Text>
                          <Text style={styles.reviewValue}>{bulkPreview.uniqueDates.length} selected</Text>
                        </View>
                      ) : null}
                      {selectedLocation ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewLabel}>Where</Text>
                          <Text style={styles.reviewValue}>{selectedLocation.name}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <View style={styles.submittingRow}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={styles.submitBtnText}>{t('assignLessonSubmitting') || 'Assigning...'}</Text>
                      </View>
                    ) : (
                      <Text style={styles.submitBtnText}>{submitLabel}</Text>
                    )}
                  </TouchableOpacity>
                </Section>
              </ScrollView>

              <CalendarModal
                visible={openCalendar === 'singleDate'}
                onClose={() => setOpenCalendar(null)}
                value={dateStr}
                onChange={(d) => {
                  setDateStr(d);
                  clearFieldError('date');
                  setOpenCalendar(null);
                }}
                minDate={null}
              />
              <CalendarModal
                visible={openCalendar === 'startDate'}
                onClose={() => setOpenCalendar(null)}
                value={bulkStartDate}
                onChange={(d) => {
                  setBulkStartDate(d);
                  if (bulkEndDate && d > bulkEndDate) setBulkEndDate('');
                  setExcludedBulkDates(new Set());
                  setOpenCalendar(null);
                }}
                minDate={null}
              />
              <CalendarModal
                visible={openCalendar === 'endDate'}
                onClose={() => setOpenCalendar(null)}
                value={bulkEndDate}
                onChange={(d) => {
                  setBulkEndDate(d);
                  setExcludedBulkDates(new Set());
                  setOpenCalendar(null);
                }}
                minDate={bulkStartDate}
              />
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
    maxHeight: '92%',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  scroll: { maxHeight: 520 },
  scrollContent: { padding: 20, paddingBottom: 36 },
  section: {
    marginBottom: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  fieldLabelSpaced: { marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
  },
  inputErrorBorder: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  fieldErrorText: { fontSize: 13, color: '#DC2626', flex: 1 },
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
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectedChipText: { fontSize: 13, fontWeight: '600', color: '#0D9488' },
  hint: { fontSize: 12, color: '#64748B', marginTop: 4 },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  validationBannerText: { flex: 1, fontSize: 14, color: '#DC2626', fontWeight: '500' },
  submitBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  submittingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultOverlay: {
    padding: 24,
    minHeight: 280,
  },
  resultCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  resultCardSuccess: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
  resultCardError: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  resultDetails: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  resultDetailLine: { fontSize: 14, color: '#334155', lineHeight: 20 },
  resultDetailLabel: { fontWeight: '600', color: '#64748B' },
  failuresBox: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  failuresTitle: { fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 4 },
  failuresSubtitle: { fontSize: 13, color: '#78350F', marginBottom: 6 },
  failureLine: { fontSize: 13, color: '#78350F', marginBottom: 2 },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  resultPrimaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#059669',
    minWidth: 120,
    alignItems: 'center',
  },
  resultPrimaryBtnError: { backgroundColor: '#DC2626' },
  resultPrimaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  resultSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    minWidth: 120,
    alignItems: 'center',
  },
  resultSecondaryBtnText: { color: '#334155', fontSize: 15, fontWeight: '600' },
  modeToggle: { marginBottom: 16 },
  modeToggleLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#FFF',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    }),
  },
  modeTabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  modeTabTextActive: { color: '#0D9488' },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceCard: {
    flexGrow: 1,
    flexBasis: Platform.OS === 'web' ? '45%' : '100%',
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  serviceCardSelected: {
    borderColor: '#0D9488',
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
  },
  serviceName: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  serviceNameSelected: { color: '#0D9488' },
  serviceDuration: { fontSize: 12, color: '#64748B', marginTop: 4 },
  selectedSummaryBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  selectedSummaryLabel: { fontSize: 12, fontWeight: '600', color: '#0D9488', marginBottom: 2 },
  selectedSummaryValue: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  bulkHint: { fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 18 },
  bulkDatesPreview: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bulkDatesPreviewTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  bulkPreviewCount: { fontSize: 13, color: '#64748B', marginBottom: 10 },
  dateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
  },
  dateChipText: { fontSize: 13, fontWeight: '500', color: '#334155' },
  reviewBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  reviewLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  reviewValue: { fontSize: 14, color: '#0F172A', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFF',
    gap: 8,
  },
  datePickerText: { flex: 1, fontSize: 16, color: '#0F172A' },
  datePickerPlaceholder: { color: '#94A3B8' },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonActive: { borderColor: '#0D9488', backgroundColor: 'rgba(13, 148, 136, 0.12)' },
  dayButtonText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  dayButtonTextActive: { color: '#0D9488' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeInputWrap: { flex: 1 },
  timeLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    width: Platform.OS === 'web' ? 350 : '90%',
    maxWidth: 400,
    ...(Platform.OS === 'web' && { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)' }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 1000,
    }),
  },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calendarNavButton: { padding: 8 },
  calendarMonthText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  todayButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  todayButtonText: { fontSize: 14, fontWeight: '600', color: '#0D9488' },
  calendarWeekDays: { flexDirection: 'row', marginBottom: 8 },
  calendarWeekDay: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  calendarWeekDayText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  calendarDays: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calendarDayDisabled: { opacity: 0.3 },
  calendarDayToday: { backgroundColor: '#E0F2FE' },
  calendarDaySelected: { backgroundColor: '#0D9488' },
  calendarDayText: { fontSize: 14, color: '#0F172A' },
  calendarDayTextDisabled: { color: '#CBD5E1' },
  calendarDayTextToday: { color: '#0284C7', fontWeight: '600' },
  calendarDayTextSelected: { color: '#FFF', fontWeight: '700' },
});
