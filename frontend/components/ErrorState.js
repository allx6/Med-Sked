import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import SecondaryButton from './SecondaryButton';

export default function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Could not load this screen</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <SecondaryButton
          label="Try again"
          onPress={onRetry}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dangerText,
  },
  message: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.dangerText,
  },
  button: {
    marginTop: 12,
  },
});
