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
  registerUser,
} from '../services/api';

import TextField from '../components/TextField';
import PasswordInput from '../components/PasswordInput';
import PrimaryButton from '../components/PrimaryButton';

export default function RegisterScreen({
  onRegister,
  onNavigateLogin,
}) {

  // =====================================================
  // FORM STATE
  // =====================================================

  const [name, setName] = useState('');

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [role, setRole] = useState('patient');

  const [loading, setLoading] = useState(false);


  // =====================================================
  // REGISTER
  // =====================================================

  const handleRegister = async () => {

    if (!name.trim()) {
      Alert.alert(
        'Missing Name',
        'Please enter your name.'
      );
      return;
    }


    if (!email.trim()) {
      Alert.alert(
        'Missing Email',
        'Please enter your email.'
      );
      return;
    }


    if (!password) {
      Alert.alert(
        'Missing Password',
        'Please enter a password.'
      );
      return;
    }


    if (password.length < 6) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 6 characters.'
      );
      return;
    }


    if (password !== confirmPassword) {
      Alert.alert(
        'Passwords Do Not Match',
        'Please make sure both passwords are the same.'
      );
      return;
    }


    try {

      setLoading(true);


      const result = await registerUser(
        name.trim(),
        email.trim(),
        password,
        role
      );


      const registeredUser =
        result.user || result;

      const token =
        result.token || '';


      onRegister(
        registeredUser,
        token
      );


    } catch (error) {

      Alert.alert(
        'Registration Failed',
        error.message ||
          'Unable to create your account.'
      );

    } finally {

      setLoading(false);

    }

  };


  // =====================================================
  // RENDER
  // =====================================================

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

          {/* =================================================
              BACKGROUND
          ================================================= */}

          <View
            style={styles.backgroundCircleOne}
          />

          <View
            style={styles.backgroundCircleTwo}
          />


          {/* =================================================
              TOP
          ================================================= */}

          <View style={styles.topSection}>

            <Pressable
              onPress={onNavigateLogin}
              style={styles.backButton}
              hitSlop={10}
            >

              <Text style={styles.backText}>
                ← Back to Login
              </Text>

            </Pressable>


            <View style={styles.logoCircle}>

              <Text style={styles.logoIcon}>
                💊
              </Text>

            </View>


            <Text style={styles.logoText}>
              Create Account
            </Text>


            <Text style={styles.tagline}>
              Start managing your medications
              with MediSked.
            </Text>

          </View>


          {/* =================================================
              FORM CARD
          ================================================= */}

          <View style={styles.card}>

            <Text style={styles.title}>
              Get started
            </Text>


            <Text style={styles.subtitle}>
              Create your MediSked account below.
            </Text>


            {/* =================================================
                NAME
            ================================================= */}

            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Choose a name"
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />


            {/* =================================================
                EMAIL
            ================================================= */}

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />


            {/* =================================================
                ACCOUNT TYPE
            ================================================= */}

            <View style={styles.inputGroup}>

              <Text style={styles.inputLabel}>
                Account Type
              </Text>


              <View style={styles.roleContainer}>

                {/* PATIENT */}

                <Pressable
                  style={[
                    styles.roleOption,

                    role === 'patient' &&
                      styles.roleOptionSelected,
                  ]}

                  onPress={() =>
                    setRole('patient')
                  }

                  disabled={loading}
                >

                  <Text
                    style={[
                      styles.roleTitle,

                      role === 'patient' &&
                        styles.roleTitleSelected,
                    ]}
                  >
                    Patient
                  </Text>

                  <Text style={styles.roleDescription}>
                    Manage my medications
                  </Text>

                </Pressable>


                {/* CAREGIVER */}

                <Pressable
                  style={[
                    styles.roleOption,

                    role === 'caregiver' &&
                      styles.roleOptionSelected,
                  ]}

                  onPress={() =>
                    setRole('caregiver')
                  }

                  disabled={loading}
                >

                  <Text
                    style={[
                      styles.roleTitle,

                      role === 'caregiver' &&
                        styles.roleTitleSelected,
                    ]}
                  >
                    Caregiver
                  </Text>

                  <Text style={styles.roleDescription}>
                    Help manage a patient
                  </Text>

                </Pressable>

              </View>

            </View>


            {/* =================================================
                PASSWORD
            ================================================= */}

            <PasswordInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              editable={!loading}
            />


            {/* =================================================
                CONFIRM PASSWORD
            ================================================= */}

            <PasswordInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Enter password again"
              editable={!loading}
            />


            {/* =================================================
                REGISTER BUTTON
            ================================================= */}

            <PrimaryButton
              label="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={styles.registerButton}
            />


            {/* =================================================
                LOGIN
            ================================================= */}

            <View style={styles.loginRow}>

              <Text style={styles.loginText}>
                Already have an account?
              </Text>

              <Pressable
                onPress={onNavigateLogin}
                hitSlop={8}
              >

                <Text style={styles.loginLink}>
                  Sign In
                </Text>

              </Pressable>

            </View>

          </View>


          {/* =================================================
              FOOTER
          ================================================= */}

          <Text style={styles.footerText}>
            MediSked • Medication Management
          </Text>

        </ScrollView>

      </KeyboardAvoidingView>

    </View>
  );
}


// =====================================================
// STYLES
// =====================================================

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
    paddingTop: 20,
    paddingBottom: 30,
    justifyContent: 'center',
  },

  backgroundCircleOne: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#DCECF5',
    top: -110,
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

  topSection: {
    alignItems: 'center',
    marginBottom: 22,
  },

  backButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    justifyContent: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },

  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2F6690',
  },

  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F6690',
    marginBottom: 11,
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
    fontSize: 29,
  },

  logoText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  tagline: {
    maxWidth: 280,
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
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
    fontSize: 23,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  subtitle: {
    marginTop: 5,
    marginBottom: 20,
    fontSize: 13,
    color: '#6B7280',
  },

  inputGroup: {
    marginBottom: 15,
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

  roleContainer: {
    flexDirection: 'row',
    gap: 10,
  },

  roleOption: {
    flex: 1,
    minHeight: 78,
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D8E0E8',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
  },

  roleOptionSelected: {
    borderColor: '#2F6690',
    backgroundColor: '#EAF4FA',
  },

  roleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 4,
  },

  roleTitleSelected: {
    color: '#2F6690',
  },

  roleDescription: {
    fontSize: 10,
    color: '#6B7280',
  },

  registerButton: {
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

  registerButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    flexWrap: 'wrap',
  },

  loginText: {
    fontSize: 12,
    color: '#6B7280',
  },

  loginLink: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '800',
    color: '#2F6690',
  },

  footerText: {
    marginTop: 22,
    textAlign: 'center',
    fontSize: 10,
    color: '#8A94A3',
  },

});