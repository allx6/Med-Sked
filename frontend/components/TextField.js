import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  editable = true,
  ...inputProps
}) {
  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          error && styles.inputError,
          !editable && styles.disabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA3AF"
        editable={editable}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: {
    marginBottom: 7,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputFill,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: '#F87171',
    backgroundColor: '#FFF7F7',
  },
  disabled: { opacity: 0.7 },
  error: {
    marginTop: 6,
    fontSize: 13,
    color: colors.dangerText,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
