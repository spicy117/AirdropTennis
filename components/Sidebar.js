import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Sidebar({ activeScreen, onNavigate, onSignOut }) {
  const { user, isAdmin, userRole } = useAuth();
  const [unassignedBookingsCount, setUnassignedBookingsCount] = useState(0);

  useEffect(() => {
    const isUserAdmin = isAdmin && typeof isAdmin === 'function' ? isAdmin() : false;
    if (isUserAdmin) {
      loadUnassignedBookingsCount();
      // Refresh count periodically
      const interval = setInterval(() => {
        loadUnassignedBookingsCount();
      }, 30000); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  // Refresh count when navigating away from admin-availability (coach may have been assigned)
  useEffect(() => {
    const isUserAdmin = isAdmin && typeof isAdmin === 'function' ? isAdmin() : false;
    if (isUserAdmin && activeScreen !== 'admin-availability') {
      // Small delay to allow for any pending updates
      const timer = setTimeout(() => {
        loadUnassignedBookingsCount();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeScreen, isAdmin]);

  const loadUnassignedBookingsCount = async () => {
    try {
      // Count bookings that have NULL coach_id
      const { count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .is('coach_id', null);

      if (error) throw error;
      setUnassignedBookingsCount(count || 0);
    } catch (error) {
      console.error('Error loading unassigned bookings count:', error);
    }
  };

  const displayName =
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ') ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'User';

  const isUserAdmin = isAdmin && typeof isAdmin === 'function' ? isAdmin() : false;
  const isUserCoach = userRole === 'coach';

  const userMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
    { id: 'bookings', label: 'Bookings', icon: 'calendar-outline', activeIcon: 'calendar' },
    { id: 'history', label: 'History', icon: 'time-outline', activeIcon: 'time' },
    { id: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ];

  const coachMenuItems = [
    { id: 'coach-dashboard', label: 'Coach Dashboard', icon: 'shield-outline', activeIcon: 'shield' },
    { id: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ];

  const adminMenuItems = [
    { id: 'admin-dashboard', label: 'Admin Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
    { id: 'admin-locations-courts', label: 'Locations & Courts', icon: 'location-outline', activeIcon: 'location' },
    { id: 'admin-availability', label: 'Availability & Bookings', icon: 'time-outline', activeIcon: 'time' },
    { id: 'admin-students', label: 'Students', icon: 'people-outline', activeIcon: 'people' },
    { id: 'admin-coaches', label: 'Coaches', icon: 'shield-outline', activeIcon: 'shield' },
    { id: 'admin-history', label: 'Booking History', icon: 'archive-outline', activeIcon: 'archive' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🎾 Airdrop Tennis</Text>
      </View>

      <View style={styles.menu}>
        {/* Student Links - only show if not coach */}
        {!isUserCoach && userMenuItems.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
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
              <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Coach Links */}
        {isUserCoach && coachMenuItems.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
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
              <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Admin Links Separator */}
        {isUserAdmin && adminMenuItems.length > 0 && (
          <>
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>Admin</Text>
              <View style={styles.separatorLine} />
            </View>
            {adminMenuItems.map((item) => {
              const isActive = activeScreen === item.id;
              const showBadge = item.id === 'admin-availability' && unassignedBookingsCount > 0;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
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
                  <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                    {item.label}
                  </Text>
                  {showBadge && (
                    <View style={styles.sidebarBadge}>
                      <Text style={styles.sidebarBadgeText}>
                        {unassignedBookingsCount > 99 ? '99+' : unassignedBookingsCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => onNavigate('profile')}
          accessible={true}
          accessibilityLabel="Go to profile"
          accessibilityRole="button"
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color="#8E8E93" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {displayName}
            </Text>
            <Text style={styles.userRole}>
              {isUserAdmin ? 'Admin' : isUserCoach ? 'Coach' : 'Student'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={onSignOut}
          accessible={true}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    backgroundColor: '#FAFAFA',
    borderRightWidth: 1,
    borderRightColor: '#E5E5EA',
    height: '100vh',
    flexDirection: 'column',
    justifyContent: 'space-between',
    ...(Platform.OS !== 'web' && {
      width: 0,
      display: 'none',
    }),
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  logo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  menu: {
    flex: 1,
    paddingTop: 20,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  separatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: '#fff',
    borderLeftWidth: 3,
    borderLeftColor: '#000',
  },
  menuText: {
    fontSize: 16,
    color: '#8E8E93',
    marginLeft: 12,
    fontWeight: '500',
  },
  menuTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  userRole: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  signOutButton: {
    padding: 8,
  },
  sidebarBadge: {
    marginLeft: 'auto',
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    }),
  },
  sidebarBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
