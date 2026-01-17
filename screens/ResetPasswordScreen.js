import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { validatePassword } from '../utils/passwordValidation';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import PasswordRequirements from '../components/PasswordRequirements';
import ShowPasswordToggle from '../components/ShowPasswordToggle';
import ErrorBanner from '../components/ErrorBanner';
import SuccessBanner from '../components/SuccessBanner';

const getWindowWidth = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth;
  }
  return Dimensions.get('window').width;
};

const isDesktop = () => {
  if (Platform.OS === 'web') {
    return getWindowWidth() > 768;
  }
  return false;
};

export default function ResetPasswordScreen({ navigation, route }) {
  const { updatePassword, signOut, resetPassword } = useAuth();
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
  const [desktop, setDesktop] = useState(isDesktop());
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Handle window resize for desktop detection
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleResize = () => {
        setDesktop(isDesktop());
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Fetch email from Supabase session on mount and listen for auth changes
  useEffect(() => {
    const fetchRecoveryEmail = async () => {
      try {
        // Try to get session directly from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setRecoveryEmail(session.user.email);
          return;
        }
        
        // If no session, try to get user from auth state
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setRecoveryEmail(user.email);
        }
      } catch (error) {
        console.error('Error fetching recovery email:', error);
      }
    };

    // Fetch immediately
    fetchRecoveryEmail();

    // Also listen to auth state changes to catch the email when recovery session is established
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email && !recoveryEmail) {
        setRecoveryEmail(session.user.email);
      }
    });

    // Retry after a short delay in case session isn't ready yet
    const retryTimer = setTimeout(() => {
      fetchRecoveryEmail();
    }, 500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(retryTimer);
    };
  }, [recoveryEmail]);

  // Check for error in URL hash on mount
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
    
    // Try to get email from route params or session
    const routeError = route?.params?.error;
    if (routeError && routeError.includes('error_code=otp_expired')) {
      setLinkExpired(true);
      setError('This password reset link has expired. Please request a new one.');
    }
  }, [route]);

  // Real-time password validation
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
      setError('Please request a new password reset link first.');
      return;
    }

    setError(null);
    setSuccess(null);
    setFieldErrors({});

    // Validate password
    if (!formData.password) {
      setFieldErrors({ password: 'Password is required' });
      return;
    }

    if (!passwordValidation.isValid) {
      setFieldErrors({ password: 'Password does not meet requirements' });
      return;
    }

    // Validate confirm password
    if (!formData.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Please confirm your password' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(formData.password);
    setLoading(false);

    if (updateError) {
      // Check if it's a token expiration error
      if (updateError.message?.includes('expired') || updateError.message?.includes('invalid')) {
        setLinkExpired(true);
        setError('This password reset link has expired. Please request a new one.');
      } else {
        setError(updateError.message || 'Failed to reset password. Please try again.');
      }
    } else {
      setSuccess('Password reset successfully! Redirecting to login...');
      // Sign out to clear the recovery session, then redirect to auth selection
      await signOut();
      // Redirect to auth selection after a short delay
      setTimeout(() => {
        navigation.navigate('AuthSelection');
      }, 1500);
    }
  };

  const handleRequestNewLink = async () => {
    if (!email) {
      setError('Please enter your email address to request a new reset link.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoadingResend(true);
    setError(null);
    setSuccess(null);

    const { error: resetError } = await resetPassword(email);
    setLoadingResend(false);

    if (resetError) {
      setError(resetError.message || 'Failed to send reset email. Please try again.');
    } else {
      setSuccess(`A new password reset link has been sent to ${email}. Please check your inbox.`);
      setLinkExpired(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.container}>
        <View style={styles.contentRow}>
          {desktop && (
            <View style={styles.sidePanel}>
              <View style={styles.illustrationContainer}>
                <Text style={styles.illustrationEmoji}>🎾</Text>
                <Text style={styles.illustrationTitle}>Reset Your Password</Text>
                <Text style={styles.illustrationText}>
                  {recoveryEmail 
                    ? `Resetting password for:`
                    : 'Enter your new password to regain access to your account.'}
                </Text>
                {recoveryEmail && (
                  <View style={styles.emailDisplay}>
                    <Text style={styles.emailDisplayText}>{recoveryEmail}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.authCard}>
            <Text style={styles.title}>Reset Your Password</Text>
            {recoveryEmail ? (
              <Text style={styles.subtitle}>
                Resetting password for: <Text style={styles.emailText}>{recoveryEmail}</Text>
              </Text>
            ) : (
              <Text style={styles.subtitle}>Enter your new password below</Text>
            )}

            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
            />

            <SuccessBanner
              message={success}
              onDismiss={() => setSuccess(null)}
            />

            {linkExpired && (
              <View style={styles.expiredContainer}>
                <Text style={styles.expiredText}>
                  Your password reset link has expired. Please enter your email address to receive a new link.
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    fontSize={16}
                    accessible={true}
                    accessibilityLabel="Email address"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.button, loadingResend && styles.buttonDisabled]}
                  onPress={handleRequestNewLink}
                  disabled={loadingResend}
                  accessible={true}
                  accessibilityLabel="Request new reset link"
                >
                  {loadingResend ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Request New Reset Link</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {!linkExpired && (
              <>
            <View style={styles.inputContainer}>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                fieldErrors.password && styles.inputError,
                styles.passwordInput,
              ]}
              placeholder="New Password"
              value={formData.password}
              onChangeText={(text) => {
                setFormData({ ...formData, password: text });
                setFieldErrors((prev) => ({ ...prev, password: null }));
                setError(null);
              }}
              secureTextEntry={!showPassword}
              fontSize={16}
              accessible={true}
              accessibilityLabel="New password"
              accessibilityHint="Enter a password with at least 8 characters, including a number, uppercase letter, and special character"
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
              <View accessible={true} accessibilityRole="list">
                <PasswordRequirements requirements={passwordValidation.requirements} />
              </View>
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
                setError(null);
              }}
              secureTextEntry={!showConfirmPassword}
              fontSize={16}
              accessible={true}
              accessibilityLabel="Confirm password"
              accessibilityHint="Re-enter your password to confirm"
            />
            <ShowPasswordToggle
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
            />
          </View>
              {fieldErrors.confirmPassword && (
                <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, (loading || !passwordValidation.isValid) && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading || !passwordValidation.isValid}
              accessible={true}
              accessibilityLabel="Reset password"
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('AuthSelection')}
              accessible={true}
              accessibilityLabel="Back to login"
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>Back to Log In</Text>
            </TouchableOpacity>
              </>
            )}
          </View>
        </View>
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
    backgroundColor: '#FAFAFA',
    ...(Platform.OS === 'web' && {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      paddingVertical: 40,
    }),
  },
  contentRow: {
    width: '100%',
    ...(Platform.OS === 'web' && {
      maxWidth: 980,
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
    }),
  },
  sidePanel: {
    flex: 1,
    maxWidth: 500,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    ...(Platform.OS === 'web' && {
      display: 'flex',
    }),
  },
  illustrationContainer: {
    alignItems: 'center',
  },
  illustrationEmoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  illustrationTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  illustrationText: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 28,
  },
  emailDisplay: {
    backgroundColor: '#1A1A1A',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    width: '100%',
  },
  emailDisplayText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  authCard: {
    flex: 1,
    maxWidth: Platform.OS === 'web' && isDesktop() ? 480 : '100%',
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
    ...(Platform.OS !== 'web' && {
      paddingHorizontal: 20,
      paddingTop: 40,
    }),
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
  emailText: {
    fontWeight: '600',
    color: '#333',
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
  passwordInput: {
    paddingRight: 50,
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
  expiredContainer: {
    width: '100%',
    marginBottom: 20,
  },
  expiredText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
});
