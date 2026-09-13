import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

export default function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <PrimaryButton
            label={confirmLabel}
            onPress={onConfirm}
            style={danger ? styles.danger : undefined}
          />
          <SecondaryButton
            label={cancelLabel}
            onPress={onCancel}
            style={styles.cancel}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 42, 74, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  message: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  cancel: { marginTop: 10 },
  danger: { backgroundColor: colors.danger },
});
