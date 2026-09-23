import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';

import {
  generateTodayDoses,
  getDoseRecords,
  takeDose,
  skipDose,
  deleteDoseRecord,
} from '../services/api';

import StatusBadge from '../components/StatusBadge';

export default function DoseHistoryScreen({
  token,
  onBack,
}) {
  const { width } = useWindowDimensions();
  const compactLayout = width < 400;

  // =====================================================
  // STATE
  // =====================================================

  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Medication filter
  const [selectedMedication, setSelectedMedication] =
    useState('all');

  // Status filter
  const [selectedStatus, setSelectedStatus] =
    useState('all');

  const [selectedDate, setSelectedDate] =
    useState(() => formatDateForComparison(new Date()));

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
        error.message ||
          'Failed to load dose history.'
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
    return Array.from(
      new Set(
        doses
          .map((dose) => dose.scheduledDate)
          .filter(Boolean)
      )
    ).sort((a, b) => parseLocalDate(a) - parseLocalDate(b));
  }, [doses]);

  // =====================================================
  // FILTER DOSES
  // =====================================================

  const filteredDoses = useMemo(() => {
    let result = [...doses];

    // ---------------------------------------------------
    // MEDICATION FILTER
    // ---------------------------------------------------

    if (selectedMedication !== 'all') {
      result = result.filter(
        (dose) =>
          dose.medicationId?._id ===
          selectedMedication
      );
    }

    if (selectedDate !== 'all') {
      result = result.filter(
        (dose) => dose.scheduledDate === selectedDate
      );
    }

    // ---------------------------------------------------
    // STATUS FILTER
    // ---------------------------------------------------

    if (selectedStatus !== 'all') {
      result = result.filter(
        (dose) =>
          dose.status === selectedStatus
      );
    }

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
        dose.scheduledDate || 'Unknown';

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

  const handleTake = async (doseId) => {
    try {
      const updatedDose = await takeDose(
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
        'Take dose error:',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
          'Failed to mark dose as taken.'
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
        error.message ||
          'Failed to skip dose.'
      );
    }
  };

  // =====================================================
  // DELETE DOSE
  // =====================================================

  const handleDelete = (doseId) => {
    Alert.alert(
      'Delete Dose Record',
      'Are you sure you want to delete this dose record?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',

          onPress: async () => {
            try {
              await deleteDoseRecord(
                token,
                doseId
              );

              setDoses((previous) =>
                previous.filter(
                  (dose) =>
                    dose._id !== doseId
                )
              );
            } catch (error) {
              console.error(
                'Delete dose error:',
                error
              );

              Alert.alert(
                'Error',
                error.message ||
                  'Failed to delete dose record.'
              );
            }
          },
        },
      ]
    );
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

    const today = new Date();

    const yesterday = new Date();
    yesterday.setDate(
      yesterday.getDate() - 1
    );

    const todayString =
      formatDateForComparison(today);

    const yesterdayString =
      formatDateForComparison(yesterday);

    if (dateString === todayString) {
      return 'Today';
    }

    if (dateString === yesterdayString) {
      return 'Yesterday';
    }

    const date =
      parseLocalDate(dateString);

    if (isNaN(date.getTime())) {
      return dateString;
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

    return (
      <View style={styles.card}>

        {/* CARD HEADER */}

        <View style={styles.cardTop}>
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
            Scheduled:{' '}
            {item.scheduledTime ||
              'Not specified'}
          </Text>

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
              {new Date(
                item.takenAt
              ).toLocaleString()}
            </Text>
          ) : null}
        </View>

        {/* ACTION BUTTONS */}

        {status === 'pending' && (
          <View
            style={[styles.actionRow, compactLayout && styles.compactActionRow]}
          >
            <Pressable
              style={styles.takeButton}
              onPress={() =>
                handleTake(item._id)
              }
            >
              <Text
                style={
                  styles.takeButtonText
                }
              >
                Mark as Taken
              </Text>
            </Pressable>

            <Pressable
              style={styles.skipButton}
              onPress={() =>
                handleSkip(item._id)
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

      {/* HEADER */}

      <View style={[styles.header, compactLayout && styles.compactHeader]}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
        >
          <Text
            style={[styles.backText, compactLayout && styles.compactBackText]}
          >
            Back
          </Text>
        </Pressable>

        <View
          style={
            styles.headerTitleContainer
          }
        >
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {availableDates.map((date) => (
              <Pressable
                key={date}
                style={[
                  styles.filterChip,
                  selectedDate === date && styles.activeFilterChip,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedDate === date && styles.activeFilterChipText,
                  ]}
                >
                  {getDateLabel(date)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* MEDICATION FILTER */}

          <Text
            style={styles.filterTitle}
          >
            Medication
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.filterScroll
            }
          >
            {/* ALL */}

            <Pressable
              style={[
                styles.filterChip,

                selectedMedication ===
                  'all' &&
                  styles.activeFilterChip,
              ]}
              onPress={() =>
                setSelectedMedication(
                  'all'
                )
              }
            >
              <Text
                style={[
                  styles.filterChipText,

                  selectedMedication ===
                    'all' &&
                    styles.activeFilterChipText,
                ]}
              >
                All Medications
              </Text>
            </Pressable>

            {/* MEDICATIONS */}

            {medications.map(
              (medication) => (
                <Pressable
                  key={medication.id}
                  style={[
                    styles.filterChip,

                    selectedMedication ===
                      medication.id &&
                      styles.activeFilterChip,
                  ]}
                  onPress={() =>
                    setSelectedMedication(
                      medication.id
                    )
                  }
                >
                  <Text
                    style={[
                      styles.filterChipText,

                      selectedMedication ===
                        medication.id &&
                        styles.activeFilterChipText,
                    ]}
                  >
                    {medication.name}
                  </Text>
                </Pressable>
              )
            )}
          </ScrollView>

          {/* STATUS FILTER */}

          <Text
            style={[
              styles.filterTitle,
              styles.statusFilterTitle,
            ]}
          >
            Status
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.filterScroll
            }
          >
            {[
              {
                key: 'all',
                label: 'All',
              },
              {
                key: 'pending',
                label: 'Pending',
              },
              {
                key: 'taken',
                label: 'Taken',
              },
              {
                key: 'skipped',
                label: 'Skipped',
              },
              {
                key: 'missed',
                label: 'Missed',
              },
            ].map((status) => (
              <Pressable
                key={status.key}
                style={[
                  styles.filterChip,

                  selectedStatus ===
                    status.key &&
                    styles.activeFilterChip,
                ]}
                onPress={() =>
                  setSelectedStatus(
                    status.key
                  )
                }
              >
                <Text
                  style={[
                    styles.filterChipText,

                    selectedStatus ===
                      status.key &&
                      styles.activeFilterChipText,
                  ]}
                >
                  {status.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* RESULT COUNT */}

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
        <FlatList
          data={groupedDoses}
          keyExtractor={(item) =>
            item.date
          }
          renderItem={
            renderDateGroup
          }
          contentContainerStyle={
            groupedDoses.length === 0
              ? styles.emptyList
              : styles.list
          }
          ListEmptyComponent={
            <View
              style={
                styles.emptyContainer
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No matching doses
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Try changing your
                medication or status
                filters.
              </Text>
            </View>
          }
          onRefresh={loadDoses}
          refreshing={loading}
        />
      )}
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
    dose?.scheduledDate || '';

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
    padding: 20,
    backgroundColor: '#87CEEB',
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },

  compactContainer: {
    padding: 12,
  },

  // =================================================
  // HEADER
  // =================================================

  header: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 8,
  },

  compactHeader: {
    marginBottom: 8,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
  },

  backText: {
    color: '#2F6690',
    fontSize: 16,
    fontWeight: '600',
  },

  compactBackText: {
    fontSize: 14,
  },

  headerTitleContainer: {
    marginTop: 4,
    alignItems: 'flex-start',
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E2A4A',
  },

  compactTitle: {
    fontSize: 20,
  },

  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },

  compactSubtitle: {
    fontSize: 12,
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
    marginBottom: 12,
    width: '100%',
    alignItems: 'flex-start',
  },

  filterTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 7,
  },

  statusFilterTitle: {
    marginTop: 12,
  },

  filterScroll: {
    gap: 8,
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingRight: 10,
  },

  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  activeFilterChip: {
    backgroundColor: '#2F6690',
    borderColor: '#2F6690',
  },

  filterChipText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },

  activeFilterChipText: {
    color: '#FFFFFF',
  },

  resultCount: {
    marginTop: 10,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
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
    color: '#6B7280',
    fontSize: 14,
  },

  // =================================================
  // LIST
  // =================================================

  list: {
    paddingBottom: 30,
    width: '100%',
    alignSelf: 'center',
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 100,
  },

  // =================================================
  // DATE GROUP
  // =================================================

  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
    width: '100%',
  },

  dateHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E2A4A',
  },

  dateCount: {
    fontSize: 12,
    color: '#6B7280',
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
    color: '#1E2A4A',
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  // =================================================
  // CARD
  // =================================================

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    alignSelf: 'center',
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  medicationInfo: {
    flex: 1,
    paddingRight: 10,
  },

  medicationName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E2A4A',
  },

  dosage: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 3,
  },

  frequency: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
    gap: 8,
  },

  statusLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },

  // =================================================
  // STATUS
  // =================================================

  statusBadge: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
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
    fontSize: 12,
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
    marginTop: 14,
  },

  detailText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },

  // =================================================
  // ACTIONS
  // =================================================

  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
    flexWrap: 'wrap',
  },

  compactActionRow: {
    gap: 6,
  },

  takeButton: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#2F6690',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },

  takeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  skipButton: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },

  skipButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },

  // =================================================
  // DELETE
  // =================================================

  deleteButton: {
    marginTop: 12,
    alignSelf: 'stretch',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
  },

  deleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});