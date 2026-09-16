import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const STEP_BUTTON_SIZE = 40;

const clamp = (value, minimum, maximum) => (
  Math.min(Math.max(value, minimum), maximum)
);

const Selector = ({
  label,
  value,
  onDecrease,
  onIncrease,
  disabled,
}) => (
  <View style={styles.selector}>
    <Pressable
      accessibilityLabel={`Increase ${label}`}
      style={styles.stepButton}
      onPress={onIncrease}
      disabled={disabled}
      hitSlop={6}
    >
      <Text style={styles.stepText}>▲</Text>
    </Pressable>

    <View style={styles.valueBox}>
      <Text style={styles.valueText}>{value}</Text>
    </View>

    <Pressable
      accessibilityLabel={`Decrease ${label}`}
      style={styles.stepButton}
      onPress={onDecrease}
      disabled={disabled}
      hitSlop={6}
    >
      <Text style={styles.stepText}>▼</Text>
    </Pressable>
  </View>
);

export default function TimeSelector({
  hour,
  minute,
  period,
  onChange,
  disabled = false,
}) {
  const changeHour = (amount) => {
    onChange({
      hour: clamp(hour + amount, 1, 12),
      minute,
      period,
    });
  };

  const changeMinute = (amount) => {
    onChange({
      hour,
      minute: (minute + amount + 60) % 60,
      period,
    });
  };

  const changePeriod = () => {
    onChange({
      hour,
      minute,
      period: period === 'AM' ? 'PM' : 'AM',
    });
  };

  const content = (
    <View style={styles.container}>
      <Selector
        label="hour"
        value={String(hour).padStart(2, '0')}
        onDecrease={() => changeHour(-1)}
        onIncrease={() => changeHour(1)}
        disabled={disabled}
      />

      <Text style={styles.separator}>:</Text>

      <Selector
        label="minute"
        value={String(minute).padStart(2, '0')}
        onDecrease={() => changeMinute(-1)}
        onIncrease={() => changeMinute(1)}
        disabled={disabled}
      />

      <View style={styles.periodSelector}>
        <Pressable
          accessibilityLabel="Toggle AM or PM"
          style={styles.periodButton}
          onPress={changePeriod}
          disabled={disabled}
          hitSlop={6}
        >
          <Text style={styles.stepText}>▲</Text>
        </Pressable>
        <Pressable
          style={styles.periodValueBox}
          onPress={changePeriod}
          disabled={disabled}
        >
          <Text style={styles.valueText}>{period}</Text>
        </Pressable>
        <Pressable
          style={styles.periodButton}
          onPress={changePeriod}
          disabled={disabled}
          hitSlop={6}
        >
          <Text style={styles.stepText}>▼</Text>
        </Pressable>
      </View>
    </View>
  );

  return disabled ? (
    <View style={styles.disabled}>{content}</View>
  ) : content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8E0E8',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selector: {
    alignItems: 'center',
    minWidth: 58,
  },
  stepButton: {
    alignItems: 'center',
    height: STEP_BUTTON_SIZE,
    justifyContent: 'center',
    width: STEP_BUTTON_SIZE,
  },
  stepText: {
    color: '#2F6690',
    fontSize: 14,
  },
  valueBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E3E9EF',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 58,
    paddingHorizontal: 8,
  },
  valueText: {
    color: '#1E2A4A',
    fontSize: 18,
    fontWeight: '700',
  },
  separator: {
    color: '#1E2A4A',
    fontSize: 22,
    fontWeight: '700',
    marginHorizontal: 5,
  },
  periodSelector: {
    alignItems: 'center',
    marginLeft: 12,
    minWidth: 64,
  },
  periodButton: {
    alignItems: 'center',
    height: STEP_BUTTON_SIZE,
    justifyContent: 'center',
    width: STEP_BUTTON_SIZE,
  },
  periodValueBox: {
    alignItems: 'center',
    backgroundColor: '#EAF3F9',
    borderColor: '#2F6690',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});
