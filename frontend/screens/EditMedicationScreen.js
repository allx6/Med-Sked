import React, { useState } from 'react';

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';

import { updateMedication } from '../services/api';

import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';

const dosageUnits = ['mg', 'mcg', 'g', 'mL', 'tablet'];
const frequencyUnits = ['minutes', 'hours', 'days'];

function parseDosage(value) {
  const match = String(value || '').trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(mg|mcg|g|mL|tablet)$/i);
  return match ? { amount: match[1], unit: match[2] } : null;
}

function parseFrequency(value) {
  const match = String(value || '').trim().match(/^Every\s+([0-9]+(?:\.[0-9]+)?)\s+(minutes|hours|days)$/i);
  return match ? { amount: match[1], unit: match[2].toLowerCase() } : null;
}


export default function EditMedicationScreen({
  medication,
  token,
  patientId,
  onMedicationUpdated,
  onCancel,
}) {

  const [name, setName] =
    useState(medication.name || '');

  const parsedDosage = parseDosage(medication.dosage);
  const parsedFrequency = parseFrequency(medication.frequency);

  const [dosageAmount, setDosageAmount] = useState(parsedDosage?.amount || '');
  const [dosageUnit, setDosageUnit] = useState(parsedDosage?.unit || 'mg');
  const [frequencyAmount, setFrequencyAmount] = useState(parsedFrequency?.amount || '');
  const [frequencyUnit, setFrequencyUnit] = useState(parsedFrequency?.unit || 'hours');
  const [quantityOnHand, setQuantityOnHand] = useState(String(medication.quantityOnHand ?? 0));
  const [refillThreshold, setRefillThreshold] = useState(String(medication.refillThreshold ?? 0));
  const [legacyDosage, setLegacyDosage] = useState(parsedDosage ? '' : medication.dosage || '');
  const [legacyFrequency, setLegacyFrequency] = useState(parsedFrequency ? '' : medication.frequency || '');

  const [error, setError] =
    useState('');

  const [loading, setLoading] =
    useState(false);


  // =====================================================
  // SAVE CHANGES
  // =====================================================

  const handleSubmit = async () => {

    if (
      !name.trim() ||
      (!legacyDosage.trim() && !dosageAmount.trim()) ||
      (!legacyFrequency.trim() && !frequencyAmount.trim())
    ) {

      setError(
        'Please fill in all fields.'
      );

      return;
    }

    if (!legacyDosage.trim() && !/^\d+(\.\d+)?$/.test(dosageAmount.trim())) {
      setError('Dosage amount must be numeric.');
      return;
    }

    if (!legacyFrequency.trim() && !/^\d+(\.\d+)?$/.test(frequencyAmount.trim())) {
      setError('Frequency interval must be numeric.');
      return;
    }

    if (!/^\d+(\.\d+)?$/.test(quantityOnHand.trim()) || !/^\d+(\.\d+)?$/.test(refillThreshold.trim())) {
      setError('Quantity and refill threshold must be non-negative numbers.');
      return;
    }


    try {

      setError('');

      setLoading(true);


      const updatedMedication = {

        name: name.trim(),

        dosage: legacyDosage.trim() || `${dosageAmount.trim()} ${dosageUnit}`,

        frequency: legacyFrequency.trim() || `Every ${frequencyAmount.trim()} ${frequencyUnit}`,

        quantityOnHand: Number(quantityOnHand),
        refillThreshold: Number(refillThreshold),
      };


      const data =
        await updateMedication(
          token,
          medication._id,
          updatedMedication
          ,
          patientId
        );


      Alert.alert(
        'Success',
        'Medication updated successfully.'
      );


      onMedicationUpdated(
        data
      );


    } catch (error) {

      console.error(
        'Update medication error:',
        error
      );

      setError(
        error.message ||
        'Failed to update medication.'
      );

    } finally {

      setLoading(false);

    }

  };


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
        contentContainerStyle={
          styles.scroll
        }
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.card}>

          {/* TITLE */}

          <Text style={styles.title}>
            Edit Medication
          </Text>

          <Text style={styles.subtitle}>
            Update your medication information
          </Text>


          {/* MEDICATION NAME */}

          <TextField
            label="Medication name"
            placeholder="e.g. Paracetamol"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!loading}
          />


          {/* DOSAGE */}

          {legacyDosage ? (
            <TextField
              label="Dosage"
              value={legacyDosage}
              onChangeText={setLegacyDosage}
              editable={!loading}
              hint="Legacy format preserved. You can edit it as text."
            />
          ) : (
            <>
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
                {dosageUnits.map((unit) => (
                  <Pressable key={unit} onPress={() => setDosageUnit(unit)} disabled={loading} style={[styles.unitChip, dosageUnit === unit && styles.unitChipSelected]}>
                    <Text style={[styles.unitChipText, dosageUnit === unit && styles.unitChipTextSelected]}>{unit}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}


          {/* FREQUENCY */}

          {legacyFrequency ? (
            <TextField
              label="Frequency"
              value={legacyFrequency}
              onChangeText={setLegacyFrequency}
              editable={!loading}
              hint="Legacy format preserved. You can edit it as text."
            />
          ) : (
            <>
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
                {frequencyUnits.map((unit) => (
                  <Pressable key={unit} onPress={() => setFrequencyUnit(unit)} disabled={loading} style={[styles.unitChip, frequencyUnit === unit && styles.unitChipSelected]}>
                    <Text style={[styles.unitChipText, frequencyUnit === unit && styles.unitChipTextSelected]}>{unit}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

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


          {/* ERROR */}

          {error ? (

            <Text style={styles.error}>
              {error}
            </Text>

          ) : null}


          {/* SAVE */}

          <PrimaryButton
            label="Save Changes"
            onPress={handleSubmit}
            loading={loading}
            style={styles.button}
          />


          {/* CANCEL */}

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


// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  wrapper: {

    flex: 1,

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

    paddingVertical: 10,

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


  buttonDisabled: {

    opacity: 0.6,

  },


  buttonText: {

    color: '#FFFFFF',

    fontSize: 15,

    fontWeight: '600',

  },


  cancelButton: {

    alignItems: 'center',

    paddingVertical: 14,

    marginTop: 8,

  },


  cancelText: {

    color: '#6B7280',

    fontSize: 14,

    fontWeight: '600',

  },

});