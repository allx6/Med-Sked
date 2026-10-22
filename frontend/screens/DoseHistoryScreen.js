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
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  generateTodayDoses,
  getDoseRecords,
  takeDose,
  skipDose,
  deleteDoseRecord,
  correctMissedDose,
} from '../services/api';

import StatusBadge from '../components/StatusBadge';
import ConfirmationDialog from '../components/ConfirmationDialog';
import DoseCorrectionDialog from '../components/DoseCorrectionDialog';
import { getDoseActionErrorMessage } from '../utils/doseErrors';
import { getSafeUserErrorMessage } from '../utils/medicationValidation';
import {
  filterDoseHistory,
  getAvailableDoseDates,
  normalizeDoseDate,
} from '../utils/doseHistory';
import {
  formatActualTakenAt,
  getDoseDueDisplay,
  isDoseDue,
  isIntervalFrequency,
} from '../utils/doseTiming';

const DOSE_STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'taken', label: 'Taken' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'missed', label: 'Missed' },
];

export default function DoseHistoryScreen({
  token,
}) {
  const { width } = useWindowDimensions();
  const compactLayout = width < 400;

  // =====================================================
  // STATE
  // =====================================================

  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [doseCorrection, setDoseCorrection] = useState(null);
  const [correctionSaving, setCorrectionSaving] = useState(false);

  // Medication filter
  const [selectedMedication, setSelectedMedication] =
    useState('all');

  // Status filter
  const [selectedStatus, setSelectedStatus] =
    useState('all');

  const [selectedDate, setSelectedDate] =
    useState(() => formatDateForComparison(new Date()));
  const [dateDropdownVisible, setDateDropdownVisible] = useState(false);
  const [medicationDropdownVisible, setMedicationDropdownVisible] = useState(false);
  const [statusDropdownVisible, setStatusDropdownVisible] = useState(false);

  // =====================================================
  // LOAD DOSE RECORDS
  // =====================================================

  const loadDoses = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // -------------------------------------------------
      // GENERATE TODAY'S DOSES FIRST
      // -------------------------------------------------

      await generateTodayDoses(token);

      // -------------------------------------------------
      // THEN LOAD DOSES
      // -------------------------------------------------

      const data = await getDoseRecords(token);

      setDoses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(
        'Error loading dose records:',
        error
      );

      setError(
        getSafeUserErrorMessage(
          error,
          'Unable to load dose history. Please check your connection and try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  // =====================================================
  // LOAD WHEN SCREEN OPENS
  // =====================================================

  useEffect(() => {
    loadDoses();
  }, [loadDoses]);

  // =====================================================
  // GET UNIQUE MEDICATIONS
  // =====================================================

  const medications = useMemo(() => {
    const medicationMap = new Map();

    doses.forEach((dose) => {
      const medication = dose.medicationId;

      if (
        medication &&
        medication._id &&
        medication.name
      ) {
        medicationMap.set(
          medication._id,
          medication.name
        );
      }
    });

    return Array.from(
      medicationMap.entries()
    ).map(([id, name]) => ({
      id,
      name,
    }));
  }, [doses]);

  const availableDates = useMemo(() => {
    return getAvailableDoseDates(doses);
  }, [doses]);

  useEffect(() => {
    if (
      selectedDate !== 'all'
      && availableDates.length > 0
      && !availableDates.includes(selectedDate)
    ) {
      setSelectedDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, selectedDate]);

  // =====================================================
  // FILTER DOSES
  // =====================================================

  const filteredDoses = useMemo(() => {
    const result = filterDoseHistory(doses, {
      selectedDate,
      selectedMedication,
      selectedStatus,
    });

    // ---------------------------------------------------
    // CHRONOLOGICAL ORDER
    // ---------------------------------------------------
    // Oldest -> newest
    // Within the same date:
    // earliest -> latest
    // ---------------------------------------------------

    result.sort((a, b) => {
      const dateA = createDoseDate(a);
      const dateB = createDoseDate(b);

      return dateA - dateB;
    });

    return result;
  }, [
    doses,
    selectedMedication,
    selectedStatus,
    selectedDate,
  ]);

  // =====================================================
  // GROUP DOSES BY DATE
  // =====================================================

  const groupedDoses = useMemo(() => {
    const groups = {};

    filteredDoses.forEach((dose) => {
      const date =
        normalizeDoseDate(dose.scheduledDate) || 'Unknown';

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date].push(dose);
    });

    return Object.keys(groups)
      .sort((a, b) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;

        return (
          parseLocalDate(a) -
          parseLocalDate(b)
        );
      })
      .map((date) => ({
        date,
        doses: groups[date],
      }));
  }, [filteredDoses]);

  // =====================================================
  // MARK AS TAKEN
  // =====================================================

  const handleTake = async (doseId, earlyDoseConfirmed = false) => {
    try {
      const updatedDose = await takeDose(
        token,
        doseId,
        { earlyDoseConfirmed }
      );

      setDoses((previous) =>
        previous.map((dose) =>
          dose._id === doseId
            ? updatedDose
            : dose
        )
      );
    } catch (error) {
      console.error(
        'Take dose error:',
        error
      );

      Alert.alert(
        'Error',
        getDoseActionErrorMessage(error)
      );
    }
  };

  // =====================================================
  // MARK AS SKIPPED
  // =====================================================

  const handleSkip = async (doseId) => {
    try {
      const updatedDose = await skipDose(
        token,
        doseId
      );

      setDoses((previous) =>
        previous.map((dose) =>
          dose._id === doseId
            ? updatedDose
            : dose
        )
      );
    } catch (error) {
      console.error(
        'Skip dose error:',
        error
      );

      Alert.alert(
        'Error',
        getDoseActionErrorMessage(error)
      );
    }
  };

  const submitDoseCorrection = async (correction) => {
    if (!doseCorrection?.doseId) return;
    try {
      setCorrectionSaving(true);
      const updatedDose = await correctMissedDose(
        token,
        doseCorrection.doseId,
        correction
      );
      setDoses((previous) => previous.map((dose) => (
        dose._id === doseCorrection.doseId ? updatedDose : dose
      )));
      setDoseCorrection(null);
    } catch (correctionError) {
      console.error('Dose correction error:', correctionError);
      Alert.alert(
        'Unable to correct dose record',
        getDoseActionErrorMessage(correctionError)
      );
    } finally {
      setCorrectionSaving(false);
    }
  };

  // =====================================================
  // DELETE DOSE
  // =====================================================

  const handleDelete = (doseId) => {
    setPendingAction({
      doseId,
      action: 'delete',
      confirmLabel: 'Delete',
    });
    setShowActionDialog(true);
  };

  const requestDoseAction = (doseId, action, earlyDoseConfirmed = false) => {
    setPendingAction({ doseId, action, earlyDoseConfirmed });
    setShowActionDialog(true);
  };

  const confirmPendingDoseAction = async () => {
    if (!pendingAction) {
      return;
    }

    const { doseId, action } = pendingAction;

    try {
      if (action === 'take') {
        const updatedDose = await takeDose(token, doseId, {
          earlyDoseConfirmed: pendingAction.earlyDoseConfirmed,
        });
        setDoses((previous) =>
          previous.map((dose) =>
            dose._id === doseId ? updatedDose : dose
          )
        );
      } else if (action === 'skip') {
        const updatedDose = await skipDose(token, doseId);
        setDoses((previous) =>
          previous.map((dose) =>
            dose._id === doseId ? updatedDose : dose
          )
        );
      } else if (action === 'delete') {
        await deleteDoseRecord(token, doseId);
        setDoses((previous) =>
          previous.filter((dose) => dose._id !== doseId)
        );
      }

      setShowActionDialog(false);
      setPendingAction(null);
    } catch (error) {
      console.error(
        'Dose action error:',
        error
      );

      Alert.alert(
        'Error',
        action === 'delete'
          ? error.message || 'Unable to delete the dose. Please try again.'
          : getDoseActionErrorMessage(error)
      );
    }
  };

  // =====================================================
  // STATUS TEXT
  // =====================================================

  const getStatusText = (status) => {
    switch (status) {
      case 'taken':
        return 'Taken';

      case 'missed':
        return 'Missed';

      case 'skipped':
        return 'Skipped';

      case 'pending':
      default:
        return 'Pending';
    }
  };

  // =====================================================
  // DATE LABEL
  // =====================================================

  const getDateLabel = (dateString) => {
    if (!dateString) {
      return 'Unknown Date';
    }
    if (dateString === 'all') {
      return 'All dates';
    }

    const normalizedDate = normalizeDoseDate(dateString) || dateString;

    const today = new Date();

    const yesterday = new Date();
    yesterday.setDate(
      yesterday.getDate() - 1
    );

    const todayString =
      formatDateForComparison(today);

    const yesterdayString =
      formatDateForComparison(yesterday);

    if (normalizedDate === todayString) {
      return 'Today';
    }

    if (normalizedDate === yesterdayString) {
      return 'Yesterday';
    }

    const date =
      parseLocalDate(normalizedDate);

    if (isNaN(date.getTime())) {
      return normalizedDate;
    }

    return date.toLocaleDateString(
      undefined,
      {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }
    );
  };

  // =====================================================
  // DOSE CARD
  // =====================================================

  const renderDose = ({ item }) => {
    const medication =
      item.medicationId;

    const schedule =
      item.scheduleId;

    const medicationName =
      medication?.name ||
      'Unknown medication';

    const dosage =
      medication?.dosage || '';

    const frequency =
      medication?.frequency || '';

    const status =
      item.status || 'pending';
    const dueDisplay = getDoseDueDisplay(item);
    const canTakeNow = isDoseDue(item);
    const canConfirmEarly = isIntervalFrequency(medication);

    return (
      <View style={styles.card}>

        {/* CARD HEADER */}

        <View style={styles.cardTop}>
          <View style={styles.medicationIcon}>
            <MaterialCommunityIcons name="pill" size={17} color="#0B4F59" />
          </View>
          <View
            style={styles.medicationInfo}
          >
            <Text
              style={
                styles.medicationName
              }
            >
              {medicationName}
            </Text>

            {dosage ? (
              <Text
                style={styles.dosage}
              >
                {dosage}
              </Text>
            ) : null}

            {frequency ? (
              <Text
                style={styles.frequency}
              >
                {frequency}
              </Text>
            ) : null}

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <StatusBadge
                status={status}
                label={getStatusText(status)}
              />
            </View>
          </View>
        </View>

        {/* DOSE DETAILS */}

        <View style={styles.details}>
          <Text
            style={styles.detailText}
          >
            {dueDisplay.adjusted ? 'Adjusted due: ' : 'Scheduled: '}
            {dueDisplay.date ? `${dueDisplay.date} at ` : ''}
            {dueDisplay.time}
          </Text>

          {dueDisplay.adjusted ? (
            <Text style={styles.detailText}>
              Original schedule: {item.scheduledDate} at {item.scheduledTime}
            </Text>
          ) : null}

          {schedule?.dose ? (
            <Text style={styles.detailText}>
              Dose: {schedule.dose}
            </Text>
          ) : null}

          {schedule?.days?.length > 0 ? (
            <Text
              style={styles.detailText}
            >
              Schedule:{' '}
              {schedule.days.join(', ')}
            </Text>
          ) : null}

          {item.takenAt ? (
            <Text
              style={styles.detailText}
            >
              Taken:{' '}
              {formatActualTakenAt(item.takenAt)}
              {item.takenTiming ? ` (${item.takenTiming.replace('_', ' ')})` : ''}
              {item.takenByRole ? ` - recorded by ${item.takenByRole}` : ''}
            </Text>
          ) : null}
          {item.correctionReason ? (
            <Text style={styles.detailText}>
              Correction reason: {item.correctionReason}
            </Text>
          ) : null}
          {item.correctedAt ? (
            <Text style={styles.detailText}>
              Corrected: {formatActualTakenAt(item.correctedAt)}
            </Text>
          ) : null}
        </View>

        {/* ACTION BUTTONS */}

        {status === 'pending' && (
          <View
            style={[styles.actionRow, compactLayout && styles.compactActionRow]}
          >
            {canTakeNow ? (
              <Pressable
                style={styles.takeButton}
                onPress={() => requestDoseAction(item._id, 'take')}
              >
                <Text style={styles.takeButtonText}>Mark as Taken</Text>
              </Pressable>
            ) : canConfirmEarly ? (
              <Pressable
                style={[styles.takeButton, styles.earlyDoseButton]}
                onPress={() => requestDoseAction(item._id, 'take', true)}
              >
                <Text style={styles.takeButtonText}>Confirm Early Dose</Text>
              </Pressable>
            ) : (
              <Text style={styles.notDueText}>Not due yet</Text>
            )}

            <Pressable
              style={styles.skipButton}
              onPress={() =>
                requestDoseAction(item._id, 'skip')
              }
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

        {status === 'missed' ? (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.takeButton, styles.correctionButton]}
              onPress={() => setDoseCorrection({
                doseId: item._id,
                medicationName,
              })}
            >
              <Text style={styles.takeButtonText}>Correct missed record</Text>
            </Pressable>
          </View>
        ) : null}

        {/* DELETE PENDING RECORDS ONLY */}

        {status === 'pending' && (
          <Pressable
            style={styles.deleteButton}
            onPress={() =>
              handleDelete(item._id)
            }
          >
            <Text style={styles.deleteText}>
              Delete Record
            </Text>
          </Pressable>
        )}

      </View>
    );
  };

  // =====================================================
  // DATE GROUP
  // =====================================================

  const renderDateGroup = ({ item }) => {
    return (
      <View>

        {/* DATE HEADER */}

        <View
          style={styles.dateHeader}
        >
          <Text
            style={
              styles.dateHeaderText
            }
          >
            {getDateLabel(item.date)}
          </Text>

          <Text
            style={styles.dateCount}
          >
            {item.doses.length}{' '}
            {item.doses.length === 1
              ? 'dose'
              : 'doses'}
          </Text>
        </View>

        {/* DOSES */}

        {item.doses.map((dose) => (
          <View key={dose._id}>
            {renderDose({
              item: dose,
            })}
          </View>
        ))}

      </View>
    );
  };

  // =====================================================
  // SCREEN
  // =====================================================

  return (
    <View style={[styles.container, compactLayout && styles.compactContainer]}>
      <View style={styles.decorCircle} pointerEvents="none" />

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenScrollContent}
        refreshControl={(
          <RefreshControl
            refreshing={loading && doses.length > 0}
            onRefresh={loadDoses}
          />
        )}
      >
      {/* HEADER */}

      <View style={styles.brandHeader}>
        <Image
          accessible
          accessibilityLabel="MedSked logo"
          source={require('../assets/medsked.png')}
          resizeMode="contain"
          style={styles.logo}
        />
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.title, compactLayout && styles.compactTitle]}>
            Dose History
          </Text>

          <Text
            style={[styles.subtitle, compactLayout && styles.compactSubtitle]}
          >
            Track your medication doses
          </Text>
        </View>
      </View>

      {/* ERROR */}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>
            {error}
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={loadDoses}
          >
            <Text
              style={styles.retryText}
            >
              Retry
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* FILTERS */}

      {!loading && (
        <View
          style={
            styles.filterSection
          }
        >
          <Text style={styles.filterTitle}>Date</Text>

          <View style={styles.filterRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose dose history date"
              accessibilityState={{ expanded: dateDropdownVisible }}
              style={styles.dateDropdownButton}
              onPress={() => {
                setDateDropdownVisible((current) => !current);
                setMedicationDropdownVisible(false);
                setStatusDropdownVisible(false);
              }}
            >
              <Text style={styles.dateDropdownText}>
                {getDateLabel(selectedDate)}
              </Text>
              <MaterialCommunityIcons
                name={dateDropdownVisible ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#D7EDF3"
              />
            </Pressable>

            {dateDropdownVisible ? (
              <View style={styles.dateDropdownList}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  style={styles.dateDropdownScroll}
                  contentContainerStyle={styles.dateDropdownScrollContent}
                >
                  <Pressable
                    style={[
                      styles.dateDropdownItem,
                      selectedDate === 'all' && styles.dateDropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedDate('all');
                      setDateDropdownVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dateDropdownItemText,
                        selectedDate === 'all' && styles.dateDropdownItemTextActive,
                      ]}
                    >
                      All dates
                    </Text>
                  </Pressable>
                  {availableDates.map((date) => (
                    <Pressable
                      key={date}
                      style={[
                        styles.dateDropdownItem,
                        selectedDate === date && styles.dateDropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedDate(date);
                        setDateDropdownVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dateDropdownItemText,
                          selectedDate === date && styles.dateDropdownItemTextActive,
                        ]}
                      >
                        {getDateLabel(date)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          {/* MEDICATION FILTER */}

          <Text
            style={styles.filterTitle}
          >
            Medication
          </Text>

          <View style={styles.filterRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose medication"
              accessibilityState={{ expanded: medicationDropdownVisible }}
              style={styles.dateDropdownButton}
              onPress={() => {
                setMedicationDropdownVisible((current) => !current);
                setDateDropdownVisible(false);
                setStatusDropdownVisible(false);
              }}
            >
              <Text style={styles.dateDropdownText}>
                {selectedMedication === 'all'
                  ? 'All Medications'
                  : medications.find((medication) => medication.id === selectedMedication)?.name || 'All Medications'}
              </Text>
              <MaterialCommunityIcons
                name={medicationDropdownVisible ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#D7EDF3"
              />
            </Pressable>

            {medicationDropdownVisible ? (
              <View style={styles.dateDropdownList}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  style={styles.dateDropdownScroll}
                  contentContainerStyle={styles.dateDropdownScrollContent}
                >
                  {[
                    { id: 'all', name: 'All Medications' },
                    ...medications,
                  ].map((medication) => (
                    <Pressable
                      key={medication.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedMedication === medication.id }}
                      style={[
                        styles.dateDropdownItem,
                        selectedMedication === medication.id && styles.dateDropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedMedication(medication.id);
                        setMedicationDropdownVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dateDropdownItemText,
                          selectedMedication === medication.id && styles.dateDropdownItemTextActive,
                        ]}
                      >
                        {medication.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          {/* STATUS FILTER */}

          <Text
            style={[
              styles.filterTitle,
              styles.statusFilterTitle,
            ]}
          >
            Status
          </Text>

          <View style={styles.filterRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose dose status"
              accessibilityState={{ expanded: statusDropdownVisible }}
              style={styles.dateDropdownButton}
              onPress={() => {
                setStatusDropdownVisible((current) => !current);
                setDateDropdownVisible(false);
                setMedicationDropdownVisible(false);
              }}
            >
              <Text style={styles.dateDropdownText}>
                {DOSE_STATUS_OPTIONS.find((status) => status.key === selectedStatus)?.label || 'All'}
              </Text>
              <MaterialCommunityIcons
                name={statusDropdownVisible ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#D7EDF3"
              />
            </Pressable>

            {statusDropdownVisible ? (
              <View style={styles.dateDropdownList}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  style={styles.dateDropdownScroll}
                  contentContainerStyle={styles.dateDropdownScrollContent}
                >
                  {DOSE_STATUS_OPTIONS.map((status) => (
                    <Pressable
                      key={status.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedStatus === status.key }}
                      style={[
                        styles.dateDropdownItem,
                        selectedStatus === status.key && styles.dateDropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedStatus(status.key);
                        setStatusDropdownVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dateDropdownItemText,
                          selectedStatus === status.key && styles.dateDropdownItemTextActive,
                        ]}
                      >
                        {status.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <Text
            style={styles.resultCount}
          >
            Showing{' '}
            {filteredDoses.length}{' '}
            {filteredDoses.length === 1
              ? 'dose'
              : 'doses'}
          </Text>
        </View>
      )}

      {/* CONTENT */}

      {loading ? (
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
          />

          <Text
            style={styles.loadingText}
          >
            Generating dose history...
          </Text>
        </View>
      ) : (
        groupedDoses.length === 0 ? (
          <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No matching doses</Text>

              <Text style={styles.emptyText}>
                Try changing your medication or status filters.
              </Text>
          </View>
        ) : (
          groupedDoses.map((item) => (
            <View key={item.date}>
              {renderDateGroup({ item })}
            </View>
          ))
        )
      )}
      </ScrollView>

      <ConfirmationDialog
        visible={showActionDialog}
        title={
          pendingAction?.action === 'take'
            ? 'Mark dose as taken?'
            : pendingAction?.action === 'skip'
              ? 'Skip this dose?'
              : 'Delete dose record?'
        }
        message={
          pendingAction?.action === 'take'
            ? pendingAction.earlyDoseConfirmed
              ? 'This dose is scheduled for later. Confirm only if your prescription or care team specifically instructs you to take it now. The minimum interval must also be verified.'
              : 'You are about to mark this dose as taken.'
            : pendingAction?.action === 'skip'
              ? 'You are about to skip this dose.'
              : 'Are you sure you want to delete this dose history record?'
        }
        confirmLabel={
          pendingAction?.action === 'take'
            ? pendingAction.earlyDoseConfirmed
              ? 'Confirm Early Dose'
              : 'Mark as Taken'
            : pendingAction?.action === 'skip'
              ? 'Skip'
              : 'Delete'
        }
        cancelLabel="Cancel"
        danger={pendingAction?.action === 'delete'}
        onConfirm={async () => {
          setShowActionDialog(false);
          await confirmPendingDoseAction();
        }}
        onCancel={() => {
          setShowActionDialog(false);
          setPendingAction(null);
        }}
      />
      <DoseCorrectionDialog
        visible={Boolean(doseCorrection)}
        doseName={doseCorrection?.medicationName}
        submitting={correctionSaving}
        onCancel={() => {
          if (!correctionSaving) setDoseCorrection(null);
        }}
        onSubmit={submitDoseCorrection}
      />
    </View>
  );
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// -----------------------------------------------------
// CREATE DATE FROM DOSE
// -----------------------------------------------------

const createDoseDate = (dose) => {
  const date =
    normalizeDoseDate(dose?.scheduledDate) || '';

  const time =
    dose?.scheduledTime ||
    '12:00 AM';

  const parsedTime =
    parseTimeForSorting(time);

  const localDate =
    parseLocalDate(date);

  if (isNaN(localDate.getTime())) {
    return new Date(0);
  }

  localDate.setHours(
    parsedTime.hours,
    parsedTime.minutes,
    0,
    0
  );

  return localDate;
};

// -----------------------------------------------------
// PARSE DATE
// -----------------------------------------------------
// Avoids UTC timezone problems caused by:
//
// new Date("2026-09-08")
// -----------------------------------------------------

const parseLocalDate = (dateString) => {
  if (!dateString) {
    return new Date(NaN);
  }

  const parts =
    String(dateString).split('-');

  if (parts.length !== 3) {
    const fallback =
      new Date(dateString);

    return fallback;
  }

  const year =
    parseInt(parts[0], 10);

  const month =
    parseInt(parts[1], 10) - 1;

  const day =
    parseInt(parts[2], 10);

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day)
  ) {
    return new Date(NaN);
  }

  return new Date(
    year,
    month,
    day
  );
};


// -----------------------------------------------------
// FORMAT DATE FOR COMPARISON
// -----------------------------------------------------

const formatDateForComparison = (
  date
) => {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// -----------------------------------------------------
// PARSE TIME FOR SORTING
// -----------------------------------------------------

const parseTimeForSorting = (
  timeString
) => {
  if (!timeString) {
    return {
      hours: 0,
      minutes: 0,
    };
  }

  const normalizedTime = String(timeString).trim();
  const twelveHourMatch = normalizedTime.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  const twentyFourHourMatch = normalizedTime.match(
    /^(\d{2}):(\d{2})$/
  );

  if (!twelveHourMatch && !twentyFourHourMatch) {
    return {
      hours: 0,
      minutes: 0,
    };
  }

  if (twentyFourHourMatch) {
    return {
      hours: parseInt(twentyFourHourMatch[1], 10),
      minutes: parseInt(twentyFourHourMatch[2], 10),
    };
  }

  let hours =
    parseInt(twelveHourMatch[1], 10);

  const minutes =
    parseInt(twelveHourMatch[2], 10);

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

  return {
    hours,
    minutes,
  };
};

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 0,
    backgroundColor: '#116F7A',
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    overflow: 'hidden',
  },

  compactContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  screenScroll: {
    flex: 1,
    width: '100%',
  },

  screenScrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },

  // =================================================
  // HEADER
  // =================================================

  header: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 10,
  },

  compactHeader: {
    marginBottom: 8,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
  },

  backText: {
    color: '#D8F0F2',
    fontSize: 16,
    fontWeight: '600',
  },

  compactBackText: {
    fontSize: 14,
  },

  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
  },

  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  logo: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },

  decorCircle: {
    position: 'absolute',
    top: -38,
    right: -62,
    width: 125,
    height: 125,
    borderRadius: 63,
    backgroundColor: '#3D929B',
  },

  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D7EDF3',
  },

  compactTitle: {
    fontSize: 17,
  },

  subtitle: {
    fontSize: 9,
    color: '#A7CDD0',
    marginTop: 2,
  },

  compactSubtitle: {
    fontSize: 8,
  },

  // =================================================
  // ERROR
  // =================================================

  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  error: {
    color: '#B91C1C',
    fontSize: 13,
    marginBottom: 8,
  },

  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  retryText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },

  // =================================================
  // FILTERS
  // =================================================

  filterSection: {
    marginBottom: 8,
    width: '100%',
    alignItems: 'stretch',
  },

  filterRow: {
    width: '100%',
    overflow: 'visible',
  },

  dateDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B4F59',
    borderWidth: 1,
    borderColor: '#D7EDF3',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },

  dateDropdownText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  dateDropdownList: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7EDF3',
    maxHeight: 90,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  dateDropdownScroll: {
    maxHeight: 88,
  },

  dateDropdownScrollContent: {
    paddingVertical: 6,
  },

  dateDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EEF1',
  },

  dateDropdownItemActive: {
    backgroundColor: '#EAF7F8',
  },

  dateDropdownItemText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '600',
  },

  dateDropdownItemTextActive: {
    color: '#0B4F59',
  },

  filterTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#A7CDD0',
    marginBottom: 4,
    textTransform: 'uppercase',
  },

  statusFilterTitle: {
    marginTop: 8,
  },

  resultCount: {
    marginTop: 5,
    fontSize: 8,
    color: '#A7CDD0',
    textAlign: 'left',
    textTransform: 'uppercase',
  },

  // =================================================
  // LOADING
  // =================================================

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#A7CDD0',
    fontSize: 14,
  },

  // =================================================
  // DATE GROUP
  // =================================================

  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 6,
    paddingHorizontal: 2,
    width: '100%',
  },

  dateHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

  dateCount: {
    fontSize: 8,
    color: '#A7CDD0',
  },

  // =================================================
  // EMPTY
  // =================================================

  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    color: '#A7CDD0',
    textAlign: 'center',
    lineHeight: 20,
  },

  // =================================================
  // CARD
  // =================================================

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D7EDF3',
    width: '100%',
    alignSelf: 'center',
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  medicationIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#80AEB5',
  },

  medicationInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    paddingRight: 4,
  },

  medicationName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E2A4A',
  },

  dosage: {
    fontSize: 8,
    color: '#7A8494',
    marginTop: 1,
  },

  frequency: {
    fontSize: 8,
    color: '#7A8494',
    marginTop: 1,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },

  statusLabel: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: '600',
  },

  // =================================================
  // STATUS
  // =================================================

  statusBadge: {
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },

  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },

  takenBadge: {
    backgroundColor: '#DCFCE7',
  },

  skippedBadge: {
    backgroundColor: '#E5E7EB',
  },

  missedBadge: {
    backgroundColor: '#FEE2E2',
  },

  statusText: {
    fontSize: 8,
    fontWeight: '700',
  },

  pendingStatusText: {
    color: '#92400E',
  },

  takenStatusText: {
    color: '#166534',
  },

  skippedStatusText: {
    color: '#374151',
  },

  missedStatusText: {
    color: '#B91C1C',
  },

  // =================================================
  // DETAILS
  // =================================================

  details: {
    marginTop: 9,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#E0E8EB',
  },

  detailText: {
    fontSize: 8,
    color: '#718991',
    marginBottom: 3,
  },

  // =================================================
  // ACTIONS
  // =================================================

  actionRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },

  compactActionRow: {
    gap: 6,
  },

  takeButton: {
    flex: 1,
    minWidth: 120,
    minHeight: 32,
    justifyContent: 'center',
    backgroundColor: '#218C73',
    borderRadius: 5,
    alignItems: 'center',
  },

  earlyDoseButton: {
    backgroundColor: '#8A5A00',
  },

  correctionButton: {
    backgroundColor: '#455A64',
  },

  notDueText: {
    flex: 1,
    minHeight: 42,
    color: '#718991',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
  },

  takeButtonText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },

  skipButton: {
    flex: 1,
    minWidth: 120,
    minHeight: 32,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#9AAAB0',
    borderRadius: 5,
    alignItems: 'center',
  },

  skipButtonText: {
    color: '#B91C1C',
    fontSize: 9,
    fontWeight: '700',
  },

  // =================================================
  // DELETE
  // =================================================

  deleteButton: {
    marginTop: 4,
    alignSelf: 'flex-end',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },

  deleteText: {
    color: '#B91C1C',
    fontSize: 8,
    fontWeight: '700',
  },
});