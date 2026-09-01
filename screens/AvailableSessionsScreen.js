import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Modal,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { supabase } from '../lib/supabase';
import MemberPageBackground from '../components/member/MemberPageBackground';
import SessionFilters from '../components/member/SessionFilters';
import SessionDateGroup from '../components/member/SessionDateGroup';
import EmptyState from '../components/member/EmptyState';
import MemberSkeleton from '../components/member/MemberSkeleton';
import { memberColors, memberTypography } from '../theme/memberTheme';
import { formatDateGroupHeader, formatDurationFromHours } from '../utils/locale';
import { translateServiceName } from '../utils/serviceTranslations';
import {
  SERVICE_FILTER_OPTIONS,
  PERIOD_OPTIONS,
  getDateRangeForPeriod,
  fetchAvailabilitiesInRange,
  buildBookableSessions,
  groupSessionsByDate,
} from '../utils/availableSessions';
import { getSydneyToday } from '../utils/timezone';

function SessionRowSkeleton() {
  return (
    <View style={skeletonStyles.row}>
      <MemberSkeleton width={44} height={18} />
      <View style={skeletonStyles.body}>
        <MemberSkeleton width="70%" height={16} style={{ marginBottom: 6 }} />
        <MemberSkeleton width="50%" height={13} />
      </View>
      <MemberSkeleton width={56} height={16} />
    </View>
  );
}

export default function AvailableSessionsScreen({ onBack, onBookSession }) {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  const [activeServiceKey, setActiveServiceKey] = useState('all');
  const [activePeriod, setActivePeriod] = useState('nextWeek');
  const [activeLocationId, setActiveLocationId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodModalVisible, setPeriodModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  const serviceOptions = useMemo(
    () =>
      SERVICE_FILTER_OPTIONS.map((opt) => ({
        ...opt,
        label: t(opt.labelKey),
      })),
    [language]
  );

  const activeServiceDbName = useMemo(() => {
    const found = SERVICE_FILTER_OPTIONS.find((o) => o.key === activeServiceKey);
    return found?.dbName || null;
  }, [activeServiceKey]);

  const periodLabel = t(PERIOD_OPTIONS.find((p) => p.key === activePeriod)?.labelKey || 'filterNextWeek');

  const locationLabel = useMemo(() => {
    if (!activeLocationId) return t('filterAllLocations');
    return locations.find((l) => l.id === activeLocationId)?.name || t('filterAllLocations');
  }, [activeLocationId, locations, language]);

  const loadLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('name');
      if (error) throw error;
      setLocations(data || []);
    } catch (err) {
      console.error('Error loading locations:', err);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRangeForPeriod(activePeriod, getSydneyToday());
      const raw = await fetchAvailabilitiesInRange({
        startDate,
        endDate,
        serviceFilter: activeServiceDbName,
        locationId: activeLocationId,
      });
      setSessions(buildBookableSessions(raw));
    } catch (err) {
      console.error('Error loading available sessions:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [activePeriod, activeServiceDbName, activeLocationId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const grouped = useMemo(() => groupSessionsByDate(sessions), [sessions]);

  const formatTime24 = (time24) => {
    const [h, m] = time24.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(language === 'zh-CN' ? 'zh-CN' : 'en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: language !== 'zh-CN',
    });
  };

  const handleBook = (session) => {
    onBookSession?.({
      dateStr: session.dateStr,
      serviceName: session.serviceName,
      locationId: session.locationId,
      time24: session.time24,
    });
  };

  const showLocationFilter = locations.length > 1;

  return (
    <MemberPageBackground>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color={memberColors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('availableSessionsTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (isMobile ? 88 : 32) },
        ]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.stickyFilters}>
          <SessionFilters
            serviceOptions={serviceOptions}
            activeServiceKey={activeServiceKey}
            onServiceChange={setActiveServiceKey}
            periodLabel={periodLabel}
            onPeriodPress={() => setPeriodModalVisible(true)}
            periodMenuOpen={periodModalVisible}
            locationLabel={locationLabel}
            onLocationPress={() => setLocationModalVisible(true)}
            locationMenuOpen={locationModalVisible}
            showLocationFilter={showLocationFilter}
          />
        </View>

        {loading ? (
          <View style={styles.skeletonBlock}>
            <MemberSkeleton width={140} height={14} style={{ marginBottom: 16 }} />
            <SessionRowSkeleton />
            <SessionRowSkeleton />
            <SessionRowSkeleton />
          </View>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title={t('noSessionsMatchFilters')}
            subtitle={t('noSessionsMatchFiltersSub')}
            actionLabel={t('clearFilters')}
            onAction={() => {
              setActiveServiceKey('all');
              setActivePeriod('nextWeek');
              setActiveLocationId(null);
            }}
          />
        ) : (
          grouped.map(({ dateStr, sessions: daySessions }) => (
            <SessionDateGroup
              key={dateStr}
              dateLabel={formatDateGroupHeader(dateStr, language)}
              sessions={daySessions}
              formatTime={formatTime24}
              translateService={(name) => translateServiceName(name, t, name)}
              formatDuration={(hours) => formatDurationFromHours(hours, t)}
              bookLabel={t('book')}
              onBookSession={handleBook}
            />
          ))
        )}
      </ScrollView>

      <PickerModal
        visible={periodModalVisible}
        title={t('filterPeriod')}
        options={PERIOD_OPTIONS.map((p) => ({ key: p.key, label: t(p.labelKey) }))}
        activeKey={activePeriod}
        onSelect={(key) => {
          setActivePeriod(key);
          setPeriodModalVisible(false);
        }}
        onClose={() => setPeriodModalVisible(false)}
      />

      <PickerModal
        visible={locationModalVisible}
        title={t('filterLocation')}
        options={[
          { key: 'all', label: t('filterAllLocations') },
          ...locations.map((l) => ({ key: l.id, label: l.name })),
        ]}
        activeKey={activeLocationId || 'all'}
        onSelect={(key) => {
          setActiveLocationId(key === 'all' ? null : key);
          setLocationModalVisible(false);
        }}
        onClose={() => setLocationModalVisible(false)}
      />
    </MemberPageBackground>
  );
}

function PickerModal({ visible, title, options, activeKey, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <Pressable style={pickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={pickerStyles.title}>{title}</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={String(opt.key)}
              style={[pickerStyles.option, activeKey === opt.key && pickerStyles.optionActive]}
              onPress={() => onSelect(opt.key)}
            >
              <Text style={[pickerStyles.optionText, activeKey === opt.key && pickerStyles.optionTextActive]}>
                {opt.label}
              </Text>
              {activeKey === opt.key ? (
                <Ionicons name="checkmark" size={18} color={memberColors.white} />
              ) : null}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  body: { flex: 1 },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' && { justifyContent: 'center', alignItems: 'center', padding: 16 }),
  },
  sheet: {
    backgroundColor: memberColors.surfaceRaised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...(Platform.OS === 'web' && {
      borderRadius: 16,
      maxWidth: 400,
      width: '100%',
    }),
  },
  title: {
    ...memberTypography.h3,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: memberColors.border,
  },
  optionActive: {
    backgroundColor: memberColors.court,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    color: memberColors.inkSecondary,
    flex: 1,
  },
  optionTextActive: {
    fontWeight: '600',
    color: memberColors.white,
  },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: memberColors.border,
    backgroundColor: memberColors.bg,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...memberTypography.h3,
    fontSize: 17,
  },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  stickyFilters: {
    backgroundColor: memberColors.bg,
    paddingTop: 12,
    paddingBottom: 4,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  skeletonBlock: {
    paddingTop: 8,
  },
});
