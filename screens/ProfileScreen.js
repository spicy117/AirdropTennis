import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { supabase } from '../lib/supabase';
import MemberPageBackground from '../components/member/MemberPageBackground';
import { memberColors, memberRadius, memberTypography } from '../theme/memberTheme';

export default function ProfileScreen({ onSignOut, onNavigate }) {
  const { user, userRole, refreshUserRole } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [currentRole, setCurrentRole] = useState(null);

  useEffect(() => {
    const fetchRoleDirectly = async () => {
      if (user?.id) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (!error && profile?.role) {
            setCurrentRole(profile.role);
          } else {
            setCurrentRole(userRole);
          }
        } catch {
          setCurrentRole(userRole);
        }
      }
    };
    fetchRoleDirectly();
    const interval = setInterval(fetchRoleDirectly, 5000);
    return () => clearInterval(interval);
  }, [user?.id, userRole]);

  useEffect(() => {
    if (user) refreshUserRole();
  }, [user?.id]);

  const displayName =
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ') ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    t('student');

  const effectiveRole = currentRole || userRole;
  const isAdmin = effectiveRole === 'admin';
  const isMember = !isAdmin && effectiveRole !== 'coach';

  const getRoleDisplay = () => {
    if (effectiveRole === 'coach') return t('coach');
    if (effectiveRole === 'admin') return t('admin');
    return t('student');
  };

  const content = (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={[styles.header, isMember && memberStyles.header]}>
        <View style={[styles.avatarLarge, isMember && memberStyles.avatar]}>
          <Text style={memberStyles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, isMember && memberStyles.name]}>{displayName}</Text>
        <Text style={[styles.email, isMember && memberStyles.email]}>{user?.email}</Text>
        <View style={[styles.roleBadge, isMember && memberStyles.roleBadge]}>
          <Text style={[styles.roleText, isMember && memberStyles.roleText]}>{getRoleDisplay()}</Text>
        </View>
      </View>

      {isMember && (
        <View style={memberStyles.section}>
          <Text style={memberStyles.sectionTitle}>Account</Text>
          <View style={memberStyles.row}>
            <Ionicons name="mail-outline" size={18} color={memberColors.inkMuted} />
            <Text style={memberStyles.rowText}>{user?.email}</Text>
          </View>
        </View>
      )}

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
        style={[styles.signOutButton, isMember && memberStyles.signOut]}
        onPress={onSignOut}
        accessible={true}
        accessibilityLabel={t('signOut')}
        accessibilityRole="button"
      >
        <Ionicons name="log-out-outline" size={20} color={isMember ? memberColors.danger : '#FF3B30'} />
        <Text style={[styles.signOutText, isMember && memberStyles.signOutText]}>{t('signOut')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (isMember) {
    return <MemberPageBackground>{content}</MemberPageBackground>;
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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

const memberStyles = StyleSheet.create({
  header: {
    paddingTop: 8,
    marginBottom: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: memberColors.limeSoft,
    borderWidth: 2,
    borderColor: memberColors.lime,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: memberColors.ink,
  },
  name: {
    ...memberTypography.h1,
    fontSize: 26,
    marginBottom: 4,
  },
  email: {
    fontSize: 15,
    color: memberColors.inkMuted,
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: memberColors.court,
    borderRadius: memberRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  roleText: {
    color: memberColors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  section: {
    backgroundColor: memberColors.surfaceRaised,
    borderRadius: memberRadius.lg,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: memberColors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: memberColors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    fontSize: 15,
    color: memberColors.ink,
    flex: 1,
  },
  signOut: {
    borderColor: memberColors.dangerSoft,
    backgroundColor: memberColors.surfaceRaised,
    alignSelf: 'stretch',
    marginTop: 8,
  },
  signOutText: {
    color: memberColors.danger,
  },
});
