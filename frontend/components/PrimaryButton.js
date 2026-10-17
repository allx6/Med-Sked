import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import { colors, radius, shadow } from '../theme';

export default function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
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
      disabled={disabled || loading}
      style={[
        styles.button,
        (disabled || loading) && styles.disabled,
        style,
        {
          transform: [
            ...(buttonStyle.transform || []),
            { scale: pressProgress },
          ],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
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
    backgroundColor: colors.primary,
    ...shadow.card,
  },
  disabled: { opacity: 0.55, elevation: 0, shadowOpacity: 0 },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
});
