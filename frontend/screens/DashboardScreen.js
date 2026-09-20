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
  getMedications,
  generateTodayDoses,
  getDoseRecords,
  takeDose,
  skipDose,
} from '../services/api';


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

        try {

          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError('');


          const medicationData =
            await getMedications(
              token
            );

          setMedications(
            Array.isArray(
              medicationData
            )
              ? medicationData
              : []
          );


          await generateTodayDoses(
            token
          );


          const doseData =
            await getDoseRecords(
              token
            );

          setDoses(
            Array.isArray(doseData)
              ? doseData
              : []
          );

        } catch (err) {

          console.error(
            'Dashboard loading error:',
            err
          );

          setError(
            err.message ||
              'Failed to load dashboard.'
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

      return doses

        .filter(
          dose =>
            dose.scheduledDate ===
            today
        )

        .sort(
          (a, b) =>
            convertTimeToMinutes(
              a.scheduledTime
            ) -
            convertTimeToMinutes(
              b.scheduledTime
            )
        );

    }, [doses]);


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


  const medicationCount =
    medications.length;


  // =====================================================
  // ADHERENCE
  // =====================================================

  const adherence =
    todayDoses.length > 0
      ? Math.round(
          (
            takenCount /
            todayDoses.length
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
          err.message ||
            'Failed to mark dose as taken.'
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
                    err.message ||
                      'Failed to skip dose.'
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

        <View
          style={
            styles.loadingLogo
          }
        >

          <Text
            style={
              styles.loadingLogoText
            }
          >
            💊
          </Text>

        </View>


        <Text
          style={
            styles.loadingTitle
          }
        >
          MediSked
        </Text>


        <ActivityIndicator
          size="small"
          color="#2F6690"
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

      {/* BACKGROUND */}

      <View
        style={
          styles.backgroundCircleOne
        }
      />

      <View
        style={
          styles.backgroundCircleTwo
        }
      />


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

        <View
          style={styles.header}
        >

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


          <Pressable

            onPress={onLogout}

            hitSlop={8}

            style={({ pressed }) => [

              styles.logoutButton,

              pressed &&
                styles.buttonPressed,

            ]}

          >

            <Text
              style={
                styles.logoutText
              }
            >
              Logout
            </Text>

          </Pressable>

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

        <View
          style={styles.section}
        >

          <Text
            style={
              styles.sectionTitle
            }
          >
            Today's Overview
          </Text>


          <View
            style={
              styles.summaryCard
            }
          >

            <View
              style={
                styles.summaryItem
              }
            >

              <Text
                style={
                  styles.summaryNumber
                }
              >
                {todayDoses.length}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                Doses
              </Text>

            </View>


            <View
              style={
                styles.summaryDivider
              }
            />


            <View
              style={
                styles.summaryItem
              }
            >

              <Text
                style={
                  styles.summaryNumber
                }
              >
                {takenCount}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                Taken
              </Text>

            </View>


            <View
              style={
                styles.summaryDivider
              }
            />


            <View
              style={
                styles.summaryItem
              }
            >

              <Text
                style={
                  styles.summaryNumber
                }
              >
                {pendingCount}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                Pending
              </Text>

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

                <Text
                  style={
                    styles.quickIconText
                  }
                >
                  +
                </Text>

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

                <Text
                  style={
                    styles.quickIconText
                  }
                >
                  🗓
                </Text>

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

                <Text
                  style={
                    styles.quickIconText
                  }
                >
                  ▤
                </Text>

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
                      <Text>
                        💊
                      </Text>
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
      '#EEF5FA',
  },


  // ===================================================
  // BACKGROUND
  // ===================================================

  backgroundCircleOne: {

    position: 'absolute',

    width: 240,
    height: 240,

    borderRadius: 120,

    backgroundColor:
      '#E0EFF7',

    top: -130,
    right: -100,

  },

  backgroundCircleTwo: {

    position: 'absolute',

    width: 180,
    height: 180,

    borderRadius: 90,

    backgroundColor:
      '#E5F2F8',

    bottom: 100,
    left: -100,

  },


  // ===================================================
  // LOADING
  // ===================================================

  loadingContainer: {

    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      '#EEF5FA',

  },

  loadingLogo: {

    width: 65,
    height: 65,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 21,

    backgroundColor:
      '#2F6690',

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


  // ===================================================
  // SCROLL
  // ===================================================

  scrollContent: {

    paddingTop: 18,

    paddingBottom: 20,

  },


  // ===================================================
  // HEADER
  // ===================================================

  header: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    justifyContent:
      'space-between',

    paddingHorizontal: 20,

    paddingBottom: 22,

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

    backgroundColor:
      '#FFFFFF',

    borderWidth: 1,

    borderColor:
      '#E4EAF0',

  },

  logoutText: {

    fontSize: 11,

    fontWeight: '800',

    color: '#DC2626',

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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E9EF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#1E2A4A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  aiCardPressed: {
    opacity: 0.9,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EAF3F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2F6690',
  },
  aiTextWrap: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E2A4A',
  },
  aiSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  aiArrow: {
    fontSize: 26,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 8,
  },


  // ===================================================
  // SECTIONS
  // ===================================================

  section: {

    marginBottom: 23,

    paddingHorizontal: 20,

  },

  sectionHeader: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    justifyContent:
      'space-between',

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

  },

  viewAll: {

    marginTop: 2,

    fontSize: 12,

    fontWeight: '800',

    color: '#2F6690',

  },


  // ===================================================
  // SUMMARY
  // ===================================================

  summaryCard: {

    flexDirection: 'row',

    alignItems: 'center',

    minHeight: 105,

    paddingHorizontal: 8,

    borderRadius: 18,

    backgroundColor:
      '#FFFFFF',

    borderWidth: 1,

    borderColor:
      '#E3E9EF',

    shadowColor:
      '#1E2A4A',

    shadowOpacity: 0.05,

    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,

  },

  summaryItem: {

    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

  },

  summaryNumber: {

    fontSize: 25,

    fontWeight: '900',

    color: '#1E2A4A',

  },

  summaryLabel: {

    marginTop: 4,

    fontSize: 11,

    color: '#7A8494',

  },

  summaryDivider: {

    width: 1,

    height: 42,

    backgroundColor:
      '#E5EAF0',

  },


  // ===================================================
  // ADHERENCE
  // ===================================================

  adherencePercentage: {

    fontSize: 19,

    fontWeight: '900',

    color: '#2F6690',

  },

  adherenceCard: {

    padding: 16,

    borderRadius: 17,

    backgroundColor:
      '#FFFFFF',

    borderWidth: 1,

    borderColor:
      '#E3E9EF',

  },

  progressBackground: {

    height: 10,

    overflow: 'hidden',

    borderRadius: 20,

    backgroundColor:
      '#E5EAF0',

  },

  progressFill: {

    height: '100%',

    borderRadius: 20,

    backgroundColor:
      '#2F6690',

  },

  adherenceBottom: {

    flexDirection: 'row',

    justifyContent:
      'space-between',

    marginTop: 9,

  },

  adherenceText: {

    fontSize: 11,

    color: '#6B7280',

  },

  missedText: {

    fontSize: 11,

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

    minHeight: 128,

    padding: 12,

    borderRadius: 17,

    backgroundColor:
      '#FFFFFF',

    borderWidth: 1,

    borderColor:
      '#E3E9EF',

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

    width: 38,
    height: 38,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 10,

    borderRadius: 12,

    backgroundColor:
      '#EAF3F9',

  },

  quickIconText: {

    fontSize: 20,

    fontWeight: '800',

    color: '#2F6690',

  },

  quickTitle: {

    fontSize: 11,

    fontWeight: '900',

    color: '#1E2A4A',

  },

  quickDescription: {

    marginTop: 4,

    fontSize: 9,

    lineHeight: 14,

    color: '#7A8494',

  },


  // ===================================================
  // DOSES
  // ===================================================

  doseCard: {

    marginBottom: 10,

    padding: 14,

    borderRadius: 16,

    backgroundColor:
      '#FFFFFF',

    borderWidth: 1,

    borderColor:
      '#E3E9EF',

  },

  doseMain: {

    flexDirection: 'row',

    alignItems: 'center',

  },

  timeBox: {

    width: 65,

  },

  doseTime: {

    fontSize: 12,

    fontWeight: '900',

    color: '#2F6690',

  },

  doseInfo: {

    flex: 1,

    paddingRight: 8,

  },

  doseMedication: {

    fontSize: 14,

    fontWeight: '800',

    color: '#1E2A4A',

  },

  doseDosage: {

    marginTop: 2,

    fontSize: 11,

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
      '#2F6690',

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
      '#2F6690',

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

    marginBottom: 10,

    padding: 13,

    borderRadius: 16,

    backgroundColor:
      '#FFFFFF',

    borderWidth: 1,

    borderColor:
      '#E3E9EF',

  },

  medicationIcon: {

    width: 43,
    height: 43,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 13,

    backgroundColor:
      '#EAF3F9',

  },

  medicationInfo: {

    flex: 1,

    marginLeft: 11,

  },

  medicationName: {

    fontSize: 13,

    fontWeight: '900',

    color: '#1E2A4A',

  },

  medicationDosage: {

    marginTop: 2,

    fontSize: 10,

    color: '#6B7280',

  },

  medicationFrequency: {

    marginTop: 2,

    fontSize: 10,

    color: '#8A94A3',

  },

  editMedication: {

    minWidth: 50,

    minHeight: 38,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 9,

    backgroundColor:
      '#EAF3F9',

  },

  editText: {

    fontSize: 10,

    fontWeight: '800',

    color: '#2F6690',

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