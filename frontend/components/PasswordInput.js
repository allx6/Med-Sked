import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function PasswordInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  editable = true,
  inputStyle,
  labelStyle,
  rowStyle,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.group}>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
      <View style={[styles.row, error && styles.rowError, rowStyle]}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9AA3AF"
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
        />
        <Pressable
          onPress={() => setVisible((current) => !current)}
          hitSlop={8}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {visible ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 10 },
  label: {
    marginBottom: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  row: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputFill,
  },
  rowError: {
    borderColor: '#F87171',
    backgroundColor: '#FFF7F7',
  },
  input: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 11,
    fontSize: 14,
    color: colors.text,
  },
  toggle: {
    paddingHorizontal: 10,
    minHeight: 38,
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
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
