import React, { useState } from 'react';

import {
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

const medSkedLogo = require('../assets/medsked.png');

export default function LoginScreen({
  onLogin,
  onNavigateRegister,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const nextErrors = {};
    setAuthError('');

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
      const message =
        error?.message ||
        'Unable to log in. Please check your credentials.';

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
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* LOGO */}

          <View style={styles.logoSection}>

            <Image
              accessible
              accessibilityLabel="MedSked logo"
              source={medSkedLogo}
              resizeMode="contain"
              style={styles.logoImage}
            />

            <Text style={styles.logoText}>
              MedSked
            </Text>

            <Text style={styles.tagline}>
              Your medication, organized.
            </Text>

          </View>

          {/* LOGIN CARD */}

          <View style={styles.card}>

            <Text style={styles.title}>
              Welcome back
            </Text>

            <Text style={styles.subtitle}>
              Sign in to manage your medications
              and stay on schedule.
            </Text>

            {/* USERNAME */}

            <TextField
              label="Email"
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                setErrors((current) => ({ ...current, username: '' }));
                setAuthError('');
              }}
              placeholder="Enter your email"
              error={errors.username}
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
              editable={!loading}
            />

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

              <Text style={styles.registerText}>
                Don't have an account?
              </Text>

              <Pressable
                onPress={
                  onNavigateRegister
                }
              >
                <Text
                  style={
                    styles.registerLink
                  }
                >
                  Create one
                </Text>
              </Pressable>

            </View>

          </View>

         

         

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#87CEEB',
  },

  container: {
    flex: 1,
    backgroundColor: '#87CEEB',
  },

  scrollContent: {
    flexGrow: 1,

    paddingHorizontal: 20,

    paddingTop: 42,
    paddingBottom: 30,

    justifyContent: 'center',
  },

  logoSection: {
    alignItems: 'center',

    marginBottom: 22,
  },

  logoImage: {
    width: 150,
    height: 150,
    marginBottom: 4,
  },

  logoCircle: {
    width: 72,
    height: 72,

    borderRadius: 24,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#2F6690',

    marginBottom: 12,

    shadowColor: '#2F6690',
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
    fontSize: 30,

    fontWeight: '900',

    color: '#1E2A4A',

    letterSpacing: -0.5,
  },

  tagline: {
    marginTop: 4,

    fontSize: 13,

    color: '#6B7280',
  },

  card: {
    width: '100%',

    maxWidth: 520,

    alignSelf: 'center',

    padding: 22,

    borderRadius: 22,

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
    fontSize: 24,

    fontWeight: '900',

    color: '#1E2A4A',
  },

  subtitle: {
    marginTop: 6,

    marginBottom: 22,

    fontSize: 13,

    lineHeight: 19,

    color: '#6B7280',
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

  loginButton: {
    minHeight: 53,

    marginTop: 5,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 13,

    backgroundColor: '#2F6690',

    shadowColor: '#2F6690',
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

    marginTop: 20,

    flexWrap: 'wrap',
  },

  registerText: {
    fontSize: 12,

    color: '#6B7280',
  },

  registerLink: {
    marginLeft: 5,

    fontSize: 12,

    fontWeight: '800',

    color: '#2F6690',
  },

  footerText: {
    marginTop: 24,

    textAlign: 'center',

    fontSize: 10,

    color: '#8A94A3',
  },
});