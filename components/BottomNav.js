import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function BottomNav({ activeScreen, onNavigate }) {
  const insets = useSafeAreaInsets();
  const { isAdmin, userRole } = useAuth();

  const userMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
    { id: 'bookings', label: 'Bookings', icon: 'calendar-outline', activeIcon: 'calendar' },
    { id: 'history', label: 'History', icon: 'time-outline', activeIcon: 'time' },
    { id: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ];

  const coachMenuItems = [
    { id: 'coach-dashboard', label: 'Dashboard', icon: 'shield-outline', activeIcon: 'shield' },
    { id: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ];

  const adminMenuItems = [
    { id: 'admin-dashboard', label: 'Admin', icon: 'grid-outline', activeIcon: 'grid' },
    { id: 'admin-students', label: 'Students', icon: 'people-outline', activeIcon: 'people' },
    { id: 'admin-availability', label: 'Availability', icon: 'time-outline', activeIcon: 'time' },
    { id: 'admin-locations-courts', label: 'Locations', icon: 'location-outline', activeIcon: 'location' },
    { id: 'admin-history', label: 'History', icon: 'archive-outline', activeIcon: 'archive' },
  ];

  // For mobile, show user items + admin items if admin (but limit to 5 items max for bottom nav)
  // If admin, replace some user items with admin items
  // If coach, show coach menu items
  const isUserAdmin = isAdmin && typeof isAdmin === 'function' ? isAdmin() : false;
  const isUserCoach = userRole === 'coach';
  
  // For mobile, limit to 5 items max for bottom nav
  const menuItems = isUserAdmin
    ? [
        { id: 'admin-dashboard', label: 'Admin', icon: 'grid-outline', activeIcon: 'grid' },
        { id: 'admin-students', label: 'Students', icon: 'people-outline', activeIcon: 'people' },
        { id: 'admin-availability', label: 'Availability', icon: 'time-outline', activeIcon: 'time' },
        { id: 'admin-history', label: 'History', icon: 'archive-outline', activeIcon: 'archive' },
        { id: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
      ]
    : isUserCoach
    ? coachMenuItems
    : userMenuItems;

  if (Platform.OS === 'web') {
    return null; // Hide on desktop (use sidebar instead)
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 8),
        },
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
            <View
              style={[
                styles.label,
                isActive && styles.labelActive,
              ]}
            >
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
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
  labelActive: {
    // Active state handled by indicator
  },
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
