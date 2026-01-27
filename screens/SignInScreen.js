import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import ErrorBanner from '../components/ErrorBanner';
import SuccessBanner from '../components/SuccessBanner';
import ShowPasswordToggle from '../components/ShowPasswordToggle';

export default function SignInScreen({ navigation, embedded = false }) {
  const { signIn, resetPassword, resendVerificationEmail } = useAuth();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [loading, setLoading] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showResendOption, setShowResendOption] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const getErrorMessage = (error) => {
    if (!error) return null;
    
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    
    // Check for email not confirmed error
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
      return t('invalidEmailOrPassword');
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return t('connectionTimeout');
    }
    
    return errorMessage || t('error');
  };

  const handleSignIn = async () => {
    setError(null);
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
    const { data, error: signInError } = await signIn(formData.email, formData.password);
    setLoading(false);

    if (signInError) {
      const errorMsg = getErrorMessage(signInError);
      const errorMessage = signInError.message || '';
      const errorCode = signInError.code || '';
      
      // Check if this is an email not confirmed error
      const isEmailNotConfirmed = 
        errorMessage.toLowerCase().includes('email not confirmed') ||
        errorMessage.toLowerCase().includes('email not verified') ||
        errorMessage.toLowerCase().includes('confirm your email') ||
        errorMessage.toLowerCase().includes('verify your email') ||
        errorCode.toLowerCase().includes('email_not_confirmed') ||
        errorCode.toLowerCase().includes('email_not_verified');
      
      setError(errorMsg);
      setShowResendOption(isEmailNotConfirmed && formData.email);
      
      if (errorMsg.includes('email') || errorMsg.includes('password')) {
        setFieldErrors({
          email: errorMsg.includes('email') ? errorMsg : null,
          password: errorMsg.includes('password') ? errorMsg : null,
        });
      }
    } else {
      setShowResendOption(false);
    }
    // If successful, the auth state will update automatically via the context
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    // Validate email is provided
    if (!formData.email) {
      setFieldErrors({ email: t('emailRequiredForReset') });
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFieldErrors({ email: t('validEmail') });
      return;
    }

    setLoadingReset(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const { error: resetError } = await resetPassword(formData.email);
    setLoadingReset(false);

    if (resetError) {
      setError(resetError.message || t('failedToSendReset'));
    } else {
      setSuccess(t('resetEmailSent'));
    }
  };

  const handleResendVerification = async () => {
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    // Validate email is provided
    if (!formData.email) {
      setFieldErrors({ email: t('emailRequiredForResend') });
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFieldErrors({ email: t('validEmail') });
      return;
    }

    setLoadingResend(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const { error: resendError } = await resendVerificationEmail(formData.email);
    setLoadingResend(false);

    if (resendError) {
      setError(resendError.message || t('failedToSendVerification'));
    } else {
      setSuccess(t('verificationEmailSentTo'));
      setShowResendOption(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.container, embedded && styles.embeddedContainer]}>
        {!embedded && (
          <>
            <Text style={styles.title}>{t('welcomeBack')}</Text>
            <Text style={styles.subtitle}>{t('logInToAccount')}</Text>
          </>
        )}

        <ErrorBanner
          message={error}
          onDismiss={() => setError(null)}
        />

        <SuccessBanner
          message={success}
          onDismiss={() => setSuccess(null)}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              fieldErrors.email && styles.inputError,
            ]}
            placeholder="Email"
            value={formData.email}
            onChangeText={(text) => {
              setFormData({ ...formData, email: text });
              setFieldErrors((prev) => ({ ...prev, email: null }));
              setError(null);
              setSuccess(null);
              setShowResendOption(false);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            fontSize={16}
            accessible={true}
            accessibilityLabel={t('emailPlaceholder')}
            accessibilityHint={t('validEmail')}
          />
          {fieldErrors.email && (
            <Text style={styles.fieldError}>{fieldErrors.email}</Text>
          )}
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                fieldErrors.password && styles.inputError,
                styles.passwordInput,
              ]}
              placeholder={t('passwordPlaceholder')}
              value={formData.password}
              onChangeText={(text) => {
                setFormData({ ...formData, password: text });
                setFieldErrors((prev) => ({ ...prev, password: null }));
              }}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              fontSize={16}
              accessible={true}
              accessibilityLabel={t('passwordPlaceholder')}
              accessibilityHint={t('passwordPlaceholder')}
            />
            <ShowPasswordToggle
              show={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
            />
          </View>
          {fieldErrors.password && (
            <Text style={styles.fieldError}>{fieldErrors.password}</Text>
          )}
        </View>

        {showResendOption && (
          <View style={styles.resendContainer}>
            <Text style={styles.resendMessage}>{t('resendVerificationMessage')}</Text>
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendVerification}
              disabled={loadingResend}
              accessible={true}
              accessibilityLabel={t('resendVerificationEmail')}
              accessibilityRole="button"
            >
              <Text style={styles.resendButtonText}>
                {loadingResend ? t('sending') : t('resendVerificationEmail')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.forgotPasswordButton}
          onPress={handleForgotPassword}
          disabled={loadingReset}
          accessible={true}
          accessibilityLabel={t('forgotPassword')}
          accessibilityRole="button"
        >
          <Text style={styles.forgotPasswordText}>
            {loadingReset ? t('sending') : t('forgotPassword')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
          accessible={true}
          accessibilityLabel={t('logIn')}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t('logIn')}</Text>
          )}
        </TouchableOpacity>

        {!embedded && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('SignUp')}
            accessible={true}
            accessibilityLabel={t('dontHaveAccountSignUp')}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>{t('dontHaveAccountSignUp')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  embeddedContainer: {
    padding: 24,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 15,
  },
  passwordRow: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
    padding: 15,
    paddingRight: 45,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 4,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
      WebkitAppearance: 'none',
    }),
  },
  passwordInput: {
    // Additional styles for password inputs
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  fieldError: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  button: {
    width: '100%',
    padding: 15,
    backgroundColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    marginTop: -5,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  resendContainer: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  resendMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  resendButton: {
    width: '100%',
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  resendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
