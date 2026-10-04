import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  View,
  StyleSheet,
} from 'react-native';

import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import LandingScreen from './screens/LandingScreen';
import HowItWorksScreen from './screens/HowItWorksScreen';

import DashboardScreen from './screens/DashboardScreen';
import MedicationsScreen from './screens/MedicationsScreen';
import AddMedicationScreen from './screens/AddMedicationScreen';
import EditMedicationScreen from './screens/EditMedicationScreen';

import ScheduleScreen from './screens/ScheduleScreen';
import AddScheduleScreen from './screens/AddScheduleScreen';
import EditScheduleScreen from './screens/EditScheduleScreen';

import CaregiverDashboardScreen from './screens/CaregiverDashboardScreen';
import CaregiverPatientsScreen from './screens/CaregiverPatientsScreen';
import CaregiverConnectionsScreen from './screens/CaregiverConnectionsScreen';
import PatientConnectionsScreen from './screens/PatientConnectionsScreen';
import PatientCaregiverRequestsScreen from './screens/PatientCaregiverRequestsScreen';
import PatientMonitoringScreen from './screens/PatientMonitoringScreen';
import ProfileScreen from './screens/ProfileScreen';
import AIAssistantScreen from './screens/AIAssistantScreen';

import DoseHistoryScreen from './screens/DoseHistoryScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';

import BottomNavigation from './components/BottomNavigation';
import CaregiverBottomNavigation from './components/CaregiverBottomNavigation';
import { colors } from './theme';
import { getUnreadNotificationCount } from './services/api';

export default function App() {

  // =====================================================
  // CURRENT SCREEN
  // =====================================================

  const [screen, setScreen] = useState('landing');


  // =====================================================
  // USER
  // =====================================================

  const [user, setUser] = useState(null);

  const [token, setToken] = useState('');
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const unreadCountRequestRef = useRef(0);

  const refreshUnreadNotificationCount = useCallback(async () => {
    if (!token) {
      return;
    }

    const requestId = unreadCountRequestRef.current + 1;
    unreadCountRequestRef.current = requestId;

    try {
      const result = await getUnreadNotificationCount(token);
      if (unreadCountRequestRef.current === requestId) {
        setUnreadNotificationCount(Number(result?.count) || 0);
      }
    } catch (error) {
      // Keep the last known count when the API is temporarily unavailable.
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      unreadCountRequestRef.current += 1;
      setUnreadNotificationCount(0);
      return;
    }

    if (['profile', 'caregiverProfile', 'notifications'].includes(screen)) {
      refreshUnreadNotificationCount();
    }
  }, [token, screen, refreshUnreadNotificationCount]);


  // =====================================================
  // SELECTED MEDICATION
  // =====================================================

  const [selectedMedication, setSelectedMedication] =
    useState(null);


  // =====================================================
  // SELECTED SCHEDULE
  // =====================================================

  const [selectedSchedule, setSelectedSchedule] =
    useState(null);

  const [selectedPatient, setSelectedPatient] =
    useState(null);

  const [caregiverMedication, setCaregiverMedication] = useState(null);
  const [caregiverSchedule, setCaregiverSchedule] = useState(null);

  const [analyticsPatientId, setAnalyticsPatientId] =
    useState(null);

  // =====================================================
  // LOGIN
  // =====================================================

  function handleLogin(loggedInUser, loggedInToken) {

    setUser(loggedInUser);

    setToken(loggedInToken);


    // -----------------------------------------------------
    // ROLE-BASED REDIRECT
    // -----------------------------------------------------

    if (
      loggedInUser?.role === 'caregiver'
    ) {

      setScreen('caregiverDashboard');

    } else {

      setScreen('dashboard');

    }
  }


  // =====================================================
  // REGISTER
  // =====================================================

  function handleRegister(
    registeredUser,
    registeredToken
  ) {

    setUser(registeredUser);

    setToken(registeredToken);


    // -----------------------------------------------------
    // ROLE-BASED REDIRECT
    // -----------------------------------------------------

    if (
      registeredUser?.role === 'caregiver'
    ) {

      setScreen('caregiverDashboard');

    } else {

      setScreen('dashboard');

    }
  }


  // =====================================================
  // LOGOUT
  // =====================================================

  function handleLogout() {

    setUser(null);

    setToken('');
    setUnreadNotificationCount(0);

    setSelectedMedication(null);

    setSelectedSchedule(null);

    setSelectedPatient(null);
    setAnalyticsPatientId(null);

    setScreen('login');
  }


  // =====================================================
  // EDIT MEDICATION
  // =====================================================

  function handleEditMedication(medication) {

    setSelectedMedication(medication);

    setScreen('editMedication');
  }


  // =====================================================
  // MEDICATION UPDATED
  // =====================================================

  function handleMedicationUpdated() {

    setSelectedMedication(null);

    setScreen('medications');
  }


  // =====================================================
  // OPEN ADD MEDICATION
  // =====================================================

  function handleAddMedication() {

    setScreen('addMedication');
  }


  // =====================================================
  // OPEN MEDICATIONS
  // =====================================================

  function handleOpenMedications() {

    setScreen('medications');
  }


  // =====================================================
  // OPEN SCHEDULES
  // =====================================================

  function handleScheduleMedication() {

    setScreen('schedules');
  }


  // =====================================================
  // OPEN ADD SCHEDULE
  // =====================================================

  function handleAddSchedule() {

    setScreen('addSchedule');
  }


  // =====================================================
  // AFTER SCHEDULE CREATED
  // =====================================================

  function handleScheduleAdded() {

    setScreen('schedules');
  }


  // =====================================================
  // OPEN EDIT SCHEDULE
  // =====================================================

  function handleEditSchedule(schedule) {

    setSelectedSchedule(schedule);

    setScreen('editSchedule');
  }


  // =====================================================
  // AFTER SCHEDULE UPDATED
  // =====================================================

  function handleScheduleUpdated() {

    setSelectedSchedule(null);

    setScreen('schedules');
  }


  // =====================================================
  // OPEN DOSE HISTORY
  // =====================================================

  function handleDoseHistory() {

    setScreen('doseHistory');
  }


  function handlePatientConnections() {
    setScreen('patientConnections');
  }

  function handlePatientCaregiverRequests() {
    setScreen('patientCaregiverRequests');
  }


  function handleCaregiverConnections() {
    setScreen('caregiverConnections');
  }

  function handleCaregiverPatients() {
    setScreen('caregiverPatients');
  }

  function handleCaregiverProfile() {
    setScreen('caregiverProfile');
  }

  function handleNotifications() {
    setScreen('notifications');
  }

  function handleAnalytics(patientId = null) {
    setAnalyticsPatientId(patientId);
    setScreen('analytics');
  }


  function handleSelectPatient(patient) {
    setSelectedPatient(patient);
    setScreen('patientMonitoring');
  }

  function handleCaregiverAddMedication() {
    setScreen('caregiverAddMedication');
  }

  function handleCaregiverEditMedication(medication) {
    setCaregiverMedication(medication);
    setScreen('caregiverEditMedication');
  }

  function handleCaregiverAddSchedule() {
    setScreen('caregiverAddSchedule');
  }

  function handleCaregiverEditSchedule(schedule) {
    setCaregiverSchedule(schedule);
    setScreen('caregiverEditSchedule');
  }


  function handleBackToDashboard() {
    setSelectedPatient(null);
    setScreen(user?.role === 'caregiver' ? 'caregiverDashboard' : 'dashboard');
  }


  // =====================================================
  // MAIN PATIENT NAVIGATION
  // =====================================================

  const showBottomNavigation =
    user &&
    user.role !== 'caregiver' &&
    (
      screen === 'dashboard' ||
      screen === 'medications' ||
      screen === 'schedules' ||
      screen === 'doseHistory' ||
      screen === 'profile'
    );

  const showCaregiverBottomNavigation =
    user &&
    user.role === 'caregiver' &&
    (
      screen === 'caregiverDashboard' ||
      screen === 'caregiverPatients' ||
      screen === 'caregiverConnections' ||
      screen === 'caregiverProfile'
    );


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <SafeAreaProvider>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.container}
      >

      {screen === 'landing' && !user && (
        <LandingScreen
          onSignIn={() => setScreen('login')}
          onGetStarted={() => setScreen('register')}
          onHowItWorks={() => setScreen('howItWorks')}
        />
      )}

      {screen === 'howItWorks' && !user && (
        <HowItWorksScreen
          onBack={() => setScreen('landing')}
        />
      )}

      {/* =================================================
          LOGIN
      ================================================= */}

      {screen === 'login' && (

        <LoginScreen
          onLogin={handleLogin}
          onNavigateLanding={() => setScreen('landing')}

          onNavigateRegister={() =>
            setScreen('register')
          }
        />

      )}


      {/* =================================================
          REGISTER
      ================================================= */}

      {screen === 'register' && (

        <RegisterScreen
          onRegister={handleRegister}
          onNavigateLanding={() => setScreen('landing')}

          onNavigateLogin={() =>
            setScreen('login')
          }
        />

      )}


      {/* =================================================
          PATIENT DASHBOARD
      ================================================= */}

      {screen === 'dashboard' &&
        user &&
        user.role !== 'caregiver' &&
        user.role !== 'admin' && (

          <DashboardScreen

            username={
              user.username
            }

            token={token}

            onLogout={
              handleLogout
            }

            onAddMedication={
              handleAddMedication
            }

            onEditMedication={
              handleEditMedication
            }

            onScheduleMedication={
              handleScheduleMedication
            }

            onDoseHistory={
              handleDoseHistory
            }

            onCaregiverConnections={
              handlePatientCaregiverRequests
            }

            onOpenAiAssistant={() => setScreen('aiAssistant')}

          />

        )}

      {/* =================================================
          CAREGIVER DASHBOARD
      ================================================= */}

      {screen === 'caregiverDashboard' &&
        user &&
        user.role === 'caregiver' && (

          <CaregiverDashboardScreen

            user={user}

            username={user.username}

            token={token}

            onLogout={
              handleLogout
            }

            onManageConnections={
              handleCaregiverConnections
            }

            onSelectPatient={
              handleSelectPatient
            }

          />

        )}

      {screen === 'caregiverPatients' &&
        user &&
        user.role === 'caregiver' && (

          <CaregiverPatientsScreen
            token={token}
            onSelectPatient={handleSelectPatient}
            onOpenConnections={handleCaregiverConnections}
          />

        )}

      {screen === 'caregiverConnections' &&
        user &&
        user.role === 'caregiver' && (

          <CaregiverConnectionsScreen

            token={token}

            onOpenPatientMonitoring={
              handleSelectPatient
            }

          />

        )}

      {screen === 'caregiverProfile' &&
        user &&
        user.role === 'caregiver' && (
          <ProfileScreen
            user={user}
            unreadNotificationCount={unreadNotificationCount}
            onOpenNotifications={handleNotifications}
            onLogout={handleLogout}
          />
        )}

      {screen === 'patientMonitoring' &&
        user &&
        user.role === 'caregiver' &&
        selectedPatient && (

          <PatientMonitoringScreen

            token={token}

            patient={selectedPatient}

            onOpenAnalytics={() => handleAnalytics(selectedPatient?._id)}
            onOpenAiAssistant={() => setScreen('aiAssistant')}
            onAddMedication={handleCaregiverAddMedication}
            onEditMedication={handleCaregiverEditMedication}
            onAddSchedule={handleCaregiverAddSchedule}
            onEditSchedule={handleCaregiverEditSchedule}
            onReturnFromMutation={() => setScreen('patientMonitoring')}

            onBack={handleBackToDashboard}

          />

        )}

      {screen === 'caregiverAddMedication' && user?.role === 'caregiver' && selectedPatient && (
        <AddMedicationScreen
          token={token}
          patientId={selectedPatient._id}
          onMedicationAdded={() => setScreen('patientMonitoring')}
          onCancel={() => setScreen('patientMonitoring')}
        />
      )}

      {screen === 'caregiverEditMedication' && user?.role === 'caregiver' && selectedPatient && caregiverMedication && (
        <EditMedicationScreen
          token={token}
          patientId={selectedPatient._id}
          medication={caregiverMedication}
          onMedicationUpdated={() => setScreen('patientMonitoring')}
          onCancel={() => setScreen('patientMonitoring')}
        />
      )}

      {screen === 'caregiverAddSchedule' && user?.role === 'caregiver' && selectedPatient && (
        <AddScheduleScreen
          token={token}
          patientId={selectedPatient._id}
          onScheduleAdded={() => setScreen('patientMonitoring')}
          onCancel={() => setScreen('patientMonitoring')}
        />
      )}

      {screen === 'caregiverEditSchedule' && user?.role === 'caregiver' && selectedPatient && caregiverSchedule && (
        <EditScheduleScreen
          token={token}
          patientId={selectedPatient._id}
          schedule={caregiverSchedule}
          autoReturnOnSuccess
          onScheduleUpdated={() => setScreen('patientMonitoring')}
          onCancel={() => setScreen('patientMonitoring')}
        />
      )}


      {/* =================================================
          MEDICATIONS
      ================================================= */}

      {screen === 'medications' &&
        user &&
        user.role !== 'caregiver' && (

          <MedicationsScreen

            token={token}

            onAddMedication={
              handleAddMedication
            }

            onEditMedication={
              handleEditMedication
            }

          />

        )}


      {/* =================================================
          ADD MEDICATION
      ================================================= */}

      {screen === 'addMedication' &&
        user &&
        user.role !== 'caregiver' && (

          <AddMedicationScreen

            token={token}

            onMedicationAdded={() =>
              setScreen('medications')
            }

            onCancel={() =>
              setScreen('medications')
            }

          />

        )}


      {/* =================================================
          EDIT MEDICATION
      ================================================= */}

      {screen === 'editMedication' &&
        user &&
        user.role !== 'caregiver' &&
        selectedMedication && (

          <EditMedicationScreen

            medication={
              selectedMedication
            }

            token={token}

            onMedicationUpdated={
              handleMedicationUpdated
            }

            onCancel={() => {

              setSelectedMedication(null);

              setScreen('medications');

            }}

          />

        )}


      {/* =================================================
          SCHEDULES
      ================================================= */}

      {screen === 'schedules' &&
        user &&
        user.role !== 'caregiver' && (

          <ScheduleScreen

            token={token}

            onAddSchedule={
              handleAddSchedule
            }

            onEditSchedule={
              handleEditSchedule
            }

          />

        )}


      {/* =================================================
          ADD SCHEDULE
      ================================================= */}

      {screen === 'addSchedule' &&
        user &&
        user.role !== 'caregiver' && (

          <AddScheduleScreen

            token={token}
            autoReturnOnSuccess

            onScheduleAdded={
              handleScheduleAdded
            }

            onCancel={() =>
              setScreen('schedules')
            }

          />

        )}


      {/* =================================================
          EDIT SCHEDULE
      ================================================= */}

      {screen === 'editSchedule' &&
        user &&
        user.role !== 'caregiver' &&
        selectedSchedule && (

          <EditScheduleScreen

            token={token}
            autoReturnOnSuccess

            schedule={
              selectedSchedule
            }

            onScheduleUpdated={
              handleScheduleUpdated
            }

            onCancel={() => {

              setSelectedSchedule(null);

              setScreen('schedules');

            }}

          />

        )}


      {/* =================================================
          DOSE HISTORY
      ================================================= */}

      {screen === 'doseHistory' &&
        user &&
        user.role !== 'caregiver' && (

          <DoseHistoryScreen

            token={token}

          />

        )}


      {/* =================================================
          PATIENT CAREGIVER CONNECTIONS
      ================================================= */}

      {screen === 'patientConnections' &&
        user &&
        user.role !== 'caregiver' && (

          <PatientConnectionsScreen

            token={token}
            onBack={() => setScreen('profile')}

          />

        )}

      {screen === 'patientCaregiverRequests' &&
        user &&
        user.role !== 'caregiver' && (
          <PatientCaregiverRequestsScreen
            token={token}
            onBack={() => setScreen('profile')}
          />
        )}

      {screen === 'profile' &&
        user &&
        user.role !== 'caregiver' && (
          <ProfileScreen
            user={user}
            token={token}
            unreadNotificationCount={unreadNotificationCount}
            onOpenNotifications={handleNotifications}
            onOpenAnalytics={() => handleAnalytics()}
            onLogout={handleLogout}
            onOpenCaregiverRequests={handlePatientCaregiverRequests}
            onOpenPatientConnections={handlePatientConnections}
          />
        )}

      {screen === 'notifications' &&
        user && (
          <NotificationsScreen
            token={token}
            unreadNotificationCount={unreadNotificationCount}
            onUnreadCountChange={refreshUnreadNotificationCount}
            onBack={() => setScreen(user.role === 'caregiver' ? 'caregiverProfile' : 'profile')}
          />
        )}

      {screen === 'analytics' &&
        user && (
          <AnalyticsScreen
            token={token}
            patientId={analyticsPatientId}
            onBack={user.role === 'caregiver' ? () => setScreen('patientMonitoring') : () => setScreen('profile')}
          />
        )}

      {screen === 'aiAssistant' &&
        user && (
          <AIAssistantScreen
            token={token}
            userRole={user.role}
            patientId={user.role === 'caregiver' ? selectedPatient?._id : null}
            onBack={user.role === 'caregiver' ? () => setScreen('patientMonitoring') : () => setScreen('dashboard')}
          />
        )}


      {/* =================================================
          CAREGIVER CONNECTIONS
      ================================================= */}



      {/* =================================================
          PATIENT BOTTOM NAVIGATION
      ================================================= */}

      {showBottomNavigation && (

        <BottomNavigation

          activeScreen={screen}

          onHome={() =>
            setScreen('dashboard')
          }

          onMedications={() =>
            setScreen('medications')
          }

          onSchedules={() =>
            setScreen('schedules')
          }

          onHistory={() =>
            setScreen('doseHistory')
          }

          onProfile={() =>
            setScreen('profile')
          }

        />

      )}

      {showCaregiverBottomNavigation && (
        <CaregiverBottomNavigation
          activeScreen={screen}
          onHome={() => setScreen('caregiverDashboard')}
          onPatients={() => setScreen('caregiverPatients')}
          onConnections={() => setScreen('caregiverConnections')}
          onProfile={() => setScreen('caregiverProfile')}
        />
      )}

      </SafeAreaView>
    </SafeAreaProvider>

  );
}


// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: colors.background,

  },

});