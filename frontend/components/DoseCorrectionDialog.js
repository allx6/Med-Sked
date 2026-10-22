import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, radius, spacing } from '../theme';

const TIME_ZONE = 'Asia/Manila';
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const MINIMUM_DATE = '1900-01-01';

const getManilaDateTimeInput = (date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

const parseManilaDateTime = (date, time) => {
  const dateMatch = String(date).match(DATE_PATTERN);
  const timeMatch = String(time).match(TIME_PATTERN);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    year < 1900
    || wallClock.getUTCFullYear() !== year
    || wallClock.getUTCMonth() !== month - 1
    || wallClock.getUTCDate() !== day
    || hour > 23
    || minute > 59
  ) {
    return null;
  }
  return new Date(wallClock.getTime() - 8 * 60 * 60 * 1000);
};

const parseDateForPicker = (value) => {
  const match = String(value).match(DATE_PATTERN);
  if (!match) return new Date();
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const parseTimeForPicker = (value) => {
  const match = String(value).match(TIME_PATTERN);
  if (!match) return new Date();
  const [, hour, minute] = match;
  const pickerDate = new Date();
  pickerDate.setHours(Number(hour), Number(minute), 0, 0);
  return pickerDate;
};

const formatLocalDate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const formatLocalTime = (date) => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);

const getManilaToday = () => getManilaDateTimeInput(new Date()).date;

export default function DoseCorrectionDialog({
  visible,
  doseName,
  submitting = false,
  onCancel,
  onSubmit,
}) {
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [today, setToday] = useState(getManilaToday);

  useEffect(() => {
    if (!visible) return;
    const now = getManilaDateTimeInput(new Date());
    setDateValue(now.date);
    setTimeValue(now.time);
    setReason('');
    setValidationError('');
    setShowDatePicker(false);
    setShowTimePicker(false);
    setToday(now.date);
  }, [visible]);

  const updateDate = (value) => {
    setDateValue(value);
    setValidationError('');
  };

  const updateTime = (value) => {
    setTimeValue(value);
    setValidationError('');
  };

  const openDatePicker = () => {
    if (submitting) return;
    setShowTimePicker(false);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseDateForPicker(dateValue),
        mode: 'date',
        minimumDate: parseDateForPicker(MINIMUM_DATE),
        maximumDate: parseDateForPicker(today),
        onValueChange: (event, selectedDate) => {
          if (event?.type !== 'dismissed' && selectedDate) {
            updateDate(formatLocalDate(selectedDate));
          }
        },
      });
      return;
    }
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    if (submitting) return;
    setShowDatePicker(false);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseTimeForPicker(timeValue),
        mode: 'time',
        is24Hour: true,
        onValueChange: (event, selectedTime) => {
          if (event?.type !== 'dismissed' && selectedTime) {
            updateTime(formatLocalTime(selectedTime));
          }
        },
      });
      return;
    }
    setShowTimePicker(true);
  };

  const submitCorrection = () => {
    const takenAt = parseManilaDateTime(dateValue, timeValue);
    const trimmedReason = reason.trim();
    if (!takenAt) {
      setValidationError('Choose a valid date and time. Use YYYY-MM-DD and 24-hour HH:MM format.');
      return;
    }
    if (dateValue > today || takenAt > new Date()) {
      setValidationError('The actual administration time cannot be in the future.');
      return;
    }
    if (!trimmedReason || trimmedReason.length > 500) {
      setValidationError('Enter a correction reason of 1 to 500 characters.');
      return;
    }
    setValidationError('');
    onSubmit({
      takenAt: takenAt.toISOString(),
      correctionReason: trimmedReason,
    });
  };

  const handlePickedDate = (event, selectedDate) => {
    if (event?.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (selectedDate) updateDate(formatLocalDate(selectedDate));
  };

  const handlePickedTime = (event, selectedTime) => {
    if (event?.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    if (selectedTime) updateTime(formatLocalTime(selectedTime));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      >
        <View style={styles.overlay}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View style={styles.card}>
              <Text style={styles.title}>Correct a missed dose</Text>
              <Text style={styles.description}>
                Record the actual time {doseName ? `${doseName} ` : 'this dose '}was taken. The audit history will be updated, and interval schedules will be recalculated when applicable. This does not provide missed-dose medical advice.
              </Text>

              <Text style={styles.label}>Actual date taken (Manila time)</Text>
              {Platform.OS === 'web' ? (
                <input
                  aria-label="Actual date taken in Manila time"
                  type="date"
                  min={MINIMUM_DATE}
                  max={today}
                  value={dateValue}
                  disabled={submitting}
                  onChange={(event) => updateDate(event.target.value)}
                  style={styles.webInput}
                />
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Choose actual date taken, ${dateValue}`}
                    disabled={submitting}
                    onPress={openDatePicker}
                    style={[styles.pickerButton, submitting && styles.disabled]}
                  >
                    <Text style={styles.pickerValue}>{dateValue}</Text>
                  </Pressable>
                  {showDatePicker ? (
                    <View style={styles.inlinePicker}>
                      <DateTimePicker
                        value={parseDateForPicker(dateValue)}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={parseDateForPicker(MINIMUM_DATE)}
                        maximumDate={parseDateForPicker(today)}
                        onValueChange={handlePickedDate}
                        onDismiss={() => setShowDatePicker(false)}
                      />
                      {Platform.OS === 'ios' ? (
                        <Pressable onPress={() => setShowDatePicker(false)} style={styles.pickerDone}>
                          <Text style={styles.pickerDoneText}>Done</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </>
              )}
              <Text style={styles.formatGuide}>Choose a date from January 1, 1900 through today.</Text>

              <Text style={styles.label}>Actual time taken (24-hour, Manila time)</Text>
              {Platform.OS === 'web' ? (
                <input
                  aria-label="Actual time taken in 24-hour Manila time"
                  type="time"
                  step={60}
                  max={dateValue === today ? getManilaDateTimeInput(new Date()).time : undefined}
                  value={timeValue}
                  disabled={submitting}
                  onChange={(event) => updateTime(event.target.value)}
                  style={styles.webInput}
                />
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Choose actual time taken, ${timeValue}, 24-hour Manila time`}
                    disabled={submitting}
                    onPress={openTimePicker}
                    style={[styles.pickerButton, submitting && styles.disabled]}
                  >
                    <Text style={styles.pickerValue}>{timeValue}</Text>
                  </Pressable>
                  {showTimePicker ? (
                    <View style={styles.inlinePicker}>
                      <DateTimePicker
                        value={parseTimeForPicker(timeValue)}
                        mode="time"
                        is24Hour
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onValueChange={handlePickedTime}
                        onDismiss={() => setShowTimePicker(false)}
                      />
                      {Platform.OS === 'ios' ? (
                        <Pressable onPress={() => setShowTimePicker(false)} style={styles.pickerDone}>
                          <Text style={styles.pickerDoneText}>Done</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </>
              )}
              <Text style={styles.formatGuide}>Time uses HH:MM (00:00–23:59); future times are not allowed.</Text>

              <Text style={styles.label}>Why is this record being corrected?</Text>
              <TextInput
                accessibilityLabel="Missed dose correction reason"
                value={reason}
                onChangeText={(value) => {
                  setReason(value);
                  setValidationError('');
                }}
                placeholder="Required reason"
                multiline
                maxLength={500}
                style={[styles.input, styles.reasonInput]}
                editable={!submitting}
              />
              <Text style={styles.characterCount}>{reason.length}/500</Text>
              {validationError ? (
                <Text accessibilityRole="alert" style={styles.error}>{validationError}</Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={onCancel}
                  style={[styles.cancelButton, submitting && styles.disabled]}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={submitCorrection}
                  style={[styles.submitButton, submitting && styles.disabled]}
                >
                  <Text style={styles.submitText}>{submitting ? 'Saving...' : 'Save correction'}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 42, 74, 0.45)',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  description: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  label: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: spacing.md },
  input: {
    minHeight: 42,
    marginTop: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    color: colors.text,
    backgroundColor: colors.white,
  },
  pickerButton: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  pickerValue: { color: colors.text, fontSize: 16 },
  inlinePicker: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  pickerDone: { alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pickerDoneText: { color: colors.primary, fontWeight: '700' },
  formatGuide: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  webInput: {
    width: '100%',
    minHeight: 44,
    boxSizing: 'border-box',
    marginTop: 5,
    paddingTop: 0,
    paddingRight: 10,
    paddingBottom: 0,
    paddingLeft: 10,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: radius.sm,
    color: colors.text,
    backgroundColor: colors.white,
    fontSize: 16,
  },
  reasonInput: { minHeight: 76, paddingTop: 10, textAlignVertical: 'top' },
  characterCount: { color: colors.textSecondary, fontSize: 11, marginTop: 4, textAlign: 'right' },
  error: { color: colors.dangerText, fontSize: 12, marginTop: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  cancelButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md },
  cancelText: { color: colors.textSecondary, fontWeight: '700' },
  submitButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.primary },
  submitText: { color: colors.white, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
