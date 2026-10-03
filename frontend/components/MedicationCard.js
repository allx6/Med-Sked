import React from 'react';

import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';

import StatusBadge from './StatusBadge';
import { getMedicationExpirationState } from '../utils/medicationValidation';

export default function MedicationCard({
  medication,
  onEdit,
  onSchedule,
  onDelete,
}) {
  const expirationState = getMedicationExpirationState(medication?.expirationDate);
  const isExpired = expirationState.expired;

  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name}>{medication.name}</Text>

        <Text style={styles.detail}>Dosage: {medication.dosage}</Text>

        <Text style={styles.detail}>Frequency: {medication.frequency}</Text>

        {isExpired ? (
          <View style={styles.expirationRow}>
            <StatusBadge status="expired" label="Expired" />
            <Text style={[styles.detail, styles.expiredText]}>
              Expired on {expirationState.expirationDate}
            </Text>
          </View>
        ) : expirationState.expirationDate ? (
          <Text style={styles.detail}>Expires: {expirationState.expirationDate}</Text>
        ) : null}

        <Text style={[styles.detail, Number(medication.quantityOnHand ?? 0) <= Number(medication.refillThreshold ?? 0) ? styles.lowStock : styles.stockOkay]}>
          Refill: {Number(medication.quantityOnHand ?? 0) <= 0 ? 'Out of stock' : Number(medication.quantityOnHand ?? 0) <= Number(medication.refillThreshold ?? 0) ? 'Low stock' : 'In stock'} - {Number(medication.quantityOnHand ?? 0)} on hand, threshold {Number(medication.refillThreshold ?? 0)}
        </Text>
      </View>

      <View style={styles.actions}>
        {onEdit && (
          <Pressable style={styles.actionButton} onPress={onEdit}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        )}

        {onSchedule && (
          <Pressable style={styles.actionButton} onPress={onSchedule}>
            <Text style={styles.scheduleText}>Schedule</Text>
          </Pressable>
        )}

        {onDelete && (
          <Pressable style={styles.actionButton} onPress={onDelete}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 1,
  },

  info: {
    flex: 1,
    paddingRight: 10,
  },

  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E2A4A',
    marginBottom: 6,
  },

  detail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  expirationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
    gap: 8,
  },

  expiredText: {
    color: '#B91C1C',
    fontWeight: '700',
  },

  lowStock: { color: '#B91C1C', fontWeight: '700' },
  stockOkay: { color: '#15803D', fontWeight: '700' },

  actions: {
    alignItems: 'flex-end',
  },

  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginVertical: 2,
  },

  editText: {
    color: '#0B4F59',
    fontSize: 13,
    fontWeight: '600',
  },

  scheduleText: {
    color: '#0B4F59',
    fontSize: 13,
    fontWeight: '600',
  },

  deleteText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
});