import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';

/** Maps roles to allowed nav item ids. When loading/undefined, only profile is allowed. */
const PERMISSIONS = {
  coach: ['coach-dashboard', 'profile'],
  admin: ['admin-dashboard', 'admin-students', 'admin-availability', 'admin-history', 'profile'],
  student: ['dashboard', 'bookings', 'history', 'profile'],
};

const ALL_BOTTOM_NAV_LINKS = [
  { id: 'dashboard', labelKey: 'navHome', icon: 'home-outline', activeIcon: 'home' },
  { id: 'bookings', labelKey: 'navBookings', icon: 'calendar-outline', activeIcon: 'calendar' },
  { id: 'history', labelKey: 'navHistory', icon: 'time-outline', activeIcon: 'time' },
  { id: 'profile', labelKey: 'profile', icon: 'person-outline', activeIcon: 'person' },
  { id: 'coach-dashboard', labelKey: 'navCoachDashboard', icon: 'shield-outline', activeIcon: 'shield' },
  { id: 'admin-dashboard', labelKey: 'navAdmin', icon: 'grid-outline', activeIcon: 'grid' },
  { id: 'admin-students', labelKey: 'navStudents', icon: 'people-outline', activeIcon: 'people' },
  { id: 'admin-availability', labelKey: 'navAvailability', icon: 'time-outline', activeIcon: 'time' },
  { id: 'admin-history', labelKey: 'navHistory', icon: 'archive-outline', activeIcon: 'archive' },
];

export default function BottomNav({ activeScreen, onNavigate }) {
  const insets = useSafeAreaInsets();
  const { userRole, roleLoading } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);

  const allowedIds = useMemo(() => {
    if (roleLoading || userRole == null || userRole === undefined) return ['profile'];
    return PERMISSIONS[userRole] ?? ['profile'];
  }, [roleLoading, userRole]);

  const menuItems = useMemo(
    () => ALL_BOTTOM_NAV_LINKS.filter((link) => allowedIds.includes(link.id)),
    [allowedIds]
  );

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
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
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={24}
              color={isActive ? '#000' : '#8E8E93'}
            />
            <View style={[styles.label, isActive && styles.labelActive]}>
              <View style={[styles.indicator, isActive && styles.indicatorActive]} />
            </View>
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
    paddingVertical: 8,
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
