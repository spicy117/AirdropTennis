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
import { addDaysToDateString, getDayOfWeekFromDateString, sydneyDateTimeToUTC } from '../utils/timezone';

// Four services: name (stored in DB), duration in hours. Duration drives end_time to satisfy bookings_minimum_duration.
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

// Calendar button - opens modal (avoids inline calendar formatting issues)
const CalendarDatePicker = ({ value, onChange, placeholder, onOpen }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };
  return (
    <TouchableOpacity style={styles.datePickerButton} onPress={onOpen} activeOpacity={0.7}>
      <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
      <Text style={[styles.datePickerText, !value && styles.datePickerPlaceholder]}>
        {value ? formatDate(value) : placeholder}
      </Text>
      <Ionicons name="chevron-down" size={20} color="#8E8E93" />
    </TouchableOpacity>
  );
};

// Calendar modal - renders in separate Modal above everything
const CalendarModal = ({ visible, onClose, value, onChange, minDate }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number);
      return { year, month: month - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  React.useEffect(() => {
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
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!isDateDisabled(today.getDate())) {
      onChange(dateStr);
      onClose();
    }
  };
  const isToday = (day) =>
    day === new Date().getDate() &&
    selectedMonth.year === new Date().getFullYear() &&
    selectedMonth.month === new Date().getMonth();
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
  const monthName = new Date(selectedMonth.year, selectedMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
          <TouchableOpacity style={styles.todayButton} onPress={handleTodaySelect} disabled={minDate && isDateDisabled(new Date().getDate())}>
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
              const selected = day && value && (() => {
                const [y, m, d] = value.split('-').map(Number);
                return day === d && selectedMonth.year === y && selectedMonth.month === m - 1;
              })();
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.calendarDay,
                    day && isDateDisabled(day) && styles.calendarDayDisabled,
                    day && isToday(day) && !value && styles.calendarDayToday,
                    selected && styles.calendarDaySelected,
                  ]}
                  onPress={() => day && handleDateSelect(day)}
                  disabled={!day || isDateDisabled(day)}
                >
                  {day && (
                    <Text style={[
                      styles.calendarDayText,
                      isDateDisabled(day) && styles.calendarDayTextDisabled,
                      isToday(day) && !value && styles.calendarDayTextToday,
                      selected && styles.calendarDayTextSelected,
                    ]}>
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
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [bulkDaysOfWeek, setBulkDaysOfWeek] = useState({
    sunday: false, monday: false, tuesday: false, wednesday: false,
    thursday: false, friday: false, saturday: false,
  });
  const [bulkStartTime, setBulkStartTime] = useState('09:00');
  const [bulkEndTime, setBulkEndTime] = useState('17:00');
  const [openCalendar, setOpenCalendar] = useState(null); // 'startDate' | 'endDate' | null

  useEffect(() => {
    if (visible) {
      loadStudents();
      loadLocations();
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      setDateStr(todayStr);
      setTimeStr('09:00');
      setBulkStartDate(todayStr);
      setBulkEndDate(todayStr);
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

  const handleBulkDayToggle = (key) => {
    setBulkDaysOfWeek((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleBulkAssign = async () => {
    setError(null);
    if (!selectedStudentId) {
      setError(t('assignLessonSelectStudent') || 'Please select a student');
      return;
    }
    if (!bulkStartDate || !bulkEndDate) {
      setError('Please select start and end dates');
      return;
    }
    const selectedDays = DAY_KEYS.filter((d) => bulkDaysOfWeek[d.key]).map((d) => d.jsDow);
    if (selectedDays.length === 0) {
      setError('Please select at least one day of the week');
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
    const svc = ASSIGN_SERVICES.find((s) => s.id === selectedServiceId);
    const durationHours = svc?.durationHours || 1;
    const [startH, startM] = bulkStartTime.split(':').map(Number);
    const [endH, endM] = bulkEndTime.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);
    if (endMinutes <= startMinutes) {
      setError('End time must be after start time');
      return;
    }

    try {
      setSubmitting(true);
      const slots = [];
      let current = bulkStartDate;
      while (current <= bulkEndDate) {
        const dow = getDayOfWeekFromDateString(current);
        if (selectedDays.includes(dow)) {
          for (let m = startMinutes; m + durationHours * 60 <= endMinutes; m += durationHours * 60) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const startISO = sydneyDateTimeToUTC(current, h, min);
            const startDate = new Date(startISO);
            const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
            slots.push({ startTime: startISO, endTime: endDate.toISOString() });
          }
        }
        current = addDaysToDateString(current, 1);
      }
      if (slots.length === 0) {
        setError('No slots found for the selected range and days. Try a different date range or days.');
        setSubmitting(false);
        return;
      }
      const totalCost = costNum * slots.length;
      if (costNum > 0) {
        const balance = await getWalletBalance(selectedStudentId);
        if (balance < totalCost) {
          setError(
            (t('assignLessonInsufficientBalance') || 'Insufficient balance')
              .replace('{{balance}}', balance.toFixed(2))
              .replace('{{cost}}', totalCost.toFixed(2))
          );
          setSubmitting(false);
          return;
        }
      }
      let created = 0;
      let failed = 0;
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
          failed++;
          if (costNum > 0) {
            try {
              await supabase.rpc('add_wallet_balance', { user_id: selectedStudentId, amount: costNum });
            } catch {}
          }
        } else {
          created++;
        }
      }
      setResult({
        type: failed === 0 ? 'success' : 'error',
        message: failed === 0
          ? `${created} lesson${created !== 1 ? 's' : ''} assigned.`
          : `${created} created, ${failed} failed.`,
      });
    } catch (e) {
      console.error('Bulk assign error:', e);
      setError(e.message || 'Failed to bulk assign');
      setResult({ type: 'error', message: e.message || 'Failed to bulk assign' });
    } finally {
      setSubmitting(false);
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
    setMode('single');
    setOpenCalendar(null);
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

            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'single' && styles.modeTabActive]}
                onPress={() => setMode('single')}
              >
                <Text style={[styles.modeTabText, mode === 'single' && styles.modeTabTextActive]}>Single lesson</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'bulk' && styles.modeTabActive]}
                onPress={() => setMode('bulk')}
              >
                <Text style={[styles.modeTabText, mode === 'bulk' && styles.modeTabTextActive]}>Bulk lessons</Text>
              </TouchableOpacity>
            </View>

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

            {mode === 'single' ? (
              <>
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
              </>
            ) : (
              <>
                <Text style={styles.label}>Start date *</Text>
                <CalendarDatePicker
                  value={bulkStartDate}
                  onChange={(d) => {
                    setBulkStartDate(d);
                    if (bulkEndDate && d > bulkEndDate) setBulkEndDate('');
                  }}
                  placeholder="Select start date"
                  onOpen={() => setOpenCalendar('startDate')}
                />
                <Text style={styles.label}>End date *</Text>
                <CalendarDatePicker
                  value={bulkEndDate}
                  onChange={setBulkEndDate}
                  placeholder="Select end date"
                  onOpen={() => setOpenCalendar('endDate')}
                />
                <Text style={styles.label}>Days of week *</Text>
                <View style={styles.daysContainer}>
                  {DAY_KEYS.map(({ key, label }) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.dayButton, bulkDaysOfWeek[key] && styles.dayButtonActive]}
                      onPress={() => handleBulkDayToggle(key)}
                    >
                      <Text style={[styles.dayButtonText, bulkDaysOfWeek[key] && styles.dayButtonTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Daily time window *</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeInputWrap}>
                    <Text style={styles.timeLabel}>Start</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="09:00"
                      value={bulkStartTime}
                      onChangeText={setBulkStartTime}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.timeInputWrap}>
                    <Text style={styles.timeLabel}>End</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="17:00"
                      value={bulkEndTime}
                      onChangeText={setBulkEndTime}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </>
            )}

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
              onPress={mode === 'bulk' ? handleBulkAssign : handleAssign}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'bulk' ? 'Bulk assign lessons' : (t('assignLessonSubmit') || 'Assign lesson')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>

          <CalendarModal
            visible={openCalendar === 'startDate'}
            onClose={() => setOpenCalendar(null)}
            value={bulkStartDate}
            onChange={(d) => {
              setBulkStartDate(d);
              if (bulkEndDate && d > bulkEndDate) setBulkEndDate('');
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
  modeToggle: {
    flexDirection: 'row',
    marginBottom: 16,
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
    ...(Platform.OS !== 'web' && { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 }),
  },
  modeTabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  modeTabTextActive: { color: '#0D9488' },
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
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
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
    ...(Platform.OS !== 'web' && { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 1000 }),
  },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calendarNavButton: { padding: 8 },
  calendarMonthText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  todayButton: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9', marginBottom: 12 },
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
