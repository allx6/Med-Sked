import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import {
  getCaregiverRequestsForPatient,
  acceptCaregiverRequest,
  rejectCaregiverRequest,
} from '../services/api';

import { colors, radius, spacing, shadow } from '../theme';

export default function PatientCaregiverRequestsScreen({ token, onBack }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadRequests = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const data = await getCaregiverRequestsForPatient(token);
      setRequests(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load caregiver requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const respondToRequest = async (relationshipId, action) => {
    try {
      setActionId(relationshipId);
      setError('');
      setSuccessMessage('');
      if (action === 'accept') {
        await acceptCaregiverRequest(token, relationshipId);
        setSuccessMessage('Caregiver request accepted.');
      } else {
        await rejectCaregiverRequest(token, relationshipId);
        setSuccessMessage('Caregiver request declined.');
      }
      await loadRequests(true);
    } catch (requestError) {
      setError(requestError.message || 'Unable to update this request.');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading caregiver requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Caregiver Requests</Text>
        <Text style={styles.subtitle}>Review who is asking to monitor your medication routine.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadRequests()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {successMessage ? <Text style={styles.successMessage}>{successMessage}</Text> : null}

        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📬</Text>
            <Text style={styles.emptyTitle}>No pending caregiver requests</Text>
            <Text style={styles.emptyText}>Caregiver requests will appear here when someone asks to connect with you.</Text>
          </View>
        ) : (
          requests.map((request) => {
            const caregiver = request.caregiver || {};
            const relationshipId = request._id || request.relationshipId;
            const busy = actionId === relationshipId;

            return (
              <View key={relationshipId} style={styles.card}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>👤</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{caregiver.username || 'Caregiver'}</Text>
                  <Text style={styles.cardMeta}>{caregiver.email || 'Email not shared'}</Text>
                  <Text style={styles.pendingText}>Requesting caregiver access</Text>
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => respondToRequest(relationshipId, 'accept')}
                      disabled={busy}
                      style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed, busy && styles.disabled]}
                    >
                      <Text style={styles.acceptText}>{busy ? 'Working...' : 'Accept'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => respondToRequest(relationshipId, 'reject')}
                      disabled={busy}
                      style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed, busy && styles.disabled]}
                    >
                      <Text style={styles.rejectText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 32 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  backButton: { minHeight: 40, justifyContent: 'center', marginBottom: spacing.sm },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: spacing.lg },
  errorBox: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.dangerText, fontWeight: '600' },
  retryText: { color: colors.dangerText, fontWeight: '800', marginTop: spacing.sm },
  successMessage: { color: colors.success, fontWeight: '800', marginBottom: spacing.md },
  card: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, ...shadow.card },
  avatarWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { fontSize: 20 },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  cardMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  pendingText: { color: colors.pending, fontSize: 12, fontWeight: '800', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  acceptButton: { flex: 1, backgroundColor: colors.primary, minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rejectButton: { flex: 1, backgroundColor: colors.dangerSoft, minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: colors.white, fontWeight: '800' },
  rejectText: { color: colors.dangerText, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  emptyState: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', ...shadow.card },
  emptyIcon: { fontSize: 30, marginBottom: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginTop: spacing.sm },
});
