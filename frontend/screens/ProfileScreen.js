import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';

import { getCaregiverRequestsForPatient } from '../services/api';
import { colors, radius, spacing, shadow } from '../theme';
import ConfirmationDialog from '../components/ConfirmationDialog';

export default function ProfileScreen({ user, token, unreadNotificationCount = 0, onOpenNotifications, onOpenAnalytics, onLogout, onBack, onOpenCaregiverRequests, onOpenPatientConnections }) {
  const patientId = user?.patientId || 'Not assigned';
  const [pendingRequestCount, setPendingRequestCount] = useState(null);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  useEffect(() => {
    if (!token || user?.role === 'caregiver') {
      setPendingRequestCount(null);
      return;
    }

    let isMounted = true;

    const loadCount = async () => {
      try {
        const requests = await getCaregiverRequestsForPatient(token);
        if (isMounted) {
          setPendingRequestCount(Array.isArray(requests) ? requests.length : 0);
        }
      } catch (error) {
        if (isMounted) {
          setPendingRequestCount(null);
        }
      }
    };

    loadCount();

    return () => {
      isMounted = false;
    };
  }, [token, user?.role]);

  const caregiverRequestStatus =
    pendingRequestCount === null
      ? 'Review caregiver requests'
      : pendingRequestCount === 0
        ? 'No pending requests'
        : `${pendingRequestCount} pending`;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={8}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageTitle}>Profile</Text>
            <Text style={styles.pageSubtitle}>Account information</Text>
          </View>
          <Pressable onPress={onOpenNotifications} style={styles.notificationButton}>
            <Text style={styles.notificationIcon}>🔔</Text>
            {unreadNotificationCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{user?.role === 'caregiver' ? '👩‍⚕️' : '🩺'}</Text>
          </View>

          <Text style={styles.name}>{user?.username || user?.name || 'User'}</Text>
          <Text style={styles.role}>{user?.role === 'caregiver' ? 'Caregiver Account' : 'Patient Account'}</Text>

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || 'Not provided'}</Text>
            </View>

            {user?.role !== 'caregiver' ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Patient ID</Text>
                <Text style={styles.infoValue}>{patientId}</Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{user?.role || 'Unknown'}</Text>
            </View>
          </View>
        </View>

        {user?.role !== 'caregiver' ? (
          <>
            <Pressable
              onPress={onOpenCaregiverRequests}
              style={({ pressed }) => [styles.requestsButton, pressed && styles.buttonPressed]}
            >
              <View style={styles.requestsTopRow}>
                <Text style={styles.requestsTitle}>Caregiver Requests</Text>
                {pendingRequestCount !== null ? (
                  <View
                    style={[
                      styles.countBadge,
                      pendingRequestCount > 0 ? styles.countBadgeActive : styles.countBadgeMuted,
                    ]}
                  >
                    <Text style={styles.countBadgeText}>{pendingRequestCount}</Text>
                  </View>
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
              </View>
              <Text style={styles.requestsSubtitle}>{caregiverRequestStatus}</Text>
            </Pressable>

            <Pressable
              onPress={onOpenPatientConnections}
              style={({ pressed }) => [styles.connectionsButton, pressed && styles.buttonPressed]}
            >
              <View style={styles.requestsTopRow}>
                <Text style={styles.requestsTitle}>Caregiver Connections</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.requestsSubtitle}>Manage active caregiver permissions</Text>
            </Pressable>

            <Pressable
              onPress={onOpenAnalytics}
              style={({ pressed }) => [styles.connectionsButton, pressed && styles.buttonPressed]}
            >
              <View style={styles.requestsTopRow}>
                <Text style={styles.requestsTitle}>Adherence Analytics</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.requestsSubtitle}>Review dose outcomes and regimen patterns</Text>
            </Pressable>
          </>
        ) : null}

        <Pressable onPress={() => setShowLogoutConfirmation(true)} style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <ConfirmationDialog
        visible={showLogoutConfirmation}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          setShowLogoutConfirmation(false);
          onLogout();
        }}
        onCancel={() => setShowLogoutConfirmation(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 32 },
  headerRow: { marginBottom: spacing.md },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.text },
  pageSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  notificationButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  notificationIcon: { fontSize: 20 },
  notificationBadge: { position: 'absolute', top: -4, right: -4, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 34 },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  role: { marginTop: 4, fontSize: 14, color: colors.primary, fontWeight: '700' },
  infoList: { width: '100%', marginTop: spacing.xl },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  infoValue: { fontSize: 13, color: colors.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  requestsButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  connectionsButton: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  requestsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestsTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  requestsSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeActive: {
    backgroundColor: colors.primary,
  },
  countBadgeMuted: {
    backgroundColor: colors.border,
  },
  countBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  chevron: { color: colors.textSecondary, fontSize: 24, fontWeight: '700' },
  logoutButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  buttonPressed: { opacity: 0.8 },
});
