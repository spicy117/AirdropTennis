import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';
import AuthPrimaryButton, { AuthTextLink } from '../components/auth/AuthPrimaryButton';
import { memberColors, memberRadius, memberTypography } from '../theme/memberTheme';

export default function EmailVerificationScreen({ route, navigation }) {
  const { resendVerificationEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const email = route?.params?.email || '';

  const handleResendEmail = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address not found');
      return;
    }

    setLoading(true);
    const { error } = await resendVerificationEmail(email);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Verification email sent! Please check your inbox.');
    }
  };

  return (
    <AuthLayout>
      <View style={styles.block}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>✉️</Text>
        </View>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.message}>We've sent a verification email to:</Text>
        {email ? (
          <View style={styles.emailBox}>
            <Text style={styles.email}>{email}</Text>
          </View>
        ) : null}
        <Text style={styles.instructions}>
          Please check your email and click the verification link to activate your account.
        </Text>

        <AuthPrimaryButton
          label={loading ? 'Sending…' : 'Resend verification email'}
          onPress={handleResendEmail}
          loading={loading}
          disabled={loading}
        />

        <AuthTextLink label="Back to login" onPress={() => navigation.navigate('LogIn')} subtle />
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
    color: memberColors.inkMuted,
    marginBottom: 12,
  },
  emailBox: {
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.border,
    borderRadius: memberRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    fontSize: 14,
    color: memberColors.inkMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});
