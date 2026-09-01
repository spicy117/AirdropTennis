import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import AuthLayout from '../components/auth/AuthLayout';
import AuthPrimaryButton, { AuthTextLink } from '../components/auth/AuthPrimaryButton';
import { memberColors, memberTypography } from '../theme/memberTheme';

export default function EmailVerificationScreen({ route, navigation }) {
  const { resendVerificationEmail } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [loading, setLoading] = useState(false);
  const email = route?.params?.email || '';

  const handleResendEmail = async () => {
    if (!email) {
      Alert.alert(t('error'), t('emailNotFound'));
      return;
    }

    setLoading(true);
    const { error } = await resendVerificationEmail(email);
    setLoading(false);

    if (error) {
      Alert.alert(t('error'), error.message);
    } else {
      Alert.alert(t('success'), t('verificationEmailSent'));
    }
  };

  return (
    <AuthLayout>
      <View style={styles.block}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>✉️</Text>
        </View>
        <Text style={styles.title}>{t('verifyYourEmail')}</Text>
        <Text style={styles.message}>{t('verificationEmailSentTo')}</Text>
        {email ? (
          <View style={styles.emailBox}>
            <Text style={styles.email}>{email}</Text>
          </View>
        ) : null}
        <Text style={styles.instructions}>{t('verifyEmailInstructions')}</Text>

        <AuthPrimaryButton
          label={loading ? t('sending') : t('resendVerificationEmail')}
          onPress={handleResendEmail}
          loading={loading}
          disabled={loading}
        />

        <AuthTextLink label={t('backToLogin')} onPress={() => navigation.navigate('LogIn')} subtle />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: memberColors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    ...memberTypography.h1,
    fontSize: 26,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    ...memberTypography.body,
    textAlign: 'center',
    marginBottom: 12,
  },
  emailBox: {
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    width: '100%',
  },
  email: {
    fontSize: 15,
    fontWeight: '600',
    color: memberColors.ink,
    textAlign: 'center',
  },
  instructions: {
    ...memberTypography.body,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
});
