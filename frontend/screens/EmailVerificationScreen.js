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

import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import { resendVerificationCode, verifyEmail } from '../services/api';
import { colors, radius, spacing, type } from '../theme';

export default function EmailVerificationScreen({
  email,
  initialMessage = '',
  initialCooldownSeconds = 0,
  onVerified,
  onBackToLogin,
}) {
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState(initialMessage);
  const [messageType, setMessageType] = useState(
    initialMessage ? 'info' : ''
  );
  const [cooldown, setCooldown] = useState(initialCooldownSeconds);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setCooldown((remaining) => Math.max(0, remaining - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown > 0]);

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setMessage('Please enter the 6-digit verification code.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');
    try {
      await verifyEmail(email, otp);
      setVerified(true);
      setMessage('Email verified successfully.');
      setMessageType('success');
    } catch (error) {
      setMessage(error.message || 'Unable to verify your email. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setMessage('');
    setMessageType('');
    try {
      const result = await resendVerificationCode(email);
      setOtp('');
      setCooldown(60);
      setMessage(result.message);
      setMessageType('success');
    } catch (error) {
      const retryAfterSeconds = error.responseData?.retryAfterSeconds;
      if (retryAfterSeconds) {
        setCooldown(retryAfterSeconds);
      }
      setMessage(error.message || 'Unable to send the verification email. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to {email}.
            </Text>

            {!verified ? (
              <>
                <TextField
                  label="Verification code"
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
                      messageType === 'success' && styles.successMessage,
                    ]}
                  >
                    {message}
                  </Text>
                ) : null}

                <PrimaryButton
                  label="Verify Email"
                  onPress={handleVerify}
                  loading={loading}
                  style={styles.verifyButton}
                />

                <Pressable
                  accessibilityRole="button"
                  onPress={handleResend}
                  disabled={loading || cooldown > 0}
                  style={styles.resendButton}
                >
                  <Text
                    style={[
                      styles.resendText,
                      (loading || cooldown > 0) && styles.disabledText,
                    ]}
                  >
                    {cooldown > 0
                      ? `Resend code in ${cooldown}s`
                      : 'Resend verification code'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.message, styles.successMessage]}>
                  {message}
                </Text>
                <PrimaryButton
                  label="Continue to Sign In"
                  onPress={onVerified}
                  style={styles.verifyButton}
                />
              </>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={onBackToLogin}
              disabled={loading}
              style={styles.backButton}
            >
              <Text style={styles.backText}>Back to Sign In</Text>
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
  successMessage: {
    color: colors.success,
  },
  verifyButton: {
    marginTop: spacing.sm,
  },
  resendButton: {
    alignSelf: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  resendText: {
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
