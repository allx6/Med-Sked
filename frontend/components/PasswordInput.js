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
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.row, error && styles.rowError]}>
        <TextInput
          style={styles.input}
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
  group: { marginBottom: 14 },
  label: {
    marginBottom: 7,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
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
    minHeight: 52,
    paddingHorizontal: 15,
    fontSize: 16,
    color: colors.text,
  },
  toggle: {
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 13,
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
