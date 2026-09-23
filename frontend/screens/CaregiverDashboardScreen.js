import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';

import {
  getMyPatients,
  getCaregiverRequests,
} from '../services/api';

export default function CaregiverDashboardScreen({
  username,
  token,
  onLogout,
  onSelectPatient,
  onManageConnections,
}) {
  // =====================================================
  // STATE
  // =====================================================

  const [patients, setPatients] = useState([]);

  const [pendingRequests, setPendingRequests] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState('');

  // =====================================================
  // LOAD PATIENTS
  // =====================================================

  const loadPatients = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        const [patientData, requestData] = await Promise.all([
          getMyPatients(token),
          getCaregiverRequests(token),
        ]);

        setPatients(
          Array.isArray(patientData)
            ? patientData
            : Array.isArray(patientData?.patients)
            ? patientData.patients
            : []
        );

        setPendingRequests(
          Array.isArray(requestData)
            ? requestData.filter((request) => request?.status === 'pending' || !request?.status)
            : []
        );
      } catch (err) {
        console.error(
          'Caregiver dashboard error:',
          err
        );

        setError(
          err.message ||
            'Failed to load your patients.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // =====================================================
  // GREETING
  // =====================================================

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    }

    if (hour < 18) {
      return 'Good afternoon';
    }

    return 'Good evening';
  };

  // =====================================================
  // PATIENT COUNT
  // =====================================================

  const patientCount = patients.length;
  const pendingCount = pendingRequests.length;

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingTitle}>
          MedSked
        </Text>

        <ActivityIndicator
          size="small"
          color="#2F6690"
          style={styles.loadingIndicator}
        />

        <Text style={styles.loadingText}>
          Loading caregiver dashboard...
        </Text>
      </View>
    );
  }

  // =====================================================
  // SCREEN
  // =====================================================

  return (
    <View style={styles.container}>

      {/* BACKGROUND */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              loadPatients(true)
            }
            tintColor="#2F6690"
          />
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <View style={styles.header}>

          <View style={styles.headerText}>

            <Text style={styles.greeting}>
              {getGreeting()}
            </Text>

            <Text style={styles.username}>
              {username || 'Caregiver'} 👋
            </Text>

            <Text style={styles.subtitle}>
              Monitor and support your patients'
              medication routines.
            </Text>

          </View>

          <Pressable
            onPress={onLogout}
            hitSlop={8}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed &&
                styles.buttonPressed,
            ]}
          >
            <Text style={styles.logoutText}>
              Logout
            </Text>
          </Pressable>

        </View>

        {/* =================================================
            ERROR
        ================================================= */}

        {error ? (
          <View style={styles.errorBox}>

            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable
              onPress={() =>
                loadPatients()
              }
            >
              <Text style={styles.retryText}>
                Retry
              </Text>
            </Pressable>

          </View>
        ) : null}

        {/* =================================================
            CONNECTION MANAGEMENT
        ================================================= */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            Connection Management
          </Text>

          <Pressable
            onPress={onManageConnections}
            style={({ pressed }) => [
              styles.managementCard,
              pressed && styles.managementCardPressed,
            ]}
          >
            <View style={styles.managementContent}>
              <View>
                <Text style={styles.managementTitle}>Manage caregiver connections</Text>
                <Text style={styles.managementSubtitle}>
                  {pendingCount > 0
                    ? `${pendingCount} pending request${pendingCount === 1 ? '' : 's'} waiting for patient review.`
                    : 'Search for patients and send connection requests.'}
                </Text>
              </View>
              <Text style={styles.managementArrow}>›</Text>
            </View>
          </Pressable>

        </View>

        {/* =================================================
            OVERVIEW
        ================================================= */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            Caregiver Overview
          </Text>

          <View style={styles.summaryCard}>

            <View style={styles.summaryItem}>

              <Text
                style={styles.summaryNumber}
              >
                {patientCount}
              </Text>

              <Text style={styles.summaryLabel}>
                {patientCount === 1
                  ? 'Patient'
                  : 'Patients'}
              </Text>

            </View>

            <View
              style={styles.summaryDivider}
            />

            <View style={styles.summaryItem}>

              <Text
                style={styles.summaryNumber}
              >
                ✓
              </Text>

              <Text style={styles.summaryLabel}>
                Monitoring
              </Text>

            </View>

            <View
              style={styles.summaryDivider}
            />

            <View style={styles.summaryItem}>

              <Text
                style={styles.summaryNumber}
              >
                💊
              </Text>

              <Text style={styles.summaryLabel}>
                Medication
              </Text>

            </View>

          </View>

        </View>

        {/* =================================================
            PATIENTS
        ================================================= */}

        <View style={styles.section}>

          <View
            style={styles.sectionHeader}
          >

            <View>

              <Text
                style={styles.sectionTitle}
              >
                My Patients
              </Text>

              <Text
                style={styles.sectionSubtitle}
              >
                Select a patient to view
                their medication information.
              </Text>

            </View>

          </View>

          {patients.length === 0 ? (

            <View style={styles.emptyCard}>

              <Text style={styles.emptyIcon}>
                👥
              </Text>

              <Text style={styles.emptyTitle}>
                No patients connected
              </Text>

              <Text style={styles.emptyText}>
                You currently don't have any
                active patient relationships.
              </Text>

            </View>

          ) : (

            patients.map((patient) => {

              const patientData =
                patient.patient ||
                patient.user ||
                patient;

              const patientId =
                patientData.patientId ||
                patient.patientId ||
                patientData._id ||
                patient._id;

              const patientName =
                patientData.fullName ||
                patientData.username ||
                patientData.name ||
                'Patient';

              const patientUsername =
                patientData.username || '';

              const permission =
                patient.permission || 'VIEW_ONLY';

              return (
                <Pressable
                  key={patientId}
                  onPress={() =>
                    onSelectPatient(
                      patientData
                    )
                  }
                  style={({ pressed }) => [
                    styles.patientCard,
                    pressed &&
                      styles.patientCardPressed,
                  ]}
                >

                  <View
                    style={styles.patientIcon}
                  >
                    <Text
                      style={
                        styles.patientIconText
                      }
                    >
                      👤
                    </Text>
                  </View>

                  <View
                    style={styles.patientInfo}
                  >

                    <Text
                      style={
                        styles.patientName
                      }
                    >
                      {patientName}
                    </Text>

                    {patientId ? (
                      <Text style={styles.patientUsername}>Patient ID: {patientId}</Text>
                    ) : null}

                    {patientUsername ? (
                      <Text
                        style={
                          styles.patientUsername
                        }
                      >
                        @{patientUsername}
                      </Text>
                    ) : null}

                    <Text
                      style={
                        styles.patientStatus
                      }
                    >
                      ● Active relationship
                    </Text>

                    <Text style={styles.patientPermission}>
                      Permission: {permission === 'ADHERENCE_SUPPORT' ? 'Adherence support' : 'View only'}
                    </Text>

                  </View>

                  <Text
                    style={styles.arrow}
                  >
                    ›
                  </Text>

                </Pressable>
              );
            })

          )}

        </View>

        {/* =================================================
            INFORMATION
        ================================================= */}

        <View style={styles.section}>

          <View
            style={styles.infoCard}
          >

            <View
              style={styles.infoIcon}
            >
              <Text>ℹ️</Text>
            </View>

            <View
              style={styles.infoContent}
            >

              <Text
                style={styles.infoTitle}
              >
                Caregiver Access
              </Text>

              <Text
                style={styles.infoText}
              >
                You can view medication,
                schedule, and dose information
                for patients who have an active
                caregiver relationship with you.
              </Text>

            </View>

          </View>

        </View>

        <View style={styles.bottomSpacing} />

      </ScrollView>

    </View>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#87CEEB',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#87CEEB',
  },

  loadingLogo: {
    width: 65,
    height: 65,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#2F6690',
  },

  loadingLogoText: {
    fontSize: 30,
  },

  loadingTitle: {
    marginTop: 12,
    fontSize: 23,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  loadingIndicator: {
    marginTop: 18,
  },

  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },

  scrollContent: {
    paddingTop: 12,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E9EF',
    shadowColor: '#1E2A4A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  headerText: {
    flex: 1,
    paddingRight: 15,
  },

  greeting: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },

  username: {
    marginTop: 2,
    fontSize: 27,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },

  logoutButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4EAF0',
  },

  logoutText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },

  errorBox: {
    marginHorizontal: 20,
    marginBottom: 18,
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
  },

  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#B91C1C',
  },

  retryText: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },

  section: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 11,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  sectionSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: '#7A8494',
    lineHeight: 16,
  },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 94,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E9EF',
    shadowColor: '#1E2A4A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  managementCard: {
    padding: 16,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1E2A4A',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  managementCardPressed: {
    opacity: 0.82,
  },

  managementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  managementTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '900',
  },

  managementSubtitle: {
    maxWidth: 285,
    marginTop: 5,
    color: '#000000',
    fontSize: 11,
    lineHeight: 16,
  },

  managementArrow: {
    marginLeft: 10,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
  },

  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryNumber: {
    fontSize: 23,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  summaryLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#7A8494',
    textAlign: 'center',
  },

  summaryDivider: {
    width: 1,
    height: 42,
    backgroundColor: '#E5EAF0',
  },

  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 15,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E9EF',
    shadowColor: '#1E2A4A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 1,
  },

  patientCardPressed: {
    opacity: 0.75,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  patientIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#EAF3F9',
  },

  patientIconText: {
    fontSize: 22,
  },

  patientInfo: {
    flex: 1,
    marginLeft: 12,
  },

  patientName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  patientUsername: {
    marginTop: 2,
    fontSize: 10,
    color: '#7A8494',
  },

  patientStatus: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: '700',
    color: '#2F6690',
  },

  patientPermission: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
  },

  arrow: {
    marginLeft: 8,
    fontSize: 28,
    fontWeight: '300',
    color: '#9AA3AF',
  },

  emptyCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E9EF',
  },

  emptyIcon: {
    marginBottom: 8,
    fontSize: 27,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  emptyText: {
    maxWidth: 290,
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    color: '#7A8494',
  },

  infoCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 17,
    backgroundColor: '#EAF3F9',
    borderWidth: 1,
    borderColor: '#D7E8F2',
  },

  infoIcon: {
    width: 35,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },

  infoContent: {
    flex: 1,
    marginLeft: 11,
  },

  infoTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  infoText: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 16,
    color: '#657487',
  },

  buttonPressed: {
    opacity: 0.7,
  },

  bottomSpacing: {
    height: 105,
  },

});