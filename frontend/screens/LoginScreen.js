import React, { useEffect, useRef, useState } from 'react';

import {
  Animated,
  View,
  Image,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import {
  loginUser,
} from '../services/api';

import TextField from '../components/TextField';
import PasswordInput from '../components/PasswordInput';
import PrimaryButton from '../components/PrimaryButton';
import { colors, radius, spacing, shadow, type } from '../theme';
import { getSafeUserErrorMessage } from '../utils/medicationValidation';

const medSkedLogo = require('../assets/medsked.png');

export default function LoginScreen({
  onLogin,
  onNavigateVerification,
  onNavigateForgotPassword,
  initialEmail = '',
  initialNotice = '',
  onNavigateLanding,
  onNavigateRegister,
}) {
  const [username, setUsername] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState(initialNotice);

  const [loading, setLoading] = useState(false);
  const entranceProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(entranceProgress, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [entranceProgress]);

  const entranceStyle = {
    opacity: entranceProgress,
    transform: [
      {
        translateY: entranceProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  const handleLogin = async () => {
    const nextErrors = {};
    setAuthError('');
    setNotice('');

    if (!username.trim()) {
      nextErrors.username = 'Please enter your username.';
      setErrors(nextErrors);
      Alert.alert(
        'Missing Username',
        'Please enter your username.'
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim())) {
      nextErrors.username = 'Please enter a valid email address.';
      setErrors(nextErrors);
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
      );
      return;
    }

    if (!password) {
      nextErrors.password = 'Please enter your password.';
      setErrors(nextErrors);
      Alert.alert(
        'Missing Password',
        'Please enter your password.'
      );
      return;
    }

    setErrors(nextErrors);

    try {
      setLoading(true);

      const result = await loginUser(
        username.trim(),
        password
      );

      const loggedInUser =
        result.user || result;

      const token =
        result.token || '';

      onLogin(
        loggedInUser,
        token
      );

    } catch (error) {
      if (error.responseData?.code === 'EMAIL_VERIFICATION_REQUIRED') {
        onNavigateVerification(error.responseData.email || username.trim());
        return;
      }

      const message = getSafeUserErrorMessage(
        error,
        'Unable to log in. Please check your credentials.'
      );

      setAuthError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
      >
        <View style={styles.decorTopRight} />
        <View style={styles.decorBottomLeft} />

        <Pressable
          accessibilityRole="button"
          onPress={onNavigateLanding}
          style={styles.backButton}
          hitSlop={10}
        >
          <Text style={styles.backText}>←  Back</Text>
        </Pressable>

        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* LOGIN CARD */}

          <Animated.View style={[styles.card, entranceStyle]}>
            <View style={styles.logoSection}>
              <Image
                accessible
                accessibilityLabel="MedSked logo"
                source={medSkedLogo}
                resizeMode="contain"
                style={styles.logoImage}
              />
              <Text style={styles.logoText}>MedSked</Text>
            </View>

            <Text style={styles.title}>Sign In to your account</Text>

            <Text style={styles.subtitle}>
              Manage your medications and stay on schedule.
            </Text>

            {/* USERNAME */}

            <TextField
              label="Email"
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                setErrors((current) => ({ ...current, username: '' }));
                setAuthError('');
                setNotice('');
              }}
              placeholder="Enter your email"
              error={errors.username}
              labelStyle={styles.authLabel}
              inputStyle={styles.authInput}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* PASSWORD */}

            <PasswordInput
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: '' }));
                setAuthError('');
              }}
              placeholder="Enter your password"
              error={errors.password}
              labelStyle={styles.authLabel}
              inputStyle={styles.authInput}
              rowStyle={styles.authPasswordRow}
              editable={!loading}
            />

            <Pressable
              accessibilityRole="button"
              onPress={onNavigateForgotPassword}
              style={styles.forgotPasswordButton}
            >
              <Text style={styles.forgotPasswordText}>
                Forgot Password?
              </Text>
            </Pressable>

            {notice ? (
              <Text style={styles.authNotice}>{notice}</Text>
            ) : null}
            {authError ? (
              <Text style={styles.authError}>{authError}</Text>
            ) : null}

            {/* LOGIN BUTTON */}

            <PrimaryButton
              label="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />

            {/* REGISTER */}

            <View style={styles.registerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.registerText}>Don't have an account?</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onNavigateRegister}
              style={({ pressed }) => [styles.createAccountButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.registerLink}>Create Account</Text>
            </Pressable>

          </Animated.View>

         

         

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 14,
    left: 20,
    zIndex: 2,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D8F0F2',
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#116F7A',
  },

  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#116F7A',
  },

  decorTopRight: {
    position: 'absolute',
    top: -72,
    right: -64,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#3D929B',
    pointerEvents: 'none',
  },

  decorBottomLeft: {
    position: 'absolute',
    bottom: -46,
    left: -58,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#3D929B',
    pointerEvents: 'none',
  },

  scrollContent: {
    flexGrow: 1,

    paddingHorizontal: 20,

    paddingTop: 20,
    paddingBottom: 20,

    justifyContent: 'center',
  },

  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  logoImage: {
    width: 48,
    height: 48,
    marginRight: 10,
  },

  logoCircle: {
    width: 72,
    height: 72,

    borderRadius: 24,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#0B4F59',

    marginBottom: 12,

    shadowColor: '#0B4F59',
    shadowOpacity: 0.20,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 5,
  },

  logoIcon: {
    fontSize: 34,
  },

  logoText: {
    fontSize: 20,

    fontWeight: '600',

    color: '#17313A',

    letterSpacing: 0,
  },

  tagline: {
    display: 'none',
  },

  card: {
    width: '100%',

    maxWidth: 420,

    alignSelf: 'center',

    paddingVertical: 30,
    paddingHorizontal: 32,

    borderRadius: 12,

    backgroundColor: '#FFFFFF',

    borderWidth: 1,
    borderColor: '#E4EAF0',

    shadowColor: '#1E2A4A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 7,
    },

    elevation: 4,
  },

  title: {
    fontSize: 20,

    fontWeight: '900',

    color: '#1E2A4A',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 8,

    marginBottom: 20,

    fontSize: 13,

    lineHeight: 19,

    color: '#6B7280',
    textAlign: 'center',
  },

  authLabel: {
    fontSize: 13,
    marginBottom: 6,
  },

  authInput: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
  },

  authPasswordRow: {
    minHeight: 44,
    borderRadius: 7,
  },

  inputGroup: {
    marginBottom: 16,
  },

  inputLabel: {
    marginBottom: 7,

    fontSize: 13,

    fontWeight: '700',

    color: '#374151',
  },

  input: {
    minHeight: 52,

    paddingHorizontal: 15,

    borderRadius: 13,

    borderWidth: 1,

    borderColor: '#D8E0E8',

    backgroundColor: '#F8FAFC',

    fontSize: 14,

    color: '#1E2A4A',
  },

  authError: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: -4,
  },

  forgotPasswordText: {
    color: '#0B4F59',
    fontSize: 12,
    fontWeight: '700',
  },

  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 12,
    paddingVertical: 4,
  },

  authNotice: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },

  loginButton: {
    minHeight: 46,

    marginTop: 5,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 6,

    backgroundColor: '#0B4F59',

    shadowColor: '#0B4F59',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 3,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  loginButtonText: {
    fontSize: 15,

    fontWeight: '800',

    color: '#FFFFFF',
  },

  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    marginBottom: 12,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E3E9EF',
  },

  registerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },

  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B4F59',
    textAlign: 'center',
  },

  createAccountButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0B4F59',
    borderRadius: 6,
  },

  footerText: {
    marginTop: 24,

    textAlign: 'center',

    fontSize: 10,

    color: '#8A94A3',
  },
});