import React from 'react';

import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';


export default function MedicationCard({

  medication,

  onEdit,

  onSchedule,

  onDelete,

}) {

  return (

    <View style={styles.card}>

      {/* =================================================
          MEDICATION INFORMATION
      ================================================= */}

      <View style={styles.info}>

        <Text style={styles.name}>

          {medication.name}

        </Text>


        <Text style={styles.detail}>

          Dosage: {medication.dosage}

        </Text>


        <Text style={styles.detail}>

          Frequency: {medication.frequency}

        </Text>

        <Text style={[styles.detail, Number(medication.quantityOnHand ?? 0) <= Number(medication.refillThreshold ?? 0) ? styles.lowStock : styles.stockOkay]}>
          Refill: {Number(medication.quantityOnHand ?? 0) <= 0 ? 'Out of stock' : Number(medication.quantityOnHand ?? 0) <= Number(medication.refillThreshold ?? 0) ? 'Low stock' : 'In stock'} - {Number(medication.quantityOnHand ?? 0)} on hand, threshold {Number(medication.refillThreshold ?? 0)}
        </Text>

      </View>


      {/* =================================================
          ACTION BUTTONS
      ================================================= */}

      <View style={styles.actions}>

        {/* EDIT */}

        {onEdit && (

          <Pressable

            style={
              styles.actionButton
            }

            onPress={
              onEdit
            }

          >

            <Text style={
              styles.editText
            }>

              Edit

            </Text>

          </Pressable>

        )}


        {/* SCHEDULE */}

        {onSchedule && (

          <Pressable

            style={
              styles.actionButton
            }

            onPress={
              onSchedule
            }

          >

            <Text style={
              styles.scheduleText
            }>

              Schedule

            </Text>

          </Pressable>

        )}


        {/* DELETE */}

        {onDelete && (

          <Pressable

            style={
              styles.actionButton
            }

            onPress={
              onDelete
            }

          >

            <Text style={
              styles.deleteText
            }>

              Delete

            </Text>

          </Pressable>

        )}

      </View>

    </View>

  );

}


// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  card: {

    backgroundColor:
      '#FFFFFF',

    borderRadius: 14,

    padding: 16,

    marginBottom: 12,

    flexDirection:
      'row',

    justifyContent:
      'space-between',

    alignItems:
      'center',

    shadowColor:
      '#000',

    shadowOpacity:
      0.04,

    shadowRadius:
      8,

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

    fontWeight:
      '700',

    color:
      '#1E2A4A',

    marginBottom: 6,

  },


  detail: {

    fontSize: 13,

    color:
      '#6B7280',

    marginTop: 2,

  },

  lowStock: { color: '#B91C1C', fontWeight: '700' },
  stockOkay: { color: '#15803D', fontWeight: '700' },


  actions: {

    alignItems:
      'flex-end',

  },


  actionButton: {

    paddingHorizontal: 8,

    paddingVertical: 6,

    marginVertical: 2,

  },


  editText: {

    color:
      '#2F6690',

    fontSize: 13,

    fontWeight:
      '600',

  },


  scheduleText: {

    color:
      '#2F6690',

    fontSize: 13,

    fontWeight:
      '600',

  },


  deleteText: {

    color:
      '#DC2626',

    fontSize: 13,

    fontWeight:
      '600',

  },

});