import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Text, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { memberColors, memberRadius } from '../theme/memberTheme';

/** Maps roles to allowed nav item ids. When loading/undefined, only profile is allowed. */
const PERMISSIONS = {
  coach: ['coach-dashboard', 'profile'],
  admin: ['admin-dashboard', 'admin-students', 'admin-availability', 'admin-history', 'profile'],
  student: ['dashboard', 'bookings', 'history', 'performance', 'profile'],
};

const ALL_BOTTOM_NAV_LINKS = [
  { id: 'dashboard', labelKey: 'navHome', icon: 'home-outline', activeIcon: 'home' },
  { id: 'bookings', labelKey: 'navBookings', icon: 'calendar-outline', activeIcon: 'calendar' },
  { id: 'history', labelKey: 'navHistory', icon: 'time-outline', activeIcon: 'time' },
  { id: 'performance', labelKey: 'navPerformance', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  { id: 'profile', labelKey: 'profile', icon: 'person-outline', activeIcon: 'person' },
  { id: 'coach-dashboard', labelKey: 'navCoachDashboard', icon: 'shield-outline', activeIcon: 'shield' },
  { id: 'admin-dashboard', labelKey: 'navAdmin', icon: 'grid-outline', activeIcon: 'grid' },
  { id: 'admin-students', labelKey: 'navStudents', icon: 'people-outline', activeIcon: 'people' },
  { id: 'admin-availability', labelKey: 'navAvailability', icon: 'time-outline', activeIcon: 'time' },
  { id: 'admin-history', labelKey: 'navHistory', icon: 'archive-outline', activeIcon: 'archive' },
];

export default function BottomNav({ activeScreen, onNavigate }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { userRole, roleLoading } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);

  const isStudent = userRole === 'student' || (userRole != null && userRole !== 'admin' && userRole !== 'coach');
  const isDesktopWeb = Platform.OS === 'web' && width > 768;

  const allowedIds = useMemo(() => {
    if (roleLoading || userRole == null || userRole === undefined) return ['profile'];
    return PERMISSIONS[userRole] ?? ['profile'];
  }, [roleLoading, userRole]);

  const menuItems = useMemo(
    () => ALL_BOTTOM_NAV_LINKS.filter((link) => allowedIds.includes(link.id)),
    [allowedIds]
  );

  if (isDesktopWeb) {
    return null;
  }

  return (
    <View
      style={[
        isStudent ? memberStyles.container : styles.container,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      {menuItems.map((item) => {
        const isActive = activeScreen === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.navItem}
            onPress={() => onNavigate(item.id)}
            accessible={true}
            accessibilityLabel={t(item.labelKey)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <View style={[isStudent && isActive && memberStyles.activePill]}>
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={22}
                color={isActive ? (isStudent ? memberColors.ink : '#000') : (isStudent ? memberColors.inkMuted : '#8E8E93')}
              />
            </View>
            {isStudent && (
              <Text style={[memberStyles.label, isActive && memberStyles.labelActive]} numberOfLines={1}>
                {t(item.labelKey)}
              </Text>
            )}
            {!isStudent && (
              <View style={[styles.label, isActive && styles.labelActive]}>
                <View style={[styles.indicator, isActive && styles.indicatorActive]} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
    ...(Platform.OS !== 'web' && {
      elevation: 8,
    }),
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 52,
  },
  label: {
    marginTop: 4,
    height: 2,
    width: 24,
  },
  labelActive: {},
  indicator: {
    height: 2,
    width: 24,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: '#000',
  },
});

const memberStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: memberColors.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: memberColors.border,
    paddingTop: 6,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    }),
  },
  activePill: {
    backgroundColor: memberColors.limeSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: memberRadius.pill,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: memberColors.inkMuted,
    marginTop: 4,
  },
  labelActive: {
    color: memberColors.ink,
    fontWeight: '600',
  },
});
