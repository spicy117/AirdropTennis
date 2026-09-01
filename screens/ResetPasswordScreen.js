import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { supabase } from '../lib/supabase';
import { validatePassword } from '../utils/passwordValidation';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import PasswordRequirements from '../components/PasswordRequirements';
import ShowPasswordToggle from '../components/ShowPasswordToggle';
import AuthLayout from '../components/auth/AuthLayout';
import AuthField from '../components/auth/AuthField';
import AuthPrimaryButton, { AuthTextLink } from '../components/auth/AuthPrimaryButton';
import { memberColors, memberTypography } from '../theme/memberTheme';

export default function ResetPasswordScreen({ navigation, route }) {
  const { updatePassword, signOut, resetPassword } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [loading, setLoading] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    isValid: false,
    requirements: {
      minLength: false,
      hasNumber: false,
      hasUppercase: false,
      hasSpecialChar: false,
    },
    strength: 0,
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [linkExpired, setLinkExpired] = useState(false);
  const [email, setEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const fetchRecoveryEmail = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setRecoveryEmail(session.user.email);
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setRecoveryEmail(user.email);
        }
      } catch (err) {
        console.error('Error fetching recovery email:', err);
      }
    };

    fetchRecoveryEmail();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email && !recoveryEmail) {
        setRecoveryEmail(session.user.email);
      }
    });

    const retryTimer = setTimeout(fetchRecoveryEmail, 500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(retryTimer);
    };
  }, [recoveryEmail]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('error_code=otp_expired')) {
        setLinkExpired(true);
        setError('This password reset link has expired. Please request a new one.');
      } else if (hash && hash.includes('error=')) {
        setLinkExpired(true);
        setError('This password reset link is invalid or has expired. Please request a new one.');
      }
    }

    const routeError = route?.params?.error;
    if (routeError && routeError.includes('error_code=otp_expired')) {
      setLinkExpired(true);
      setError('This password reset link has expired. Please request a new one.');
    }
  }, [route]);

  useEffect(() => {
    if (formData.password) {
      const validation = validatePassword(formData.password);
      setPasswordValidation(validation);
      setFieldErrors((prev) => ({ ...prev, password: null }));
    } else {
      setPasswordValidation({
        isValid: false,
        requirements: {
          minLength: false,
          hasNumber: false,
          hasUppercase: false,
          hasSpecialChar: false,
        },
        strength: 0,
      });
    }
  }, [formData.password]);

  const handleResetPassword = async () => {
    if (linkExpired) {
      setError(t('requestNewResetLinkFirst'));
      return;
    }

    setError(null);
    setSuccess(null);
    setFieldErrors({});

    if (!formData.password) {
      setFieldErrors({ password: t('passwordRequired') });
      return;
    }
    if (!passwordValidation.isValid) {
      setFieldErrors({ password: t('passwordDoesNotMeetRequirements') });
      return;
    }
    if (!formData.confirmPassword) {
      setFieldErrors({ confirmPassword: t('confirmPasswordRequired') });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: t('passwordsDoNotMatch') });
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(formData.password);
    setLoading(false);

    if (updateError) {
      if (updateError.message?.includes('expired') || updateError.message?.includes('invalid')) {
        setLinkExpired(true);
        setError(t('resetLinkExpired'));
      } else {
        setError(updateError.message || t('failedToResetPassword'));
      }
    } else {
      setSuccess(t('passwordResetSuccess'));
      await signOut();
      setTimeout(() => {
        navigation.navigate('AuthSelection');
      }, 1500);
    }
  };

  const handleRequestNewLink = async () => {
    if (!email) {
      setFieldErrors({ email: 'Please enter your email address to request a new reset link.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors({ email: 'Please enter a valid email address.' });
      return;
    }

    setLoadingResend(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const { error: resetError } = await resetPassword(email);
    setLoadingResend(false);

    if (resetError) {
      setFieldErrors({ email: resetError.message || 'Failed to send reset email. Please try again.' });
    } else {
      setSuccess(`A new password reset link has been sent to ${email}. Please check your inbox.`);
      setLinkExpired(false);
    }
  };

  return (
    <AuthLayout scrollable keyboardAvoid>
      <Text style={styles.title}>{t('resetYourPassword')}</Text>
      {recoveryEmail ? (
        <Text style={styles.subtitle}>
          {t('resettingPasswordFor')} <Text style={styles.emailStrong}>{recoveryEmail}</Text>
        </Text>
      ) : (
        <Text style={styles.subtitle}>{t('enterNewPasswordBelow')}</Text>
      )}

      {error ? <Text style={styles.bannerError}>{error}</Text> : null}
      {success ? <Text style={styles.bannerSuccess}>{success}</Text> : null}

      {linkExpired && (
        <View style={styles.expiredBlock}>
          <Text style={styles.expiredText}>
            Your password reset link has expired. Enter your email to receive a new link.
          </Text>
          <AuthField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setFieldErrors({});
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={fieldErrors.email}
          />
          <AuthPrimaryButton
            label={loadingResend ? 'Sending…' : 'Request new reset link'}
            onPress={handleRequestNewLink}
            loading={loadingResend}
            disabled={loadingResend}
          />
        </View>
      )}

      {!linkExpired && (
        <>
          <AuthField
            label="New password"
            value={formData.password}
            onChangeText={(text) => {
              setFormData({ ...formData, password: text });
              setFieldErrors((prev) => ({ ...prev, password: null }));
              setError(null);
            }}
            secureTextEntry={!showPassword}
            error={fieldErrors.password}
            rightElement={
              <ShowPasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
            }
          />

          {formData.password.length > 0 && <PasswordStrengthMeter strength={passwordValidation.strength} />}
          {formData.password.length > 0 && (
            <PasswordRequirements requirements={passwordValidation.requirements} />
          )}

          <AuthField
            label="Confirm password"
            value={formData.confirmPassword}
            onChangeText={(text) => {
              setFormData({ ...formData, confirmPassword: text });
              setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
              setError(null);
            }}
            secureTextEntry={!showConfirmPassword}
            error={fieldErrors.confirmPassword}
            rightElement={
              <ShowPasswordToggle
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
          />

          <AuthPrimaryButton
            label="Reset password"
            onPress={handleResetPassword}
            loading={loading}
            disabled={loading || !passwordValidation.isValid}
          />
        </>
      )}

      <AuthTextLink label="Back to login" onPress={() => navigation.navigate('AuthSelection')} subtle />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    ...memberTypography.h1,
    fontSize: 26,
    marginBottom: 6,
  },
  subtitle: {
    ...memberTypography.body,
    marginBottom: 24,
    color: memberColors.inkMuted,
  },
  emailStrong: {
    fontWeight: '600',
    color: memberColors.ink,
  },
  bannerError: {
    fontSize: 13,
    color: memberColors.danger,
    backgroundColor: memberColors.dangerSoft,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  bannerSuccess: {
    fontSize: 13,
    color: memberColors.court,
    backgroundColor: memberColors.limeSoft,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 249, 52, 0.35)',
  },
  expiredBlock: {
    marginBottom: 8,
  },
  expiredText: {
    fontSize: 14,
    color: memberColors.inkSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
});
