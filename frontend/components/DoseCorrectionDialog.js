import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

const TIME_ZONE = 'Asia/Manila';

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
  const dateMatch = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(time).match(/^(\d{2}):(\d{2})$/);
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
    wallClock.getUTCFullYear() !== year
    || wallClock.getUTCMonth() !== month - 1
    || wallClock.getUTCDate() !== day
    || hour > 23
    || minute > 59
  ) {
    return null;
  }
  return new Date(wallClock.getTime() - 8 * 60 * 60 * 1000);
};

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

  useEffect(() => {
    if (!visible) return;
    const now = getManilaDateTimeInput(new Date());
    setDateValue(now.date);
    setTimeValue(now.time);
    setReason('');
    setValidationError('');
  }, [visible]);

  const submitCorrection = () => {
    const takenAt = parseManilaDateTime(dateValue, timeValue);
    const trimmedReason = reason.trim();
    if (!takenAt) {
      setValidationError('Enter the actual date as YYYY-MM-DD and time as HH:MM (24-hour).');
      return;
    }
    if (takenAt > new Date()) {
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Correct a missed dose</Text>
          <Text style={styles.description}>
            Record the actual time {doseName ? `${doseName} ` : 'this dose '}was taken. The audit history will be updated, and interval schedules will be recalculated when applicable. This does not provide missed-dose medical advice.
          </Text>
          <Text style={styles.label}>Actual date taken (Manila time)</Text>
          <TextInput
            accessibilityLabel="Actual date taken in Manila time"
            value={dateValue}
            onChangeText={setDateValue}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            style={styles.input}
            editable={!submitting}
          />
          <Text style={styles.label}>Actual time taken (24-hour)</Text>
          <TextInput
            accessibilityLabel="Actual time taken in 24-hour format"
            value={timeValue}
            onChangeText={setTimeValue}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
            style={styles.input}
            editable={!submitting}
          />
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 42, 74, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
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
  reasonInput: { minHeight: 76, paddingTop: 10, textAlignVertical: 'top' },
  error: { color: colors.dangerText, fontSize: 12, marginTop: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  cancelButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md },
  cancelText: { color: colors.textSecondary, fontWeight: '700' },
  submitButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.primary },
  submitText: { color: colors.white, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
