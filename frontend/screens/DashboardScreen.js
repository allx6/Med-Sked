import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  View,
  Image,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getMedications,
  generateTodayDoses,
  getDoseRecords,
  takeDose,
  skipDose,
} from '../services/api';
import {
  filterDoseRecordsByMedicationExpiration,
  getSafeUserErrorMessage,
} from '../utils/medicationValidation';
import { getDoseActionErrorMessage } from '../utils/doseErrors';

const medSkedLogo = require('../assets/medsked.png');


export default function DashboardScreen({

  username,
  token,

  onLogout,
  onAddMedication,
  onEditMedication,
  onScheduleMedication,
  onDoseHistory,
  onCaregiverConnections,
  onOpenAiAssistant,

}) {

  // =====================================================
  // STATE
  // =====================================================

  const [
    medications,
    setMedications,
  ] = useState([]);

  const [
    doses,
    setDoses,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');


  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  const loadDashboard =
    useCallback(
      async (
        isRefresh = false
      ) => {

        const loadStart = performance.now();

        try {

          console.log('[Dashboard] Mounted');

          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError('');

          const medicationsStart = performance.now();
          const medicationPromise = getMedications(token).then((data) => {
            console.log(`[Dashboard] Medications: ${((performance.now() - medicationsStart)).toFixed(0)} ms`);
            return data;
          });

          const generationAndRecordsPromise = (async () => {
            const generateStart = performance.now();
            await generateTodayDoses(token);
            console.log(`[Dashboard] Dose generation: ${((performance.now() - generateStart)).toFixed(0)} ms`);

            const dosesStart = performance.now();
            const doseData = await getDoseRecords(token);
            console.log(`[Dashboard] Dose records: ${((performance.now() - dosesStart)).toFixed(0)} ms`);
            return doseData;
          })();

          const [medicationData, doseData] = await Promise.all([
            medicationPromise,
            generationAndRecordsPromise,
          ]);

          setMedications(Array.isArray(medicationData) ? medicationData : []);
          setDoses(Array.isArray(doseData) ? doseData : []);

          console.log(`[Dashboard] Initialization: ${((performance.now() - loadStart)).toFixed(0)} ms`);

        } catch (err) {

          console.error(
            'Dashboard loading error:',
            err
          );

          setError(
            getSafeUserErrorMessage(
              err,
              'Unable to load the dashboard. Please check your connection and try again.'
            )
          );

        } finally {

          setLoading(false);
          setRefreshing(false);

        }

      },
      [token]
    );


  // =====================================================
  // LOAD SCREEN
  // =====================================================

  useEffect(() => {

    loadDashboard();

  }, [loadDashboard]);


  // =====================================================
  // TODAY
  // =====================================================

  function getTodayString() {

    const today =
      new Date();

    const year =
      today.getFullYear();

    const month =
      String(
        today.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        today.getDate()
      ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }


  // =====================================================
  // TODAY'S DOSES
  // =====================================================

  const todayDoses =
    useMemo(() => {

      const today =
        getTodayString();

      return filterDoseRecordsByMedicationExpiration(doses

        .filter(
          dose =>
            dose.scheduledDate === today
        )

        .sort(
          (a, b) =>
            convertTimeToMinutes(
              a.scheduledTime
            ) -
            convertTimeToMinutes(
              b.scheduledTime
            )
        ), medications);

    }, [doses, medications]);


  // =====================================================
  // COUNTS
  // =====================================================

  const takenCount =
    todayDoses.filter(
      dose =>
        dose.status === 'taken'
    ).length;


  const pendingCount =
    todayDoses.filter(
      dose =>
        dose.status === 'pending'
    ).length;


  const missedCount =
    todayDoses.filter(
      dose =>
        dose.status === 'missed'
    ).length;


  const skippedCount =
    todayDoses.filter(
      dose =>
        dose.status === 'skipped'
    ).length;


  const medicationCount =
    medications.length;


  // =====================================================
  // ADHERENCE
  // =====================================================

  const eligibleCount =
    takenCount +
    missedCount +
    skippedCount;

  const adherence =
    eligibleCount > 0
      ? Math.round(
          (
            takenCount /
            eligibleCount
          ) * 100
        )
      : 0;


  // =====================================================
  // TAKE DOSE
  // =====================================================

  const handleTakeDose =
    async (doseId) => {

      try {

        const updatedDose =
          await takeDose(
            token,
            doseId
          );

        setDoses(
          previous =>
            previous.map(
              dose =>
                dose._id === doseId
                  ? updatedDose
                  : dose
            )
        );

      } catch (err) {

        Alert.alert(
          'Error',
          getDoseActionErrorMessage(err)
        );

      }

    };


  // =====================================================
  // SKIP DOSE
  // =====================================================

  const handleSkipDose =
    async (doseId) => {

      Alert.alert(

        'Skip Dose',

        'Are you sure you want to skip this dose?',

        [

          {
            text: 'Cancel',
            style: 'cancel',
          },

          {

            text: 'Skip',

            style: 'destructive',

            onPress:
              async () => {

                try {

                  const updatedDose =
                    await skipDose(
                      token,
                      doseId
                    );

                  setDoses(
                    previous =>
                      previous.map(
                        dose =>
                          dose._id === doseId
                            ? updatedDose
                            : dose
                      )
                  );

                } catch (err) {

                  Alert.alert(
                    'Error',
                    getDoseActionErrorMessage(err)
                  );

                }

              },

          },

        ]

      );

    };


  // =====================================================
  // GREETING
  // =====================================================

  const getGreeting = () => {

    const hour =
      new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    }

    if (hour < 18) {
      return 'Good afternoon';
    }

    return 'Good evening';

  };


  // =====================================================
  // CAREGIVER CONNECTIONS CTA
  // =====================================================

  const renderCaregiverConnectionsCard = () => (
    <Pressable
      onPress={onCaregiverConnections}
      style={({ pressed }) => [
        styles.connectionCard,
        pressed && styles.connectionCardPressed,
      ]}
    >
      <View style={styles.connectionHeader}>
        <View>
          <Text style={styles.connectionTitle}>Caregiver Connections</Text>
          <Text style={styles.connectionSubtitle}>Review connected caregivers and pending requests.</Text>
        </View>
        <Text style={styles.connectionArrow}>›</Text>
      </View>
    </Pressable>
  );

  const renderAiAssistantCard = () => (
    <Pressable
      onPress={() => onOpenAiAssistant?.()}
      style={({ pressed }) => [
        styles.aiCard,
        pressed && styles.aiCardPressed,
      ]}
    >
      <View style={styles.aiHeader}>
        <View style={styles.aiIconWrap}>
          <Text style={styles.aiIconText}>AI</Text>
        </View>

        <View style={styles.aiTextWrap}>
          <Text style={styles.aiTitle}>MedSked AI Assistant</Text>
          <Text style={styles.aiSubtitle}>Ask about your medications, schedules, adherence, or refills.</Text>
        </View>

        <Text style={styles.aiArrow}>›</Text>
      </View>
    </Pressable>
  );


  // =====================================================
  // DOSE CARD
  // =====================================================

  const renderDose =
    dose => {

      const medication =
        dose.medicationId;

      const medicationName =
        medication?.name ||
        'Unknown medication';

      const dosage =
        medication?.dosage ||
        '';

      const status =
        dose.status ||
        'pending';


      return (

        <View
          key={dose._id}
          style={styles.doseCard}
        >

          <View
            style={
              styles.doseMain
            }
          >

            <View
              style={
                styles.timeBox
              }
            >

              <Text
                style={
                  styles.doseTime
                }
              >
                {dose.scheduledTime ||
                  '--'}
              </Text>

            </View>


            <View style={styles.doseMedicationIcon}>
              <MaterialCommunityIcons name="pill" size={14} color="#0B4F59" />
            </View>

            <View
              style={
                styles.doseInfo
              }
            >

              <Text
                style={
                  styles.doseMedication
                }
              >
                {medicationName}
              </Text>


              {dosage ? (

                <Text
                  style={
                    styles.doseDosage
                  }
                >
                  {dosage}
                </Text>

              ) : null}

            </View>


            <View
              style={[
                styles.statusBadge,

                status === 'taken'
                  ? styles.takenBadge
                  : status === 'skipped'
                  ? styles.skippedBadge
                  : status === 'missed'
                  ? styles.missedBadge
                  : styles.pendingBadge,
              ]}
            >

              <Text
                style={
                  styles.statusText
                }
              >
                {status === 'taken'
                  ? 'Taken'
                  : status === 'skipped'
                  ? 'Skipped'
                  : status === 'missed'
                  ? 'Missed'
                  : 'Pending'}
              </Text>

            </View>

          </View>


          {status === 'pending' && (

            <View
              style={
                styles.doseActions
              }
            >

              <Pressable

                onPress={() =>
                  handleTakeDose(
                    dose._id
                  )
                }

                style={({ pressed }) => [

                  styles.takeButton,

                  pressed &&
                    styles.buttonPressed,

                ]}

              >

                <Text
                  style={
                    styles.takeButtonText
                  }
                >
                  ✓ Mark as Taken
                </Text>

              </Pressable>


              <Pressable

                onPress={() =>
                  handleSkipDose(
                    dose._id
                  )
                }

                style={({ pressed }) => [

                  styles.skipButton,

                  pressed &&
                    styles.buttonPressed,

                ]}

              >

                <Text
                  style={
                    styles.skipButtonText
                  }
                >
                  Skip
                </Text>

              </Pressable>

            </View>

          )}

        </View>

      );

    };


  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (

      <View
        style={
          styles.loadingContainer
        }
      >

        <Text
          style={
            styles.loadingTitle
          }
        >
          MedSked
        </Text>


        <ActivityIndicator
          size="small"
          color="#0B4F59"
          style={
            styles.loadingIndicator
          }
        />


        <Text
          style={
            styles.loadingText
          }
        >
          Loading your dashboard...
        </Text>

      </View>

    );

  }


  // =====================================================
  // SCREEN
  // =====================================================

  return (

    <View
      style={styles.container}
    >

      <ScrollView

        showsVerticalScrollIndicator={
          false
        }

        refreshControl={

          <RefreshControl

            refreshing={
              refreshing
            }

            onRefresh={() =>
              loadDashboard(true)
            }

            tintColor="#0B4F59"

          />

        }

        contentContainerStyle={
          styles.scrollContent
        }

      >

        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={styles.header}
        >

          <View style={styles.headerDecoration} />

          <View style={styles.headerBrand}>
            <Image
              accessible
              accessibilityLabel="MedSked logo"
              source={medSkedLogo}
              resizeMode="contain"
              style={styles.headerLogo}
            />

          <View
            style={
              styles.headerText
            }
          >

            <Text
              style={
                styles.greeting
              }
            >
              {getGreeting()}
            </Text>


            <Text
              style={
                styles.username
              }
            >
              {username ||
                'Patient'} 👋
            </Text>


            <Text
              style={
                styles.subtitle
              }
            >
              Here's your medication
              overview for today.
            </Text>

          </View>

          </View>

        </View>


        {/* ERROR */}

        {error ? (

          <View
            style={
              styles.errorBox
            }
          >

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>

            <Pressable
              onPress={() =>
                loadDashboard()
              }
            >

              <Text
                style={
                  styles.retryText
                }
              >
                Retry
              </Text>

            </Pressable>

          </View>

        ) : null}

        {renderAiAssistantCard()}


        {/* =================================================
            TODAY'S OVERVIEW
        ================================================= */}

        <View style={[styles.section, styles.summarySection]}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIcon}>
                <MaterialCommunityIcons name="pill" size={16} color="#0B4F59" />
              </View>
              <View>
                <Text style={styles.summaryNumber}>{todayDoses.length}</Text>
                <Text style={styles.summaryLabel}>Doses</Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, styles.summaryIconTaken]}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color="#16865A" />
              </View>
              <View>
                <Text style={styles.summaryNumber}>{takenCount}</Text>
                <Text style={styles.summaryLabel}>Taken</Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, styles.summaryIconPending]}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#C65050" />
              </View>
              <View>
                <Text style={styles.summaryNumber}>{pendingCount}</Text>
                <Text style={styles.summaryLabel}>Pending</Text>
              </View>
            </View>
          </View>
        </View>


        {/* =================================================
            ADHERENCE
        ================================================= */}

        <View
          style={styles.section}
        >

          <View
            style={
              styles.sectionHeader
            }
          >

            <View>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Today's Adherence
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Keep your medication routine
                on track.
              </Text>

            </View>


            <Text
              style={
                styles.adherencePercentage
              }
            >
              {adherence}%
            </Text>

          </View>


          <View
            style={
              styles.adherenceCard
            }
          >

            <View
              style={
                styles.progressBackground
              }
            >

              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      `${adherence}%`,
                  },
                ]}
              />

            </View>


            <View
              style={
                styles.adherenceBottom
              }
            >

              <Text
                style={
                  styles.adherenceText
                }
              >
                {takenCount} of{' '}
                {todayDoses.length}{' '}
                doses taken
              </Text>


              {missedCount > 0 && (

                <Text
                  style={
                    styles.missedText
                  }
                >
                  {missedCount} missed
                </Text>

              )}

            </View>

          </View>

        </View>


        {/* =================================================
            QUICK ACTIONS
        ================================================= */}

        <View
          style={styles.section}
        >

          <View
            style={
              styles.sectionHeader
            }
          >

            <View>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Quick Actions
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Manage your medication routine.
              </Text>

            </View>

          </View>


          <View
            style={
              styles.quickActions
            }
          >

            {/* ADD MEDICATION */}

            <Pressable

              onPress={
                onAddMedication
              }

              style={({ pressed }) => [

                styles.quickCard,

                pressed &&
                  styles.quickCardPressed,

              ]}

            >

              <View
                style={
                  styles.quickIcon
                }
              >

                <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#0B4F59" />

              </View>


              <Text
                style={
                  styles.quickTitle
                }
              >
                Add Medication
              </Text>


              <Text
                style={
                  styles.quickDescription
                }
              >
                Add a new medicine
              </Text>

            </Pressable>


            {/* SCHEDULE */}

            <Pressable

              onPress={
                onScheduleMedication
              }

              style={({ pressed }) => [

                styles.quickCard,

                pressed &&
                  styles.quickCardPressed,

              ]}

            >

              <View
                style={
                  styles.quickIcon
                }
              >

                <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#0B4F59" />

              </View>


              <Text
                style={
                  styles.quickTitle
                }
              >
                Schedules
              </Text>


              <Text
                style={
                  styles.quickDescription
                }
              >
                Manage dose times
              </Text>

            </Pressable>


            {/* HISTORY */}

            <Pressable

              onPress={
                onDoseHistory
              }

              style={({ pressed }) => [

                styles.quickCard,

                pressed &&
                  styles.quickCardPressed,

              ]}

            >

              <View
                style={
                  styles.quickIcon
                }
              >

                <MaterialCommunityIcons name="history" size={18} color="#0B4F59" />

              </View>


              <Text
                style={
                  styles.quickTitle
                }
              >
                Dose History
              </Text>


              <Text
                style={
                  styles.quickDescription
                }
              >
                Review your doses
              </Text>

            </Pressable>

          </View>

        </View>


        {/* =================================================
            TODAY'S DOSES
        ================================================= */}

        <View
          style={styles.section}
        >

          <View
            style={
              styles.sectionHeader
            }
          >

            <View>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Today's Doses
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Your medication schedule for today.
              </Text>

            </View>


            <Pressable
              onPress={
                onDoseHistory
              }
              hitSlop={8}
            >

              <Text
                style={
                  styles.viewAll
                }
              >
                View All
              </Text>

            </Pressable>

          </View>


          {todayDoses.length === 0 ? (

            <View
              style={
                styles.emptyCard
              }
            >

              <Text
                style={
                  styles.emptyIcon
                }
              >
                ✓
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No doses scheduled
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                You don't have any doses
                scheduled for today.
              </Text>

            </View>

          ) : (

            todayDoses
              .slice(0, 5)
              .map(renderDose)

          )}

        </View>


        {/* =================================================
            MEDICATIONS
        ================================================= */}

        <View
          style={styles.section}
        >

          <View
            style={
              styles.sectionHeader
            }
          >

            <View>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                My Medications
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                {medicationCount}{' '}
                {medicationCount === 1
                  ? 'medication'
                  : 'medications'}{' '}
                currently added.
              </Text>

            </View>


            <Pressable
              onPress={
                onAddMedication
              }
              hitSlop={8}
            >

              <Text
                style={
                  styles.viewAll
                }
              >
                + Add
              </Text>

            </Pressable>

          </View>


          {medications.length === 0 ? (

            <View
              style={
                styles.emptyCard
              }
            >

              <Text
                style={
                  styles.emptyIcon
                }
              >
                💊
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No medications yet
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Add your first medication
                to get started.
              </Text>


              <Pressable

                onPress={
                  onAddMedication
                }

                style={
                  styles.primaryButton
                }

              >

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  + Add Medication
                </Text>

              </Pressable>

            </View>

          ) : (

            medications
              .slice(0, 5)
              .map(
                medication => (

                  <View
                    key={
                      medication._id
                    }
                    style={
                      styles.medicationCard
                    }
                  >

                    <View
                      style={
                        styles.medicationIcon
                      }
                    >
                      <MaterialCommunityIcons name="pill" size={18} color="#0B4F59" />
                    </View>


                    <View
                      style={
                        styles.medicationInfo
                      }
                    >

                      <Text
                        style={
                          styles.medicationName
                        }
                      >
                        {
                          medication.name
                        }
                      </Text>

                      <Text
                        style={
                          styles.medicationDosage
                        }
                      >
                        {
                          medication.dosage
                        }
                      </Text>

                      <Text
                        style={
                          styles.medicationFrequency
                        }
                      >
                        {
                          medication.frequency
                        }
                      </Text>

                      {(() => {
                        const rawDate = medication?.expirationDate;
                        if (!rawDate || !String(rawDate).trim()) return null;

                        const normalizedDate = String(rawDate).trim().split('T')[0];
                        const [year, month, day] = normalizedDate.split('-').map(Number);
                        if (![year, month, day].every(Number.isFinite)) {
                          return null;
                        }

                        const parsedDate = new Date(year, month - 1, day);
                        if (
                          parsedDate.getFullYear() !== year ||
                          parsedDate.getMonth() !== month - 1 ||
                          parsedDate.getDate() !== day
                        ) {
                          return null;
                        }

                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const expiration = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
                        const expired = expiration < today;

                        return (
                          <Text style={expired ? styles.medicationExpirationExpired : styles.medicationExpiration}>
                            {expired ? `Expired • ${normalizedDate}` : `Expires: ${normalizedDate}`}
                          </Text>
                        );
                      })()}

                    </View>


                    <Pressable

                      onPress={() =>
                        onEditMedication(
                          medication
                        )
                      }

                      hitSlop={8}

                      style={
                        styles.editMedication
                      }

                    >

                      <Text
                        style={
                          styles.editText
                        }
                      >
                        Edit
                      </Text>

                    </Pressable>

                  </View>

                )
              )

          )}

        </View>


        {/* BOTTOM SPACE */}

        <View
          style={
            styles.bottomSpacing
          }
        />

      </ScrollView>

    </View>

  );
}


// =====================================================
// TIME CONVERTER
// =====================================================

function convertTimeToMinutes(
  time
) {

  if (!time) {
    return 0;
  }

  const normalizedTime = time.trim();
  const twelveHourMatch = normalizedTime.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  const twentyFourHourMatch = normalizedTime.match(
    /^(\d{2}):(\d{2})$/
  );

  if (!twelveHourMatch && !twentyFourHourMatch) {
    return 0;
  }

  if (twentyFourHourMatch) {
    return (
      parseInt(twentyFourHourMatch[1], 10) * 60 +
      parseInt(twentyFourHourMatch[2], 10)
    );
  }

  let hours =
    parseInt(
      twelveHourMatch[1],
      10
    );

  const minutes =
    parseInt(
      twelveHourMatch[2],
      10
    );

  const period =
    twelveHourMatch[3].toUpperCase();

  if (period === 'AM') {

    if (hours === 12) {
      hours = 0;
    }

  } else {

    if (hours !== 12) {
      hours += 12;
    }

  }

  return (
    hours * 60 +
    minutes
  );
}


// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor:
      '#116F7A',
  },


  // ===================================================
  // LOADING
  // ===================================================

  loadingContainer: {

    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      '#116F7A',

  },

  loadingLogo: {

    width: 65,
    height: 65,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 21,

    backgroundColor:
      '#0B4F59',

  },

  loadingLogoText: {

    fontSize: 30,

  },

  loadingTitle: {

    marginTop: 12,

    fontSize: 23,

    fontWeight: '900',

    color: '#FFFFFF',

  },

  loadingIndicator: {

    marginTop: 18,

  },

  loadingText: {

    marginTop: 8,

    fontSize: 12,

    color: '#A7CDD0',

  },


  // ===================================================
  // SCROLL
  // ===================================================

  scrollContent: {

    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,

  },


  // ===================================================
  // HEADER
  // ===================================================

  header: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    minHeight: 58,
    marginHorizontal: 16,
    marginBottom: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#0B4F59',

  },

  headerDecoration: {
    position: 'absolute',
    width: 94,
    height: 94,
    top: -36,
    right: -18,
    borderRadius: 47,
    backgroundColor: '#3D929B',
    pointerEvents: 'none',
  },

  headerBrand: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerLogo: {
    width: 31,
    height: 31,
    marginRight: 9,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',

  },

  headerText: {

    flex: 1,

    paddingRight: 8,

  },

  greeting: {

    fontSize: 8,

    fontWeight: '600',

    color: '#A7CDD0',

  },

  username: {

    marginTop: 1,

    fontSize: 13,

    fontWeight: '900',

    color: '#FFFFFF',

  },

  subtitle: {

    marginTop: 2,

    fontSize: 8,

    lineHeight: 11,

    color: '#A7CDD0',

  },

  // ===================================================
  // ERROR
  // ===================================================

  errorBox: {

    marginHorizontal: 20,

    marginBottom: 18,

    padding: 14,

    borderRadius: 13,

    backgroundColor:
      '#FEE2E2',

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

  aiCard: {
    backgroundColor: '#D7EDF3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B5D4DC',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 9,
  },
  aiCardPressed: {
    opacity: 0.9,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconWrap: {
    width: 27,
    height: 27,
    borderRadius: 7,
    backgroundColor: '#C5E3EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  aiIconText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0B4F59',
  },
  aiTextWrap: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E2A4A',
  },
  aiSubtitle: {
    marginTop: 2,
    fontSize: 8,
    lineHeight: 11,
    color: '#6B7280',
  },
  aiArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 6,
  },


  // ===================================================
  // SECTIONS
  // ===================================================

  section: {

    marginBottom: 10,

    paddingHorizontal: 16,

  },

  sectionHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    marginBottom: 6,

  },

  sectionTitle: {

    fontSize: 10,

    fontWeight: '900',

    color: '#FFFFFF',

  },

  sectionSubtitle: {

    marginTop: 1,

    fontSize: 8,

    color: '#A7CDD0',

  },

  viewAll: {

    marginTop: 1,

    fontSize: 8,

    fontWeight: '800',

    color: '#83DBDE',

  },


  // ===================================================
  // SUMMARY
  // ===================================================

  summarySection: {
    marginBottom: 10,
  },

  summaryCard: {
    flexDirection: 'row',
    gap: 8,
  },

  summaryItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#D7EDF3',
    borderWidth: 1,
    borderColor: '#B5D4DC',
  },

  summaryIcon: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#8EBAC5',
    borderRadius: 6,
    backgroundColor: '#C5E3EA',
  },

  summaryIconTaken: {
    backgroundColor: '#CBE8D8',
    borderColor: '#8BBDA1',
  },

  summaryIconPending: {
    backgroundColor: '#F1D6D4',
    borderColor: '#D9A19D',
  },

  summaryNumber: {
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '900',
    color: '#17313A',
  },

  summaryLabel: {
    marginTop: 1,
    fontSize: 8,
    color: '#7A8494',
  },


  // ===================================================
  // ADHERENCE
  // ===================================================

  adherencePercentage: {

    fontSize: 11,

    fontWeight: '900',

    color: '#0B4F59',

  },

  adherenceCard: {

    padding: 10,

    borderRadius: 12,

    backgroundColor:
      '#D7EDF3',

    borderWidth: 1,

    borderColor:
      '#B5D4DC',

  },

  progressBackground: {

    height: 5,

    overflow: 'hidden',

    borderRadius: 20,

    backgroundColor:
      '#E5EAF0',

  },

  progressFill: {

    height: '100%',

    borderRadius: 20,

    backgroundColor:
      '#0B4F59',

  },

  adherenceBottom: {

    flexDirection: 'row',

    justifyContent:
      'space-between',

    marginTop: 6,

  },

  adherenceText: {

    fontSize: 8,

    color: '#6B7280',

  },

  missedText: {

    fontSize: 8,

    fontWeight: '700',

    color: '#DC2626',

  },


  // ===================================================
  // QUICK ACTIONS
  // ===================================================

  quickActions: {

    flexDirection: 'row',

    gap: 9,

  },

  quickCard: {

    flex: 1,

    minHeight: 72,

    padding: 8,

    borderRadius: 12,

    backgroundColor:
      '#D7EDF3',

    borderWidth: 1,

    borderColor:
      '#B5D4DC',

  },

  quickCardPressed: {

    opacity: 0.70,

    transform: [
      {
        scale: 0.98,
      },
    ],

  },

  quickIcon: {

    width: 25,
    height: 25,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 5,

    borderRadius: 6,

    backgroundColor:
      '#C5E3EA',

    borderWidth: 1,

    borderColor: '#8EBAC5',

  },

  quickIconText: {

    fontSize: 20,

    fontWeight: '800',

    color: '#0B4F59',

  },

  quickTitle: {

    fontSize: 9,

    fontWeight: '900',

    color: '#1E2A4A',

  },

  quickDescription: {

    marginTop: 2,

    fontSize: 8,

    lineHeight: 10,

    color: '#7A8494',

  },


  // ===================================================
  // DOSES
  // ===================================================

  doseCard: {

    marginBottom: 7,

    padding: 9,

    borderRadius: 12,

    backgroundColor:
      '#D7EDF3',

    borderWidth: 1,

    borderColor:
      '#B5D4DC',

  },

  doseMain: {

    flexDirection: 'row',

    alignItems: 'center',

  },

  timeBox: {

    width: 62,

  },

  doseTime: {

    fontSize: 10,

    fontWeight: '900',

    color: '#0B4F59',

  },

  doseInfo: {

    flex: 1,

    paddingRight: 6,

  },

  doseMedicationIcon: {
    width: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#8EBAC5',
    borderRadius: 6,
    backgroundColor: '#C5E3EA',

  },

  doseMedication: {

    fontSize: 10,

    fontWeight: '800',

    color: '#1E2A4A',

  },

  doseDosage: {

    marginTop: 1,

    fontSize: 8,

    color: '#7A8494',

  },

  statusBadge: {

    paddingHorizontal: 8,

    paddingVertical: 5,

    borderRadius: 20,

  },

  pendingBadge: {

    backgroundColor:
      '#FEF3C7',

  },

  takenBadge: {

    backgroundColor:
      '#DCFCE7',

  },

  skippedBadge: {

    backgroundColor:
      '#E5E7EB',

  },

  missedBadge: {

    backgroundColor:
      '#FEE2E2',

  },

  statusText: {

    fontSize: 9,

    fontWeight: '900',

    color: '#374151',

  },

  doseActions: {

    flexDirection: 'row',

    gap: 8,

    marginTop: 12,

  },

  takeButton: {

    flex: 1,

    minHeight: 42,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 10,

    backgroundColor:
      '#0B4F59',

  },

  takeButtonText: {

    fontSize: 11,

    fontWeight: '800',

    color: '#FFFFFF',

  },

  skipButton: {

    width: 70,

    minHeight: 42,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 10,

    backgroundColor:
      '#E8ECF0',

  },

  skipButtonText: {

    fontSize: 11,

    fontWeight: '800',

    color: '#374151',

  },


  // ===================================================
  // EMPTY
  // ===================================================

  emptyCard: {

    alignItems: 'center',

    padding: 24,

    borderRadius: 17,

    backgroundColor:
      '#FFFFFF',

    borderWidth: 1,

    borderColor:
      '#E3E9EF',

  },

  emptyIcon: {

    marginBottom: 8,

    fontSize: 26,

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

  primaryButton: {

    minHeight: 44,

    marginTop: 14,

    paddingHorizontal: 17,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 10,

    backgroundColor:
      '#0B4F59',

  },

  primaryButtonText: {

    fontSize: 11,

    fontWeight: '800',

    color: '#FFFFFF',

  },


  // ===================================================
  // MEDICATIONS
  // ===================================================

  medicationCard: {

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 7,

    padding: 9,

    borderRadius: 12,

    backgroundColor:
      '#D7EDF3',

    borderWidth: 1,

    borderColor:
      '#B5D4DC',

  },

  medicationIcon: {

    width: 28,
    height: 28,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 7,

    backgroundColor:
      '#C5E3EA',

    borderWidth: 1,

    borderColor: '#8EBAC5',

  },

  medicationInfo: {

    flex: 1,

    marginLeft: 8,

  },

  medicationName: {

    fontSize: 9,

    fontWeight: '900',

    color: '#1E2A4A',

  },

  medicationDosage: {

    marginTop: 1,

    fontSize: 8,

    color: '#6B7280',

  },

  medicationFrequency: {

    marginTop: 1,

    fontSize: 8,

    color: '#8A94A3',

  },

  medicationExpiration: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '700',
    color: '#0B4F59',
  },

  medicationExpirationExpired: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '800',
    color: '#B91C1C',
  },

  editMedication: {

    minWidth: 50,

    minHeight: 28,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 7,

    backgroundColor:
      '#0B4F59',

  },

  editText: {

    fontSize: 8,

    fontWeight: '800',

    color: '#FFFFFF',

  },


  // ===================================================
  // GENERAL
  // ===================================================

  buttonPressed: {

    opacity: 0.70,

  },

  bottomSpacing: {

    height: 105,

  },

});