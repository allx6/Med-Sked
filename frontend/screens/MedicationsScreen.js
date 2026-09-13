import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import {
  getMedications,
  getSchedules,
  deleteMedication,
} from '../services/api';


// =====================================================
// SCREEN
// =====================================================

export default function MedicationsScreen({
  token,
  onBack,
  onAddMedication,
  onEditMedication,
}) {

  // =====================================================
  // STATE
  // =====================================================

  const [
    medications,
    setMedications,
  ] = useState([]);

  const [
    schedules,
    setSchedules,
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
  // LOAD MEDICATIONS + SCHEDULES
  // =====================================================

  const loadMedications = useCallback(
    async (isRefresh = false) => {

      try {

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        // -------------------------------------------------
        // LOAD BOTH
        // -------------------------------------------------

        const [
          medicationData,
          scheduleData,
        ] = await Promise.all([
          getMedications(token),
          getSchedules(token),
        ]);

        // -------------------------------------------------
        // STORE MEDICATIONS
        // -------------------------------------------------

        setMedications(
          Array.isArray(medicationData)
            ? medicationData
            : []
        );

        // -------------------------------------------------
        // STORE SCHEDULES
        // -------------------------------------------------

        setSchedules(
          Array.isArray(scheduleData)
            ? scheduleData
            : []
        );

      } catch (err) {

        console.error(
          'Error loading medications:',
          err
        );

        setError(
          err.message ||
            'Failed to load medications.'
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
    loadMedications();
  }, [loadMedications]);


  // =====================================================
  // GET SCHEDULES FOR MEDICATION
  // =====================================================

  const getMedicationSchedules = (
    medicationId
  ) => {

    return schedules.filter(
      (schedule) => {

        const scheduleMedicationId =
          schedule.medicationId?._id ||
          schedule.medicationId;

        return (
          String(scheduleMedicationId) ===
          String(medicationId)
        );

      }
    );
  };

  const handleDeleteMedication = (medication) => {
    Alert.alert(
      'Delete Medication',
      `Delete ${medication.name || 'this medication'} and its schedules and dose history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedication(token, medication._id);
              setMedications((previous) => previous.filter((item) => item._id !== medication._id));
              setSchedules((previous) => previous.filter((item) => {
                const medicationId = item.medicationId?._id || item.medicationId;
                return String(medicationId) !== String(medication._id);
              }));
            } catch (deleteError) {
              Alert.alert('Delete failed', deleteError.message || 'Failed to delete medication.');
            }
          },
        },
      ]
    );
  };


  // =====================================================
  // FORMAT TIME
  // =====================================================

  const formatTime = (time) => {

    if (!time) {
      return 'Time not specified';
    }

    // Already formatted
    if (
      time.toUpperCase().includes('AM') ||
      time.toUpperCase().includes('PM')
    ) {
      return time;
    }

    const parts = time.split(':');

    if (parts.length < 2) {
      return time;
    }

    let hour = parseInt(parts[0], 10);
    const minute = parts[1];

    if (Number.isNaN(hour)) {
      return time;
    }

    const period =
      hour >= 12
        ? 'PM'
        : 'AM';

    hour =
      hour % 12 || 12;

    return `${hour}:${minute} ${period}`;
  };


  // =====================================================
  // FORMAT DAYS
  // =====================================================

  const formatDays = (days) => {

    if (!Array.isArray(days) || days.length === 0) {
      return 'No days specified';
    }

    const dayMap = {
      Sunday: 'Sun',
      Monday: 'Mon',
      Tuesday: 'Tue',
      Wednesday: 'Wed',
      Thursday: 'Thu',
      Friday: 'Fri',
      Saturday: 'Sat',
    };

    return days
      .map(
        (day) =>
          dayMap[day] || day
      )
      .join(', ');
  };


  // =====================================================
  // MEDICATION CARD
  // =====================================================

  const renderMedication = ({
    item,
  }) => {

    const medicationSchedules =
      getMedicationSchedules(
        item._id
      );

    return (

      <View style={styles.card}>

        {/* TOP */}

        <View
          style={styles.cardTop}
        >

          <View
            style={
              styles.iconContainer
            }
          >

            <Text
              style={
                styles.icon
              }
            >
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
              numberOfLines={1}
            >
              {item.name ||
                'Medication'}
            </Text>


            {item.dosage ? (

              <Text
                style={
                  styles.dosage
                }
              >
                {item.dosage}
              </Text>

            ) : null}


            {item.frequency ? (

              <Text
                style={
                  styles.frequency
                }
              >
                {item.frequency}
              </Text>

            ) : null}

          </View>


          {/* EDIT BUTTON */}

          <Pressable
            onPress={() =>
              onEditMedication(
                item
              )
            }
            hitSlop={8}
            style={({ pressed }) => [
              styles.editButton,
              pressed &&
                styles.buttonPressed,
            ]}
          >

            <Text
              style={
                styles.editButtonText
              }
            >
              Edit
            </Text>

          </Pressable>

          <Pressable
            onPress={() => handleDeleteMedication(item)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.deleteMedicationButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.deleteMedicationText}>Delete</Text>
          </Pressable>

        </View>


        {/* DIVIDER */}

        <View
          style={
            styles.divider
          }
        />


        {/* DETAILS */}

        <View
          style={
            styles.detailsRow
          }
        >

          <View
            style={
              styles.detailBlock
            }
          >

            <Text
              style={
                styles.detailLabel
              }
            >
              Frequency
            </Text>

            <Text
              style={
                styles.detailValue
              }
            >
              {item.frequency ||
                'Not specified'}
            </Text>

          </View>


          <View
            style={
              styles.detailBlock
            }
          >

            <Text
              style={
                styles.detailLabel
              }
            >
              Status
            </Text>

            <Text
              style={
                styles.activeStatus
              }
            >
              Active
            </Text>

          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Refill</Text>
            <Text
              style={[
                styles.detailValue,
                Number(item.quantityOnHand ?? 0) <= Number(item.refillThreshold ?? 0)
                  ? styles.lowStock
                  : styles.stockOkay,
              ]}
            >
              {Number(item.quantityOnHand ?? 0) <= 0
                ? 'Out of stock'
                : Number(item.quantityOnHand ?? 0) <= Number(item.refillThreshold ?? 0)
                  ? 'Low stock'
                  : 'In stock'}
            </Text>
            <Text style={styles.stockDetail}>
              {Number(item.quantityOnHand ?? 0)} on hand / threshold {Number(item.refillThreshold ?? 0)}
            </Text>
          </View>

        </View>


        {/* =================================================
            SCHEDULES
        ================================================= */}

        <View
          style={
            styles.scheduleSection
          }
        >

          <View
            style={
              styles.scheduleHeader
            }
          >

            <Text
              style={
                styles.scheduleTitle
              }
            >
              💊 Dose Schedule
            </Text>

            <Text
              style={
                styles.scheduleCount
              }
            >
              {medicationSchedules.length}
              {' '}
              {medicationSchedules.length === 1
                ? 'schedule'
                : 'schedules'}
            </Text>

          </View>


          {medicationSchedules.length === 0 ? (

            <View
              style={
                styles.noScheduleBox
              }
            >

              <Text
                style={
                  styles.noScheduleText
                }
              >
                No schedule set for this medication.
              </Text>

            </View>

          ) : (

            <View
              style={
                styles.scheduleList
              }
            >

              {medicationSchedules.map(
                (schedule, index) => (

                  <View
                    key={
                      schedule._id ||
                      `${item._id}-${index}`
                    }
                    style={
                      styles.scheduleItem
                    }
                  >

                    {/* TIME */}

                    <View
                      style={
                        styles.timeContainer
                      }
                    >

                      <Text
                        style={
                          styles.timeText
                        }
                      >
                        {formatTime(
                          schedule.time
                        )}
                      </Text>

                    </View>


                    {/* DAYS */}

                    <View
                      style={
                        styles.scheduleInfo
                      }
                    >

                      <Text
                        style={
                          styles.daysText
                        }
                      >
                        {formatDays(
                          schedule.days
                        )}
                      </Text>


                      {schedule.startDate ? (

                        <Text
                          style={
                            styles.dateText
                          }
                        >
                          Starts:{' '}
                          {schedule.startDate}
                        </Text>

                      ) : null}

                    </View>


                    {/* ENABLED */}

                    <View
                      style={[
                        styles.enabledBadge,
                        !schedule.enabled &&
                          styles.disabledBadge,
                      ]}
                    >

                      <Text
                        style={[
                          styles.enabledText,
                          !schedule.enabled &&
                            styles.disabledText,
                        ]}
                      >
                        {schedule.enabled
                          ? 'ON'
                          : 'OFF'}
                      </Text>

                    </View>

                  </View>

                )
              )}

            </View>

          )}

        </View>

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

        <ActivityIndicator
          size="large"
          color="#2F6690"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading medications...
        </Text>

      </View>

    );

  }


  // =====================================================
  // SCREEN
  // =====================================================

  return (

    <View
      style={
        styles.container
      }
    >

      {/* BACKGROUND DECORATION */}

      <View
        style={
          styles.backgroundCircle
        }
      />


      {/* HEADER */}

      <View
        style={
          styles.header
        }
      >

        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backButton,
            pressed &&
              styles.buttonPressed,
          ]}
        >

          <Text
            style={
              styles.backIcon
            }
          >
            ‹
          </Text>

          <Text
            style={
              styles.backText
            }
          >
            Back
          </Text>

        </Pressable>


        <View
          style={
            styles.headerContent
          }
        >

          <Text
            style={
              styles.pageTitle
            }
          >
            My Medications
          </Text>

          <Text
            style={
              styles.pageSubtitle
            }
          >
            Manage your current medications.
          </Text>

        </View>


        {/* ADD BUTTON */}

        <Pressable
          onPress={
            onAddMedication
          }
          hitSlop={6}
          style={({ pressed }) => [
            styles.headerAddButton,
            pressed &&
              styles.buttonPressed,
          ]}
        >

          <Text
            style={
              styles.headerAddText
            }
          >
            +
          </Text>

        </Pressable>

      </View>


      {/* CONTENT */}

      {error ? (

        <View
          style={
            styles.errorCard
          }
        >

          <Text
            style={
              styles.errorTitle
            }
          >
            Something went wrong
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>

          <Pressable
            onPress={() =>
              loadMedications()
            }
          >

            <Text
              style={
                styles.retryText
              }
            >
              Try Again
            </Text>

          </Pressable>

        </View>

      ) : (

        <FlatList
          data={medications}

          keyExtractor={(item, index) =>
            item._id ||
            String(index)
          }

          renderItem={
            renderMedication
          }

          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={() =>
                loadMedications(
                  true
                )
              }
              tintColor="#2F6690"
            />
          }

          showsVerticalScrollIndicator={
            false
          }

          contentContainerStyle={
            medications.length === 0
              ? styles.emptyList
              : styles.list
          }

          ListHeaderComponent={
            medications.length > 0 ? (

              <View
                style={
                  styles.countContainer
                }
              >

                <Text
                  style={
                    styles.countText
                  }
                >
                  {medications.length}{' '}
                  {medications.length === 1
                    ? 'medication'
                    : 'medications'}{' '}
                  added
                </Text>

              </View>

            ) : null
          }

          ListEmptyComponent={

            <View
              style={
                styles.emptyContainer
              }
            >

              <View
                style={
                  styles.emptyIconContainer
                }
              >

                <Text
                  style={
                    styles.emptyIcon
                  }
                >
                  💊
                </Text>

              </View>


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
                to start managing your
                medication schedule.
              </Text>


              <Pressable
                onPress={
                  onAddMedication
                }
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
              >

                <Text
                  style={
                    styles.emptyButtonText
                  }
                >
                  + Add Medication
                </Text>

              </Pressable>

            </View>

          }

          ListFooterComponent={

            <View
              style={
                styles.bottomSpacing
              }
            />

          }

        />

      )}

    </View>

  );
}


// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  // ===================================================
  // CONTAINER
  // ===================================================

  container: {
    flex: 1,
    backgroundColor:
      '#EEF5FA',
  },


  // ===================================================
  // BACKGROUND
  // ===================================================

  backgroundCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor:
      '#E0EFF7',
    top: -120,
    right: -90,
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

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
  },


  // ===================================================
  // HEADER
  // ===================================================

  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },

  backButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  backIcon: {
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '300',
    color: '#2F6690',
  },

  backText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#2F6690',
  },

  headerContent: {
    paddingRight: 55,
  },

  pageTitle: {
    fontSize: 27,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  pageSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },

  headerAddButton: {
    position: 'absolute',
    right: 20,
    bottom: 21,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor:
      '#2F6690',
    shadowColor:
      '#2F6690',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  headerAddText: {
    fontSize: 27,
    lineHeight: 29,
    fontWeight: '400',
    color: '#FFFFFF',
  },


  // ===================================================
  // COUNT
  // ===================================================

  countContainer: {
    marginBottom: 10,
  },

  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7A8494',
  },


  // ===================================================
  // LIST
  // ===================================================

  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },


  // ===================================================
  // CARD
  // ===================================================

  card: {
    marginBottom: 12,
    padding: 16,
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

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconContainer: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor:
      '#EAF3F9',
  },

  icon: {
    fontSize: 25,
  },

  medicationInfo: {
    flex: 1,
    marginLeft: 13,
    paddingRight: 8,
  },

  medicationName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  dosage: {
    marginTop: 3,
    fontSize: 12,
    color: '#5F6B7A',
  },

  frequency: {
    marginTop: 2,
    fontSize: 11,
    color: '#8A94A3',
  },


  // ===================================================
  // EDIT BUTTON
  // ===================================================

  editButton: {
    minWidth: 62,
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor:
      '#EAF3F9',
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2F6690',
  },

  deleteMedicationButton: {
    minWidth: 62,
    minHeight: 40,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    marginLeft: 6,
  },

  deleteMedicationText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C',
  },


  // ===================================================
  // DIVIDER
  // ===================================================

  divider: {
    height: 1,
    marginVertical: 14,
    backgroundColor:
      '#EEF1F4',
  },


  // ===================================================
  // DETAILS
  // ===================================================

  detailsRow: {
    flexDirection: 'row',
  },

  detailBlock: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9AA3AF',
  },

  detailValue: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },

  activeStatus: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },

  lowStock: { color: '#B91C1C' },
  stockOkay: { color: '#15803D' },
  stockDetail: { marginTop: 2, fontSize: 10, color: '#9AA3AF' },


  // ===================================================
  // SCHEDULE SECTION
  // ===================================================

  scheduleSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor:
      '#EEF1F4',
  },

  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },

  scheduleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  scheduleCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A94A3',
  },


  // ===================================================
  // SCHEDULE LIST
  // ===================================================

  scheduleList: {
    gap: 8,
  },

  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 55,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor:
      '#F7FAFC',
    borderWidth: 1,
    borderColor:
      '#E8EEF3',
  },


  // ===================================================
  // TIME
  // ===================================================

  timeContainer: {
    minWidth: 82,
  },

  timeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2F6690',
  },


  // ===================================================
  // SCHEDULE INFO
  // ===================================================

  scheduleInfo: {
    flex: 1,
    marginLeft: 5,
  },

  daysText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },

  dateText: {
    marginTop: 3,
    fontSize: 9,
    color: '#8A94A3',
  },


  // ===================================================
  // ENABLED BADGE
  // ===================================================

  enabledBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor:
      '#DCFCE7',
  },

  enabledText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#15803D',
  },

  disabledBadge: {
    backgroundColor:
      '#F3F4F6',
  },

  disabledText: {
    color: '#6B7280',
  },


  // ===================================================
  // NO SCHEDULE
  // ===================================================

  noScheduleBox: {
    padding: 11,
    borderRadius: 10,
    backgroundColor:
      '#F8FAFC',
    borderWidth: 1,
    borderColor:
      '#E8EEF3',
  },

  noScheduleText: {
    fontSize: 11,
    color: '#8A94A3',
  },


  // ===================================================
  // ERROR
  // ===================================================

  errorCard: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 16,
    backgroundColor:
      '#FFFFFF',
    borderWidth: 1,
    borderColor:
      '#FECACA',
  },

  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
  },

  errorText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: '#B91C1C',
  },

  retryText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '800',
    color: '#2F6690',
  },


  // ===================================================
  // EMPTY
  // ===================================================

  emptyList: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 120,
    justifyContent: 'center',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },

  emptyIconContainer: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderRadius: 25,
    backgroundColor:
      '#EAF3F9',
  },

  emptyIcon: {
    fontSize: 36,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1E2A4A',
  },

  emptyText: {
    maxWidth: 300,
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    color: '#6B7280',
  },

  emptyButton: {
    minHeight: 48,
    marginTop: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor:
      '#2F6690',
  },

  emptyButtonText: {
    fontSize: 13,
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
    height: 100,
  },

});