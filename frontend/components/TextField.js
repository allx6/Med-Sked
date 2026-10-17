import React, { useRef } from 'react';
import {
  Animated,
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { colors, radius } from '../theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  editable = true,
  inputStyle,
  labelStyle,
  onFocus,
  onBlur,
  ...inputProps
}) {
  const focusProgress = useRef(new Animated.Value(0)).current;
  const animateFocus = (focused) => {
    Animated.timing(focusProgress, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  return (
    <View style={styles.group}>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
      <AnimatedTextInput
        style={[
          styles.input,
          error && styles.inputError,
          !editable && styles.disabled,
          inputStyle,
          {
            borderColor: focusProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                error ? colors.danger : colors.inputBorder,
                error ? colors.danger : colors.primary,
              ],
            }),
            backgroundColor: focusProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                error ? '#FFF7F7' : colors.inputFill,
                error ? '#FFF7F7' : '#FFFFFF',
              ],
            }),
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA3AF"
        editable={editable}
        onFocus={(event) => {
          animateFocus(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          animateFocus(false);
          onBlur?.(event);
        }}
        {...inputProps}
      />
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
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputFill,
    fontSize: 15,
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
