import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { supabase } from '../lib/supabase';

export default function ProfileScreen({ onSignOut, onNavigate }) {
  const { user, userRole, refreshUserRole } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [currentRole, setCurrentRole] = useState(null); // Direct role from database

  // CRITICAL: Fetch role DIRECTLY from database to bypass any caching
  useEffect(() => {
    const fetchRoleDirectly = async () => {
      if (user?.id) {
        try {
          console.log('🔍 [PROFILE] Fetching role directly from database...');
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          
          if (!error && profile?.role) {
            console.log('✅ [PROFILE] Direct role from DB:', profile.role);
            setCurrentRole(profile.role);
          } else {
            console.error('❌ [PROFILE] Error fetching role:', error);
            setCurrentRole(userRole); // Fallback to context role
          }
        } catch (error) {
          console.error('❌ [PROFILE] Error:', error);
          setCurrentRole(userRole); // Fallback
        }
      }
    };
    
    fetchRoleDirectly();
    // Refresh periodically
    const interval = setInterval(fetchRoleDirectly, 5000);
    return () => clearInterval(interval);
  }, [user?.id, userRole]);

  // Force refresh role from database when profile screen loads
  useEffect(() => {
    if (user) {
      console.log('🔄 [PROFILE] Refreshing role...');
      refreshUserRole();
    }
  }, [user?.id]);

  const displayName =
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ') ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    t('student');

  // Get role display text - CRITICAL: Use currentRole from database (source of truth)
  const getRoleDisplay = () => {
    const effectiveRole = currentRole || userRole;
    
    // DEBUG: Log role information
    console.log('🔍 [PROFILE] Role check:', {
      userRole, // From context
      currentRole, // From database
      effectiveRole, // What we're using
      userMetadataRole: user?.user_metadata?.role,
    });
    
    if (effectiveRole === 'coach') return t('coach');
    if (effectiveRole === 'admin') return t('admin');
    return t('student');
  };

  const isAdmin = (currentRole === 'admin' || userRole === 'admin');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          <Ionicons name="person" size={48} color="#8E8E93" />
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{getRoleDisplay()}</Text>
        </View>
      </View>

      {isAdmin && onNavigate && (
        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={() => onNavigate('admin-dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={20} color="#0D9488" />
          <Text style={styles.dashboardButtonText}>{t('navAdminDashboard')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={onSignOut}
        accessible={true}
        accessibilityLabel={t('signOut')}
        accessibilityRole="button"
      >
        <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
        <Text style={styles.signOutText}>{t('signOut')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
  },
  dashboardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D9488',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    marginTop: 20,
    alignSelf: 'center',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
});
