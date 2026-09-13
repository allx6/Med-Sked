import React, { useState } from 'react';

import {
  View,
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

export default function LoginScreen({
  onLogin,
  onNavigateRegister,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert(
        'Missing Username',
        'Please enter your username.'
      );
      return;
    }

    if (!password) {
      Alert.alert(
        'Missing Password',
        'Please enter your password.'
      );
      return;
    }

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
      Alert.alert(
        'Login Failed',
        error.message ||
          'Unable to log in. Please check your credentials.'
      );
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
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* BACKGROUND DECORATION */}

          <View
            style={styles.backgroundCircleOne}
          />

          <View
            style={styles.backgroundCircleTwo}
          />

          {/* LOGO */}

          <View style={styles.logoSection}>

            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>
                💊
              </Text>
            </View>

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
              onChangeText={setUsername}
              placeholder="Enter your email"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* PASSWORD */}

            <PasswordInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              editable={!loading}
            />

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

          {/* FOOTER */}

          <Text style={styles.footerText}>
            MediSked • Medication Management
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF5FA',
  },

  container: {
    flex: 1,
    backgroundColor: '#EEF5FA',
  },

  scrollContent: {
    flexGrow: 1,

    paddingHorizontal: 20,

    paddingTop: 42,
    paddingBottom: 30,

    justifyContent: 'center',
  },

  backgroundCircleOne: {
    position: 'absolute',

    width: 240,
    height: 240,

    borderRadius: 120,

    backgroundColor: '#DCECF5',

    top: -100,
    right: -90,
  },

  backgroundCircleTwo: {
    position: 'absolute',

    width: 180,
    height: 180,

    borderRadius: 90,

    backgroundColor: '#E3F1F8',

    bottom: -70,
    left: -70,
  },

  logoSection: {
    alignItems: 'center',

    marginBottom: 25,
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