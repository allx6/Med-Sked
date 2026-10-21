import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  Animated,
  StyleSheet,
} from 'react-native';
import { colors, radius } from '../theme';

export default function SecondaryButton({
  label,
  onPress,
  disabled,
  danger,
  style,
}) {
  const pressProgress = useRef(new Animated.Value(1)).current;
  const buttonStyle = StyleSheet.flatten(style) || {};

  const animatePress = (toValue) => {
    Animated.spring(pressProgress, {
      toValue,
      speed: 32,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => animatePress(0.97)}
      onPressOut={() => animatePress(1)}
      disabled={disabled}
      style={[
        styles.button,
        danger && styles.danger,
        disabled && styles.disabled,
        style,
        {
          transform: [
            ...(buttonStyle.transform || []),
            { scale: pressProgress },
          ],
        },
      ]}
    >
      <Text style={[styles.label, danger && styles.dangerLabel]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#17313A',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  danger: {
    borderColor: '#FECACA',
    backgroundColor: colors.dangerSoft,
  },
  disabled: { opacity: 0.55, elevation: 0, shadowOpacity: 0 },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  dangerLabel: {
    color: colors.danger,
  },
});
