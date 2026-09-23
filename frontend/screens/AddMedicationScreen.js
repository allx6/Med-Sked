import React, { useState } from 'react';

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { createMedication } from '../services/api';

import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';


export default function AddMedicationScreen({
  token,
  patientId,
  onMedicationAdded,
  onCancel,
}) {
  const [name, setName] = useState('');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [frequencyAmount, setFrequencyAmount] = useState('');
  const [frequencyUnit, setFrequencyUnit] = useState('hours');
  const [quantityOnHand, setQuantityOnHand] = useState('0');
  const [refillThreshold, setRefillThreshold] = useState('0');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  async function handleSubmit() {
    setError('');

    if (!name.trim() || !dosageAmount.trim() || !frequencyAmount.trim()) {
      setError(
        'Please fill in all medication fields.'
      );

      return;
    }

    if (!/^\d+(\.\d+)?$/.test(dosageAmount.trim()) || !/^\d+(\.\d+)?$/.test(frequencyAmount.trim())) {
      setError('Dosage and frequency values must be numeric.');
      return;
    }

    if (!/^\d+(\.\d+)?$/.test(quantityOnHand.trim()) || !/^\d+(\.\d+)?$/.test(refillThreshold.trim())) {
      setError('Quantity and refill threshold must be non-negative numbers.');
      return;
    }

    try {
      setLoading(true);

      const medicationPayload = {
        name: name.trim(),
        dosage: `${dosageAmount.trim()} ${dosageUnit}`,
        frequency: `Every ${frequencyAmount.trim()} ${frequencyUnit}`,
        quantityOnHand: Number(quantityOnHand),
        refillThreshold: Number(refillThreshold),
      };

      const medication = await createMedication(
        token,
        medicationPayload,
        patientId
      );

      onMedicationAdded(medication);

    } catch (error) {
      console.error(
        'Create medication error:',
        error
      );

      setError(
        error.message ||
        'Failed to create medication.'
      );

    } finally {
      setLoading(false);
    }
  }


  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
    >

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.card}>

          <Text style={styles.title}>
            Add Medication
          </Text>

          <Text style={styles.subtitle}>
            Add a medication to your Med-Sked record.
          </Text>


          <TextField
            label="Medication name"
            placeholder="e.g. Paracetamol"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!loading}
          />

          <TextField
            label="Dosage amount"
            placeholder="e.g. 500"
            value={dosageAmount}
            onChangeText={setDosageAmount}
            keyboardType="decimal-pad"
            editable={!loading}
          />

          <Text style={styles.unitLabel}>Dosage unit</Text>
          <View style={styles.unitRow}>
            {['mg', 'mcg', 'g', 'mL', 'tablet'].map((unit) => (
              <Pressable
                key={unit}
                onPress={() => setDosageUnit(unit)}
                disabled={loading}
                style={[styles.unitChip, dosageUnit === unit && styles.unitChipSelected]}
              >
                <Text style={[styles.unitChipText, dosageUnit === unit && styles.unitChipTextSelected]}>{unit}</Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label="Quantity on hand"
            placeholder="e.g. 30"
            value={quantityOnHand}
            onChangeText={setQuantityOnHand}
            keyboardType="decimal-pad"
            editable={!loading}
          />

          <TextField
            label="Refill threshold"
            placeholder="e.g. 5"
            value={refillThreshold}
            onChangeText={setRefillThreshold}
            keyboardType="decimal-pad"
            editable={!loading}
          />

          <TextField
            label="Frequency interval"
            placeholder="e.g. 8"
            value={frequencyAmount}
            onChangeText={setFrequencyAmount}
            keyboardType="number-pad"
            editable={!loading}
          />

          <Text style={styles.unitLabel}>Frequency unit</Text>
          <View style={styles.unitRow}>
            {['minutes', 'hours', 'days'].map((unit) => (
              <Pressable
                key={unit}
                onPress={() => setFrequencyUnit(unit)}
                disabled={loading}
                style={[styles.unitChip, frequencyUnit === unit && styles.unitChipSelected]}
              >
                <Text style={[styles.unitChipText, frequencyUnit === unit && styles.unitChipTextSelected]}>{unit}</Text>
              </Pressable>
            ))}
          </View>


          {error ? (
            <Text style={styles.error}>
              {error}
            </Text>
          ) : null}


          <PrimaryButton
            label="Add Medication"
            onPress={handleSubmit}
            loading={loading}
            style={styles.button}
          />


          <SecondaryButton
            label="Cancel"
            onPress={onCancel}
            disabled={loading}
            style={styles.cancelButton}
          />

        </View>

      </ScrollView>

    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({

  wrapper: {
    flex: 1,
    backgroundColor: '#87CEEB',
  },

  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,

    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 2,
  },

  unitLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },

  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D8E0E8',
    backgroundColor: '#F8FAFC',
  },

  unitChipSelected: {
    borderColor: '#2F6690',
    backgroundColor: '#EAF3F9',
  },

  unitChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },

  unitChipTextSelected: {
    color: '#2F6690',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E2A4A',
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,

    paddingHorizontal: 14,
    paddingVertical: 12,

    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },

  error: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 12,
  },

  button: {
    backgroundColor: '#2F6690',
    borderRadius: 10,

    paddingVertical: 14,

    alignItems: 'center',

    marginTop: 24,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  cancelButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },

  cancelText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },

});