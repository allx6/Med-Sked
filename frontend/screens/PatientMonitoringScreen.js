import React, { useCallback, useEffect, useState } from 'react';
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

import {
  deleteMedication,
  deleteSchedule,
  getPatientOverview,
  takePatientDose,
  skipPatientDose,
} from '../services/api';
import { colors, radius, spacing, shadow } from '../theme';
import ConfirmationDialog from '../components/ConfirmationDialog';

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
      setError(err.message || 'Failed to load patient overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patient, token]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading patient summary...</Text>
      </View>
    );
  }

  const patientName = patient?.username || patient?.name || 'Patient';
  const patientId = patient?.patientId || patient?._id || 'Unknown';
  const permission = overview?.relationship?.permission || 'VIEW_ONLY';
  const canSupportAdherence = permission === 'ADHERENCE_SUPPORT';
  const adherence = overview?.adherence?.percentage ?? 0;
  const todayDoses = overview?.todayDoses || [];
  const doseHistory = overview?.doses || [];
  const medications = overview?.medications || [];
  const schedules = overview?.schedules || [];

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
            percentage: total > 0 ? Math.round((taken / total) * 100) : 0,
          },
        };
      });

    } catch (err) {
      Alert.alert('Dose update failed', err.message || 'Unable to update this dose.');
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
      setError(err.message || 'Unable to delete this medication.');
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
      setError(err.message || 'Unable to delete this schedule.');
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
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOverview(true)} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        <Pressable onPress={onBack} hitSlop={8}>
            <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{patientName}</Text>
        <Text style={styles.pageSubtitle}>Patient monitoring • {patientId}</Text>

        <Pressable onPress={onOpenAnalytics} style={styles.analyticsButton}>
          <Text style={styles.analyticsButtonText}>View Adherence Analytics</Text>
        </Pressable>

        {patient?._id && onOpenAiAssistant ? (
          <Pressable onPress={() => onOpenAiAssistant?.()} style={styles.aiButton}>
            <Text style={styles.aiButtonTitle}>Ask MedSked AI</Text>
            <Text style={styles.aiButtonSubtitle}>Ask about this patient's medications, doses, adherence, or refills.</Text>
          </Pressable>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Adherence</Text>
            <Text style={styles.summaryValue}>{adherence}%</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Medications</Text>
            <Text style={styles.summaryValue}>{medications.length}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Schedules</Text>
            <Text style={styles.summaryValue}>{schedules.length}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Today</Text>
            <Text style={styles.summaryValue}>{todayDoses.length}</Text>
          </View>
        </View>

        <View style={styles.todayDosesBox}>
          <View style={styles.todayDosesHeader}>
            <Text style={styles.todayDosesTitle}>Today's doses</Text>
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
                  </View>
                  <Text style={[styles.todayDoseStatus, dose.status === 'taken' ? styles.success : dose.status === 'skipped' ? styles.skipped : dose.status === 'missed' ? styles.missed : styles.pending]}>
                    {dose.status || 'pending'}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.sectionFilter}>
          {[
            { key: 'medications', label: 'Medications' },
            { key: 'schedules', label: 'Schedules' },
            { key: 'doses', label: 'Doses' },
          ].map((section) => (
            <Pressable
              key={section.key}
              onPress={() => setSelectedSection(section.key)}
              style={[styles.sectionFilterButton, selectedSection === section.key && styles.sectionFilterButtonActive]}
            >
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
              <Text style={styles.emptyIcon}>💊</Text>
              <Text style={styles.emptyTitle}>No medications on file.</Text>
            </View>
          ) : (
            medications.map((medication) => {
              return (
                <View key={medication._id || medication.id} style={styles.doseCardContainer}>
                  <View style={styles.doseCard}>
                    <View style={styles.doseInfo}>
                      <Text style={styles.doseName}>{medication.name || 'Medication'}</Text>
                      <Text style={styles.doseMeta}>{medication.dosage || 'Dose not specified'} • {medication.frequency || 'Frequency not specified'}</Text>
                      <Text style={styles.doseMeta}>
                        Refill: {Number(medication.quantityOnHand ?? 0) <= 0 ? 'Out of stock' : Number(medication.quantityOnHand ?? 0) <= Number(medication.refillThreshold ?? 0) ? 'Low stock' : 'In stock'} ({Number(medication.quantityOnHand ?? 0)} on hand, threshold {Number(medication.refillThreshold ?? 0)})
                      </Text>
                    </View>
                    {canSupportAdherence ? (
                      <View style={styles.resourceActions}>
                        <Pressable onPress={() => onEditMedication(medication)} style={styles.inlineAction}><Text style={styles.inlineActionText}>Edit</Text></Pressable>
                        <Pressable
                          onPress={() => setConfirmation({
                            type: 'medication',
                            item: medication,
                            title: 'Delete medication?',
                            message: 'This will remove this patient\'s medication and its related records where applicable.',
                          })}
                          style={styles.inlineDanger}
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
          {doseHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No dose history yet.</Text>
            </View>
          ) : doseHistory.slice(0, 20).map((dose) => {
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
                    <View style={styles.inlineDoseActions}>
                      <Pressable
                        onPress={() => setConfirmation({ doseId: dose._id, action: 'take', type: 'dose', title: 'Mark dose as taken?', message: 'Confirm that this dose was taken.' })}
                        style={styles.takeButton}
                      >
                        <Text style={styles.takeButtonText}>Take</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmation({ doseId: dose._id, action: 'skip', type: 'dose', title: 'Skip this dose?', message: 'Confirm that this dose should be skipped.' })}
                        style={styles.skipButton}
                      >
                        <Text style={styles.skipButtonText}>Skip</Text>
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
              <Text style={styles.emptyIcon}>🗓</Text>
              <Text style={styles.emptyTitle}>No schedules on file.</Text>
            </View>
          ) : (
            schedules.map((schedule) => {
              const medication = schedule.medicationId || {};
              const days = Array.isArray(schedule.days) && schedule.days.length > 0
                ? schedule.days.join(', ')
                : 'Days not specified';

              return (
                <View key={schedule._id || schedule.id} style={[styles.doseCard, styles.scheduleCard]}>
                  <View style={styles.doseInfo}>
                    <Text style={styles.doseName}>{medication.name || 'Medication'}</Text>
                    <Text style={styles.doseMeta}>{schedule.time || schedule.scheduledTime || 'Time not specified'}</Text>
                    <Text style={styles.doseMeta}>{days}</Text>
                  </View>
                  <Text style={[styles.statusText, schedule.enabled === false ? styles.skipped : styles.success]}>
                    {schedule.enabled === false ? 'Inactive' : 'Active'}
                  </Text>
                  {canSupportAdherence ? (
                    <View style={styles.resourceActions}>
                      <Pressable onPress={() => onEditSchedule(schedule)} style={styles.inlineAction}><Text style={styles.inlineActionText}>Edit</Text></Pressable>
                      <Pressable
                        onPress={() => setConfirmation({
                          type: 'schedule',
                          item: schedule,
                          title: 'Delete schedule?',
                          message: 'This will remove this patient\'s schedule and related dose records where applicable.',
                        })}
                        style={styles.inlineDanger}
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
        danger={confirmation?.type !== 'dose'}
        onConfirm={confirmAction}
        onCancel={() => setConfirmation(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 32, width: '100%', maxWidth: 900, alignSelf: 'center' },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 15, marginBottom: spacing.md },
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.text },
  pageSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  analyticsButton: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14, marginBottom: spacing.lg },
  analyticsButtonText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  aiButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  aiButtonTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  aiButtonSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xl, gap: 10 },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    width: '47%',
    padding: spacing.md,
    ...shadow.card,
  },
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryValue: { fontSize: 24, color: colors.text, fontWeight: '800', marginTop: 6 },
  todayDosesBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  todayDosesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  todayDosesTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  todayDosesCount: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  todayDosesEmpty: { color: colors.textSecondary, fontSize: 13 },
  todayDoseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  todayDoseInfo: { flex: 1, paddingRight: spacing.sm },
  todayDoseName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  todayDoseTime: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  todayDoseStatus: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  sectionFilter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  sectionFilterButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.card },
  sectionFilterButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sectionFilterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  sectionFilterTextActive: { color: colors.white },
  smallActionButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12 },
  smallActionText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  doseCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.card,
  },
  scheduleCard: { flexDirection: 'column', alignItems: 'stretch' },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  historyRowWrapper: { marginBottom: spacing.sm },
  doseTime: { width: 72, fontSize: 14, fontWeight: '800', color: colors.primary },
  doseInfo: { flex: 1 },
  doseName: { fontSize: 15, fontWeight: '700', color: colors.text },
  doseMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  doseDate: { fontSize: 14, color: colors.textSecondary, marginTop: 3 },
  resourceActions: { marginLeft: spacing.sm, gap: 5 },
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
  statusInDetails: { marginTop: 4 },
  success: { color: colors.success },
  skipped: { color: colors.skipped },
  missed: { color: colors.dangerText },
  pending: { color: colors.pending },
  doseActions: { width: 70, marginLeft: spacing.sm, gap: 4 },
  inlineDoseActions: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  takeButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center' },
  takeButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  skipButton: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center' },
  skipButtonText: { color: colors.dangerText, fontSize: 11, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  emptyState: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  emptyIcon: { fontSize: 28, marginBottom: 8 },
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
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
});
