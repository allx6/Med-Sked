import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  View,
  Image,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getMedications,
  getSchedules,
  deleteMedication,
} from '../services/api';

import ConfirmationDialog from '../components/ConfirmationDialog';
import {
  getMedicationExpirationState,
  getSafeUserErrorMessage,
} from '../utils/medicationValidation';


// =====================================================
// SCREEN
// =====================================================

export default function MedicationsScreen({
  token,
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingMedication, setPendingMedication] = useState(null);


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
          getSafeUserErrorMessage(
            err,
            'Unable to load medications. Please check your connection and try again.'
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

  const activeMedicationCount = medications.filter(
    (medication) => !getMedicationExpirationState(medication?.expirationDate).expired
  ).length;
  const unitsInStock = medications.reduce((total, medication) => {
    const quantity = Number(medication.quantityOnHand ?? 0);
    return total + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
  const refillCount = medications.filter(
    (medication) => Number(medication.quantityOnHand ?? 0) <= Number(medication.refillThreshold ?? 0)
  ).length;

  const handleDeleteMedication = (medication) => {
    setPendingMedication(medication);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteMedication = async () => {
    if (!pendingMedication) {
      return;
    }

    try {
      await deleteMedication(token, pendingMedication._id);

      setMedications((previous) =>
        previous.filter((item) => item._id !== pendingMedication._id)
      );

      setSchedules((previous) =>
        previous.filter((item) => {
          const medicationId = item.medicationId?._id || item.medicationId;
          return String(medicationId) !== String(pendingMedication._id);
        })
      );

      setShowDeleteConfirm(false);
      setPendingMedication(null);
    } catch (deleteError) {
      Alert.alert(
        'Delete failed',
        getSafeUserErrorMessage(
          deleteError,
          'Unable to delete this medication. Please try again.'
        )
      );
    }
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

  const formatDayLabel = (day) => {
    const dayLabels = {
      Monday: 'M',
      Tuesday: 'T',
      Wednesday: 'W',
      Thursday: 'TH',
      Friday: 'F',
      Saturday: 'S',
      Sunday: 'S',
    };
    return dayLabels[day] || String(day).slice(0, 2).toUpperCase();
  };


  // =====================================================
  // MEDICATION CARD
  // =====================================================

  const renderMedication = ({
    item,
  }) => {

    const expirationState = getMedicationExpirationState(item?.expirationDate);
    const isExpired = expirationState.expired;

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

          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="pill" size={21} color="#0B4F59" />
          </View>


          <View
            style={
              styles.medicationInfo
            }
          >

            <View style={styles.medicationNameRow}>
              <Text style={styles.medicationName} numberOfLines={1}>
                {item.name || 'Medication'}
              </Text>
              <Text style={isExpired ? styles.expiredInlineBadge : styles.activeInlineBadge}>
                {isExpired ? 'EXPIRED' : 'ACTIVE'}
              </Text>
            </View>


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

            {isExpired ? (
              <Text style={styles.expiredInlineBadge}>Expired</Text>
            ) : expirationState.expirationDate ? (
              <Text style={styles.expirationText}>Expires: {expirationState.expirationDate}</Text>
            ) : null}

          </View>


          {/* EDIT BUTTON */}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name || 'medication'}`}
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

            <MaterialCommunityIcons name="pencil-outline" size={17} color="#FFFFFF" />

          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name || 'medication'}`}
            onPress={() => handleDeleteMedication(item)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.deleteMedicationButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <MaterialCommunityIcons name="delete-outline" size={17} color="#FFFFFF" />
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
              Stock
            </Text>

            <Text
              style={styles.detailValue}
            >
              {Number(item.quantityOnHand ?? 0)} units on hand
            </Text>
            <Text style={styles.stockDetail}>
              Threshold {Number(item.refillThreshold ?? 0)}
            </Text>

          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Refill status</Text>
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

            <View style={styles.scheduleTitleRow}>
              <MaterialCommunityIcons name="calendar-clock" size={15} color="#0B4F59" />
              <Text style={styles.scheduleTitle}>Dose Schedule</Text>
            </View>

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

                    <View style={styles.scheduleInfo}>
                      {Array.isArray(schedule.days) && schedule.days.length > 0 ? (
                        <View style={styles.scheduleDays}>
                          {schedule.days.map((day, dayIndex) => (
                            <View
                              key={`${schedule._id || index}-${dayIndex}`}
                              style={styles.scheduleDay}
                            >
                              <Text style={styles.scheduleDayText}>{formatDayLabel(day)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.daysText}>{formatDays(schedule.days)}</Text>
                      )}


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
                        isExpired
                          ? styles.expiredBadge
                          : !schedule.enabled && styles.disabledBadge,
                      ]}
                    >

                      <Text
                        style={[
                          styles.enabledText,
                          isExpired
                            ? styles.expiredBadgeText
                            : !schedule.enabled && styles.disabledText,
                        ]}
                      >
                        {isExpired
                          ? 'EXPIRED'
                          : schedule.enabled
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
          color="#0B4F59"
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
      <View style={styles.content}>

      {/* HEADER */}

      <View
        style={
          styles.header
        }
      >

        <View
          style={
            styles.headerContent
          }
        >

          <View style={styles.pageTitleRow}>
            <Text style={styles.pageTitle}>My Medication</Text>
            <Image
              accessible
              accessibilityLabel="MedSked logo"
              source={require('../assets/medsked.png')}
              resizeMode="contain"
              style={styles.pageLogo}
            />
          </View>

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

          <Text style={styles.headerAddText}>+ Add</Text>

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
              tintColor="#0B4F59"
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

          ListHeaderComponent={(
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIcon, styles.summaryIconBlue]}>
                  <MaterialCommunityIcons name="pill" size={15} color="#0B4F59" />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryNumber}>{activeMedicationCount}</Text>
                  <Text style={styles.summaryLabel}>Active medications</Text>
                </View>
              </View>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIcon, styles.summaryIconGreen]}>
                  <MaterialCommunityIcons name="check-circle-outline" size={15} color="#16865A" />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryNumber}>{unitsInStock}</Text>
                  <Text style={styles.summaryLabel}>Units in stock</Text>
                </View>
              </View>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIcon, styles.summaryIconRed]}>
                  <MaterialCommunityIcons name="clock-outline" size={15} color="#C65050" />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryNumber}>{refillCount}</Text>
                  <Text style={styles.summaryLabel}>Refills needed</Text>
                </View>
              </View>
            </View>
          )}

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

      <ConfirmationDialog
        visible={showDeleteConfirm}
        title="Delete medication?"
        message={pendingMedication
          ? `Are you sure you want to delete ${pendingMedication.name || 'this medication'}? This will also remove its linked schedules and dose history.`
          : 'Are you sure you want to delete this medication?'}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await confirmDeleteMedication();
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setPendingMedication(null);
        }}
      />

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
      '#116F7A',
  },

  content: {
    flex: 1,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },


  // ===================================================
  // BACKGROUND
  // ===================================================

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

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
  },


  // ===================================================
  // HEADER
  // ===================================================

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 12,
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
    color: '#D8F0F2',
  },

  backText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#D8F0F2',
  },

  headerContent: {
    flex: 1,
    minWidth: 0,
  },

  pageTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },

  pageLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },

  pageTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: '#D7EDF3',
  },

  pageSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: '#A7CDD0',
  },

  headerAddButton: {
    flexShrink: 0,
    marginLeft: 12,
    minWidth: 80,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor:
      '#0B4F59',
  },

  headerAddText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
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

  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  summaryCard: {
    flex: 1,
    minWidth: 150,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
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
    marginRight: 7,
    borderWidth: 1,
    borderRadius: 6,
  },

  summaryIconBlue: {
    backgroundColor: '#C5E3EA',
    borderColor: '#8EBAC5',
  },

  summaryIconGreen: {
    backgroundColor: '#CBE8D8',
    borderColor: '#8BBDA1',
  },

  summaryIconRed: {
    backgroundColor: '#F1D6D4',
    borderColor: '#D9A19D',
  },

  summaryText: {
    flex: 1,
    minWidth: 0,
  },

  summaryNumber: {
    fontSize: 18,
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
  // LIST
  // ===================================================

  list: {
    paddingHorizontal: 36,
    paddingBottom: 20,
  },


  // ===================================================
  // CARD
  // ===================================================

  card: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor:
      '#D7EDF3',
    borderWidth: 1,
    borderColor:
      '#B5D4DC',
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor:
      '#80AEB5',
  },

  icon: {
    fontSize: 25,
  },

  medicationInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    paddingRight: 6,
  },

  medicationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  medicationName: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  dosage: {
    marginTop: 2,
    fontSize: 12,
    color: '#5F6B7A',
  },

  frequency: {
    marginTop: 1,
    fontSize: 10,
    color: '#8A94A3',
  },

  expiredInlineBadge: {
    fontSize: 7,
    fontWeight: '800',
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
  },

  activeInlineBadge: {
    fontSize: 7,
    fontWeight: '800',
    color: '#176B4B',
    backgroundColor: '#BFE3D0',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
  },

  expirationText: {
    marginTop: 6,
    fontSize: 11,
    color: '#0B4F59',
    fontWeight: '600',
  },


  // ===================================================
  // EDIT BUTTON
  // ===================================================

  editButton: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#0B4F59',
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B4F59',
  },

  deleteMedicationButton: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#0B4F59',
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
    flexWrap: 'wrap',
    gap: 6,
  },

  detailBlock: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: '#0B4F59',
  },

  detailLabel: {
    fontSize: 7,
    fontWeight: '600',
    color: '#A7CDD0',
  },

  detailValue: {
    marginTop: 0,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  activeStatus: {
    marginTop: 0,
    fontSize: 9,
    fontWeight: '800',
    color: '#A8E3C3',
  },

  expiredStatus: {
    marginTop: 0,
    fontSize: 9,
    fontWeight: '800',
    color: '#FCA5A5',
  },

  lowStock: { color: '#B91C1C' },
  stockOkay: { color: '#15803D' },
  stockDetail: { marginTop: 0, fontSize: 7, color: '#A7CDD0' },


  // ===================================================
  // SCHEDULE SECTION
  // ===================================================

  scheduleSection: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor:
      '#B5D4DC',
  },

  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  scheduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  scheduleTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  scheduleCount: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8A94A3',
  },


  // ===================================================
  // SCHEDULE LIST
  // ===================================================

  scheduleList: {
    gap: 6,
  },

  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor:
      '#80AEB5',
  },


  // ===================================================
  // TIME
  // ===================================================

  timeContainer: {
    minWidth: 82,
  },

  timeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0B4F59',
  },


  // ===================================================
  // SCHEDULE INFO
  // ===================================================

  scheduleInfo: {
    flex: 1,
    marginLeft: 5,
  },

  scheduleDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },

  scheduleDay: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#0B4F59',
  },

  scheduleDayText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },

  daysText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#374151',
  },

  dateText: {
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#D7EDF3',
    fontSize: 9,
    fontWeight: '700',
    color: '#0B4F59',
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

  expiredBadge: {
    backgroundColor: '#FEE2E2',
  },

  disabledText: {
    color: '#6B7280',
  },

  expiredBadgeText: {
    color: '#B91C1C',
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
    color: '#0B4F59',
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
      '#0B4F59',
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