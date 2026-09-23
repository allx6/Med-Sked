import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import {
  getSchedules,
  deleteSchedule,
} from '../services/api';


// =====================================================
// MEDICATION SCHEDULE SCREEN
// =====================================================

export default function ScheduleScreen({
  token,
  onBack,
  onAddSchedule,
  onEditSchedule,
}) {

  // =====================================================
  // STATE
  // =====================================================

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');


  // =====================================================
  // LOAD SCHEDULES
  // =====================================================

  const loadSchedules = useCallback(
    async (isRefresh = false) => {

      try {

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        const data = await getSchedules(token);

        setSchedules(
          Array.isArray(data)
            ? data
            : []
        );

      } catch (error) {

        console.error(
          'Error loading schedules:',
          error
        );

        setError(
          error.message ||
          'Failed to load schedules.'
        );

      } finally {

        setLoading(false);
        setRefreshing(false);

      }

    },
    [token]
  );


  // =====================================================
  // LOAD WHEN SCREEN OPENS
  // =====================================================

  useEffect(() => {

    loadSchedules();

  }, [loadSchedules]);


  // =====================================================
  // DELETE SCHEDULE
  // =====================================================

  const handleDelete = (scheduleId) => {

    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to delete this medication schedule?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },

        {
          text: 'Delete',
          style: 'destructive',

          onPress: async () => {

            try {

              await deleteSchedule(
                token,
                scheduleId
              );

              setSchedules(
                previous =>
                  previous.filter(
                    schedule =>
                      schedule._id !== scheduleId
                  )
              );

            } catch (error) {

              console.error(
                'Delete schedule error:',
                error
              );

              Alert.alert(
                'Error',
                error.message ||
                'Failed to delete schedule.'
              );

            }

          },
        },
      ]
    );
  };


  // =====================================================
  // FORMAT DAYS
  // =====================================================

  const formatDays = (days) => {

    if (!days || days.length === 0) {
      return 'No days selected';
    }

    return days.join(', ');
  };


  // =====================================================
  // SCHEDULE CARD
  // =====================================================

  const renderSchedule = ({ item }) => {

    const medication =
      item.medicationId;

    const medicationName =
      medication?.name ||
      'Medication';

    const dosage =
      medication?.dosage ||
      '';

    const isEnabled =
      item.enabled !== false;


    return (

      <View style={styles.card}>

        {/* =================================================
            CARD HEADER
        ================================================= */}

        <View style={styles.cardHeader}>

          <View style={styles.medicationIcon}>

            <Text style={styles.medicationIconText}>
              💊
            </Text>

          </View>


          <View style={styles.medicationHeaderInfo}>

            <Text style={styles.medicationName}>
              {medicationName}
            </Text>

            {dosage ? (
              <Text style={styles.dosage}>
                {dosage}
              </Text>
            ) : null}

          </View>


          <View
            style={[
              styles.statusBadge,
              isEnabled
                ? styles.activeBadge
                : styles.disabledBadge,
            ]}
          >

            <Text
              style={[
                styles.statusText,
                isEnabled
                  ? styles.activeText
                  : styles.disabledText,
              ]}
            >
              {isEnabled
                ? 'Active'
                : 'Disabled'}
            </Text>

          </View>

        </View>


        {/* =================================================
            TIME
        ================================================= */}

        <View style={styles.timeSection}>

          <Text style={styles.timeLabel}>
            Scheduled Time
          </Text>

          <Text style={styles.time}>
            {item.time || '--'}
          </Text>

        </View>


        {/* =================================================
            SCHEDULE DETAILS
        ================================================= */}

        <View style={styles.detailsContainer}>

          <View style={styles.detailRow}>

            <Text style={styles.detailLabel}>
              Dose
            </Text>

            <Text style={styles.detailValue}>
              {item.dose || dosage || '--'}
            </Text>

          </View>


          <View style={styles.detailRow}>

            <Text style={styles.detailLabel}>
              Days
            </Text>

            <Text style={styles.detailValue}>
              {formatDays(item.days)}
            </Text>

          </View>


          <View style={styles.detailRow}>

            <Text style={styles.detailLabel}>
              Start Date
            </Text>

            <Text style={styles.detailValue}>
              {item.startDate || '--'}
            </Text>

          </View>


          <View style={styles.detailRow}>

            <Text style={styles.detailLabel}>
              End Date
            </Text>

            <Text style={styles.detailValue}>
              {item.endDate
                ? item.endDate
                : 'No end date'}
            </Text>

          </View>

        </View>


        {/* =================================================
            ACTION BUTTONS
        ================================================= */}

        <View style={styles.actions}>

          <Pressable
            style={styles.editButton}
            onPress={() =>
              onEditSchedule(item)
            }
          >

            <Text style={styles.editText}>
              Edit
            </Text>

          </Pressable>


          <Pressable
            style={styles.deleteButton}
            onPress={() =>
              handleDelete(item._id)
            }
          >

            <Text style={styles.deleteText}>
              Delete
            </Text>

          </Pressable>

        </View>

      </View>
    );
  };


  // =====================================================
  // LOADING SCREEN
  // =====================================================

  if (loading) {

    return (

      <View style={styles.loadingContainer}>

        <ActivityIndicator
          size="large"
          color="#2F6690"
        />

        <Text style={styles.loadingText}>
          Loading schedules...
        </Text>

      </View>
    );
  }


  // =====================================================
  // SCREEN
  // =====================================================

  return (

    <View style={styles.container}>

      {/* =================================================
          HEADER
      ================================================= */}

      <View style={styles.header}>

        <Pressable
          onPress={onBack}
          style={styles.backButton}
        >

          <Text style={styles.backText}>
            Back
          </Text>

        </Pressable>


        <View style={styles.headerTitleContainer}>

          <Text style={styles.title}>
            Medication Schedules
          </Text>

          <Text style={styles.subtitle}>
            Manage when you take your medications.
          </Text>

        </View>

      </View>


      {/* =================================================
          ADD SCHEDULE BUTTON
      ================================================= */}

      <Pressable
        style={styles.addButton}
        onPress={onAddSchedule}
      >

        <Text style={styles.addButtonIcon}>
          +
        </Text>

        <View>

          <Text style={styles.addButtonTitle}>
            Add Schedule
          </Text>

          <Text style={styles.addButtonSubtitle}>
            Create a new medication reminder
          </Text>

        </View>

      </Pressable>


      {/* =================================================
          ERROR
      ================================================= */}

      {error ? (

        <View style={styles.errorBox}>

          <Text style={styles.errorTitle}>
            Unable to load schedules
          </Text>

          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={() =>
              loadSchedules()
            }
          >

            <Text style={styles.retryText}>
              Try Again
            </Text>

          </Pressable>

        </View>

      ) : null}


      {/* =================================================
          SCHEDULE LIST
      ================================================= */}

      <FlatList
        data={schedules}
        keyExtractor={(item) =>
          item._id
        }
        renderItem={renderSchedule}

        showsVerticalScrollIndicator={false}

        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              loadSchedules(true)
            }
            tintColor="#2F6690"
          />
        }

        contentContainerStyle={
          schedules.length === 0
            ? styles.emptyList
            : styles.list
        }

        ListHeaderComponent={

          schedules.length > 0 ? (

            <View style={styles.listHeader}>

              <Text style={styles.listTitle}>
                Your Schedules
              </Text>

              <Text style={styles.listCount}>
                {schedules.length}{' '}
                {schedules.length === 1
                  ? 'schedule'
                  : 'schedules'}
              </Text>

            </View>

          ) : null
        }

        ListEmptyComponent={

          <View style={styles.emptyContainer}>

            <View style={styles.emptyIconContainer}>

              <Text style={styles.emptyIcon}>
                🗓️
              </Text>

            </View>


            <Text style={styles.emptyTitle}>
              No schedules yet
            </Text>


            <Text style={styles.emptyText}>
              Create a medication schedule to
              receive reminders and keep track
              of your doses.
            </Text>


            <Pressable
              style={styles.emptyButton}
              onPress={onAddSchedule}
            >

              <Text style={styles.emptyButtonText}>
                + Create Schedule
              </Text>

            </Pressable>

          </View>
        }

        ListFooterComponent={
          <View style={styles.bottomSpacing} />
        }
      />

    </View>
  );
}


// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  // ===================================================
  // CONTAINER
  // ===================================================

  container: {
    flex: 1,
    backgroundColor: '#87CEEB',
    paddingHorizontal: 20,
  },


  // ===================================================
  // LOADING
  // ===================================================

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#87CEEB',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },


  // ===================================================
  // HEADER
  // ===================================================

  header: {
    paddingTop: 20,
    paddingBottom: 16,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 15,
    paddingVertical: 4,
  },

  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2F6690',
  },

  headerTitleContainer: {
    paddingRight: 20,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },


  // ===================================================
  // ADD BUTTON
  // ===================================================

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    padding: 15,
    borderRadius: 14,
    backgroundColor: '#2F6690',
  },

  addButtonIcon: {
    width: 38,
    height: 38,
    marginRight: 12,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 36,
    fontSize: 25,
    fontWeight: '400',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  addButtonTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  addButtonSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#DCEAF2',
  },


  // ===================================================
  // ERROR
  // ===================================================

  errorBox: {
    marginBottom: 15,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },

  errorTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B91C1C',
  },

  errorText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#991B1B',
  },

  retryText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    color: '#7F1D1D',
  },


  // ===================================================
  // LIST
  // ===================================================

  list: {
    paddingBottom: 20,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  listTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  listCount: {
    fontSize: 12,
    color: '#6B7280',
  },


  // ===================================================
  // SCHEDULE CARD
  // ===================================================

  card: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',

    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 1,
  },


  // ===================================================
  // CARD HEADER
  // ===================================================

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  medicationIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#87CEEB',
  },

  medicationIconText: {
    fontSize: 21,
  },

  medicationHeaderInfo: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },

  medicationName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  dosage: {
    marginTop: 3,
    fontSize: 12,
    color: '#6B7280',
  },


  // ===================================================
  // STATUS
  // ===================================================

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },

  activeBadge: {
    backgroundColor: '#DCFCE7',
  },

  disabledBadge: {
    backgroundColor: '#FEE2E2',
  },

  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },

  activeText: {
    color: '#15803D',
  },

  disabledText: {
    color: '#B91C1C',
  },


  // ===================================================
  // TIME
  // ===================================================

  timeSection: {
    marginTop: 17,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: '#F6F9FC',
  },

  timeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  time: {
    marginTop: 3,
    fontSize: 22,
    fontWeight: '800',
    color: '#2F6690',
  },


  // ===================================================
  // DETAILS
  // ===================================================

  detailsContainer: {
    marginTop: 13,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },

  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
  },

  detailValue: {
    maxWidth: '65%',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    color: '#374151',
  },


  // ===================================================
  // ACTIONS
  // ===================================================

  actions: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F3',
    gap: 8,
  },

  editButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#E8F1F7',
  },

  editText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2F6690',
  },

  deleteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#FEE2E2',
  },

  deleteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },


  // ===================================================
  // EMPTY STATE
  // ===================================================

  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 25,
  },

  emptyIconContainer: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderRadius: 20,
    backgroundColor: '#87CEEB',
  },

  emptyIcon: {
    fontSize: 32,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  emptyText: {
    maxWidth: 300,
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#6B7280',
  },

  emptyButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: '#2F6690',
  },

  emptyButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },


  // ===================================================
  // BOTTOM
  // ===================================================

  bottomSpacing: {
    height: 35,
  },

});