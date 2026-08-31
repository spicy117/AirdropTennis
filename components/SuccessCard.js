import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { memberColors, memberRadius, memberTypography } from '../theme/memberTheme';

export default function SuccessCard({ email, embedded = false }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);

  return (
    <View
      style={[styles.container, embedded && styles.embedded]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.iconCircle}>
        <View style={styles.iconRing} />
        <Text style={styles.icon}>✓</Text>
      </View>
      <Text style={styles.heading}>{t('welcomeToCourt')}</Text>
      <Text style={styles.message}>{t('verificationEmailSent')}</Text>
      {email && (
        <View style={styles.emailContainer}>
          <Text style={styles.emailLabel}>{t('emailSentTo')}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: memberColors.bg,
  },
  embedded: {
    padding: 24,
    minHeight: 360,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: memberColors.limeSoft,
    borderWidth: 1,
    borderColor: 'rgba(212, 249, 52, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  iconRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: memberColors.court,
    opacity: 0.1,
  },
  icon: {
    fontSize: 28,
    fontWeight: '700',
    color: memberColors.court,
  },
  heading: {
    ...memberTypography.h2,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    ...memberTypography.body,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 400,
    color: memberColors.inkMuted,
  },
  emailContainer: {
    marginTop: 8,
    padding: 16,
    backgroundColor: memberColors.surfaceRaised,
    borderRadius: memberRadius.md,
    borderWidth: 1,
    borderColor: memberColors.border,
    width: '100%',
    maxWidth: 400,
  },
  emailLabel: {
    fontSize: 12,
    color: memberColors.inkMuted,
    marginBottom: 4,
    textAlign: 'center',
  },
  email: {
    fontSize: 15,
    color: memberColors.ink,
    fontWeight: '600',
    textAlign: 'center',
  },
});
