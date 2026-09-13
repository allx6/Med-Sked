import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function SecondaryButton({
  label,
  onPress,
  disabled,
  danger,
  style,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        danger && styles.danger,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, danger && styles.dangerLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    borderColor: '#FECACA',
    backgroundColor: colors.dangerSoft,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  dangerLabel: {
    color: colors.danger,
  },
});
