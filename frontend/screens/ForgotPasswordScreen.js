import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import PasswordInput from '../components/PasswordInput';
import PrimaryButton from '../components/PrimaryButton';
import TextField from '../components/TextField';
import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from '../services/api';
import { isValidEmail } from '../utils/helpers';
import { getSafeUserErrorMessage } from '../utils/medicationValidation';
import { colors, radius, spacing, type } from '../theme';

const GENERIC_REQUEST_MESSAGE =
  'If an account exists for this email, a password reset code has been sent.';

export default function ForgotPasswordScreen({
  onBackToLogin,
  onResetComplete,
}) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetAuthorization, setResetAuthorization] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setCooldown((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  const showError = (error, fallback) => {
    setMessage(getSafeUserErrorMessage(error, fallback));
    setMessageType('error');
  };

  const handleRequestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setMessage('Please enter a valid email address.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');
    try {
      await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setStep('code');
      setCooldown(60);
      setMessage(GENERIC_REQUEST_MESSAGE);
      setMessageType('info');
    } catch (error) {
      showError(error, 'Unable to request a password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setMessage('Please enter the 6-digit reset code.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');
    try {
      const result = await verifyPasswordResetCode(email, otp);
      setResetAuthorization(result.resetAuthorization);
      setOtp('');
      setStep('password');
    } catch (error) {
      showError(error, 'Unable to verify the reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      setMessage('Password is required.');
      setMessageType('error');
      return;
    }
    if (newPassword.length < 6 || /\s/.test(newPassword)) {
      setMessage('Password must be at least 6 characters and cannot contain spaces.');
      setMessageType('error');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');
    try {
      const result = await resetPassword(resetAuthorization, newPassword);
      setResetAuthorization('');
      onResetComplete(result.message);
    } catch (error) {
      showError(error, 'Unable to reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setMessage('');
    setMessageType('');
    if (step === 'password') {
      setResetAuthorization('');
      onBackToLogin();
      return;
    }
    if (step === 'code') {
      setOtp('');
      setStep('email');
      return;
    }
    onBackToLogin();
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.brand}>MedSked</Text>
            <Text style={styles.title}>Reset your password</Text>

            {step === 'email' ? (
              <>
                <Text style={styles.subtitle}>
                  Enter your account email. If an account exists, we’ll send a reset code.
                </Text>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setMessage('');
                    setMessageType('');
                  }}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                {message ? (
                  <Text style={[styles.message, styles.errorMessage]}>{message}</Text>
                ) : null}
                <PrimaryButton
                  label="Send Reset Code"
                  onPress={() => handleRequestCode()}
                  loading={loading}
                  style={styles.primaryButton}
                />
              </>
            ) : null}

            {step === 'code' ? (
              <>
                <Text style={styles.subtitle}>
                  Enter the 6-digit reset code sent to {email}.
                </Text>
                <TextField
                  label="Reset code"
                  value={otp}
                  onChangeText={(value) => {
                    setOtp(value.replace(/\D/g, '').slice(0, 6));
                    setMessage('');
                    setMessageType('');
                  }}
                  placeholder="Enter 6-digit code"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={6}
                  editable={!loading}
                />
                {message ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[
                      styles.message,
                      messageType === 'error' && styles.errorMessage,
                      messageType === 'info' && styles.infoMessage,
                    ]}
                  >
                    {message}
                  </Text>
                ) : null}
                <PrimaryButton
                  label="Verify Code"
                  onPress={handleVerifyCode}
                  loading={loading}
                  style={styles.primaryButton}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={handleRequestCode}
                  disabled={loading || cooldown > 0}
                  style={styles.secondaryAction}
                >
                  <Text style={[
                    styles.actionText,
                    (loading || cooldown > 0) && styles.disabledText,
                  ]}>
                    {cooldown > 0
                      ? `Resend code in ${cooldown}s`
                      : 'Resend Code'}
                  </Text>
                </Pressable>
              </>
            ) : null}

            {step === 'password' ? (
              <>
                <Text style={styles.subtitle}>Choose a new password for your account.</Text>
                <PasswordInput
                  label="New Password"
                  value={newPassword}
                  onChangeText={(value) => {
                    setNewPassword(value);
                    setMessage('');
                    setMessageType('');
                  }}
                  placeholder="Enter new password"
                  editable={!loading}
                />
                <PasswordInput
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    setMessage('');
                    setMessageType('');
                  }}
                  placeholder="Confirm new password"
                  editable={!loading}
                />
                {message ? (
                  <Text style={[styles.message, styles.errorMessage]}>{message}</Text>
                ) : null}
                <PrimaryButton
                  label="Reset Password"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={styles.primaryButton}
                />
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={handleBack}
              disabled={loading}
              style={styles.backButton}
            >
              <Text style={styles.backText}>
                {step === 'email' ? 'Back to Sign In' : 'Back'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  brand: {
    marginBottom: spacing.sm,
    color: colors.primary,
    fontSize: type.heading,
    fontWeight: '700',
    textAlign: 'center',
  },
  title: {
    color: colors.text,
    fontSize: type.heading,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    color: colors.textSecondary,
    fontSize: type.caption,
    textAlign: 'center',
  },
  message: {
    marginBottom: spacing.md,
    fontSize: type.caption,
    textAlign: 'center',
  },
  errorMessage: {
    color: colors.dangerText,
  },
  infoMessage: {
    color: colors.textSecondary,
  },
  primaryButton: {
    marginTop: spacing.md,
  },
  secondaryAction: {
    alignSelf: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  actionText: {
    color: colors.primary,
    fontSize: type.caption,
    fontWeight: '700',
  },
  disabledText: {
    color: colors.textMuted,
  },
  backButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: type.caption,
  },
});
