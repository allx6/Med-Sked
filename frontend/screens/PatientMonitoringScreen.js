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
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  deleteMedication,
  deleteSchedule,
  getPatientOverview,
  takePatientDose,
  skipPatientDose,
  deleteDoseRecord,
} from '../services/api';
import { colors, radius, spacing, shadow } from '../theme';
import ConfirmationDialog from '../components/ConfirmationDialog';
import {
  getMedicationExpirationState,
  getSafeUserErrorMessage,
} from '../utils/medicationValidation';
import { isMedicationLowStock } from '../utils/medicationStock';
import {
  filterDoseHistory,
  getAvailableDoseDates,
  normalizeDoseDate,
} from '../utils/doseHistory';

const DOSE_STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'taken', label: 'Taken' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'missed', label: 'Missed' },
];

export default function PatientMonitoringScreen({
  token,
  patient,
  onBack,
  onOpenAnalytics,
  onOpenAiAssistant,
  onAddMedication,
  onEditMedication,
  onAddSchedule,
  onEditSchedule,
}) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [selectedSection, setSelectedSection] = useState('medications');
  const [confirmation, setConfirmation] = useState(null);
  const [selectedDoseDate, setSelectedDoseDate] = useState(getTodayDateString);
  const [selectedDoseMedication, setSelectedDoseMedication] = useState('all');
  const [selectedDoseStatus, setSelectedDoseStatus] = useState('all');
  const [dateDropdownVisible, setDateDropdownVisible] = useState(false);
  const [medicationDropdownVisible, setMedicationDropdownVisible] = useState(false);
  const [statusDropdownVisible, setStatusDropdownVisible] = useState(false);

  const loadOverview = useCallback(async (isRefresh = false) => {
    if (!patient?._id) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');
      const data = await getPatientOverview(token, patient._id);
      setOverview(data || null);
    } catch (err) {
      console.error('Patient overview error:', err);
      setError(
        getSafeUserErrorMessage(
          err,
          'Unable to load patient overview. Please check your connection and try again.'
        )
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patient, token]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const patientName = patient?.username || patient?.name || 'Patient';
  const patientId = patient?.patientId || patient?._id || 'Unknown';
  const permission = overview?.relationship?.permission || 'VIEW_ONLY';
  const canSupportAdherence = permission === 'ADHERENCE_SUPPORT';
  const adherence = overview?.adherence?.percentage ?? 0;
  const todayDoses = overview?.todayDoses || [];
  const doseHistory = overview?.doses || [];
  const medications = overview?.medications || [];
  const schedules = overview?.schedules || [];
  const availableDoseDates = useMemo(
    () => getAvailableDoseDates(doseHistory),
    [doseHistory]
  );
  const filteredDoseHistory = useMemo(
    () => filterDoseHistory(doseHistory, {
      selectedDate: selectedDoseDate,
      selectedMedication: selectedDoseMedication,
      selectedStatus: selectedDoseStatus,
    }),
    [doseHistory, selectedDoseDate, selectedDoseMedication, selectedDoseStatus]
  );

  useEffect(() => {
    if (
      selectedDoseDate !== 'all'
      && availableDoseDates.length > 0
      && !availableDoseDates.includes(selectedDoseDate)
    ) {
      setSelectedDoseDate(availableDoseDates[availableDoseDates.length - 1]);
    }
  }, [availableDoseDates, selectedDoseDate]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading patient summary...</Text>
      </View>
    );
  }

  const handleDoseAction = async (doseId, action) => {
    try {
      setActionId(doseId);
      const updatedDose = action === 'take'
        ? await takePatientDose(token, doseId, patient?._id)
        : await skipPatientDose(token, doseId, patient?._id);

      setOverview((current) => {
        if (!current) return current;

        const nextTodayDoses = (current.todayDoses || []).map((dose) => (
          dose._id === doseId ? updatedDose : dose
        ));

        const nextDoseHistory = (current.doses || []).map((dose) => (
          dose._id === doseId ? updatedDose : dose
        ));

        const total = nextTodayDoses.length;
        const taken = nextTodayDoses.filter((dose) => dose.status === 'taken').length;
        const pending = nextTodayDoses.filter((dose) => dose.status === 'pending').length;
        const missed = nextTodayDoses.filter((dose) => dose.status === 'missed').length;
        const skipped = nextTodayDoses.filter((dose) => dose.status === 'skipped').length;
        const eligible = taken + missed + skipped;

        return {
          ...current,
          todayDoses: nextTodayDoses,
          doses: nextDoseHistory,
          adherence: {
            ...(current.adherence || {}),
            total,
            taken,
            pending,
            missed,
            skipped,
            percentage: eligible > 0 ? Math.round((taken / eligible) * 100) : 0,
          },
        };
      });

    } catch {
      Alert.alert(
        'Unable to update dose',
        action === 'take'
          ? 'Unable to mark this dose as taken. Please try again.'
          : 'Unable to skip this dose. Please try again.'
      );
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteMedication = async (medication) => {
    try {
      setActionId(medication._id);
      await deleteMedication(token, medication._id, patient?._id);
      await loadOverview(true);
    } catch (err) {
      setError(
        getSafeUserErrorMessage(
          err,
          'Unable to delete this medication. Please try again.'
        )
      );
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteSchedule = async (schedule) => {
    try {
      setActionId(schedule._id);
      await deleteSchedule(token, schedule._id, patient?._id);
      await loadOverview(true);
    } catch (err) {
      setError(
        getSafeUserErrorMessage(
          err,
          'Unable to delete this schedule. Please try again.'
        )
      );
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteDose = async (dose) => {
    try {
      setActionId(dose._id);
      await deleteDoseRecord(token, dose._id, patient?._id);
      setOverview((current) => {
        if (!current) return current;

        const isTodayPending = normalizeDoseDate(dose.scheduledDate) === getTodayDateString()
          && dose.status === 'pending';
        const todayDoses = (current.todayDoses || []).filter((item) => item._id !== dose._id);

        return {
          ...current,
          doses: (current.doses || []).filter((item) => item._id !== dose._id),
          todayDoses,
          adherence: isTodayPending
            ? {
              ...current.adherence,
              total: Math.max(0, (current.adherence?.total || 0) - 1),
              pending: Math.max(0, (current.adherence?.pending || 0) - 1),
            }
            : current.adherence,
        };
      });
    } catch (err) {
      setError(
        getSafeUserErrorMessage(
          err,
          'Unable to delete this pending dose. Please try again.'
        )
      );
    } finally {
      setActionId(null);
    }
  };

  const confirmAction = async () => {
    const current = confirmation;
    setConfirmation(null);

    if (current?.type === 'medication') {
      await handleDeleteMedication(current.item);
    } else if (current?.type === 'schedule') {
      await handleDeleteSchedule(current.item);
    } else if (current?.type === 'dose') {
      await handleDoseAction(current.doseId, current.action);
    } else if (current?.type === 'dose-delete') {
      await handleDeleteDose(current.item);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOverview(true)} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={8}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={25} color="#D8F0F2" />
        </Pressable>

        <Text style={styles.pageTitle}>{patientName}</Text>
        <Text style={styles.pageSubtitle}>Patient monitoring • {patientId}</Text>

        <Pressable onPress={onOpenAnalytics} style={styles.analyticsButton}>
          <MaterialCommunityIcons name="chart-line" size={18} color={colors.primary} />
          <Text style={styles.analyticsButtonText}>View Adherence Analytics</Text>
        </Pressable>

        {patient?._id && onOpenAiAssistant ? (
          <Pressable onPress={() => onOpenAiAssistant?.()} style={styles.aiButton}>
            <View style={styles.aiIconWrap}>
              <MaterialCommunityIcons name="robot-outline" size={21} color={colors.primary} />
            </View>
            <View style={styles.aiTextWrap}>
              <Text style={styles.aiButtonTitle}>Ask MedSked AI</Text>
              <Text style={styles.aiButtonSubtitle}>Ask about this patient's medications, doses, adherence, or refills.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={23} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}><MaterialCommunityIcons name="chart-donut" size={19} color={colors.primary} /></View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Adherence</Text>
              <Text style={styles.summaryValue}>{adherence}%</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}><MaterialCommunityIcons name="pill" size={19} color={colors.primary} /></View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Medications</Text>
              <Text style={styles.summaryValue}>{medications.length}</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}><MaterialCommunityIcons name="calendar-month-outline" size={19} color={colors.primary} /></View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Schedules</Text>
              <Text style={styles.summaryValue}>{schedules.length}</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}><MaterialCommunityIcons name="clock-check-outline" size={19} color={colors.primary} /></View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Today</Text>
              <Text style={styles.summaryValue}>{todayDoses.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.todayDosesBox}>
          <View style={styles.todayDosesHeader}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIconWrap}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.todayDosesTitle}>Today's doses</Text>
            </View>
            <Text style={styles.todayDosesCount}>{todayDoses.length}</Text>
          </View>
          {todayDoses.length === 0 ? (
            <Text style={styles.todayDosesEmpty}>No doses scheduled today.</Text>
          ) : (
            todayDoses.map((dose) => {
              const medication = dose.medicationId || {};

              return (
                <View key={dose._id} style={styles.todayDoseRow}>
                  <View style={styles.todayDoseInfo}>
                    <Text style={styles.todayDoseName}>{medication.name || 'Medication'}</Text>
                    <Text style={styles.todayDoseTime}>{dose.scheduledTime || 'Time not specified'}</Text>
                    <View style={styles.todayDoseActionRow}>
                      <Text style={[styles.todayDoseStatus, dose.status === 'taken' ? styles.success : dose.status === 'skipped' ? styles.skipped : dose.status === 'missed' ? styles.missed : styles.pending]}>
                        {dose.status || 'pending'}
                      </Text>
                      {canSupportAdherence && dose.status === 'pending' ? (
                        <View style={styles.inlineDoseActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Take ${medication.name || 'medication'}`}
                            disabled={actionId === dose._id}
                            onPress={() => setConfirmation({
                              doseId: dose._id,
                              action: 'take',
                              type: 'dose',
                              title: 'Mark dose as taken?',
                              message: 'Confirm that this dose was taken.',
                            })}
                            style={[styles.takeButton, actionId === dose._id && styles.buttonDisabled]}
                          >
                            <Text style={styles.takeButtonText}>Take</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Skip ${medication.name || 'medication'}`}
                            disabled={actionId === dose._id}
                            onPress={() => setConfirmation({
                              doseId: dose._id,
                              action: 'skip',
                              type: 'dose',
                              title: 'Skip this dose?',
                              message: 'Confirm that this dose should be skipped.',
                            })}
                            style={[styles.skipButton, actionId === dose._id && styles.buttonDisabled]}
                          >
                            <Text style={styles.skipButtonText}>Skip</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.sectionFilter}>
          {[
            { key: 'medications', label: 'Medications', icon: 'pill' },
            { key: 'schedules', label: 'Schedules', icon: 'calendar-month-outline' },
            { key: 'doses', label: 'Doses', icon: 'history' },
          ].map((section) => (
            <Pressable
              key={section.key}
              onPress={() => setSelectedSection(section.key)}
              style={[styles.sectionFilterButton, selectedSection === section.key && styles.sectionFilterButtonActive]}
            >
              <MaterialCommunityIcons
                name={section.icon}
                size={16}
                style={[styles.sectionFilterIcon, selectedSection === section.key && styles.sectionFilterIconActive]}
              />
              <Text style={[styles.sectionFilterText, selectedSection === section.key && styles.sectionFilterTextActive]}>
                {section.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {selectedSection === 'medications' ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medication Summary</Text>
            {canSupportAdherence ? (
              <Pressable onPress={onAddMedication} style={styles.smallActionButton}>
                <Text style={styles.smallActionText}>Add</Text>
              </Pressable>
            ) : null}
          </View>
          {medications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons name="pill" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No medications on file.</Text>
            </View>
          ) : (
            medications.map((medication) => {
              const expirationState = getMedicationExpirationState(medication?.expirationDate);
              const isExpired = expirationState.expired;
              const isLowStock = isMedicationLowStock(medication);

              return (
                <View key={medication._id || medication.id} style={styles.doseCardContainer}>
                  <View style={styles.doseCard}>
                    <View style={styles.doseInfo}>
                      <Text style={styles.doseName}>{medication.name || 'Medication'}</Text>
                      <Text style={styles.doseMeta}>{medication.dosage || 'Dose not specified'} • {medication.frequency || 'Frequency not specified'}</Text>
                      {isExpired ? (
                        <Text style={[styles.doseMeta, styles.expiredMeta]}>Expired • {expirationState.expirationDate}</Text>
                      ) : expirationState.expirationDate ? (
                        <Text style={[styles.doseMeta, styles.expirationMeta]}>Expires: {expirationState.expirationDate}</Text>
                      ) : null}
                      <Text style={styles.doseMeta}>
                        Refill: <Text style={isLowStock ? styles.lowStockMeta : styles.inStockMeta}>{isLowStock ? 'Low Stock' : 'In Stock'}</Text>
                      </Text>
                    </View>
                    {canSupportAdherence ? (
                      <View style={styles.scheduleResourceActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${medication.name || 'medication'}`}
                          onPress={() => onEditMedication(medication)}
                          style={styles.scheduleEditAction}
                        >
                          <Text style={styles.inlineActionText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${medication.name || 'medication'}`}
                          onPress={() => setConfirmation({
                            type: 'medication',
                            item: medication,
                            title: 'Delete medication?',
                            message: 'This will remove this patient\'s medication and its related records where applicable.',
                          })}
                          style={styles.scheduleDeleteAction}
                        >
                          <Text style={styles.inlineDangerText}>Delete</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
        ) : null}

        {selectedSection === 'doses' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dose History</Text>
          {doseHistory.length > 0 ? (
            <View style={styles.doseFilterCard}>
              <Text style={styles.filterLabel}>Date</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose dose history date"
                onPress={() => {
                  setDateDropdownVisible((visible) => !visible);
                  setMedicationDropdownVisible(false);
                  setStatusDropdownVisible(false);
                }}
                style={styles.filterDropdownButton}
              >
                <Text style={styles.filterDropdownText}>{formatDoseDateLabel(selectedDoseDate)}</Text>
                <MaterialCommunityIcons
                  name={dateDropdownVisible ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.primary}
                />
              </Pressable>
              {dateDropdownVisible ? (
                <View style={styles.filterDropdownList}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    style={styles.filterDropdownScroll}
                  >
                    <Pressable
                      onPress={() => {
                        setSelectedDoseDate('all');
                        setDateDropdownVisible(false);
                      }}
                      style={styles.filterDropdownOption}
                    >
                      <Text style={styles.filterDropdownOptionText}>All dates</Text>
                    </Pressable>
                    {availableDoseDates.map((date) => (
                      <Pressable
                        key={date}
                        onPress={() => {
                          setSelectedDoseDate(date);
                          setDateDropdownVisible(false);
                        }}
                        style={[
                          styles.filterDropdownOption,
                          selectedDoseDate === date && styles.filterDropdownOptionActive,
                        ]}
                      >
                        <Text style={[
                          styles.filterDropdownOptionText,
                          selectedDoseDate === date && styles.filterDropdownOptionTextActive,
                        ]}>
                          {formatDoseDateLabel(date)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <Text style={styles.filterLabel}>Medication</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose medication"
                onPress={() => {
                  setMedicationDropdownVisible((visible) => !visible);
                  setDateDropdownVisible(false);
                  setStatusDropdownVisible(false);
                }}
                style={styles.filterDropdownButton}
              >
                <Text style={styles.filterDropdownText}>
                  {getDoseMedicationLabel(doseHistory, selectedDoseMedication)}
                </Text>
                <MaterialCommunityIcons
                  name={medicationDropdownVisible ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.primary}
                />
              </Pressable>
              {medicationDropdownVisible ? (
                <View style={styles.filterDropdownList}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    style={styles.filterDropdownScroll}
                  >
                    <Pressable
                      onPress={() => {
                        setSelectedDoseMedication('all');
                        setMedicationDropdownVisible(false);
                      }}
                      style={[
                        styles.filterDropdownOption,
                        selectedDoseMedication === 'all' && styles.filterDropdownOptionActive,
                      ]}
                    >
                      <Text style={[
                        styles.filterDropdownOptionText,
                        selectedDoseMedication === 'all' && styles.filterDropdownOptionTextActive,
                      ]}>
                        All Medications
                      </Text>
                    </Pressable>
                    {getDoseMedicationOptions(doseHistory).map((medication) => (
                      <Pressable
                        key={medication.id}
                        onPress={() => {
                          setSelectedDoseMedication(medication.id);
                          setMedicationDropdownVisible(false);
                        }}
                        style={[
                          styles.filterDropdownOption,
                          selectedDoseMedication === medication.id && styles.filterDropdownOptionActive,
                        ]}
                      >
                        <Text style={[
                          styles.filterDropdownOptionText,
                          selectedDoseMedication === medication.id && styles.filterDropdownOptionTextActive,
                        ]}>
                          {medication.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <Text style={styles.filterLabel}>Status</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose dose status"
                accessibilityState={{ expanded: statusDropdownVisible }}
                onPress={() => {
                  setStatusDropdownVisible((visible) => !visible);
                  setDateDropdownVisible(false);
                  setMedicationDropdownVisible(false);
                }}
                style={styles.filterDropdownButton}
              >
                <Text style={styles.filterDropdownText}>
                  {DOSE_STATUS_OPTIONS.find((status) => status.key === selectedDoseStatus)?.label || 'All'}
                </Text>
                <MaterialCommunityIcons
                  name={statusDropdownVisible ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.primary}
                />
              </Pressable>
              {statusDropdownVisible ? (
                <View style={[styles.filterDropdownList, styles.statusDropdownList]}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    style={[styles.filterDropdownScroll, styles.statusDropdownScroll]}
                  >
                    {DOSE_STATUS_OPTIONS.map((status) => (
                      <Pressable
                        key={status.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: selectedDoseStatus === status.key }}
                        onPress={() => {
                          setSelectedDoseStatus(status.key);
                          setStatusDropdownVisible(false);
                        }}
                        style={[
                          styles.filterDropdownOption,
                          selectedDoseStatus === status.key && styles.filterDropdownOptionActive,
                        ]}
                      >
                        <Text style={[
                          styles.filterDropdownOptionText,
                          selectedDoseStatus === status.key && styles.filterDropdownOptionTextActive,
                        ]}>
                          {status.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              <Text style={styles.filterResultCount}>
                Showing {filteredDoseHistory.length} {filteredDoseHistory.length === 1 ? 'dose' : 'doses'}
              </Text>
            </View>
          ) : null}
          {doseHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No dose history yet.</Text>
            </View>
          ) : filteredDoseHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No matching doses.</Text>
              <Text style={styles.emptyDescription}>Try changing the date, medication, or status filters.</Text>
            </View>
          ) : filteredDoseHistory.map((dose) => {
            const medication = dose.medicationId || {};

            return (
              <View key={dose._id} style={styles.historyRowWrapper}>
                <View style={styles.historyRow}>
                  <View style={styles.doseInfo}>
                    <Text style={styles.doseName}>{medication.name || 'Medication'}</Text>
                    <Text style={styles.doseDate}>{dose.scheduledDate} at {dose.scheduledTime}</Text>
                    <Text style={[styles.statusText, styles.statusInDetails, dose.status === 'taken' ? styles.success : dose.status === 'skipped' ? styles.skipped : dose.status === 'missed' ? styles.missed : styles.pending]}>
                      {dose.status}
                    </Text>
                  </View>
                  {canSupportAdherence && dose.status === 'pending' ? (
                    <View style={styles.historyActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Take ${medication.name || 'medication'} dose`}
                        disabled={actionId === dose._id}
                        onPress={() => setConfirmation({
                          doseId: dose._id,
                          action: 'take',
                          type: 'dose',
                          title: 'Mark dose as taken?',
                          message: 'Confirm that this dose was taken.',
                        })}
                        style={[styles.takeButton, actionId === dose._id && styles.buttonDisabled]}
                      >
                        <Text style={styles.takeButtonText}>Take</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Skip ${medication.name || 'medication'} dose`}
                        disabled={actionId === dose._id}
                        onPress={() => setConfirmation({
                          doseId: dose._id,
                          action: 'skip',
                          type: 'dose',
                          title: 'Skip this dose?',
                          message: 'Confirm that this dose should be skipped.',
                        })}
                        style={[styles.skipButton, actionId === dose._id && styles.buttonDisabled]}
                      >
                        <Text style={styles.skipButtonText}>Skip</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete pending ${medication.name || 'medication'} dose`}
                        disabled={actionId === dose._id}
                        onPress={() => setConfirmation({
                          type: 'dose-delete',
                          item: dose,
                          title: 'Delete pending dose?',
                          message: 'This will delete only this pending dose record. Medication and schedule information will remain unchanged.',
                        })}
                        style={[styles.historyDeleteAction, actionId === dose._id && styles.buttonDisabled]}
                      >
                        <MaterialCommunityIcons
                          name="delete-outline"
                          size={19}
                          color={colors.dangerText}
                        />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
        ) : null}

        {selectedSection === 'schedules' ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Schedules</Text>
            {canSupportAdherence ? (
              <Pressable onPress={onAddSchedule} style={styles.smallActionButton}>
                <Text style={styles.smallActionText}>Add</Text>
              </Pressable>
            ) : null}
          </View>
          {schedules.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons name="calendar-month-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No schedules on file.</Text>
            </View>
          ) : (
            schedules.map((schedule) => {
              const scheduleMedication = schedule.medicationId || {};
              const scheduleMedicationId = scheduleMedication._id || scheduleMedication;
              const medication = medications.find((item) => (
                String(item._id || item.id) === String(scheduleMedicationId)
              )) || scheduleMedication;
              const medicationExpired = getMedicationExpirationState(medication?.expirationDate).expired;
              const days = Array.isArray(schedule.days) && schedule.days.length > 0
                ? schedule.days.join(', ')
                : 'Days not specified';

              return (
                <View key={schedule._id || schedule.id} style={[styles.doseCard, styles.scheduleCard]}>
                  <View style={styles.doseInfo}>
                    <Text style={styles.doseName}>{medication.name || 'Medication'}</Text>
                    <Text style={styles.doseMeta}>{schedule.time || schedule.scheduledTime || 'Time not specified'}</Text>
                    <Text style={styles.doseMeta}>{days}</Text>
                    <View style={[
                      styles.scheduleStatusBadge,
                      medicationExpired
                        ? styles.scheduleStatusExpired
                        : schedule.enabled === false
                          ? styles.scheduleStatusInactive
                          : styles.scheduleStatusActive,
                    ]}>
                      <Text style={[styles.statusText, medicationExpired ? styles.expiredSchedule : schedule.enabled === false ? styles.skipped : styles.success]}>
                        {medicationExpired ? 'Expired' : schedule.enabled === false ? 'Inactive' : 'Active'}
                      </Text>
                    </View>
                  </View>
                  {canSupportAdherence ? (
                    <View style={styles.scheduleResourceActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit schedule for ${medication.name || 'medication'}`}
                        onPress={() => onEditSchedule(schedule)}
                        style={styles.scheduleEditAction}
                      >
                        <Text style={styles.inlineActionText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete schedule for ${medication.name || 'medication'}`}
                        onPress={() => setConfirmation({
                          type: 'schedule',
                          item: schedule,
                          title: 'Delete schedule?',
                          message: 'This will remove this patient\'s schedule and related dose records where applicable.',
                        })}
                        style={styles.scheduleDeleteAction}
                      >
                        <Text style={styles.inlineDangerText}>Delete</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
        ) : null}
      </ScrollView>

      <ConfirmationDialog
        visible={Boolean(confirmation)}
        title={confirmation?.title || ''}
        message={confirmation?.message || ''}
        confirmLabel={confirmation?.type === 'dose' ? confirmation.action === 'take' ? 'Take dose' : 'Skip dose' : 'Delete'}
        cancelLabel="Cancel"
        danger={confirmation?.type === 'dose'
          ? confirmation.action === 'skip'
          : confirmation?.type !== undefined}
        onConfirm={confirmAction}
        onCancel={() => setConfirmation(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 32, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  backButton: { width: 40, height: 40, justifyContent: 'center', marginBottom: spacing.md },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  pageSubtitle: { fontSize: 14, color: '#A7CDD0', marginBottom: spacing.lg },
  analyticsButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14, marginBottom: spacing.lg },
  analyticsButtonText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardTint,
    borderWidth: 1,
    borderColor: colors.cardTintBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  aiIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  aiTextWrap: { flex: 1 },
  aiButtonTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  aiButtonSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xl, gap: 10 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardTint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardTintBorder,
    width: '47%',
    padding: spacing.md,
    ...shadow.card,
  },
  summaryIconWrap: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1 },
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryValue: { fontSize: 24, color: colors.text, fontWeight: '800', marginTop: 6 },
  todayDosesBox: {
    backgroundColor: colors.cardTint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardTintBorder,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  todayDosesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  todayDosesTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  todayDosesCount: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  todayDosesEmpty: { color: colors.textSecondary, fontSize: 13 },
  todayDoseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  todayDoseInfo: { flex: 1, paddingRight: spacing.sm },
  todayDoseName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  todayDoseTime: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  todayDoseStatus: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  todayDoseActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 7 },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: spacing.md },
  sectionFilter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  sectionFilterButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.cardTintBorder, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.cardTint },
  sectionFilterButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sectionFilterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  sectionFilterTextActive: { color: colors.white },
  sectionFilterIcon: { color: colors.textSecondary },
  sectionFilterIconActive: { color: colors.white },
  smallActionButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12 },
  smallActionText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  doseCard: {
    backgroundColor: colors.cardTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardTintBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.card,
  },
  scheduleCard: { flexDirection: 'row', alignItems: 'flex-start' },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardTint, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardTintBorder, padding: spacing.md, marginBottom: spacing.sm },
  historyRowWrapper: { marginBottom: spacing.sm },
  doseTime: { width: 72, fontSize: 14, fontWeight: '800', color: colors.primary },
  doseInfo: { flex: 1, minWidth: 0 },
  doseName: { fontSize: 15, fontWeight: '700', color: colors.text },
  doseMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  expirationMeta: { color: colors.primary, fontWeight: '600' },
  expiredMeta: { color: colors.dangerText, fontWeight: '700' },
  lowStockMeta: { color: colors.dangerText, fontWeight: '700' },
  inStockMeta: { color: colors.success, fontWeight: '700' },
  doseDate: { fontSize: 14, color: colors.textSecondary, marginTop: 3 },
  resourceActions: { marginLeft: spacing.sm, gap: 5 },
  scheduleResourceActions: { width: 72, marginLeft: spacing.md, gap: 8 },
  scheduleStatusBadge: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  scheduleStatusActive: { backgroundColor: colors.successSoft },
  scheduleStatusInactive: { backgroundColor: colors.skippedSoft },
  scheduleStatusExpired: { backgroundColor: colors.dangerSoft },
  scheduleEditAction: { minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  scheduleDeleteAction: { minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  inlineAction: { paddingVertical: 4, paddingHorizontal: 5 },
  inlineActionText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  inlineDanger: { paddingVertical: 4, paddingHorizontal: 5 },
  inlineDangerText: { color: colors.dangerText, fontSize: 11, fontWeight: '800' },
  doseCardContainer: { marginBottom: spacing.md },
  inlineConfirmBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: spacing.md, marginTop: 0, marginBottom: spacing.sm, alignSelf: 'stretch', minWidth: 0 },
  confirmBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  confirmTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  confirmText: { color: colors.textSecondary, marginTop: 6, lineHeight: 18, flexShrink: 1 },
  confirmActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: spacing.md },
  cancelButton: { paddingVertical: 8, paddingHorizontal: 12 },
  cancelButtonText: { color: colors.textSecondary, fontWeight: '800' },
  confirmDeleteButton: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 },
  confirmDeleteText: { color: colors.white, fontWeight: '800' },
  statusText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  expiredSchedule: { color: colors.dangerText },
  statusInDetails: { marginTop: 4 },
  success: { color: colors.success },
  skipped: { color: colors.skipped },
  missed: { color: colors.dangerText },
  pending: { color: colors.pending },
  doseActions: { width: 70, marginLeft: spacing.sm, gap: 4 },
  inlineDoseActions: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  historyActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: spacing.sm, justifyContent: 'center' },
  historyDeleteAction: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  takeButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center' },
  takeButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  skipButton: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center' },
  skipButtonText: { color: colors.dangerText, fontSize: 11, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  doseFilterCard: { backgroundColor: colors.cardTint, borderWidth: 1, borderColor: colors.cardTintBorder, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  filterLabel: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 6, marginTop: spacing.sm },
  filterDropdownButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm, paddingHorizontal: 12 },
  filterDropdownText: { flex: 1, color: colors.text, fontSize: 14, marginRight: spacing.sm },
  filterDropdownList: { marginTop: 5, marginBottom: 3, maxHeight: 180, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm, overflow: 'hidden' },
  filterDropdownScroll: { maxHeight: 178 },
  statusDropdownList: { maxHeight: 84 },
  statusDropdownScroll: { maxHeight: 82 },
  filterDropdownOption: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterDropdownOptionActive: { backgroundColor: colors.primarySoft },
  filterDropdownOptionText: { color: colors.text, fontSize: 13 },
  filterDropdownOptionTextActive: { color: colors.primary, fontWeight: '800' },
  filterResultCount: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.md },
  emptyDescription: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6 },
  emptyState: {
    backgroundColor: colors.cardTint,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardTintBorder,
    ...shadow.card,
  },
  emptyIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.dangerText, fontWeight: '600' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: '#A7CDD0' },
});

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDoseDateLabel = (value) => {
  if (value === 'all') {
    return 'All dates';
  }

  const normalizedDate = normalizeDoseDate(value);
  if (!normalizedDate) {
    return 'Unknown date';
  }

  const [year, month, day] = normalizedDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const getDoseMedicationOptions = (doses) => {
  const medicationMap = new Map();

  doses.forEach((dose) => {
    const medication = dose.medicationId;
    const id = medication?._id || medication?.id;
    if (id && medication?.name) {
      medicationMap.set(String(id), medication.name);
    }
  });

  return Array.from(medicationMap, ([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

const getDoseMedicationLabel = (doses, selectedId) => {
  if (selectedId === 'all') {
    return 'All Medications';
  }

  return getDoseMedicationOptions(doses)
    .find((medication) => medication.id === selectedId)?.name || 'All Medications';
};
