import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  View,
  Image,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getSchedules,
  deleteSchedule,
} from '../services/api';

import ConfirmationDialog from '../components/ConfirmationDialog';


// =====================================================
// MEDICATION SCHEDULE SCREEN
// =====================================================

export default function ScheduleScreen({
  token,
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingScheduleId, setPendingScheduleId] = useState(null);


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
    setPendingScheduleId(scheduleId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSchedule = async () => {
    if (!pendingScheduleId) {
      return;
    }

    try {
      await deleteSchedule(token, pendingScheduleId);

      setSchedules((previous) =>
        previous.filter((schedule) => schedule._id !== pendingScheduleId)
      );

      setShowDeleteConfirm(false);
      setPendingScheduleId(null);
    } catch (error) {
      console.error(
        'Delete schedule error:',
        error
      );

      Alert.alert(
        'Error',
        error.message || 'Failed to delete schedule.'
      );
    }
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

  const formatDayLabel = (day) => {
    const dayLabels = {
      Monday: 'M',
      Tuesday: 'T',
      Wednesday: 'W',
      Thursday: 'TH',
      Friday: 'F',
      Saturday: 'S',
      Sunday: 'S',
    };
    return dayLabels[day] || String(day).slice(0, 2).toUpperCase();
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
            <MaterialCommunityIcons name="pill" size={17} color="#0B4F59" />
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

            {Array.isArray(item.days) && item.days.length > 0 ? (
              <View style={styles.dayList}>
                {item.days.map((day, index) => (
                  <View key={`${item._id}-${index}`} style={styles.dayChip}>
                    <Text style={styles.dayChipText}>{formatDayLabel(day)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.detailValue}>{formatDays(item.days)}</Text>
            )}

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
            accessibilityRole="button"
            accessibilityLabel={`Edit schedule for ${medicationName}`}
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
            accessibilityRole="button"
            accessibilityLabel={`Delete schedule for ${medicationName}`}
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
          color="#0B4F59"
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
      <View style={styles.decorTopLeft} pointerEvents="none" />
      <View style={styles.decorRight} pointerEvents="none" />
      <View style={styles.decorBottomRight} pointerEvents="none" />
      <View style={styles.content}>

      {/* =================================================
          HEADER
      ================================================= */}

      <View style={styles.header}>

        <View style={styles.brandHeader}>
          <Image
            accessible
            accessibilityLabel="MedSked logo"
            source={require('../assets/medsked.png')}
            resizeMode="contain"
            style={styles.logo}
          />
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>Medication Schedules</Text>
            <Text style={styles.subtitle}>Manage when you take your medications.</Text>
          </View>
        </View>

      </View>


      {/* =================================================
          ADD SCHEDULE BUTTON
      ================================================= */}

      <Pressable
        style={styles.addButton}
        onPress={onAddSchedule}
      >

        <View style={styles.addButtonIcon}>
          <MaterialCommunityIcons name="plus-circle-outline" size={19} color="#D7EDF3" />
        </View>

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
            tintColor="#0B4F59"
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

      <ConfirmationDialog
        visible={showDeleteConfirm}
        title="Delete schedule?"
        message="Are you sure you want to delete this medication schedule?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await confirmDeleteSchedule();
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setPendingScheduleId(null);
        }}
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
    overflow: 'hidden',
    backgroundColor: '#116F7A',
  },

  content: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 28,
  },

  decorTopLeft: {
    position: 'absolute',
    width: 90,
    height: 90,
    top: -42,
    left: -42,
    borderRadius: 45,
    backgroundColor: '#3D929B',
  },

  decorRight: {
    position: 'absolute',
    width: 125,
    height: 125,
    top: 125,
    right: -58,
    borderRadius: 63,
    backgroundColor: '#3D929B',
  },

  decorBottomRight: {
    position: 'absolute',
    width: 110,
    height: 110,
    bottom: -68,
    right: -30,
    borderRadius: 55,
    backgroundColor: '#3D929B',
  },


  // ===================================================
  // LOADING
  // ===================================================

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#116F7A',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#A7CDD0',
  },


  // ===================================================
  // HEADER
  // ===================================================

  header: {
    paddingTop: 20,
    paddingBottom: 10,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 15,
    paddingVertical: 4,
  },

  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D8F0F2',
  },

  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
  },

  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  logo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#D7EDF3',
  },

  subtitle: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 13,
    color: '#A7CDD0',
  },


  // ===================================================
  // ADD BUTTON
  // ===================================================

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0B4F59',
  },

  addButtonIcon: {
    width: 28,
    height: 28,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#7FB1B9',
    borderRadius: 7,
  },

  addButtonTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  addButtonSubtitle: {
    marginTop: 2,
    fontSize: 8,
    color: '#A7CDD0',
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
    marginBottom: 8,
  },

  listTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D7EDF3',
  },

  listCount: {
    fontSize: 9,
    color: '#A7CDD0',
  },


  // ===================================================
  // SCHEDULE CARD
  // ===================================================

  card: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 11,
    backgroundColor: '#D7EDF3',
    borderWidth: 1,
    borderColor: '#B5D4DC',
  },


  // ===================================================
  // CARD HEADER
  // ===================================================

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  medicationIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#80AEB5',
  },

  medicationHeaderInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    paddingRight: 8,
  },

  medicationName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E2A4A',
  },

  dosage: {
    marginTop: 1,
    fontSize: 8,
    color: '#7A8494',
  },


  // ===================================================
  // STATUS
  // ===================================================

  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 20,
  },

  activeBadge: {
    backgroundColor: '#DCFCE7',
  },

  disabledBadge: {
    backgroundColor: '#FEE2E2',
  },

  statusText: {
    fontSize: 7,
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
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#A9C9D1',
    backgroundColor: '#EAF5F7',
  },

  timeLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#0B4F59',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },

  time: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: '800',
    color: '#0B4F59',
  },


  // ===================================================
  // DETAILS
  // ===================================================

  detailsContainer: {
    marginTop: 8,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 25,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#B5D4DC',
  },

  detailLabel: {
    fontSize: 9,
    color: '#718991',
  },

  detailValue: {
    maxWidth: '65%',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'right',
    color: '#607981',
  },

  dayList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 5,
    maxWidth: '75%',
  },

  dayChip: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#0B4F59',
  },

  dayChipText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },


  // ===================================================
  // ACTIONS
  // ===================================================

  actions: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#B5D4DC',
  },

  editButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },

  editText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0B4F59',
  },

  deleteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#B5D4DC',
    backgroundColor: 'transparent',
  },

  deleteText: {
    fontSize: 10,
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
    color: '#FFFFFF',
  },

  emptyText: {
    maxWidth: 300,
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#A7CDD0',
  },

  emptyButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: '#0B4F59',
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