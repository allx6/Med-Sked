import React, { useState } from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';

const getPickerDate = (hour, minute, period) => {
  const normalizedHour = period === 'PM' ? (hour % 12) + 12 : hour % 12;
  const date = new Date();
  date.setHours(normalizedHour, minute, 0, 0);
  return date;
};

export default function TimeSelector({
  hour,
  minute,
  period,
  onChange,
  disabled = false,
}) {
  const [showPicker, setShowPicker] = useState(false);

  const handleTimeSelection = (eventOrDate, maybeDate) => {
    const selectedDate = maybeDate ?? eventOrDate;
    setShowPicker(false);

    if (!selectedDate || eventOrDate?.type === 'dismissed') {
      return;
    }

    const nextHour = selectedDate.getHours();
    const nextMinute = selectedDate.getMinutes();
    const nextPeriod = nextHour >= 12 ? 'PM' : 'AM';
    const normalizedHour = nextHour % 12 || 12;

    onChange({
      hour: normalizedHour,
      minute: nextMinute,
      period: nextPeriod,
    });
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.timeField}
        onPress={() => !disabled && setShowPicker(true)}
        disabled={disabled}
      >
        <Text style={styles.valueText}>
          {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')} {period}
        </Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={getPickerDate(hour, minute, period)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={handleTimeSelection}
          onDismiss={() => setShowPicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8E0E8',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timeField: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  valueText: {
    color: '#1E2A4A',
    fontSize: 18,
    fontWeight: '700',
  },
});
