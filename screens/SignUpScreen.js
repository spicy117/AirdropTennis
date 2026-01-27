import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { validatePassword } from '../utils/passwordValidation';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import PasswordRequirements from '../components/PasswordRequirements';
import ShowPasswordToggle from '../components/ShowPasswordToggle';
import SuccessCard from '../components/SuccessCard';
import ErrorBanner from '../components/ErrorBanner';

// Inject shake animation styles for web
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

export default function SignUpScreen({ navigation, embedded = false }) {
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

  // Real-time password validation
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

  // Shake animation function
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getErrorMessage = (error) => {
    if (!error) return null;
    
    const errorMessage = (error.message || '').toLowerCase();
    const errorCode = (error.code || '').toLowerCase();
    const errorStatus = error.status;
    
    // Check for duplicate email errors in various formats
    if (
      errorMessage.includes('already registered') || 
      errorMessage.includes('already in use') ||
      errorMessage.includes('user already') ||
      errorMessage.includes('already exists') ||
      errorMessage.includes('email already') ||
      errorCode.includes('user_already') ||
      errorCode.includes('email_exists') ||
      errorCode === 'email_address_not_authorized' ||
      errorStatus === 422 // Unprocessable Entity often used for duplicate emails
    ) {
      return t('thisEmailAlreadyInUse');
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return t('connectionTimeout');
    }
    if (errorMessage.includes('invalid')) {
      return t('invalidEmailOrPasswordFormat');
    }
    
    // Return original message or generic error
    return error.message || t('error');
  };

  const handleSignUp = async () => {
    // Reset errors
    setError(null);
    setFieldErrors({});
    setPasswordError(false);

    // Validation
    const newFieldErrors = {};
    
    // Trim all inputs before validation
    const trimmedFirstName = formData.firstName.trim();
    const trimmedLastName = formData.lastName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();
    
    // First name validation
    if (!trimmedFirstName) {
      newFieldErrors.firstName = t('firstNameRequired');
    } else if (trimmedFirstName.length < 1) {
      newFieldErrors.firstName = t('firstNameRequired');
    } else if (trimmedFirstName.length > 50) {
      newFieldErrors.firstName = t('firstNameMax50');
    }
    
    // Last name validation
    if (!trimmedLastName) {
      newFieldErrors.lastName = t('lastNameRequired');
    } else if (trimmedLastName.length < 1) {
      newFieldErrors.lastName = t('lastNameRequired');
    } else if (trimmedLastName.length > 50) {
      newFieldErrors.lastName = t('lastNameMax50');
    }
    
    // Email validation
    if (!trimmedEmail) {
      newFieldErrors.email = t('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newFieldErrors.email = t('validEmail');
    } else if (trimmedEmail.length > 254) {
      newFieldErrors.email = t('emailTooLong');
    }
    
    // Phone validation
    if (!trimmedPhone) {
      newFieldErrors.phone = t('mobilePhoneRequired');
    } else if (trimmedPhone.length < 8) {
      newFieldErrors.phone = t('validPhoneNumber');
    }
    
    // Password validation
    if (!formData.password) {
      newFieldErrors.password = t('passwordRequired');
    } else if (formData.password.length > 128) {
      newFieldErrors.password = t('passwordMax128');
    }
    
    if (!formData.confirmPassword) {
      newFieldErrors.confirmPassword = t('confirmPasswordRequired');
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: t('passwordsDoNotMatch') });
      return;
    }

    // Check password strength
    if (!passwordValidation.isValid) {
      setPasswordError(true);
      setFieldErrors({ password: t('passwordDoesNotMeetRequirements') });
      triggerShake();
      return;
    }

    setLoading(true);
    
    // Reuse trimmed values from validation above
    // Build full name and include role: 'student' in the user metadata
    const fullName = `${trimmedFirstName} ${trimmedLastName}`.trim();
    const { data, error: signUpError } = await signUp(trimmedEmail, formData.password, {
      full_name: fullName,
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      phone: trimmedPhone,
      role: 'student', // Automatically set role to student
    });

    setLoading(false);

    // Log full response for debugging
    console.log('SignUp response:', {
      hasError: !!signUpError,
      error: signUpError,
      hasData: !!data,
      hasUser: !!data?.user,
    });

    if (signUpError) {
      console.error('SignUpScreen error:', signUpError);
      const errorMsg = getErrorMessage(signUpError);
      
      // For duplicate email errors, only show field validation, not banner
      if (errorMsg.includes('email') || errorMsg.includes('already')) {
        setFieldErrors({ email: errorMsg });
        // Don't set banner error for email-related errors
      } else {
        // For other errors, show banner
        setError(errorMsg);
      }
    } else if (data && !data.user) {
      // Supabase may return success even when email exists (security feature)
      // If no user was created, treat it as an error
      setFieldErrors({ email: t('thisEmailAlreadyInUse') });
    } else {
      // Additional check: if user exists but email is not confirmed and no session was created,
      // it might indicate the email already exists (Supabase anti-enumeration behavior)
      // Try to detect this by checking if we can get a session
      if (data?.user && !data.session) {
        // This might be a duplicate email case when confirmations are enabled
        // We'll let it proceed but the user will need to verify
        // However, if the email already exists and is confirmed, this won't work
        console.log('User created but no session - may need email verification');
      }
      setSuccess(true);
    }
  };

  const shakeStyle = {
    transform: [{ translateX: shakeAnimation }],
  };

  // Show success card
  if (success) {
    return <SuccessCard email={formData.email.trim()} embedded={embedded} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={[styles.container, embedded && styles.embeddedContainer]}
        keyboardShouldPersistTaps="handled"
        accessible={true}
        showsVerticalScrollIndicator={false}
      >
        {!embedded && (
          <>
            <Text style={styles.title}>{t('createAccount')}</Text>
            <Text style={styles.subtitle}>{t('signUpToGetStarted')}</Text>
          </>
        )}

        <ErrorBanner
          message={error}
          onDismiss={() => setError(null)}
        />

        <View style={styles.nameRow}>
          <View style={[styles.inputContainer, styles.nameInputContainer]}>
            <TextInput
              style={[
                styles.input,
                fieldErrors.firstName && styles.inputError,
              ]}
              placeholder={t('firstNamePlaceholder')}
              value={formData.firstName}
              onChangeText={(text) => {
                setFormData({ ...formData, firstName: text });
                setFieldErrors((prev) => ({ ...prev, firstName: null }));
              }}
              autoCapitalize="words"
              fontSize={16}
              accessible={true}
              accessibilityLabel="First name"
              accessibilityHint="Enter your first name"
            />
            {fieldErrors.firstName && (
              <Text style={styles.fieldError}>{fieldErrors.firstName}</Text>
            )}
          </View>

          <View style={[styles.inputContainer, styles.nameInputContainer]}>
            <TextInput
              style={[
                styles.input,
                fieldErrors.lastName && styles.inputError,
              ]}
              placeholder={t('lastNamePlaceholder')}
              value={formData.lastName}
              onChangeText={(text) => {
                setFormData({ ...formData, lastName: text });
                setFieldErrors((prev) => ({ ...prev, lastName: null }));
              }}
              autoCapitalize="words"
              fontSize={16}
              accessible={true}
              accessibilityLabel="Last name"
              accessibilityHint="Enter your last name"
            />
            {fieldErrors.lastName && (
              <Text style={styles.fieldError}>{fieldErrors.lastName}</Text>
            )}
          </View>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              fieldErrors.email && styles.inputError,
            ]}
            placeholder={t('emailPlaceholder')}
            value={formData.email}
            onChangeText={(text) => {
              setFormData({ ...formData, email: text });
              setFieldErrors((prev) => ({ ...prev, email: null }));
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
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
          <TextInput
            style={[
              styles.input,
              styles.phoneInput,
              fieldErrors.phone && styles.inputError,
            ]}
            placeholder={t('mobilePhonePlaceholder')}
            value={formData.phone}
            onChangeText={(text) => {
              setFormData({ ...formData, phone: text });
              setFieldErrors((prev) => ({ ...prev, phone: null }));
            }}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
            fontSize={16}
            accessible={true}
            accessibilityLabel="Mobile phone number"
            accessibilityHint="Enter your mobile phone number"
          />
          {fieldErrors.phone && (
            <Text style={styles.fieldError}>{fieldErrors.phone}</Text>
          )}
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                passwordError && styles.inputError,
                fieldErrors.password && styles.inputError,
                styles.passwordInput,
              ]}
              placeholder={t('passwordPlaceholder')}
              value={formData.password}
              onChangeText={(text) => {
                setFormData({ ...formData, password: text });
                setPasswordError(false);
                setFieldErrors((prev) => ({ ...prev, password: null }));
              }}
              secureTextEntry={!showPassword}
              fontSize={16}
              accessible={true}
              accessibilityLabel={t('passwordPlaceholder')}
              accessibilityHint={t('passwordDoesNotMeetRequirements')}
              {...(Platform.OS === 'web' && {
                'aria-describedby': 'password-requirements',
              })}
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

        {/* Password Strength Meter */}
        {formData.password.length > 0 && (
          <View accessible={true} accessibilityLiveRegion="polite">
            <PasswordStrengthMeter strength={passwordValidation.strength} />
          </View>
        )}

        {/* Password Requirements Checklist */}
        {formData.password.length > 0 && (
          <Animated.View
            style={shakeStyle}
            accessible={true}
            accessibilityLiveRegion="polite"
            accessibilityLabel={t('passwordRequirements')}
            {...(Platform.OS === 'web' && {
              'aria-live': 'polite',
              'aria-describedby': 'password-requirements',
              id: 'password-requirements',
            })}
          >
            <PasswordRequirements
              requirements={passwordValidation.requirements}
              shake={passwordError}
            />
          </Animated.View>
        )}

        <View style={styles.inputContainer}>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                fieldErrors.confirmPassword && styles.inputError,
                styles.passwordInput,
              ]}
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(text) => {
                setFormData({ ...formData, confirmPassword: text });
                setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
              }}
              secureTextEntry={!showConfirmPassword}
              fontSize={16}
              accessible={true}
              accessibilityLabel={t('confirmPasswordPlaceholder')}
              accessibilityHint={t('confirmPasswordPlaceholder')}
            />
            <ShowPasswordToggle
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
            />
          </View>
          {fieldErrors.confirmPassword && (
            <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
          )}
          {formData.confirmPassword &&
            formData.password &&
            !fieldErrors.confirmPassword &&
            (formData.confirmPassword === formData.password ? (
              <Text style={styles.fieldSuccess}>{t('passwordsMatch')}</Text>
            ) : (
              <Text style={styles.fieldError}>{t('passwordsDoNotMatch')}</Text>
            ))}
        </View>

        {/* Web: inline submit button just below fields (to match Log In layout) */}
        {Platform.OS === 'web' && (
          <View style={styles.webButtonWrapper}>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
              accessible={true}
              accessibilityLabel={t('signUp')}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('signUp')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Spacer for sticky button on mobile */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Sticky Submit Button (Mobile only) */}
      {Platform.OS !== 'web' && (
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.stickyButton, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
            accessible={true}
            accessibilityLabel={t('signUp')}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('signUp')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 20,
    ...(Platform.OS === 'web' && {
      maxWidth: 500,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  embeddedContainer: {
    padding: 24,
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
  nameRow: {
    width: '100%',
    flexDirection: 'column',
    ...(Platform.OS === 'web' && {
      flexDirection: 'row',
      columnGap: 12,
    }),
  },
  nameInputContainer: {
    flex: 1,
  },
  input: {
    width: '100%',
    padding: 15,
    paddingRight: 45,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
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
  phoneInput: {
    paddingRight: 15, // No toggle button needed
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
  fieldSuccess: {
    color: '#34C759',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#fff',
  },
  button: {
    width: '100%',
    padding: 15,
    backgroundColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  webButtonWrapper: {
    marginTop: 10,
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    ...(Platform.OS === 'ios' && {
      paddingBottom: 34, // Safe area for iPhone
    }),
    ...(Platform.OS === 'web' && {
      boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
    }),
  },
  stickyButton: {
    marginBottom: 0,
  },
  spacer: {
    height: Platform.OS === 'web' ? 0 : 100, // Space for sticky button
  },
});
