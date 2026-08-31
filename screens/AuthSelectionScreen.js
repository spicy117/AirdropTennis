import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignInScreen from './SignInScreen';
import SignUpScreen from './SignUpScreen';
import AuthLayout from '../components/auth/AuthLayout';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { memberColors, memberRadius } from '../theme/memberTheme';

const getWindowWidth = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth;
  }
  return Dimensions.get('window').width;
};

const isDesktop = () => Platform.OS === 'web' && getWindowWidth() > 768;

function AuthSelectionScreenInner({ navigation, route, language, updateLanguage, t }) {
  const getInitialTab = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('/signup')) return 'signup';
      if (path.includes('/login')) return 'login';
    }
    return route?.params?.tab || 'login';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [desktop, setDesktop] = useState(isDesktop());

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleResize = () => setDesktop(isDesktop());
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const updateTabFromUrl = () => {
        const path = window.location.pathname;
        if (path.includes('/login')) setActiveTab('login');
        else if (path.includes('/signup')) setActiveTab('signup');
      };
      window.addEventListener('popstate', updateTabFromUrl);
      return () => window.removeEventListener('popstate', updateTabFromUrl);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title =
        activeTab === 'login'
          ? `${t('logIn')} - Airdrop Tennis`
          : `${t('signUp')} - Airdrop Tennis`;
    }
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const newPath = tab === 'login' ? '/login' : '/signup';
      if (window.history?.pushState) {
        window.history.pushState(null, '', newPath);
      }
    }
  };

  return (
    <AuthLayout scrollable={activeTab === 'signup'} keyboardAvoid>
      <View style={styles.topRow}>
        <View style={styles.spacer} />
        <TouchableOpacity
          style={styles.langToggle}
          onPress={() => updateLanguage(language === 'en' ? 'zh-CN' : 'en')}
          accessibilityRole="button"
          accessibilityLabel={language === 'en' ? 'Switch to Chinese' : 'Switch to English'}
        >
          <Ionicons name="language-outline" size={16} color={memberColors.inkMuted} />
          <Text style={styles.langText}>{language === 'en' ? t('langEnShort') : t('langZhShort')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formArea}>
        {activeTab === 'login' ? (
          <SignInScreen
            navigation={navigation}
            embedded
            onGoToSignUp={() => handleTabChange('signup')}
          />
        ) : (
          <SignUpScreen
            navigation={navigation}
            embedded
            onGoToLogin={() => handleTabChange('login')}
          />
        )}
      </View>
    </AuthLayout>
  );
}

export default function AuthSelectionScreen(props) {
  const langCtx = useLanguage() || {};
  const { language = 'en', updateLanguage = () => {} } = langCtx;
  const t = (key) => getTranslation(language, key);
  return (
    <AuthSelectionScreenInner
      {...props}
      language={language}
      updateLanguage={updateLanguage}
      t={t}
    />
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    width: '100%',
  },
  spacer: { flex: 1 },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: memberRadius.pill,
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.border,
  },
  langText: {
    fontSize: 12,
    fontWeight: '600',
    color: memberColors.inkMuted,
  },
  formArea: {
    width: '100%',
    flex: 1,
  },
});
