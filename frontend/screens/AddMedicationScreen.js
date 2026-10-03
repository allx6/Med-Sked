import React, { useState } from 'react';

import {
  View,
  Image,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';

import { createMedication } from '../services/api';

import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import {
  getSafeUserErrorMessage,
  validateMedicationFields,
} from '../utils/medicationValidation';


export default function AddMedicationScreen({
  token,
  patientId,
  onMedicationAdded,
  onCancel,
}) {
  const { width } = useWindowDimensions();
  const wideLayout = width >= 640;
  const [name, setName] = useState('');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [frequencyAmount, setFrequencyAmount] = useState('');
  const [frequencyUnit, setFrequencyUnit] = useState('hours');
  const [quantityOnHand, setQuantityOnHand] = useState('0');
  const [refillThreshold, setRefillThreshold] = useState('0');
  const [expirationDate, setExpirationDate] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  async function handleSubmit() {
    setError('');

    if (!/^\d+(\.\d+)?$/.test(quantityOnHand.trim()) || !/^\d+(\.\d+)?$/.test(refillThreshold.trim())) {
      setError('Quantity and refill threshold must be non-negative numbers.');
      return;
    }

    const dosage = `${dosageAmount.trim()} ${dosageUnit}`;
    const frequency = `Every ${frequencyAmount.trim()} ${frequencyUnit}`;
    const medicationError = validateMedicationFields({ name, dosage, frequency, expirationDate });

    if (medicationError) {
      setError(medicationError);
      return;
    }

    try {
      setLoading(true);

      const medicationPayload = {
        name: name.trim(),
        dosage,
        frequency,
        expirationDate: expirationDate.trim() || null,
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
        getSafeUserErrorMessage(
          error,
          'Unable to save the medication. Please check your connection and try again.'
        )
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
          <View style={styles.heading}>
            <Image
              accessible
              accessibilityLabel="MedSked logo"
              source={require('../assets/medsked.png')}
              resizeMode="contain"
              style={styles.logo}
            />
            <View style={styles.headingText}>
              <Text style={styles.title}>Add Medication</Text>
              <Text style={styles.subtitle}>Add a medication to your MedSked record.</Text>
            </View>
          </View>

          <TextField
            label="Medication name"
            placeholder="e.g. Paracetamol"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!loading}
            labelStyle={styles.fieldLabel}
            inputStyle={styles.fieldInput}
          />

          <View style={[styles.fieldRow, !wideLayout && styles.fieldRowStacked]}>
            <View style={styles.fieldColumn}>
              <TextField
                label="Dosage amount"
                placeholder="e.g. 500"
                value={dosageAmount}
                onChangeText={setDosageAmount}
                keyboardType="decimal-pad"
                editable={!loading}
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
              />
            </View>
            <View style={styles.fieldColumn}>
              <Text style={styles.unitLabel}>Dosage unit</Text>
              <View style={styles.unitRow}>
                {['mg', 'mcg', 'g', 'mL', 'tablet'].map((unit) => (
                  <Pressable
                    key={unit}
                    accessibilityRole="button"
                    accessibilityState={{ selected: dosageUnit === unit }}
                    onPress={() => setDosageUnit(unit)}
                    disabled={loading}
                    style={[styles.unitChip, dosageUnit === unit && styles.unitChipSelected]}
                  >
                    <Text style={[styles.unitChipText, dosageUnit === unit && styles.unitChipTextSelected]}>{unit}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.fieldRow, !wideLayout && styles.fieldRowStacked]}>
            <View style={styles.fieldColumn}>
              <TextField
                label="Quantity on hand"
                placeholder="e.g. 30"
                value={quantityOnHand}
                onChangeText={setQuantityOnHand}
                keyboardType="decimal-pad"
                editable={!loading}
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
              />
            </View>
            <View style={styles.fieldColumn}>
              <TextField
                label="Refill threshold"
                placeholder="e.g. 5"
                value={refillThreshold}
                onChangeText={setRefillThreshold}
                keyboardType="decimal-pad"
                editable={!loading}
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
              />
            </View>
          </View>

          <View style={[styles.fieldRow, !wideLayout && styles.fieldRowStacked]}>
            <View style={styles.fieldColumn}>
              <TextField
                label="Expiration date (required)"
                placeholder="YYYY-MM-DD"
                value={expirationDate}
                onChangeText={setExpirationDate}
                keyboardType="default"
                editable={!loading}
                maxLength={10}
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
              />
            </View>
            <View style={styles.fieldColumn}>
              <TextField
                label="Frequency interval"
                placeholder="e.g. 8"
                value={frequencyAmount}
                onChangeText={setFrequencyAmount}
                keyboardType="number-pad"
                editable={!loading}
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
              />
              <Text style={styles.unitLabel}>Frequency unit</Text>
              <View style={styles.unitRow}>
                {['hours', 'days'].map((unit) => (
                  <Pressable
                    key={unit}
                    accessibilityRole="button"
                    accessibilityState={{ selected: frequencyUnit === unit }}
                    onPress={() => setFrequencyUnit(unit)}
                    disabled={loading}
                    style={[styles.unitChip, frequencyUnit === unit && styles.unitChipSelected]}
                  >
                    <Text style={[styles.unitChipText, frequencyUnit === unit && styles.unitChipTextSelected]}>{unit}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>


          {error ? (
            <Text style={styles.error}>
              {error}
            </Text>
          ) : null}


          <View style={[styles.buttonRow, !wideLayout && styles.buttonRowStacked]}>
            <PrimaryButton
              label="Add Medication"
              onPress={handleSubmit}
              loading={loading}
              style={[styles.button, !wideLayout && styles.buttonFullWidth]}
            />
            <SecondaryButton
              label="Cancel"
              onPress={onCancel}
              disabled={loading}
              style={[styles.cancelButton, !wideLayout && styles.buttonFullWidth]}
            />
          </View>

        </View>

      </ScrollView>

    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({

  wrapper: {
    flex: 1,
    backgroundColor: '#116F7A',
  },

  scroll: {

    flexGrow: 1,

    justifyContent: 'center',

    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,

  },

  card: {
    width: '100%',
    backgroundColor: '#D7EDF3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B5D4DC',
    padding: 32,
  },

  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  logo: {
    width: 42,
    height: 42,
    marginRight: 10,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
  },

  headingText: {
    flex: 1,
    minWidth: 0,
  },

  fieldRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },

  fieldRowStacked: {
    flexDirection: 'column',
    gap: 0,
  },

  fieldColumn: {
    flex: 1,
    minWidth: 0,
  },

  fieldLabel: {
    marginBottom: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#17313A',
  },

  fieldInput: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderColor: '#8EBAC5',
    backgroundColor: '#EAF5F7',
    fontSize: 13,
  },

  unitLabel: {
    marginBottom: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#17313A',
  },

  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },

  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B5D4DC',
    backgroundColor: '#EAF5F7',
  },

  unitChipSelected: {
    borderColor: '#0B4F59',
    backgroundColor: '#C5E3EA',
  },

  unitChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },

  unitChipTextSelected: {
    color: '#0B4F59',
  },

  title: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0B4F59',
  },

  subtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#607981',
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

  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 14,
  },

  buttonRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },

  button: {
    backgroundColor: '#0B4F59',
    borderRadius: 8,
    width: '50%',
    maxWidth: 180,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    paddingVertical: 8,
  },

  buttonFullWidth: {
    width: '100%',
    maxWidth: '100%',
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
    width: '50%',
    maxWidth: 180,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0B4F59',
    borderRadius: 8,
    paddingVertical: 8,
  },

  cancelText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },

});