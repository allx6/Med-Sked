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
import ConfirmationDialog from '../components/ConfirmationDialog';
import {
  getMedicationFieldErrors,
  getSafeUserErrorMessage,
  isValidMedicationNumericInput,
  isValidMedicationFrequencyInput,
  validateBatchExpirationDate,
  validateRefillAmount,
} from '../utils/medicationValidation';
import { getRefillErrorMessage } from '../utils/refillErrors';
import { getUsableMedicationQuantity } from '../utils/medicationStock';

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
  const [refillExpirationDate, setRefillExpirationDate] = useState('');
  const [stockBatches, setStockBatches] = useState(
    Array.isArray(medication.stockBatches) ? medication.stockBatches : []
  );
  const [expirationDate, setExpirationDate] = useState(medication.expirationDate || '');
  const [showExpirationDatePicker, setShowExpirationDatePicker] = useState(false);
  const [showRefillExpirationPicker, setShowRefillExpirationPicker] = useState(false);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [legacyDosage, setLegacyDosage] = useState(parsedDosage ? '' : medication.dosage || '');
  const [legacyFrequency, setLegacyFrequency] = useState(parsedFrequency ? '' : medication.frequency || '');

  const [error, setError] =
    useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [reviewVisible, setReviewVisible] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [refilling, setRefilling] = useState(false);
  const [refillError, setRefillError] = useState('');
  const [refillDateError, setRefillDateError] = useState('');
  const [refillSuccess, setRefillSuccess] = useState('');
  const [reviewRefillVisible, setReviewRefillVisible] = useState(false);

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

  const openRefillExpirationPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseDateOnly(refillExpirationDate) || todayStart,
        mode: 'date',
        minimumDate: todayStart,
        onValueChange: (_event, date) => {
          if (date) {
            setRefillExpirationDate(formatDateOnly(date));
            setRefillDateError('');
          }
        },
      });
      return;
    }

    setShowRefillExpirationPicker((isVisible) => !isVisible);
  };


  // =====================================================
  // SAVE CHANGES
  // =====================================================

  const getMedicationValues = () => {
    const dosage = legacyDosage.trim() || `${dosageAmount.trim()} ${dosageUnit}`;
    const frequency = legacyFrequency.trim() || `Every ${frequencyAmount.trim()} ${frequencyUnit}`;
    return {
      name,
      dosage,
      frequency,
      expirationDate,
      quantityOnHand,
      refillThreshold,
    };
  };

  const handleSubmit = () => {
    const values = getMedicationValues();
    const errors = getMedicationFieldErrors(values, {
      allowLegacyFrequency: Boolean(
        legacyFrequency && legacyFrequency === medication.frequency
      ),
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please correct the highlighted fields.');
      return;
    }

    setError('');
    setReviewVisible(true);
  };

  const confirmSaveMedication = async () => {
    const { dosage, frequency } = getMedicationValues();
    setReviewVisible(false);
    try {

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
    setRefillDateError('');

    const amountError = validateRefillAmount(refillAmount);
    if (amountError) {
      setRefillError(amountError);
      return;
    }

    const batchDateError = validateBatchExpirationDate(refillExpirationDate);
    if (batchDateError) {
      setRefillDateError(batchDateError);
      return;
    }

    setReviewRefillVisible(true);
  };

  const confirmRefill = async () => {
    setReviewRefillVisible(false);
    try {
      setRefilling(true);
      const updatedMedication = await refillMedication(
        token,
        medication._id,
        Number(refillAmount),
        patientId,
        refillExpirationDate
      );
      const updatedQuantity = String(updatedMedication.quantityOnHand);
      setQuantityOnHand(updatedQuantity);
      setStockBatches(
        Array.isArray(updatedMedication.stockBatches)
          ? updatedMedication.stockBatches
          : stockBatches
      );
      setRefillAmount('');
      setRefillExpirationDate('');
      setRefillSuccess(`Refill batch added. Quantity on hand: ${updatedQuantity}.`);
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
                setFieldErrors((previous) => ({ ...previous, name: undefined }));
              }
            }}
            autoCapitalize="words"
            maxLength={100}
            editable={!loading}
            error={fieldErrors.name}
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
                label="Product strength / dosage"
                placeholder="e.g. 500"
                value={dosageAmount}
                onChangeText={(value) => {
                  if (isValidMedicationNumericInput(value, { allowDecimal: true })) {
                    setDosageAmount(value);
                    setFieldErrors((previous) => ({ ...previous, dosage: undefined }));
                  }
                }}
                keyboardType="decimal-pad"
                maxLength={7}
                editable={!loading}
                error={fieldErrors.dosage}
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
            <>
              <TextField
                label="Existing frequency"
                value={legacyFrequency}
                editable={false}
                hint="This existing instruction will be preserved when you save other changes."
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setLegacyFrequency('');
                  setFrequencyAmount('');
                  setFrequencyUnit('hours');
                }}
                disabled={loading}
              >
                <Text style={styles.replaceFrequencyText}>Replace with a standard interval</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextField
                label="Frequency interval"
                placeholder="e.g. 8"
                value={frequencyAmount}
                onChangeText={(value) => {
                  if (isValidMedicationFrequencyInput(value)) {
                    setFrequencyAmount(value);
                    setFieldErrors((previous) => ({ ...previous, frequency: undefined }));
                  }
                }}
                keyboardType="number-pad"
                editable={!loading}
                error={fieldErrors.frequency}
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
          {!legacyFrequency ? (
            <Text style={styles.frequencyHint}>
              This interval is used after you choose a starting time and active days in Add Schedule. Hour-based doses may continue past midnight.
            </Text>
          ) : null}

          <TextField
            label="Total quantity on hand (all batches)"
            placeholder="e.g. 30"
            value={quantityOnHand}
            onChangeText={(value) => {
              if (isValidMedicationNumericInput(value)) {
                setQuantityOnHand(value);
                setFieldErrors((previous) => ({ ...previous, quantityOnHand: undefined }));
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading && !refilling}
            error={fieldErrors.quantityOnHand}
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

          <Text style={styles.fieldLabel}>New batch expiration date (required)</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={refillExpirationDate}
              min={formatDateOnly(todayStart)}
              onChange={(event) => {
                setRefillExpirationDate(event.target.value);
                setRefillDateError('');
              }}
              disabled={loading || refilling}
              style={styles.webDateInput}
            />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose refill batch expiration date"
                onPress={openRefillExpirationPicker}
                disabled={loading || refilling}
                style={styles.expirationDateButton}
              >
                <Text style={refillExpirationDate ? styles.expirationDateText : styles.expirationDatePlaceholder}>
                  {refillExpirationDate || 'YYYY-MM-DD'}
                </Text>
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={20}
                  color="#0B4F59"
                />
              </Pressable>
              {showRefillExpirationPicker ? (
                <DateTimePicker
                  value={parseDateOnly(refillExpirationDate) || todayStart}
                  mode="date"
                  minimumDate={todayStart}
                  display="spinner"
                  onValueChange={(_event, date) => {
                    if (date) {
                      setRefillExpirationDate(formatDateOnly(date));
                      setRefillDateError('');
                    }
                  }}
                  onDismiss={() => setShowRefillExpirationPicker(false)}
                />
              ) : null}
            </>
          )}
          {refillDateError ? (
            <Text style={styles.error} accessibilityRole="alert">{refillDateError}</Text>
          ) : null}

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

          <View style={styles.batchList}>
            <Text style={styles.batchListTitle}>Stock batches</Text>
            <Text style={styles.batchListEmpty}>
              Usable stock today: {getUsableMedicationQuantity({
                quantityOnHand: Number(quantityOnHand),
                stockBatches,
              })}
            </Text>
            {stockBatches.length === 0 ? (
              <Text style={styles.batchListEmpty}>
                Existing stock has no batch history yet. New refills will be tracked separately.
              </Text>
            ) : (
              [...stockBatches]
                .sort((left, right) => {
                  if (!left.expirationDate) return right.expirationDate ? 1 : 0;
                  if (!right.expirationDate) return -1;
                  return left.expirationDate.localeCompare(right.expirationDate);
                })
                .map((batch) => (
                  <View key={batch._id} style={styles.batchRow}>
                    <Text style={styles.batchQuantity}>
                      {batch.remainingQuantity} remaining
                    </Text>
                    <Text style={styles.batchExpiration}>
                      Expires: {batch.expirationDate || 'Unknown'}
                    </Text>
                  </View>
                ))
            )}
          </View>

          <TextField
            label="Refill threshold"
            placeholder="e.g. 5"
            value={refillThreshold}
            onChangeText={(value) => {
              if (isValidMedicationNumericInput(value)) {
                setRefillThreshold(value);
                setFieldErrors((previous) => ({ ...previous, refillThreshold: undefined }));
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading && !refilling}
            error={fieldErrors.refillThreshold}
          />

          <Text style={styles.fieldLabel}>Expiration date (required) — YYYY-MM-DD</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={expirationDate}
              min={formatDateOnly(todayStart)}
              onChange={(event) => {
                setExpirationDate(event.target.value);
                setFieldErrors((previous) => ({ ...previous, expirationDate: undefined }));
              }}
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
                      setFieldErrors((previous) => ({ ...previous, expirationDate: undefined }));
                    }
                  }}
                  onDismiss={() => setShowExpirationDatePicker(false)}
                />
              ) : null}
            </>
          )}
          {fieldErrors.expirationDate ? (
            <Text style={styles.error} accessibilityRole="alert">{fieldErrors.expirationDate}</Text>
          ) : null}


          {/* ERROR */}

          {error ? (

            <Text style={styles.error} accessibilityRole="alert">
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
    <ConfirmationDialog
      visible={reviewVisible}
      title="Review medication changes"
      message={[
        `Medication: ${name.trim()}`,
        `Product strength: ${getMedicationValues().dosage}`,
        `Frequency interval: ${getMedicationValues().frequency}`,
        `Quantity on hand: ${quantityOnHand}`,
        `Refill threshold: ${refillThreshold}`,
        `Expiration date: ${expirationDate}`,
        '',
        'Saving updates the linked schedule dose and recalculates pending doses if frequency changed.',
      ].join('\n')}
      confirmLabel="Save changes"
      cancelLabel="Back to edit"
      onConfirm={confirmSaveMedication}
      onCancel={() => setReviewVisible(false)}
    />
    <ConfirmationDialog
      visible={reviewRefillVisible}
      title="Review refill batch"
      message={[
        `Medication: ${name.trim()}`,
        `Product strength: ${getMedicationValues().dosage}`,
        `Quantity added: ${refillAmount}`,
        `Batch expiration date: ${refillExpirationDate}`,
      ].join('\n')}
      confirmLabel="Add batch"
      cancelLabel="Back to edit"
      onConfirm={confirmRefill}
      onCancel={() => setReviewRefillVisible(false)}
    />

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
  frequencyHint: {
    marginTop: 2,
    marginBottom: 12,
    color: '#557078',
    fontSize: 12,
    lineHeight: 17,
  },
  replaceFrequencyText: {
    marginTop: -2,
    marginBottom: 12,
    color: '#0B4F59',
    fontSize: 13,
    fontWeight: '700',
  },
  batchList: {
    marginTop: 12,
    marginBottom: 18,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EAF5F6',
  },
  batchListTitle: {
    marginBottom: 6,
    color: '#0B4F59',
    fontSize: 14,
    fontWeight: '700',
  },
  batchListEmpty: {
    color: '#557078',
    fontSize: 12,
    lineHeight: 17,
  },
  batchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#D3E5E7',
  },
  batchQuantity: {
    color: '#17313A',
    fontSize: 13,
    fontWeight: '600',
  },
  batchExpiration: {
    color: '#557078',
    fontSize: 13,
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