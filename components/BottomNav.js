import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

/** Maps roles to allowed nav labels. When loading/undefined, only 'Profile' is allowed. */
const PERMISSIONS = {
  coach: ['Dashboard', 'Profile'],
  admin: ['Admin', 'Students', 'Availability', 'History', 'Profile'],
  student: ['Home', 'Bookings', 'History', 'Profile'],
};

const ALL_BOTTOM_NAV_LINKS = [
  { id: 'dashboard', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar-outline', activeIcon: 'calendar' },
  { id: 'history', label: 'History', icon: 'time-outline', activeIcon: 'time' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  { id: 'coach-dashboard', label: 'Dashboard', icon: 'shield-outline', activeIcon: 'shield' },
  { id: 'admin-dashboard', label: 'Admin', icon: 'grid-outline', activeIcon: 'grid' },
  { id: 'admin-students', label: 'Students', icon: 'people-outline', activeIcon: 'people' },
  { id: 'admin-availability', label: 'Availability', icon: 'time-outline', activeIcon: 'time' },
  { id: 'admin-history', label: 'History', icon: 'archive-outline', activeIcon: 'archive' },
];

export default function BottomNav({ activeScreen, onNavigate }) {
  const insets = useSafeAreaInsets();
  const { userRole, roleLoading } = useAuth();

  const allowedLabels = useMemo(() => {
    if (roleLoading || userRole == null || userRole === undefined) return ['Profile'];
    return PERMISSIONS[userRole] ?? ['Profile'];
  }, [roleLoading, userRole]);

  const menuItems = useMemo(
    () => ALL_BOTTOM_NAV_LINKS.filter((link) => allowedLabels.includes(link.label)),
    [allowedLabels]
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
            accessibilityLabel={item.label}
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
