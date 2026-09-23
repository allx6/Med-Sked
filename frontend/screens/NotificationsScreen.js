import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/api';
import { colors, radius, spacing, shadow } from '../theme';

const formatNotificationTime = (value) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
};

export default function NotificationsScreen({ token, onBack }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState(null);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const data = await getNotifications(token);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markRead = async (notificationId) => {
    try {
      setWorkingId(notificationId);
      const updated = await markNotificationRead(token, notificationId);
      setNotifications((current) => current.map((notification) => (
        notification._id === notificationId ? updated : notification
      )));
    } catch (requestError) {
      setError(requestError.message || 'Unable to mark notification as read.');
    } finally {
      setWorkingId(null);
    }
  };

  const markAllRead = async () => {
    try {
      setWorkingId('all');
      await markAllNotificationsRead(token);
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    } catch (requestError) {
      setError(requestError.message || 'Unable to mark notifications as read.');
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} tintColor={colors.primary} />}
      >
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>{unreadCount} unread</Text>
          </View>
          {unreadCount > 0 ? (
            <Pressable onPress={markAllRead} disabled={workingId === 'all'}>
              <Text style={styles.markAllText}>{workingId === 'all' ? 'Working...' : 'Mark all read'}</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadNotifications()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyText}>Updates about caregiver requests, schedules, and refill stock will appear here.</Text>
          </View>
        ) : notifications.map((notification) => (
          <Pressable
            key={notification._id}
            onPress={() => !notification.read && markRead(notification._id)}
            disabled={workingId === notification._id}
            style={[styles.card, !notification.read && styles.unreadCard]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.typeText}>{notification.type?.replace(/_/g, ' ') || 'Notification'}</Text>
              {!notification.read ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={styles.message}>{notification.message}</Text>
            <Text style={styles.timestamp}>{formatNotificationTime(notification.createdAt)}</Text>
            {!notification.read ? <Text style={styles.readHint}>Tap to mark as read</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 32, width: '100%', maxWidth: 900, alignSelf: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 15, marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  markAllText: { color: colors.primary, fontWeight: '800', fontSize: 13, marginTop: 8 },
  errorBox: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.dangerText, fontWeight: '600' },
  retryText: { color: colors.dangerText, fontWeight: '800', marginTop: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, ...shadow.card },
  unreadCard: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeText: { color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  message: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 8, lineHeight: 21 },
  timestamp: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
  readHint: { color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 6 },
  emptyState: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', ...shadow.card },
  emptyIcon: { fontSize: 30, marginBottom: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginTop: spacing.sm },
});