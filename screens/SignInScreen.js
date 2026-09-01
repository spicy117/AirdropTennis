import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import ShowPasswordToggle from '../components/ShowPasswordToggle';
import AuthLayout from '../components/auth/AuthLayout';
import AuthField from '../components/auth/AuthField';
import AuthPrimaryButton, { AuthTextLink, AuthDivider } from '../components/auth/AuthPrimaryButton';
import { memberColors, memberTypography } from '../theme/memberTheme';

export default function SignInScreen({ navigation, embedded = false, onGoToSignUp }) {
  const { signIn, resetPassword, resendVerificationEmail } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [loading, setLoading] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authView, setAuthView] = useState('login');
  const [showResendOption, setShowResendOption] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState({ email: '', password: '' });

  const getErrorMessage = (error) => {
    if (!error) return null;
    const errorMessage = error.message || '';
    const errorCode = error.code || '';

    if (
      errorMessage.toLowerCase().includes('email not confirmed') ||
      errorMessage.toLowerCase().includes('email not verified') ||
      errorMessage.toLowerCase().includes('confirm your email') ||
      errorMessage.toLowerCase().includes('verify your email') ||
      errorCode.toLowerCase().includes('email_not_confirmed') ||
      errorCode.toLowerCase().includes('email_not_verified')
    ) {
      return t('verifyEmailBeforeSignIn');
    }

    if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('invalid')) {
      return t('incorrectEmailOrPassword');
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return t('connectionTimeout');
    }

    return errorMessage || t('error');
  };

  const handleSignIn = async () => {
    setFieldErrors({});
    const newFieldErrors = {};

    if (!formData.email) {
      newFieldErrors.email = t('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newFieldErrors.email = t('validEmail');
    }
    if (!formData.password) {
      newFieldErrors.password = t('passwordRequired');
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setLoading(true);
    const { error: signInError } = await signIn(formData.email, formData.password);
    setLoading(false);

    if (signInError) {
      const errorMsg = getErrorMessage(signInError);
      const errorMessage = signInError.message || '';
      const errorCode = signInError.code || '';

      const isEmailNotConfirmed =
        errorMessage.toLowerCase().includes('email not confirmed') ||
        errorMessage.toLowerCase().includes('email not verified') ||
        errorMessage.toLowerCase().includes('confirm your email') ||
        errorMessage.toLowerCase().includes('verify your email') ||
        errorCode.toLowerCase().includes('email_not_confirmed') ||
        errorCode.toLowerCase().includes('email_not_verified');

      setShowResendOption(isEmailNotConfirmed && formData.email);

      if (errorMsg.includes('email') || errorMsg.includes('password') || errorMsg.includes('Incorrect')) {
        setFieldErrors({
          email: errorMsg,
          password: errorMsg.includes('password') ? errorMsg : null,
        });
      } else {
        setFieldErrors({ email: errorMsg });
      }
    } else {
      setShowResendOption(false);
    }
  };

  const handleForgotPassword = async () => {
    setFieldErrors({});

    if (!formData.email) {
      setFieldErrors({ email: t('emailRequiredForReset') });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFieldErrors({ email: t('validEmail') });
      return;
    }

    setLoadingReset(true);
    const { error: resetError } = await resetPassword(formData.email);
    setLoadingReset(false);

    if (resetError) {
      setFieldErrors({ email: resetError.message || t('failedToSendReset') });
    } else {
      setAuthView('forgot-sent');
    }
  };

  const handleResendVerification = async () => {
    setFieldErrors({});

    if (!formData.email) {
      setFieldErrors({ email: t('emailRequiredForResend') });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFieldErrors({ email: t('validEmail') });
      return;
    }

    setLoadingResend(true);
    const { error: resendError } = await resendVerificationEmail(formData.email);
    setLoadingResend(false);

    if (resendError) {
      setFieldErrors({ email: resendError.message || t('failedToSendVerification') });
    } else {
      setShowResendOption(false);
      setAuthView('forgot-sent');
    }
  };

  const renderForgotSent = () => (
    <View style={styles.block}>
      <Text style={styles.title}>{t('checkYourInbox')}</Text>
      <Text style={styles.subtitle}>{t('resetInstructionsSent')}</Text>
      <View style={styles.emailBox}>
        <Text style={styles.emailLabel}>{formData.email}</Text>
      </View>
      <AuthPrimaryButton
        label={t('backToLogin')}
        onPress={() => {
          setAuthView('login');
          setFieldErrors({});
        }}
      />
    </View>
  );

  const renderForgot = () => (
    <View style={styles.block}>
      <Text style={styles.title}>{t('resetYourPassword')}</Text>
      <Text style={styles.subtitle}>{t('resetPasswordInstructions')}</Text>

      <AuthField
        label={t('emailPlaceholder')}
        value={formData.email}
        onChangeText={(text) => {
          setFormData({ ...formData, email: text });
          setFieldErrors((prev) => ({ ...prev, email: null }));
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={fieldErrors.email}
        returnKeyType="done"
        onSubmitEditing={handleForgotPassword}
      />

      <AuthPrimaryButton
        label={loadingReset ? t('sending') : t('sendResetLink')}
        onPress={handleForgotPassword}
        loading={loadingReset}
        disabled={loadingReset}
      />

      <AuthTextLink label={t('backToLogin')} onPress={() => setAuthView('login')} subtle />
    </View>
  );

  const renderLogin = () => (
    <View style={styles.block}>
      <Text style={styles.title}>{t('welcomeBack')}</Text>
      <Text style={styles.subtitle}>{t('logInSubtitle')}</Text>

      <AuthField
        label={t('emailPlaceholder')}
        value={formData.email}
        onChangeText={(text) => {
          setFormData({ ...formData, email: text });
          setFieldErrors((prev) => ({ ...prev, email: null }));
          setShowResendOption(false);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={fieldErrors.email}
        returnKeyType="next"
        autoComplete="email"
      />

      <AuthField
        label={t('passwordPlaceholder')}
        value={formData.password}
        onChangeText={(text) => {
          setFormData({ ...formData, password: text });
          setFieldErrors((prev) => ({ ...prev, password: null }));
        }}
        secureTextEntry={!showPassword}
        error={fieldErrors.password}
        returnKeyType="done"
        onSubmitEditing={handleSignIn}
        autoComplete="password"
        rightElement={
          <ShowPasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
        }
      />

      {showResendOption && (
        <View style={styles.resendBox}>
          <Text style={styles.resendMessage}>{t('resendVerificationMessage')}</Text>
          <AuthTextLink
            label={loadingResend ? t('sending') : t('resendVerificationEmail')}
            onPress={handleResendVerification}
            disabled={loadingResend}
          />
        </View>
      )}

      <AuthPrimaryButton label={t('logIn')} onPress={handleSignIn} loading={loading} disabled={loading} />

      <AuthTextLink
        label={loadingReset ? t('sending') : t('forgotPassword')}
        onPress={() => setAuthView('forgot')}
        subtle
      />

      {(onGoToSignUp || !embedded) && (
        <View style={styles.footer}>
          <AuthDivider />
          <Text style={styles.footerText}>{t('newHere')}</Text>
          <AuthTextLink
            label={t('createAccount')}
            onPress={() => (onGoToSignUp ? onGoToSignUp() : navigation.navigate('SignUp'))}
            inline
          />
        </View>
      )}
    </View>
  );

  const content =
    authView === 'forgot-sent' ? renderForgotSent() : authView === 'forgot' ? renderForgot() : renderLogin();

  if (embedded) {
    return <View style={styles.embedded}>{content}</View>;
  }

  return <AuthLayout>{content}</AuthLayout>;
}

const styles = StyleSheet.create({
  embedded: {
    width: '100%',
  },
  block: {
    width: '100%',
  },
  title: {
    ...memberTypography.h1,
    fontSize: 28,
    letterSpacing: -0.9,
    marginBottom: 4,
  },
  subtitle: {
    ...memberTypography.body,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
    color: memberColors.inkMuted,
  },
  emailBox: {
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  emailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: memberColors.ink,
    textAlign: 'center',
  },
  resendBox: {
    backgroundColor: memberColors.limeSoft,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 249, 52, 0.35)',
  },
  resendMessage: {
    fontSize: 13,
    color: memberColors.inkSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  footer: {
    marginTop: 4,
    alignItems: 'flex-start',
    gap: 2,
  },
  footerText: {
    fontSize: 14,
    color: memberColors.inkMuted,
    lineHeight: 20,
  },
});
