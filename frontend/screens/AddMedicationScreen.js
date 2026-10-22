import React, { useRef, useState } from 'react';

import {
  View,
  Image,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Portal } from 'react-native-paper';

import { createMedication } from '../services/api';

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
} from '../utils/medicationValidation';


export default function AddMedicationScreen({
  token,
  patientId,
  onMedicationAdded,
  onCancel,
}) {
  const { width } = useWindowDimensions();
  const wideLayout = width >= 640;
  const medicineNameInputRef = useRef(null);
  const [name, setName] = useState('');
  const [selectedMedicineName, setSelectedMedicineName] = useState('');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [frequencyAmount, setFrequencyAmount] = useState('');
  const [frequencyUnit, setFrequencyUnit] = useState('hours');
  const [quantityOnHand, setQuantityOnHand] = useState('0');
  const [refillThreshold, setRefillThreshold] = useState('0');
  const [expirationDate, setExpirationDate] = useState('');
  const [showExpirationDatePicker, setShowExpirationDatePicker] = useState(false);
  const [expirationDateFocused, setExpirationDateFocused] = useState(false);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [reviewVisible, setReviewVisible] = useState(false);
  const [loading, setLoading] = useState(false);

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


  const getMedicationValues = () => {
    const dosage = `${dosageAmount.trim()} ${dosageUnit}`;
    const frequency = `Every ${frequencyAmount.trim()} ${frequencyUnit}`;
    return {
      name,
      dosage,
      frequency,
      expirationDate,
      quantityOnHand,
      refillThreshold,
    };
  };

  function handleSubmit() {
    setError('');
    const errors = getMedicationFieldErrors(getMedicationValues());
    if (
      !selectedMedicineName
      || selectedMedicineName.toLocaleLowerCase() !== name.trim().toLocaleLowerCase()
    ) {
      errors.name = 'Medicine not in the current dataset. Select a medicine from the dropdown.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please correct the highlighted fields.');
      return;
    }

    setReviewVisible(true);
  }

  async function confirmSaveMedication() {
    const { dosage, frequency } = getMedicationValues();
    setReviewVisible(false);
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
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        onScroll={
          Platform.OS === 'web'
            ? () => medicineNameInputRef.current?.closeDropdown()
            : undefined
        }
        onScrollBeginDrag={() => medicineNameInputRef.current?.closeDropdown()}
        ListHeaderComponent={(
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

          <MedicineNameInput
            ref={medicineNameInputRef}
            label="Medication name"
            showDatasetWarning
            placeholder="Enter Medication name"
            value={name}
            onChangeText={(value) => {
              if (value.length <= 100 && !/[\u0000-\u001F\u007F]/.test(value)) {
                setName(value);
                setSelectedMedicineName('');
                setFieldErrors((previous) => ({ ...previous, name: undefined }));
              }
            }}
            onSelectMedicine={(medicine) => {
              setName(medicine);
              setSelectedMedicineName(medicine);
              setFieldErrors((previous) => ({ ...previous, name: undefined }));
            }}
            autoCapitalize="words"
            maxLength={100}
            editable={!loading}
            labelStyle={styles.fieldLabel}
            inputStyle={styles.fieldInput}
            error={fieldErrors.name}
          />

          <View style={[styles.fieldRow, !wideLayout && styles.fieldRowStacked]}>
            <View style={[styles.fieldColumn, !wideLayout && styles.fieldColumnStacked]}>
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
                maxLength={7}
                keyboardType="decimal-pad"
                editable={!loading}
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
                error={fieldErrors.dosage}
              />
            </View>
            <View style={[styles.fieldColumn, !wideLayout && styles.fieldColumnStacked]}>
              <Text style={styles.unitLabel}>Dosage unit</Text>
              <View style={styles.unitRow}>
                {['mg', 'mcg', 'g', 'mL', 'tablet'].map((unit) => (
                  <Pressable
                    key={unit}
                    accessibilityRole="button"
                    accessibilityState={{ selected: dosageUnit === unit }}
                    onPress={() => setDosageUnit(unit)}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.unitChip,
                      dosageUnit === unit && styles.unitChipSelected,
                      pressed && styles.unitChipPressed,
                    ]}
                  >
                    <Text style={[styles.unitChipText, dosageUnit === unit && styles.unitChipTextSelected]}>{unit}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.fieldRow, !wideLayout && styles.fieldRowStacked]}>
            <View style={[styles.fieldColumn, !wideLayout && styles.fieldColumnStacked]}>
              <TextField
                label="Quantity on hand"
                placeholder="e.g. 30"
                value={quantityOnHand}
                onChangeText={(value) => {
                  if (isValidMedicationNumericInput(value)) {
                    setQuantityOnHand(value);
                    setFieldErrors((previous) => ({ ...previous, quantityOnHand: undefined }));
                  }
                }}
                maxLength={6}
                keyboardType="number-pad"
                editable={!loading}
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
                error={fieldErrors.quantityOnHand}
              />
            </View>
            <View style={[styles.fieldColumn, !wideLayout && styles.fieldColumnStacked]}>
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
                maxLength={6}
                keyboardType="number-pad"
                editable={!loading}
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
                error={fieldErrors.refillThreshold}
              />
            </View>
          </View>

          <View style={[styles.fieldRow, styles.frequencyFieldRow, !wideLayout && styles.fieldRowStacked]}>
            <View style={[styles.fieldColumn, !wideLayout && styles.fieldColumnStacked]}>
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
                  onFocus={() => setExpirationDateFocused(true)}
                  onBlur={() => setExpirationDateFocused(false)}
                  style={{
                    ...styles.webDateInput,
                    ...(expirationDateFocused
                      ? styles.webDateInputFocused
                      : {}),
                  }}
                />
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showExpirationDatePicker ? 'Close expiration date picker' : 'Choose expiration date'}
                    onPress={openExpirationDatePicker}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.expirationDateButton,
                      pressed && styles.expirationDateButtonPressed,
                    ]}
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
                <Text style={styles.error} accessibilityRole="alert">
                  {fieldErrors.expirationDate}
                </Text>
              ) : null}
            </View>
            <View style={[styles.fieldColumn, !wideLayout && styles.fieldColumnStacked]}>
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
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
                error={fieldErrors.frequency}
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
                    style={({ pressed }) => [
                      styles.unitChip,
                      frequencyUnit === unit && styles.unitChipSelected,
                      pressed && styles.unitChipPressed,
                    ]}
                  >
                    <Text style={[styles.unitChipText, frequencyUnit === unit && styles.unitChipTextSelected]}>{unit}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.frequencyHint}>
                This interval is used after you choose a starting time and active days in Add Schedule. Hour-based doses may continue past midnight.
              </Text>
            </View>
          </View>


          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
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
        )}
      />

    </KeyboardAvoidingView>
    <ConfirmationDialog
      visible={reviewVisible}
      title="Review medication"
      message={[
        `Medication: ${name.trim()}`,
        `Product strength: ${getMedicationValues().dosage}`,
        `Frequency interval: ${getMedicationValues().frequency}`,
        `Quantity on hand: ${quantityOnHand}`,
        `Refill threshold: ${refillThreshold}`,
        `Expiration date: ${expirationDate}`,
        '',
        'Schedule time and active days are set separately in Add Schedule.',
      ].join('\n')}
      confirmLabel="Save medication"
      cancelLabel="Back to edit"
      onConfirm={confirmSaveMedication}
      onCancel={() => setReviewVisible(false)}
    />
    </Portal.Host>
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
    paddingHorizontal: 16,
    paddingVertical: 24,
  },

  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E1ECEF',
    padding: 24,
    shadowColor: '#17313A',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
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
    gap: 18,
    marginBottom: 8,
  },

  frequencyFieldRow: {
    marginBottom: 22,
  },

  fieldRowStacked: {
    flexDirection: 'column',
    gap: 10,
  },

  fieldColumn: {
    flex: 1,
    minWidth: 0,
  },

  fieldColumnStacked: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
  },

  fieldLabel: {
    marginBottom: 7,
    fontSize: 13,
    fontWeight: '700',
    color: '#35515A',
  },
  frequencyHint: {
    marginTop: 6,
    color: '#557078',
    fontSize: 12,
    lineHeight: 17,
  },

  fieldInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderColor: '#BDD3D8',
    backgroundColor: '#F8FBFC',
  },

  webDateInputFocused: {
    borderColor: '#0B4F59',
    boxShadow: '0 0 0 3px rgba(11, 79, 89, 0.12)',
    outlineStyle: 'none',
  },

  expirationDateButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 15,
    paddingRight: 15,
    borderWidth: 1,
    borderRadius: 13,
    borderColor: '#BDD3D8',
    backgroundColor: '#F8FBFC',
  },

  expirationDateButtonPressed: {
    backgroundColor: '#EAF5F7',
    borderColor: '#0B4F59',
  },

  expirationDateText: {
    color: '#17313A',
    fontSize: 15,
  },

  expirationDatePlaceholder: {
    color: '#8A9CA3',
    fontSize: 15,
  },

  webDateInput: {
    height: 52,
    width: '100%',
    display: 'block',
    boxSizing: 'border-box',
    paddingLeft: 15,
    paddingRight: 15,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#BDD3D8',
    backgroundColor: '#F8FBFC',
    fontSize: 15,
    color: '#17313A',
    transition: 'border-color 180ms ease, box-shadow 180ms ease',
    outlineStyle: 'none',
  },

  unitLabel: {
    marginBottom: 7,
    fontSize: 13,
    fontWeight: '700',
    color: '#35515A',
  },

  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },

  unitChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D6E5E8',
    backgroundColor: '#F5FAFB',
  },

  unitChipSelected: {
    borderColor: '#0B4F59',
    backgroundColor: '#DCEFF0',
  },

  unitChipPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
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
    fontSize: 25,
    fontWeight: '800',
    color: '#0B4F59',
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#607981',
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
    gap: 12,
    marginTop: 20,
  },

  buttonRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },

  button: {
    width: '50%',
    maxWidth: 180,
  },

  buttonFullWidth: {
    width: '100%',
    maxWidth: '100%',
  },

  cancelButton: {
    width: '50%',
    maxWidth: 180,
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