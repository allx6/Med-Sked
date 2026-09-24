import React, { useEffect, useState } from 'react';

import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';

import TimeSelector from '../components/TimeSelector';
import {
  format12HourTime,
  parse24HourTime,
  to24HourTime,
} from '../utils/timeHelpers';

import {
  getMedications,
  getPatientMedications,
  updateSchedule,
} from '../services/api';
import {
  parseLocalDate,
  validateScheduleFields,
} from '../utils/scheduleValidation';

export default function EditScheduleScreen({
  token,
  schedule,
  patientId,
  onScheduleUpdated,
  onCancel,
  autoReturnOnSuccess = false,
}) {
  // =====================================================
  // STATE
  // =====================================================

  const [medications, setMedications] = useState([]);

  const [medicationId, setMedicationId] = useState(
    schedule?.medicationId?._id ||
      schedule?.medicationId ||
      ''
  );

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

  const [timeSelection, setTimeSelection] = useState(
    parse24HourTime(schedule?.time)
  );

  const [dose, setDose] = useState(
    schedule?.dose || ''
  );

  const [days, setDays] = useState(
    Array.isArray(schedule?.days)
      ? schedule.days
      : []
  );

  const [startDate, setStartDate] = useState(
    schedule?.startDate
      ? parseLocalDate(schedule.startDate)
      : new Date()
  );

  const [endDate, setEndDate] = useState(
    schedule?.endDate
      ? parseLocalDate(schedule.endDate)
      : null
  );

  const [enabled, setEnabled] = useState(
    schedule?.enabled !== false
  );

  const [showStartDatePicker, setShowStartDatePicker] =
    useState(false);

  const [showEndDatePicker, setShowEndDatePicker] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const weekDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  // =====================================================
  // LOAD MEDICATIONS
  // =====================================================

  useEffect(() => {
    const loadMedications = async () => {
      try {
        const data = patientId
          ? await getPatientMedications(token, patientId)
          : await getMedications(token);

        setMedications(
          Array.isArray(data)
            ? data
            : data?.medications || []
        );
      } catch (error) {
        console.error(
          'Error loading medications:',
          error
        );

        Alert.alert(
          'Error',
          error.message ||
            'Failed to load medications.'
        );
      }
    };

    if (token) {
      loadMedications();
    }
  }, [token, patientId]);

  // =====================================================
  // INITIALIZE FROM THE SELECTED SCHEDULE
  // =====================================================

  useEffect(() => {
    if (!schedule) {
      return;
    }

    const resolvedMedicationId =
      schedule?.medicationId?._id ||
      schedule?.medicationId ||
      '';

    const scheduleMedication =
      medications.find(
        (medication) => medication._id === resolvedMedicationId
      ) || null;

    setMedicationId(resolvedMedicationId);
    setTimeSelection(
      parse24HourTime(schedule?.time)
    );
    setDose(
      scheduleMedication?.dosage || schedule?.dose || ''
    );
    setDays(
      Array.isArray(schedule?.days)
        ? schedule.days
        : []
    );
    setStartDate(
      schedule?.startDate
        ? parseLocalDate(schedule.startDate)
        : new Date()
    );
    setEndDate(
      schedule?.endDate
        ? parseLocalDate(schedule.endDate)
        : null
    );
    setEnabled(
      schedule?.enabled !== false
    );
  }, [
    schedule?._id,
    schedule?.medicationId,
    schedule?.time,
    schedule?.dose,
    schedule?.days,
    schedule?.startDate,
    schedule?.endDate,
    schedule?.enabled,
  ]);

  useEffect(() => {
    if (!medicationId) {
      setDose('');
      return;
    }

    const selectedMedication = medications.find(
      (medication) => medication._id === medicationId
    );

    if (selectedMedication) {
      setDose(selectedMedication.dosage || '');
    }
  }, [medicationId, medications]);

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (date) => {
    if (!date) {
      return '';
    }

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        date.getDate()
      ).padStart(2, '0');

    const year =
      date.getFullYear();

    return `${year}-${month}-${day}`;
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
  // DAY SELECTION
  // =====================================================

  const toggleDay = (day) => {
    if (days.includes(day)) {
      setDays(
        days.filter(
          selectedDay =>
            selectedDay !== day
        )
      );
    } else {
      setDays([
        ...days,
        day,
      ]);
    }
  };

  // =====================================================
  // UPDATE SCHEDULE
  // =====================================================

  const handleUpdate = async () => {
    const selectedMedication = medications.find(
      (medication) => medication._id === medicationId
    );
    const medicationDose = (selectedMedication?.dosage || dose || '').trim();

    const updatedSchedule = {
      medicationId,
      time: timeSelection
        ? to24HourTime(
          timeSelection.hour,
          timeSelection.minute,
          timeSelection.period
        )
        : '',
      dose: medicationDose,
      days,
      startDate: formatDate(startDate),
      endDate: endDate ? formatDate(endDate) : null,
      enabled,
    };

    const scheduleError = validateScheduleFields(updatedSchedule);
    if (scheduleError) {
      Alert.alert('Invalid Schedule', scheduleError);
      return;
    }

    setSaving(true);

    try {
      console.log(
        '[Schedule][Frontend] Preparing update',
        {
          scheduleId: schedule?._id,
          patientId,
          payload: updatedSchedule,
        }
      );

      const response = await updateSchedule(
        token,
        schedule._id,
        updatedSchedule,
        patientId
      );

      console.log(
        '[Schedule][Frontend] Update successful',
        {
          scheduleId: schedule?._id,
          patientId,
          result: response,
        }
      );

      if (autoReturnOnSuccess && onScheduleUpdated) {
        onScheduleUpdated();
      }

      Alert.alert(
        'Success',
        'Schedule updated successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (!autoReturnOnSuccess && onScheduleUpdated) {
                onScheduleUpdated();
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error(
        '[Schedule][Frontend] Update error',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
          'Failed to update schedule.'
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // RENDER
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

      {/* HEADER */}

      <View style={styles.header}>

        <Pressable
          onPress={onCancel}
          style={styles.backButton}
          disabled={saving}
        >
          <Text style={styles.backText}>
            Back
          </Text>
        </Pressable>

        <Text style={styles.title}>
          Edit Schedule
        </Text>

      </View>

      {/* FORM */}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >

        {/* =================================================
            MEDICATION
        ================================================= */}

        <Text style={styles.label}>
          Medication
        </Text>

        <View style={styles.medicationList}>

          {medications.length === 0 ? (
            <View style={styles.emptyMedication}>
              <Text style={styles.emptyText}>
                No medications available.
              </Text>
            </View>
          ) : (
            medications.map(
              medication => (
                <Pressable
                  key={medication._id}
                  style={[
                    styles.medicationOption,

                    medicationId ===
                      medication._id &&
                      styles.selectedOption,
                  ]}
                  onPress={() => {
                    setMedicationId(medication._id);
                    setDose(medication.dosage || '');
                  }}
                >
                  <Text
                    style={[
                      styles.medicationName,

                      medicationId ===
                        medication._id &&
                        styles.selectedOptionText,
                    ]}
                  >
                    {medication.name}
                  </Text>

                  {medication.dosage ? (
                    <Text
                      style={[
                        styles.medicationDetails,

                        medicationId ===
                          medication._id &&
                          styles.selectedOptionText,
                      ]}
                    >
                      {medication.dosage}
                    </Text>
                  ) : null}

                </Pressable>
              )
            )
          )}

        </View>

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

        {/* =================================================
            DOSE
        ================================================= */}

        <Text style={styles.label}>
          Dose
        </Text>

        <TextInput
          style={[styles.textInput, styles.readOnlyInput]}
          value={dose}
          placeholder="Medication dose will appear here"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          editable={false}
          selectTextOnFocus={false}
          pointerEvents="none"
        />

        {/* =================================================
            DAYS
        ================================================= */}

        <Text style={styles.label}>
          Days
        </Text>

        <View style={styles.daysContainer}>

          {weekDays.map(day => (
            <Pressable
              key={day}
              style={[
                styles.dayButton,

                days.includes(day) &&
                  styles.selectedDay,
              ]}
              onPress={() =>
                toggleDay(day)
              }
            >

              <Text
                style={[
                  styles.dayText,

                  days.includes(day) &&
                    styles.selectedDayText,
                ]}
              >
                {day.substring(0, 3)}
              </Text>

            </Pressable>
          ))}

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

              <Text style={styles.inputText}>
                {formatDate(startDate)}
              </Text>

            </Pressable>

            {showStartDatePicker && (
              <DateTimePicker
                value={
                  startDate || new Date()
                }
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
            )}
          </>
        )}

        {/* =================================================
            END DATE
        ================================================= */}

        <Text style={styles.label}>
          End Date
        </Text>

        {isWeb ? (
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

              <Text
                style={
                  endDate
                    ? styles.inputText
                    : styles.placeholderText
                }
              >
                {endDate
                  ? formatDate(endDate)
                  : 'No end date'}
              </Text>

            </Pressable>

            {showEndDatePicker && (
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
                onValueChange={(selectedDate) =>
                  handleEndDateChange(undefined, selectedDate)
                }
                onDismiss={() => setShowEndDatePicker(false)}
              />
            )}
          </>
        )}

        {/* =================================================
            STATUS
        ================================================= */}

        <Text style={styles.label}>
          Status
        </Text>

        <Pressable
          style={[
            styles.statusButton,

            enabled &&
              styles.enabledButton,
          ]}
          onPress={() =>
            setEnabled(
              previous =>
                !previous
            )
          }
        >

          <Text
            style={[
              styles.statusText,

              enabled &&
                styles.enabledText,
            ]}
          >
            {enabled
              ? 'Schedule Enabled'
              : 'Schedule Disabled'}
          </Text>

        </Pressable>

        {/* =================================================
            UPDATE BUTTON
        ================================================= */}

        <Pressable
          style={[
            styles.updateButton,

            saving &&
              styles.disabledButton,
          ]}
          onPress={handleUpdate}
          disabled={saving}
        >

          <Text
            style={
              styles.updateButtonText
            }
          >
            {saving
              ? 'Updating...'
              : 'Update Schedule'}
          </Text>

        </Pressable>

        {/* =================================================
            CANCEL
        ================================================= */}

        <Pressable
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={saving}
        >

          <Text style={styles.cancelText}>
            Cancel
          </Text>

        </Pressable>

      </ScrollView>

    </KeyboardAvoidingView>
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

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },

  backText: {
    color: '#2F6690',
    fontSize: 15,
    fontWeight: '600',
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E2A4A',
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E2A4A',
    marginTop: 18,
    marginBottom: 8,
  },

  medicationList: {
    gap: 8,
  },

  medicationOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9DEE8',
    borderRadius: 10,
    padding: 14,
  },

  selectedOption: {
    borderColor: '#2F6690',
    backgroundColor: '#EAF3F8',
  },

  medicationName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E2A4A',
  },

  medicationDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
  },

  selectedOptionText: {
    color: '#2F6690',
  },

  emptyMedication: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9DEE8',
    borderRadius: 10,
    padding: 14,
  },

  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },

  inputButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9DEE8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 15,
    minHeight: 50,
    justifyContent: 'center',
  },

  webDateInput: {
    width: '100%',
    minHeight: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#D9DEE8',
    borderRadius: 10,
    borderWidth: 1,
    color: '#1E2A4A',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    boxSizing: 'border-box',
  },

  inputText: {
    fontSize: 15,
    color: '#1E2A4A',
  },

  selectedTimeText: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },

  placeholderText: {
    fontSize: 15,
    color: '#9CA3AF',
  },

  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9DEE8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 15,
    minHeight: 50,
    fontSize: 15,
    color: '#1E2A4A',
  },

  readOnlyInput: {
    backgroundColor: '#F3F7FB',
    color: '#4B5563',
  },

  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  dayButton: {
    width: 55,
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9DEE8',
    alignItems: 'center',
  },

  selectedDay: {
    backgroundColor: '#2F6690',
    borderColor: '#2F6690',
  },

  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },

  selectedDayText: {
    color: '#FFFFFF',
  },

  statusButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9DEE8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },

  enabledButton: {
    backgroundColor: '#EAF3F8',
    borderColor: '#2F6690',
  },

  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },

  enabledText: {
    color: '#2F6690',
  },

  updateButton: {
    backgroundColor: '#2F6690',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 25,
  },

  disabledButton: {
    opacity: 0.6,
  },

  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  cancelButton: {
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 20,
  },

  cancelText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },

});