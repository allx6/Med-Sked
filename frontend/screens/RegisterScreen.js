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
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  registerUser,
} from '../services/api';

import TextField from '../components/TextField';
import PasswordInput from '../components/PasswordInput';
import PrimaryButton from '../components/PrimaryButton';
import { getSafeUserErrorMessage } from '../utils/medicationValidation';
import { isValidEmail } from '../utils/helpers';

const medSkedLogo = require('../assets/medsked.png');

export default function RegisterScreen({
  onVerificationRequired,
  onNavigateLanding,
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [termsReadToBottom, setTermsReadToBottom] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
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

  const openTerms = () => {
    setTermsReadToBottom(false);
    setTermsVisible(true);
  };

  const handleTermsScroll = ({ nativeEvent }) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) {
      setTermsReadToBottom(true);
    }
  };


  // =====================================================
  // REGISTER
  // =====================================================

  const handleRegister = async () => {
    const nextErrors = {};
    setAuthError('');

    if (!name.trim()) {
      nextErrors.name = 'Please enter your name.';
      setErrors(nextErrors);
      Alert.alert(
        'Missing Name',
        'Please enter your name.'
      );
      return;
    }


    if (!email.trim()) {
      nextErrors.email = 'Please enter your email.';
      setErrors(nextErrors);
      Alert.alert(
        'Missing Email',
        'Please enter your email.'
      );
      return;
    }

    if (!isValidEmail(email.trim())) {
      nextErrors.email = 'Please enter a valid email address.';
      setErrors(nextErrors);
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
      );
      return;
    }


    if (!password) {
      nextErrors.password = 'Please enter a password.';
      setErrors(nextErrors);
      Alert.alert(
        'Missing Password',
        'Please enter a password.'
      );
      return;
    }


    if (/\s/.test(password)) {
      nextErrors.password = 'Password cannot contain spaces.';
      setErrors(nextErrors);
      Alert.alert(
        'Invalid Password',
        'Password cannot contain spaces.'
      );
      return;
    }


    if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
      setErrors(nextErrors);
      Alert.alert(
        'Weak Password',
        'Password must be at least 6 characters.'
      );
      return;
    }


    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
      setErrors(nextErrors);
      Alert.alert(
        'Passwords Do Not Match',
        'Please make sure both passwords are the same.'
      );
      return;
    }

    if (!termsAccepted) {
      nextErrors.termsAccepted = 'You must agree to the MedSked Terms & Conditions to create an account.';
      setErrors(nextErrors);
      return;
    }

    setErrors(nextErrors);


    try {

      setLoading(true);


      const result = await registerUser(
        name.trim(),
        email.trim(),
        password,
        role,
        termsAccepted
      );

      if (result.verificationRequired) {
        onVerificationRequired(
          email.trim().toLowerCase(),
          result.message,
          60
        );
        return;
      }

      throw new Error('Unable to create your account. Please try again.');

    } catch (error) {
      if (error.responseData?.verificationRequired) {
        onVerificationRequired(
          email.trim().toLowerCase(),
          error.message
        );
        return;
      }

      const message = getSafeUserErrorMessage(
        error,
        'Unable to create your account.'
      );

      setAuthError(message);
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

          {/* =================================================
              BACKGROUND
          ================================================= */}

          <View
            style={styles.backgroundCircleOne}
          />

          <View
            style={styles.backgroundCircleTwo}
          />

          <Animated.View style={[styles.content, entranceStyle]}>

          {/* =================================================
              TOP
          ================================================= */}

          <View style={styles.topSection}>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onNavigateLanding}
              style={styles.backButton}
              hitSlop={10}
            >
              <MaterialCommunityIcons name="arrow-left" size={25} color="#D8F0F2" />
            </Pressable>


            <View style={styles.logoCircle}>

              <Image
                accessible
                accessibilityLabel="MedSked logo"
                source={medSkedLogo}
                resizeMode="contain"
                style={styles.logoImage}
              />

            </View>


            <Text style={styles.logoText}>
              Create Account
            </Text>


            <Text style={styles.tagline}>
              Start managing your medications
              with MedSked.
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
              Create your MedSked account below.
            </Text>


            {/* =================================================
                NAME
            ================================================= */}

            <TextField
              label="Username"
              value={name}
              onChangeText={(value) => {
                setName(value.replace(/\s/g, ''));
                setErrors((current) => ({ ...current, name: '' }));
                setAuthError('');
              }}
              placeholder="Enter your Username"
              error={errors.name}
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
              onChangeText={(value) => {
                setEmail(value);
                setErrors((current) => ({ ...current, email: '' }));
                setAuthError('');
              }}
              placeholder="Enter your email"
              error={errors.email}
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
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: '' }));
                setAuthError('');
              }}
              placeholder="Create a password"
              error={errors.password}
              editable={!loading}
            />


            {/* =================================================
                CONFIRM PASSWORD
            ================================================= */}

            <PasswordInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setErrors((current) => ({ ...current, confirmPassword: '' }));
                setAuthError('');
              }}
              placeholder="Enter password again"
              error={errors.confirmPassword}
              editable={!loading}
            />

            <View style={styles.termsGroup}>
              <View style={styles.termsAgreementRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: termsAccepted }}
                  onPress={() => {
                    const nextAccepted = !termsAccepted;
                    setTermsAccepted(nextAccepted);
                    setErrors((current) => ({ ...current, termsAccepted: '' }));
                    if (nextAccepted) {
                      openTerms();
                    }
                  }}
                  disabled={loading}
                  style={styles.termsCheckboxRow}
                >
                  <MaterialCommunityIcons
                    name={termsAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={termsAccepted ? '#0B4F59' : '#6B7280'}
                  />
                  <Text style={styles.termsCheckboxText}>I agree to the MedSked</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={openTerms}
                  disabled={loading}
                  style={styles.termsLinkButton}
                >
                  <Text style={styles.termsLink}>Terms &amp; Conditions</Text>
                </Pressable>
              </View>
              {errors.termsAccepted ? (
                <Text style={styles.termsError}>{errors.termsAccepted}</Text>
              ) : null}
            </View>

            {authError ? (
              <Text style={styles.authError}>{authError}</Text>
            ) : null}

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
            MedSked • Medication Management
          </Text>

          </Animated.View>

        </ScrollView>

      </KeyboardAvoidingView>

      <Modal
        visible={termsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (termsReadToBottom) {
            setTermsVisible(false);
          }
        }}
      >
        <View style={styles.termsModal}>
          <View style={styles.termsModalHeader}>
            <Text style={styles.termsModalTitle}>MedSked Terms &amp; Conditions</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Terms & Conditions"
              accessibilityState={{ disabled: !termsReadToBottom }}
              disabled={!termsReadToBottom}
              onPress={() => setTermsVisible(false)}
              style={!termsReadToBottom && styles.termsCloseDisabled}
              hitSlop={10}
            >
              <MaterialCommunityIcons name="close" size={26} color="#1E2A4A" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.termsScroll}
            contentContainerStyle={styles.termsScrollContent}
            showsVerticalScrollIndicator
            onScroll={handleTermsScroll}
            scrollEventThrottle={16}
          >
            <Text style={styles.termsDocument}>
              {`MedSked Terms & Conditions

Welcome to MedSked — Medication Management & Adherence Support System.

These Terms & Conditions govern your use of MedSked, including its website and mobile application. By creating an account or using MedSked, you acknowledge that you have read, understood, and agreed to these Terms & Conditions.

1. Purpose of MedSked

MedSked is designed to help users organize and manage medication-related information, schedules, reminders, dose records, adherence information, and refill-related information.

MedSked may also provide features that allow authorized caregivers or family members to assist with medication management and monitoring.

MedSked is intended as a medication management and adherence support tool.

2. Not a Medical Service

MedSked does not provide medical diagnosis, treatment, prescribing, or professional medical advice.

MedSked does not replace a doctor, pharmacist, nurse, or other qualified healthcare professional.

Users should consult an appropriate healthcare professional regarding their medications, dosages, treatment decisions, medical conditions, or other health concerns.

MedSked does not independently determine whether a medication or dosage is medically appropriate.

3. Medication Information

Users are responsible for ensuring that the medication information they enter into MedSked is accurate and up to date.

This may include medication names, dosage information, medication schedules, start and expiration dates, dose records, and refill information.

Users should verify medication information against their prescription, medication label, or healthcare professional's instructions.

MedSked should not be used as the sole source of information for making medical decisions.

4. User Accounts

Users are responsible for providing accurate information when creating an account.

Users are responsible for maintaining the confidentiality of their account credentials and for activities performed through their account.

Users should not share their password, verification codes, or other authentication information with unauthorized individuals.

5. Caregiver Access

MedSked may allow a patient to establish a connection with an authorized caregiver or family member.

A caregiver's access to patient information is determined by the permissions and relationship established within MedSked.

Users should only grant caregiver access to individuals they trust.

Caregivers must only access and use patient information for legitimate medication-management and support purposes.

6. Privacy and Personal Information

MedSked may process information provided by users in connection with their accounts and medication-management activities.

This may include account information, medication information, schedules, dose records, caregiver relationships, and related system activity.

MedSked is designed to apply security measures to protect stored information and restrict access according to user roles and permissions.

Users should avoid entering information that is unnecessary for the intended use of the system.

7. Notifications and Reminders

MedSked may provide medication reminders, dose-related notifications, caregiver notifications, and other system notifications.

Notifications may be affected by device settings, Internet connectivity, application availability, operating-system restrictions, server interruptions, or other technical factors.

Users should not rely solely on MedSked notifications to take medication.

8. Accuracy and Availability

MedSked is provided as a medication-management support system.

While reasonable efforts may be made to maintain accurate information and system availability, MedSked does not guarantee that the system will always be available, uninterrupted, error-free, or completely accurate.

Users remain responsible for verifying important medication information.

9. Appropriate Use

Users agree to use MedSked only for its intended purposes.

Users must not:
- Attempt to access another user's account without authorization.
- Circumvent system security or access controls.
- Misuse caregiver permissions.
- Enter intentionally misleading information.
- Attempt to disrupt or damage the system.
- Use the system for unlawful activities.

10. Account and Access Restrictions

MedSked administrators may restrict, suspend, or deactivate an account when necessary to protect the system, users, or the security of the service, including cases involving suspected misuse or unauthorized access.

11. Changes to MedSked

MedSked may be updated or modified to improve functionality, security, usability, or system performance.

These changes may include modifications to existing features or the addition or removal of features.

Updated Terms & Conditions may be presented to users when necessary.

12. Acceptance

By selecting "I Agree" and creating a MedSked account, you confirm that:
- You have read and understood these Terms & Conditions.
- You agree to follow these Terms & Conditions.
- You understand that MedSked is a medication-management support system and not a replacement for professional medical advice.
- You understand that you are responsible for the accuracy of information you provide to MedSked.

If you do not agree to these Terms & Conditions, you should not create or use a MedSked account.`}
            </Text>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !termsReadToBottom }}
            disabled={!termsReadToBottom}
            onPress={() => setTermsVisible(false)}
            style={[
              styles.termsCloseButton,
              !termsReadToBottom && styles.termsCloseButtonDisabled,
            ]}
          >
            <Text style={styles.termsCloseButtonText}>Close</Text>
          </Pressable>
        </View>
      </Modal>

    </View>
  );
}


// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#116F7A',
  },

  container: {
    flex: 1,
    backgroundColor: '#116F7A',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    justifyContent: 'center',
  },

  content: {
    width: '100%',
  },

  backgroundCircleOne: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#3D929B',
    top: -110,
    right: -90,
  },

  backgroundCircleTwo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#3D929B',
    bottom: -70,
    left: -70,
  },

  topSection: {
    alignItems: 'center',
    marginBottom: 14,
  },

  backButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    justifyContent: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },

  logoCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  logoImage: {
    width: 50,
    height: 50,
    borderRadius: 32,
  },

  logoIcon: {
    fontSize: 29,
  },

  logoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  tagline: {
    maxWidth: 280,
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#A7CDD0',
  },

  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 20,
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
    fontSize: 19,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  subtitle: {
    marginTop: 5,
    marginBottom: 15,
    fontSize: 12,
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
    minHeight: 64,
    padding: 10,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D8E0E8',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
  },

  roleOptionSelected: {
    borderColor: '#0B4F59',
    backgroundColor: '#EAF4FA',
  },

  roleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 4,
  },

  roleTitleSelected: {
    color: '#0B4F59',
  },

  roleDescription: {
    fontSize: 10,
    color: '#6B7280',
  },

  authError: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: -4,
  },

  termsGroup: {
    marginTop: 2,
    marginBottom: 14,
  },

  termsAgreementRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  termsCheckboxRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },

  termsCheckboxText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#374151',
  },

  termsLinkButton: {
    marginLeft: 6,
    minHeight: 36,
    justifyContent: 'center',
  },

  termsLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B4F59',
    textDecorationLine: 'underline',
  },

  termsError: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#B42318',
  },

  termsModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'web' ? 18 : 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  termsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E4EAF0',
  },

  termsModalTitle: {
    flex: 1,
    marginRight: 12,
    fontSize: 19,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  termsScroll: {
    flex: 1,
  },

  termsScrollContent: {
    paddingVertical: 16,
  },

  termsDocument: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },

  termsCloseButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#0B4F59',
  },

  termsCloseButtonDisabled: {
    opacity: 0.45,
  },

  termsCloseDisabled: {
    opacity: 0.4,
  },

  termsCloseButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  registerButton: {
    minHeight: 44,
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

  registerButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
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
    color: '#0B4F59',
  },

  footerText: {
    marginTop: 22,
    textAlign: 'center',
    fontSize: 10,
    color: '#8A94A3',
  },

});