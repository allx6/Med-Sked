import React, { useRef, useState } from 'react';

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Portal } from 'react-native-paper';

import { refillMedication, updateMedication } from '../services/api';

import MedicineNameInput from '../components/MedicineNameInput';
import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import {
  getMedicationExpirationState,
  getSafeUserErrorMessage,
  isValidMedicationNumericInput,
  isValidMedicationFrequencyInput,
  validateMedicationFields,
  validateRefillAmount,
} from '../utils/medicationValidation';
import { getRefillErrorMessage } from '../utils/refillErrors';

const dosageUnits = ['mg', 'mcg', 'g', 'mL', 'tablet'];
const frequencyUnits = ['hours', 'days'];

function parseDosage(value) {
  const match = String(value || '').trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(mg|mcg|g|mL|tablet)$/i);
  return match ? { amount: match[1], unit: match[2] } : null;
}

function parseFrequency(value) {
  const match = String(value || '').trim().match(/^Every\s+([0-9]+(?:\.[0-9]+)?)\s+(hours|days)$/i);
  return match ? { amount: match[1], unit: match[2].toLowerCase() } : null;
}


export default function EditMedicationScreen({
  medication,
  token,
  patientId,
  onMedicationUpdated,
  onCancel,
}) {

  const medicineNameInputRef = useRef(null);
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
  const [refillAmount, setRefillAmount] = useState('');
  const [expirationDate, setExpirationDate] = useState(medication.expirationDate || '');
  const [showExpirationDatePicker, setShowExpirationDatePicker] = useState(false);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [legacyDosage, setLegacyDosage] = useState(parsedDosage ? '' : medication.dosage || '');
  const [legacyFrequency, setLegacyFrequency] = useState(parsedFrequency ? '' : medication.frequency || '');

  const [error, setError] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [refilling, setRefilling] = useState(false);
  const [refillError, setRefillError] = useState('');
  const [refillSuccess, setRefillSuccess] = useState('');

  const openExpirationDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseDateOnly(expirationDate) || todayStart,
        mode: 'date',
        minimumDate: todayStart,
        onValueChange: (_event, date) => {
          if (date) {
            setExpirationDate(formatDateOnly(date));
          }
        },
      });
      return;
    }

    setShowExpirationDatePicker((isVisible) => !isVisible);
  };


  // =====================================================
  // SAVE CHANGES
  // =====================================================

  const handleSubmit = async () => {

    const dosage = legacyDosage.trim() || `${dosageAmount.trim()} ${dosageUnit}`;
    const frequency = legacyFrequency.trim() || `Every ${frequencyAmount.trim()} ${frequencyUnit}`;
    const medicationError = validateMedicationFields({
      name,
      dosage,
      frequency,
      expirationDate,
      quantityOnHand,
      refillThreshold,
    });

    if (medicationError) {
      setError(medicationError);
      return;
    }


    try {

      setError('');

      setLoading(true);


      const updatedMedication = {

        name: name.trim(),

        dosage,

        frequency,

        expirationDate: expirationDate.trim() || null,

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
        getSafeUserErrorMessage(
          error,
          'Unable to save the medication. Please check your connection and try again.'
        )
      );

    } finally {

      setLoading(false);

    }

  };

  const handleRefill = async () => {
    setRefillError('');
    setRefillSuccess('');

    const amountError = validateRefillAmount(refillAmount);
    if (amountError) {
      setRefillError(amountError);
      return;
    }

    if (getMedicationExpirationState(expirationDate).expired) {
      setRefillError('Cannot refill an expired medication.');
      return;
    }

    try {
      setRefilling(true);
      const updatedMedication = await refillMedication(
        token,
        medication._id,
        Number(refillAmount),
        patientId
      );
      const updatedQuantity = String(updatedMedication.quantityOnHand);
      setQuantityOnHand(updatedQuantity);
      setRefillAmount('');
      setRefillSuccess(`Refill added. Quantity on hand: ${updatedQuantity}.`);
    } catch (error) {
      setRefillError(getRefillErrorMessage(error));
    } finally {
      setRefilling(false);
    }
  };


  return (

    <Portal.Host>
      <KeyboardAvoidingView
        style={styles.wrapper}

        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
      >

      <FlatList
        data={[]}
        renderItem={() => null}
        contentContainerStyle={
          styles.scroll
        }
        keyboardShouldPersistTaps="handled"
        onScroll={
          Platform.OS === 'web'
            ? () => medicineNameInputRef.current?.closeDropdown()
            : undefined
        }
        onScrollBeginDrag={() => medicineNameInputRef.current?.closeDropdown()}
        ListHeaderComponent={(
        <View style={styles.card}>

          {/* TITLE */}

          <Text style={styles.title}>
            Edit Medication
          </Text>

          <Text style={styles.subtitle}>
            Update your medication information
          </Text>


          {/* MEDICATION NAME */}

          <MedicineNameInput
            ref={medicineNameInputRef}
            label="Medication name"
            placeholder="Enter Medication name"
            value={name}
            onChangeText={(value) => {
              if (value.length <= 100 && !/[\u0000-\u001F\u007F]/.test(value)) {
                setName(value);
              }
            }}
            autoCapitalize="words"
            maxLength={100}
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
                onChangeText={(value) => {
                  if (isValidMedicationNumericInput(value, { allowDecimal: true })) {
                    setDosageAmount(value);
                  }
                }}
                keyboardType="decimal-pad"
                maxLength={7}
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
                onChangeText={(value) => {
                  if (isValidMedicationFrequencyInput(value)) {
                    setFrequencyAmount(value);
                  }
                }}
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
            onChangeText={(value) => {
              if (isValidMedicationNumericInput(value)) {
                setQuantityOnHand(value);
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading && !refilling}
          />

          <TextField
            label="Refill amount"
            placeholder="Enter amount to add"
            value={refillAmount}
            onChangeText={(value) => {
              if (isValidMedicationNumericInput(value, { allowDecimal: true })) {
                setRefillAmount(value);
                setRefillError('');
                setRefillSuccess('');
              }
            }}
            keyboardType="decimal-pad"
            maxLength={7}
            editable={!loading && !refilling}
          />

          <PrimaryButton
            label="Add refill"
            onPress={handleRefill}
            loading={refilling}
            disabled={loading}
            style={styles.refillButton}
          />

          {refillError ? (
            <Text style={styles.error} accessibilityRole="alert">{refillError}</Text>
          ) : null}

          {refillSuccess ? (
            <Text style={styles.refillSuccess} accessibilityRole="status">{refillSuccess}</Text>
          ) : null}

          <TextField
            label="Refill threshold"
            placeholder="e.g. 5"
            value={refillThreshold}
            onChangeText={(value) => {
              if (isValidMedicationNumericInput(value)) {
                setRefillThreshold(value);
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading && !refilling}
          />

          <Text style={styles.fieldLabel}>Expiration date (required) — YYYY-MM-DD</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={expirationDate}
              min={formatDateOnly(todayStart)}
              onChange={(event) => setExpirationDate(event.target.value)}
              disabled={loading}
              style={styles.webDateInput}
            />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showExpirationDatePicker ? 'Close expiration date picker' : 'Choose expiration date'}
                onPress={openExpirationDatePicker}
                disabled={loading}
                style={styles.expirationDateButton}
              >
                <Text style={expirationDate ? styles.expirationDateText : styles.expirationDatePlaceholder}>
                  {expirationDate || 'YYYY-MM-DD'}
                </Text>
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={20}
                  color="#0B4F59"
                />
              </Pressable>
              {showExpirationDatePicker ? (
                <DateTimePicker
                  value={parseDateOnly(expirationDate) || todayStart}
                  mode="date"
                  minimumDate={todayStart}
                  display="spinner"
                  onValueChange={(_event, date) => {
                    if (date) {
                      setExpirationDate(formatDateOnly(date));
                    }
                  }}
                  onDismiss={() => setShowExpirationDatePicker(false)}
                />
              ) : null}
            </>
          )}


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
            disabled={refilling}
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
        )}
      />

    </KeyboardAvoidingView>
    </Portal.Host>

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

    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
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

  fieldLabel: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 5,
    fontWeight: '700',
  },

  expirationDateButton: {
    width: '100%',
    minWidth: 0,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: '#A8C7CC',
    backgroundColor: '#F7FBFB',
  },

  expirationDateText: {
    color: '#17313A',
    fontSize: 14,
  },

  expirationDatePlaceholder: {
    color: '#9AA3AF',
    fontSize: 14,
  },

  webDateInput: {
    width: '100%',
    minWidth: 0,
    height: 40,
    display: 'block',
    boxSizing: 'border-box',
    paddingHorizontal: 11,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#A8C7CC',
    borderRadius: 10,
    backgroundColor: '#F7FBFB',
    fontSize: 14,
    color: '#17313A',
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
    borderColor: '#0B4F59',
    backgroundColor: '#EAF3F9',
  },

  unitChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },

  unitChipTextSelected: {
    color: '#0B4F59',
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

  refillButton: {
    marginTop: 4,
  },

  refillSuccess: {
    color: '#15803D',
    fontSize: 13,
    marginTop: 10,
  },


  button: {

    backgroundColor: '#0B4F59',

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

const formatDateOnly = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? date
    : null;
};