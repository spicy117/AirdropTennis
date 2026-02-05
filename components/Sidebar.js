import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { supabase } from '../lib/supabase';

// SOURCE OF TRUTH: Navigation uses ONLY the role from the profiles table. Do NOT use auth.user or user_metadata for nav.

// Non-admin items (students + coaches). Admin section is separate and wrapped in userRole === 'admin'.
const NON_ADMIN_NAV_ITEMS = [
  { id: 'dashboard', labelKey: 'navHome', icon: 'home-outline', activeIcon: 'home' },
  { id: 'bookings', labelKey: 'navMyBookings', icon: 'calendar-outline', activeIcon: 'calendar' },
  { id: 'history', labelKey: 'navHistory', icon: 'time-outline', activeIcon: 'time' },
  { id: 'profile', labelKey: 'profile', icon: 'person-outline', activeIcon: 'person' },
  { id: 'coach-dashboard', labelKey: 'navCoachDashboard', icon: 'shield-outline', activeIcon: 'shield' },
];

// Admin-only items. The entire ADMIN header + these links are wrapped in {userRole === 'admin' && (...)} so it cannot render for coaches.
const ADMIN_NAV_ITEMS = [
  { id: 'admin-dashboard', labelKey: 'navAdminDashboard', icon: 'grid-outline', activeIcon: 'grid' },
  { id: 'admin-active-bookings', labelKey: 'navActiveBookings', icon: 'calendar-outline', activeIcon: 'calendar' },
  { id: 'admin-locations-courts', labelKey: 'navLocations', icon: 'location-outline', activeIcon: 'location' },
  { id: 'admin-availability', labelKey: 'navAvailability', icon: 'time-outline', activeIcon: 'time', badgeKey: 'unassigned' },
  { id: 'admin-students', labelKey: 'navStudents', icon: 'people-outline', activeIcon: 'people' },
  { id: 'admin-coaches', labelKey: 'navCoaches', icon: 'shield-outline', activeIcon: 'shield' },
  { id: 'admin-history', labelKey: 'navBookingHistory', icon: 'archive-outline', activeIcon: 'archive' },
  { id: 'profile', labelKey: 'profile', icon: 'person-outline', activeIcon: 'person' },
];

export default function Sidebar({ activeScreen, onNavigate, onSignOut, isMobile = false, hideHeader = false }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [profileRole, setProfileRole] = useState(undefined); // undefined = not yet loaded; from profiles table only
  const [unassignedBookingsCount, setUnassignedBookingsCount] = useState(0);

  // Diagnostic: confirm Sidebar mounts (you should see this if the component is in the tree).
  useEffect(() => {
    console.log("[Sidebar] MOUNTED");
    return () => console.log("[Sidebar] UNMOUNTED");
  }, []);

  // Fetch role ONLY from profiles table. Logging + strict default: on error, force 'student'.
  useEffect(() => {
    console.log("[Sidebar] getRole effect ran. user?.id =", user?.id);
    if (!user?.id) return;

    async function getRole() {
      console.log("[Sidebar] Fetching role for UID:", user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error("[Sidebar] Supabase Error:", error.message);
        setProfileRole('student'); // Force student on error
      } else {
        console.log("[Sidebar] DATABASE ROLE RECEIVED:", data.role);
        setProfileRole(data.role);
      }
    }

    getRole();
  }, [user?.id]);

  // userRole for nav: from profiles only. Default to 'student' if missing.
  const userRole = profileRole || 'student';

  // Hard filter before .map(): coach sees only Coach Dashboard + Profile; admin sees all in non-admin (we give them none—they use admin block); student sees Home, Profile, History.
  const filteredNav = useMemo(
    () =>
      NON_ADMIN_NAV_ITEMS.filter((item) => {
        if (userRole === 'coach') return ['coach-dashboard', 'profile'].includes(item.id);
        if (userRole === 'admin') return false; // admins see only the admin block below
        return ['dashboard', 'profile', 'history'].includes(item.id); // students
      }),
    [userRole]
  );

  // Only admins: unassigned bookings count
  useEffect(() => {
    if (userRole !== 'admin') return;
    const load = async () => {
      const { count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .is('coach_id', null);
      if (!error) setUnassignedBookingsCount(count || 0);
    };
    load();
    const intervalId = setInterval(load, 30000);
    return () => clearInterval(intervalId);
  }, [userRole]);

  useEffect(() => {
    if (userRole !== 'admin' || activeScreen === 'admin-availability') return;
    const t = setTimeout(async () => {
      const { count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .is('coach_id', null);
      if (!error) setUnassignedBookingsCount(count || 0);
    }, 500);
    return () => clearTimeout(t);
  }, [activeScreen, userRole]);

  const displayName =
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ') ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    t('user');

  const roleLabel = t(userRole === 'coach' ? 'coach' : userRole === 'admin' ? 'admin' : 'student');

  // Flicker fix: if role is not yet loaded from DB, do not render a single link. Return null for the entire Sidebar.
  if (profileRole === undefined) return null;

  return (
    <View style={[styles.container, isMobile && styles.mobileContainer]}>
      {!hideHeader && (
        <View style={styles.header}>
          <Text style={styles.logo}>🎾 Airdrop Tennis</Text>
        </View>
      )}

      <ScrollView style={[styles.menu, hideHeader && styles.menuNoHeader]} showsVerticalScrollIndicator={false}>
        {filteredNav.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
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
              <Text style={[styles.menuText, isActive && styles.menuTextActive]}>{t(item.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Hard-wrap: entire ADMIN block only when userRole === 'admin'. Physically impossible to render for coaches. */}
        {userRole === 'admin' && (
          <>
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>{t('navAdmin')}</Text>
              <View style={styles.separatorLine} />
            </View>
            {ADMIN_NAV_ITEMS.map((item) => {
              const isActive = activeScreen === item.id;
              const showBadge = item.badgeKey === 'unassigned' && unassignedBookingsCount > 0;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
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
                  <Text style={[styles.menuText, isActive && styles.menuTextActive]}>{t(item.labelKey)}</Text>
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
      </ScrollView>

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
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userRole}>{roleLabel}</Text>
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
  mobileContainer: {
    width: '100%',
    height: '100%',
    borderRightWidth: 0,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' && {
      height: '100vh',
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
  menuNoHeader: {
    paddingTop: 8,
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
  },
  sidebarBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
