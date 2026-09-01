import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Animated, ScrollView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { validatePassword } from '../utils/passwordValidation';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import PasswordRequirements from '../components/PasswordRequirements';
import ShowPasswordToggle from '../components/ShowPasswordToggle';
import SuccessCard from '../components/SuccessCard';
import AuthLayout from '../components/auth/AuthLayout';
import AuthField from '../components/auth/AuthField';
import AuthPrimaryButton, { AuthTextLink, AuthDivider } from '../components/auth/AuthPrimaryButton';
import { memberColors, memberTypography } from '../theme/memberTheme';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'password-shake-animation';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
    `;
    document.head.appendChild(style);
  }
}

export default function SignUpScreen({ navigation, embedded = false, onGoToLogin }) {
  const { signUp } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [loading, setLoading] = useState(false);
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
  const [passwordError, setPasswordError] = useState(false);
  const [shakeAnimation] = useState(new Animated.Value(0));
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
  });

  useEffect(() => {
    if (formData.password) {
      const validation = validatePassword(formData.password);
      setPasswordValidation(validation);
      setPasswordError(false);
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

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const getErrorMessage = (error) => {
    if (!error) return null;
    const errorMessage = (error.message || '').toLowerCase();
    const errorCode = (error.code || '').toLowerCase();
    const errorStatus = error.status;

    if (
      errorMessage.includes('already registered') ||
      errorMessage.includes('already in use') ||
      errorMessage.includes('user already') ||
      errorMessage.includes('already exists') ||
      errorMessage.includes('email already') ||
      errorCode.includes('user_already') ||
      errorCode.includes('email_exists') ||
      errorCode === 'email_address_not_authorized' ||
      errorStatus === 422
    ) {
      return t('thisEmailAlreadyInUse');
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return t('connectionTimeout');
    }
    if (errorMessage.includes('invalid')) {
      return t('invalidEmailOrPasswordFormat');
    }
    return error.message || t('error');
  };

  const handleSignUp = async () => {
    setError(null);
    setFieldErrors({});
    setPasswordError(false);

    const newFieldErrors = {};
    const trimmedFirstName = formData.firstName.trim();
    const trimmedLastName = formData.lastName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();

    if (!trimmedFirstName) newFieldErrors.firstName = t('firstNameRequired');
    else if (trimmedFirstName.length > 50) newFieldErrors.firstName = t('firstNameMax50');

    if (!trimmedLastName) newFieldErrors.lastName = t('lastNameRequired');
    else if (trimmedLastName.length > 50) newFieldErrors.lastName = t('lastNameMax50');

    if (!trimmedEmail) newFieldErrors.email = t('emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) newFieldErrors.email = t('validEmail');
    else if (trimmedEmail.length > 254) newFieldErrors.email = t('emailTooLong');

    if (!trimmedPhone) newFieldErrors.phone = t('mobilePhoneRequired');
    else if (trimmedPhone.length < 8) newFieldErrors.phone = t('validPhoneNumber');

    if (!formData.password) newFieldErrors.password = t('passwordRequired');
    else if (formData.password.length > 128) newFieldErrors.password = t('passwordMax128');

    if (!formData.confirmPassword) newFieldErrors.confirmPassword = t('confirmPasswordRequired');

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: t('passwordsDoNotMatch') });
      return;
    }

    if (!passwordValidation.isValid) {
      setPasswordError(true);
      setFieldErrors({ password: t('passwordDoesNotMeetRequirements') });
      triggerShake();
      return;
    }

    setLoading(true);
    const fullName = `${trimmedFirstName} ${trimmedLastName}`.trim();
    const { data, error: signUpError } = await signUp(trimmedEmail, formData.password, {
      full_name: fullName,
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      phone: trimmedPhone,
      role: 'student',
    });
    setLoading(false);

    if (signUpError) {
      const errorMsg = getErrorMessage(signUpError);
      if (errorMsg.includes('email') || errorMsg.includes('already')) {
        setFieldErrors({ email: errorMsg });
      } else {
        setError(errorMsg);
      }
    } else if (data && !data.user) {
      setFieldErrors({ email: t('thisEmailAlreadyInUse') });
    } else {
      setSuccess(true);
    }
  };

  const shakeStyle = { transform: [{ translateX: shakeAnimation }] };

  if (success) {
    return <SuccessCard email={formData.email.trim()} embedded={embedded} />;
  }

  const form = (
    <View style={styles.block}>
      <Text style={styles.title}>{t('createAccount')}</Text>
      <Text style={styles.subtitle}>{t('signUpToGetStarted')}</Text>

      {error ? <Text style={styles.bannerError}>{error}</Text> : null}

      <View style={styles.nameRow}>
        <AuthField
          label={t('firstNamePlaceholder')}
          value={formData.firstName}
          onChangeText={(text) => {
            setFormData({ ...formData, firstName: text });
            setFieldErrors((prev) => ({ ...prev, firstName: null }));
          }}
          autoCapitalize="words"
          error={fieldErrors.firstName}
          containerStyle={styles.nameField}
        />
        <AuthField
          label={t('lastNamePlaceholder')}
          value={formData.lastName}
          onChangeText={(text) => {
            setFormData({ ...formData, lastName: text });
            setFieldErrors((prev) => ({ ...prev, lastName: null }));
          }}
          autoCapitalize="words"
          error={fieldErrors.lastName}
          containerStyle={styles.nameField}
        />
      </View>

      <AuthField
        label={t('emailPlaceholder')}
        value={formData.email}
        onChangeText={(text) => {
          setFormData({ ...formData, email: text });
          setFieldErrors((prev) => ({ ...prev, email: null }));
          setError(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={fieldErrors.email}
      />

      <AuthField
        label={t('mobilePhonePlaceholder')}
        value={formData.phone}
        onChangeText={(text) => {
          setFormData({ ...formData, phone: text });
          setFieldErrors((prev) => ({ ...prev, phone: null }));
        }}
        keyboardType="phone-pad"
        autoCapitalize="none"
        error={fieldErrors.phone}
      />

      <AuthField
        label={t('passwordPlaceholder')}
        value={formData.password}
        onChangeText={(text) => {
          setFormData({ ...formData, password: text });
          setPasswordError(false);
          setFieldErrors((prev) => ({ ...prev, password: null }));
        }}
        secureTextEntry={!showPassword}
        error={fieldErrors.password}
        rightElement={
          <ShowPasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
        }
      />

      {formData.password.length > 0 && (
        <View accessible accessibilityLiveRegion="polite">
          <PasswordStrengthMeter strength={passwordValidation.strength} />
        </View>
      )}

      {formData.password.length > 0 && (
        <Animated.View style={shakeStyle} accessible accessibilityLiveRegion="polite">
          <PasswordRequirements requirements={passwordValidation.requirements} shake={passwordError} />
        </Animated.View>
      )}

      <AuthField
        label={t('confirmPasswordPlaceholder')}
        value={formData.confirmPassword}
        onChangeText={(text) => {
          setFormData({ ...formData, confirmPassword: text });
          setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
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

      <AuthPrimaryButton label={t('signUp')} onPress={handleSignUp} loading={loading} disabled={loading} />

      {(onGoToLogin || !embedded) && (
        <View style={styles.footer}>
          <AuthDivider />
          <Text style={styles.footerText}>{t('alreadyHaveAccount')}</Text>
          <AuthTextLink
            label={t('logIn')}
            onPress={() => (onGoToLogin ? onGoToLogin() : navigation.navigate('LogIn'))}
            inline
          />
        </View>
      )}
    </View>
  );

  if (embedded) {
    return <ScrollView contentContainerStyle={styles.embeddedScroll} keyboardShouldPersistTaps="handled">{form}</ScrollView>;
  }

  return (
    <AuthLayout scrollable keyboardAvoid>
      {form}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  embeddedScroll: {
    paddingBottom: 24,
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
    marginBottom: 20,
    color: memberColors.inkMuted,
  },
  bannerError: {
    fontSize: 13,
    color: memberColors.danger,
    backgroundColor: memberColors.dangerSoft,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 0,
  },
  nameField: {
    flex: Platform.OS === 'web' ? 1 : undefined,
  },
  footer: {
    marginTop: 4,
    alignItems: 'flex-start',
    gap: 2,
  },
  footerText: {
    fontSize: 14,
    color: memberColors.inkMuted,
  },
});
