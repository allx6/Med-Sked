import React, { useEffect, useState } from 'react';

import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';

import TimeSelector from '../components/TimeSelector';
import {
  format12HourTime,
  to24HourTime,
} from '../utils/timeHelpers';

import {
  getMedications,
  getPatientMedications,
  getSchedules,
  getPatientSchedules,
  createSchedule,
} from '../services/api';
import {
  getScheduleSubmissionErrorMessage,
  validateScheduleFields,
} from '../utils/scheduleValidation';


export default function AddScheduleScreen({
  token,
  patientId,
  onScheduleAdded,
  onCancel,
  autoReturnOnSuccess = false,
}) {

  // =====================================================
  // MEDICATIONS
  // =====================================================

  const [medications, setMedications] = useState([]);
  const [loadingMedications, setLoadingMedications] =
    useState(true);
  const [hasScheduledMedications, setHasScheduledMedications] =
    useState(false);

  const [selectedMedication, setSelectedMedication] =
    useState(null);

  const [dose, setDose] = useState('');


  // =====================================================
  // TIME
  // =====================================================

  const [timeSelection, setTimeSelection] = useState({
    hour: 8,
    minute: 0,
    period: 'AM',
  });


  // =====================================================
  // DAYS
  // =====================================================

  const daysOfWeek = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const [selectedDays, setSelectedDays] =
    useState([]);


  // =====================================================
  // START DATE
  // =====================================================

  const [startDate, setStartDate] =
    useState(new Date());

  const [showStartDatePicker, setShowStartDatePicker] =
    useState(false);


  // =====================================================
  // END DATE
  // =====================================================

  const [endDate, setEndDate] =
    useState(null);

  const [hasEndDate, setHasEndDate] =
    useState(false);

  const [showEndDatePicker, setShowEndDatePicker] =
    useState(false);


  // =====================================================
  // ENABLED
  // =====================================================

  const [enabled, setEnabled] =
    useState(true);


  // =====================================================
  // SAVING
  // =====================================================

  const [saving, setSaving] =
    useState(false);
  const [formError, setFormError] = useState('');


  // =====================================================
  // LOAD MEDICATIONS
  // =====================================================

  useEffect(() => {

    const loadMedications = async () => {

      try {

        setLoadingMedications(true);

        const [data, schedules] = await Promise.all([
          patientId
            ? getPatientMedications(token, patientId)
            : getMedications(token),
          patientId
            ? getPatientSchedules(token, patientId)
            : getSchedules(token),
        ]);

        const allMedications = Array.isArray(data)
          ? data
          : data?.medications || [];
        const scheduledMedicationIds = new Set(
          (Array.isArray(schedules) ? schedules : [])
            .map((schedule) => schedule.medicationId?._id || schedule.medicationId)
            .filter(Boolean)
            .map(String)
        );

        setHasScheduledMedications(scheduledMedicationIds.size > 0);

        setMedications(
          allMedications.filter(
            (medication) => !scheduledMedicationIds.has(String(medication._id))
          )
        );

      } catch (error) {

        console.error(
          'Load medications error:',
          error
        );

        Alert.alert(
          'Error',
          error.message ||
            'Failed to load medications.'
        );

      } finally {

        setLoadingMedications(false);

      }

    };

    loadMedications();

  }, [token, patientId]);


  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (date) => {

    if (!date) {
      return '';
    }

    const month =
      (date.getMonth() + 1)
        .toString()
        .padStart(2, '0');

    const day =
      date
        .getDate()
        .toString()
        .padStart(2, '0');

    const year =
      date.getFullYear();

    return `${year}-${month}-${day}`;

  };


  // =====================================================
  // SELECT DAY
  // =====================================================

  const toggleDay = (day) => {

    setSelectedDays(previous => {

      if (previous.includes(day)) {

        return previous.filter(
          item => item !== day
        );

      }

      return [
        ...previous,
        day,
      ];

    });

  };

  const selectMedication = (medication) => {
    setSelectedMedication(medication);
    setDose(medication?.dosage || '');
  };

  const todayDate = new Date();
  const todayStart = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate()
  );
  const isWeb = Platform.OS === 'web';

  const parseWebDateValue = (value) => {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const nextDate = new Date(year, month - 1, day);

    if (Number.isNaN(nextDate.getTime())) {
      return null;
    }

    return nextDate;
  };

  // =====================================================
  // START DATE PICKER
  // =====================================================

  const handleStartDateChange = (
    event,
    selectedDate
  ) => {

    setShowStartDatePicker(false);

    if (event?.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      const nextDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );

      if (nextDate < todayStart) {
        return;
      }

      setStartDate(nextDate);
    }

  };


  // =====================================================
  // END DATE PICKER
  // =====================================================

  const handleEndDateChange = (
    event,
    selectedDate
  ) => {

    setShowEndDatePicker(false);

    if (event?.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      const nextDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );

      if (nextDate < todayStart) {
        return;
      }

      if (startDate && nextDate < new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      )) {
        return;
      }

      setEndDate(nextDate);
    }

  };


  // =====================================================
  // SAVE SCHEDULE
  // =====================================================

  const handleSave = async () => {
    setFormError('');

    const medicationDose =
      (selectedMedication?.dosage || dose || '').trim();

    const schedule = {

        medicationId:
          selectedMedication?._id || '',

        time:
          to24HourTime(
            timeSelection.hour,
            timeSelection.minute,
            timeSelection.period
          ),

        dose:
          medicationDose,

        days:
          selectedDays,

        startDate:
          formatDate(startDate),

        endDate:
          hasEndDate
            ? formatDate(endDate)
            : null,

        enabled,

      };

    const scheduleError = validateScheduleFields(schedule, {
      medicationExpirationDate: selectedMedication?.expirationDate,
      rejectExpiredMedication: true,
    });
    if (scheduleError) {
      setFormError(scheduleError);
      return;
    }

    try {
      setSaving(true);

      console.log(
        '[Schedule][Frontend] Preparing add',
        {
          patientId,
          payload: schedule,
        }
      );

      const response = await createSchedule(
        token,
        schedule,
        patientId
      );

      console.log(
        '[Schedule][Frontend] Add successful',
        {
          patientId,
          result: response,
        }
      );

      if (autoReturnOnSuccess && onScheduleAdded) {
        onScheduleAdded();
      }

      Alert.alert(
        'Success',
        'Medication schedule added successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (!autoReturnOnSuccess && onScheduleAdded) {
                onScheduleAdded();
              }
            },
          },
        ]
      );


    } catch (error) {

      console.error(
        '[Schedule][Frontend] Add error',
        error
      );

      setFormError(getScheduleSubmissionErrorMessage(error));

    } finally {

      setSaving(false);

    }

  };


  // =====================================================
  // SCREEN
  // =====================================================

  return (

    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >

      {/* =================================================
          HEADER
      ================================================= */}

      <View style={styles.header}>

        <Text style={styles.title}>
          Add Schedule
        </Text>

        <Text style={styles.subtitle}>
          Set when you want to take this medication.
        </Text>

      </View>

      {formError ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      ) : null}


      {/* =================================================
          MEDICATION
      ================================================= */}

      <Text style={styles.label}>
        Medication
      </Text>

      {loadingMedications ? (

        <View style={styles.loadingBox}>

          <ActivityIndicator />

          <Text style={styles.loadingText}>
            Loading medications...
          </Text>

        </View>

      ) : medications.length === 0 ? (

        <View style={styles.emptyBox}>

          <Text style={styles.emptyTitle}>
            {hasScheduledMedications
              ? 'No unscheduled medications'
              : 'No medications available'}
          </Text>

          <Text style={styles.emptyText}>
            {hasScheduledMedications
              ? 'Each medication can have only one schedule.'
              : 'Add a medication first before creating a schedule.'}
          </Text>

        </View>

      ) : (

        <View style={styles.medicationList}>

          {medications.map(
            (medication) => {

              const selected =
                selectedMedication?._id ===
                medication._id;

              return (

                <Pressable
                  key={medication._id}
                  style={[
                    styles.medicationOption,
                    selected &&
                      styles.medicationOptionSelected,
                  ]}
                  onPress={() => selectMedication(medication)}
                >

                  <View style={styles.medicationInfo}>

                    <Text
                      style={[
                        styles.medicationName,
                        selected &&
                          styles.selectedText,
                      ]}
                    >
                      {medication.name}
                    </Text>

                    <Text
                      style={[
                        styles.medicationDetails,
                        selected &&
                          styles.selectedSubText,
                      ]}
                    >
                      {medication.dosage}
                    </Text>

                    <Text
                      style={[
                        styles.medicationDetails,
                        selected &&
                          styles.selectedSubText,
                      ]}
                    >
                      {medication.frequency}
                    </Text>

                  </View>

                  <View
                    style={[
                      styles.radio,
                      selected &&
                        styles.radioSelected,
                    ]}
                  >

                    {selected && (
                      <View
                        style={
                          styles.radioInner
                        }
                      />
                    )}

                  </View>

                </Pressable>

              );

            }
          )}

        </View>

      )}


      {/* =================================================
          TIME
      ================================================= */}

      <Text style={styles.label}>
        Time
      </Text>

      <TimeSelector
        hour={timeSelection.hour}
        minute={timeSelection.minute}
        period={timeSelection.period}
        onChange={setTimeSelection}
        disabled={saving}
      />

      <Text style={styles.selectedTimeText}>
        {format12HourTime(
          timeSelection.hour,
          timeSelection.minute,
          timeSelection.period
        )}
      </Text>

      <Text style={styles.label}>
        Dose
      </Text>

      <TextInput
        style={[styles.input, styles.readOnlyInput]}
        value={dose}
        placeholder="Select a medication to populate the dose"
        placeholderTextColor="#9AA3AF"
        editable={false}
        selectTextOnFocus={false}
        pointerEvents="none"
      />


      {/* =================================================
          DAYS
      ================================================= */}

      <Text style={styles.label}>
        Repeat On
      </Text>

      <View style={styles.daysContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysScrollContent}
          style={styles.daysScrollWrap}
        >
          {daysOfWeek.map(
            (day) => {

              const selected =
                selectedDays.includes(day);

              const shortDay =
                day.substring(0, 3);

              return (

                <Pressable
                  key={day}
                  style={[
                    styles.dayButton,
                    selected &&
                      styles.dayButtonSelected,
                  ]}
                  onPress={() =>
                    toggleDay(day)
                  }
                >

                  <Text
                    style={[
                      styles.dayText,
                      selected &&
                        styles.dayTextSelected,
                    ]}
                  >
                    {shortDay}
                  </Text>

                </Pressable>

              );

            }
          )}
        </ScrollView>
      </View>


      {/* =================================================
          START DATE
      ================================================= */}

      <Text style={styles.label}>
        Start Date
      </Text>

      {isWeb ? (
        <input
          type="date"
          value={formatDate(startDate)}
          min={formatDate(todayStart)}
          onChange={(event) => {
            const nextDate = parseWebDateValue(event.target.value);

            if (!nextDate || nextDate < todayStart) {
              return;
            }

            setStartDate(nextDate);
          }}
          disabled={saving}
          style={styles.webDateInput}
        />
      ) : (
        <>
          <Pressable
            style={styles.inputButton}
            onPress={() =>
              setShowStartDatePicker(true)
            }
          >

            <Text style={styles.inputIcon}>
              📅
            </Text>

            <Text style={styles.inputButtonText}>
              {formatDate(startDate)}
            </Text>

          </Pressable>


          {showStartDatePicker && (

            <View style={styles.pickerContainer}>

              <DateTimePicker
                value={startDate}
                mode="date"
                minimumDate={todayStart}
                display={
                  Platform.OS === 'ios'
                    ? 'spinner'
                    : 'default'
                }
                onValueChange={(selectedDate) =>
                  handleStartDateChange(undefined, selectedDate)
                }
                onDismiss={() => setShowStartDatePicker(false)}
              />

            </View>

          )}
        </>
      )}


      {/* =================================================
          END DATE
      ================================================= */}

      <View style={styles.endDateHeader}>

        <Text style={styles.label}>
          End Date
        </Text>

        <View style={styles.endDateToggle}>

          <Text style={styles.noEndText}>
            No end date
          </Text>

          <Switch
            value={!hasEndDate}
            onValueChange={(value) => {

              setHasEndDate(!value);

              if (value) {
                setEndDate(null);
              }

            }}
          />

        </View>

      </View>

      {selectedMedication?.expirationDate ? (
        <Text style={styles.expirationHint}>
          End date is required because this medication expires on {selectedMedication.expirationDate}.
        </Text>
      ) : null}


      {hasEndDate && (

        isWeb ? (
          <input
            type="date"
            value={endDate ? formatDate(endDate) : ''}
            min={
              startDate > todayStart
                ? formatDate(startDate)
                : formatDate(todayStart)
            }
            onChange={(event) => {
              const nextDate = parseWebDateValue(event.target.value);

              if (!nextDate) {
                return;
              }

              if (nextDate < todayStart) {
                return;
              }

              if (startDate && nextDate < new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate()
              )) {
                return;
              }

              setEndDate(nextDate);
            }}
            disabled={saving}
            style={styles.webDateInput}
          />
        ) : (
          <>

            <Pressable
              style={styles.inputButton}
              onPress={() =>
                setShowEndDatePicker(true)
              }
            >

              <Text style={styles.inputIcon}>
                📅
              </Text>

              <Text style={styles.inputButtonText}>

                {endDate
                  ? formatDate(endDate)
                  : 'Select end date'}

              </Text>

            </Pressable>


            {showEndDatePicker && (

              <View style={styles.pickerContainer}>

                <DateTimePicker
                  value={
                    endDate ||
                    startDate ||
                    new Date()
                  }
                  mode="date"
                  minimumDate={
                    startDate > todayStart
                      ? startDate
                      : todayStart
                  }
                  display={
                    Platform.OS === 'ios'
                      ? 'spinner'
                      : 'default'
                  }
                  onValueChange={handleEndDateChange}
                  onDismiss={() => setShowEndDatePicker(false)}
                />

              </View>

            )}

          </>
        )

      )}


      {/* =================================================
          ENABLED
      ================================================= */}

      <View style={styles.enabledRow}>

        <View>

          <Text style={styles.enabledTitle}>
            Schedule Enabled
          </Text>

          <Text style={styles.enabledText}>
            Enable reminders for this schedule.
          </Text>

        </View>

        <Switch
          value={enabled}
          onValueChange={setEnabled}
        />

      </View>


      {/* =================================================
          SAVE
      ================================================= */}

      <Pressable
        style={[
          styles.saveButton,
          saving &&
            styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={saving}
      >

        {saving ? (

          <ActivityIndicator
            color="#FFFFFF"
          />

        ) : (

          <Text style={styles.saveButtonText}>
            Add Schedule
          </Text>

        )}

      </Pressable>


      {/* =================================================
          CANCEL
      ================================================= */}

      <Pressable
        style={styles.cancelButton}
        onPress={onCancel}
        disabled={saving}
      >

        <Text style={styles.cancelButtonText}>
          Cancel
        </Text>

      </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>

  );

}


// =======================================================
// STYLES
// =======================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#116F7A',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },

  header: {
    marginBottom: 25,
  },

  backButton: {
    marginBottom: 15,
  },

  backText: {
    color: '#D8F0F2',
    fontSize: 15,
    fontWeight: '600',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: '#A7CDD0',
  },

  errorBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },

  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },

  expirationHint: {
    marginTop: 4,
    color: '#D8F0F2',
    fontSize: 12,
    lineHeight: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 18,
  },

  loadingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 8,
    color: '#6B7280',
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E2A4A',
    marginBottom: 5,
  },

  emptyText: {
    fontSize: 13,
    color: '#6B7280',
  },

  medicationList: {
    gap: 10,
  },

  medicationOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  medicationOptionSelected: {
    borderColor: '#0B4F59',
    backgroundColor: '#EEF6FA',
  },

  medicationInfo: {
    flex: 1,
  },

  medicationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E2A4A',
    marginBottom: 4,
  },

  medicationDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  selectedText: {
    color: '#0B4F59',
  },

  selectedSubText: {
    color: '#4B6B7C',
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  radioSelected: {
    borderColor: '#0B4F59',
  },

  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0B4F59',
  },

  inputButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  webDateInput: {
    width: '100%',
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1,
    color: '#1E2A4A',
    fontSize: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    boxSizing: 'border-box',
  },

  inputIcon: {
    fontSize: 18,
    marginRight: 10,
  },

  inputButtonText: {
    fontSize: 15,
    color: '#1E2A4A',
    fontWeight: '500',
  },

  selectedTimeText: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#1E2A4A',
  },

  readOnlyInput: {
    backgroundColor: '#F3F7FB',
    color: '#4B5563',
  },

  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    overflow: 'hidden',
  },

  daysContainer: {
    width: '100%',
    maxWidth: '100%',
  },

  daysScrollWrap: {
    maxWidth: '100%',
  },

  daysScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
    paddingVertical: 2,
  },

  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },

  dayButtonSelected: {
    backgroundColor: '#0B4F59',
    borderColor: '#0B4F59',
  },

  dayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },

  dayTextSelected: {
    color: '#FFFFFF',
  },

  endDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  endDateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },

  noEndText: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 6,
  },

  enabledRow: {
    marginTop: 25,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  enabledTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E2A4A',
  },

  enabledText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },

  saveButton: {
    marginTop: 25,
    backgroundColor: '#0B4F59',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  cancelButton: {
    marginTop: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },

});