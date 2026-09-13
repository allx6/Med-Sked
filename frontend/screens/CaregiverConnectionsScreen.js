import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';

import {
  getMyPatients,
  getCaregiverRequests,
  searchPatient,
  sendCaregiverRequest,
} from '../services/api';

import { colors, radius, spacing, shadow } from '../theme';

export default function CaregiverConnectionsScreen({ token, onBack, onOpenPatientMonitoring }) {
  const [connectedPatients, setConnectedPatients] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [email, setEmail] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadConnections = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const [patientData, requestData] = await Promise.all([
        getMyPatients(token),
        getCaregiverRequests(token),
      ]);

      setConnectedPatients(Array.isArray(patientData) ? patientData : Array.isArray(patientData?.patients) ? patientData.patients : []);
      setPendingRequests(Array.isArray(requestData) ? requestData : []);
    } catch (err) {
      console.error('Caregiver connections load error:', err);
      setError(err.message || 'Failed to load caregiver connections.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const searchPatientByEmail = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Enter a patient ID or email to search.');
      return;
    }

    try {
      setSearching(true);
      setError('');
      const result = await searchPatient(token, trimmedEmail);
      setSearchResult(result || null);
    } catch (err) {
      setSearchResult(null);
      setError(err.message || 'Unable to find this patient.');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult?.patient?._id) {
      Alert.alert('No patient selected', 'Search for a patient before sending a request.');
      return;
    }

    try {
      setSending(true);
      setError('');
      await sendCaregiverRequest(token, searchResult.patient._id);
      setEmail('');
      setSearchResult(null);
      await loadConnections(true);
      Alert.alert('Request sent', 'The patient can accept or reject the caregiver request.');
    } catch (err) {
      Alert.alert('Request failed', err.message || 'Unable to send caregiver request.');
    } finally {
      setSending(false);
    }
  };

  const pendingOnly = useMemo(
    () => pendingRequests.filter((request) => request?.status === 'pending' || !request?.status),
    [pendingRequests]
  );

  const renderPatientCard = (item) => {
    const patient = item?.patient || item;
    const patientName = patient?.username || patient?.name || 'Patient';
    const patientEmail = patient?.email || 'No email';
    const relationshipId = item?.relationshipId || item?._id;
    const permission = item?.permission || 'VIEW_ONLY';

    return (
      <Pressable
        key={relationshipId || patient?._id}
        onPress={() => onOpenPatientMonitoring?.(patient)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>👤</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{patientName}</Text>
          <Text style={styles.cardMeta}>{patientEmail}</Text>
          <Text style={[styles.statusText, styles.activeStatus]}>Connected</Text>
          <Text style={styles.permissionText}>
            Permission: {permission === 'ADHERENCE_SUPPORT' ? 'Adherence support' : 'View only'}
          </Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </Pressable>
    );
  };

  const renderRequestCard = (request) => {
    const patient = request.patient || {};
    const patientName = patient.username || patient.name || 'Patient';
    const patientEmail = patient.email || 'No email';

    return (
      <View key={request._id || request.relationshipId} style={styles.card}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>⏳</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{patientName}</Text>
          <Text style={styles.cardMeta}>{patientEmail}</Text>
          <Text style={[styles.statusText, styles.pendingStatus]}>Pending approval</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading connection overview...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadConnections(true)} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>

        <Text style={styles.pageTitle}>Caregiver Connections</Text>
        <Text style={styles.pageSubtitle}>Search for a patient and manage current requests.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Request</Text>
          <View style={styles.searchCard}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Patient ID or email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              style={styles.input}
            />

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, searching && styles.buttonDisabled]}
              onPress={searchPatientByEmail}
              disabled={searching}
            >
              <Text style={styles.primaryButtonText}>{searching ? 'Searching...' : 'Search Patient'}</Text>
            </Pressable>

            {searchResult?.patient ? (
              <View style={styles.searchResultBox}>
                <Text style={styles.searchResultTitle}>{searchResult.patient.username || 'Patient'}</Text>
                <Text style={styles.searchResultMeta}>Patient ID: {searchResult.patient.patientId || 'Not available'}</Text>
                <Text style={styles.searchResultMeta}>{searchResult.patient.email}</Text>

                {searchResult.relationship?.status === 'active' ? (
                  <Text style={[styles.searchResultState, styles.activeStatus]}>Already connected</Text>
                ) : searchResult.relationship?.status === 'pending' ? (
                  <Text style={[styles.searchResultState, styles.pendingStatus]}>Request pending</Text>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.primaryButton, styles.sendButton, pressed && styles.buttonPressed, sending && styles.buttonDisabled]}
                    onPress={handleSendRequest}
                    disabled={sending}
                  >
                    <Text style={styles.primaryButtonText}>{sending ? 'Sending...' : 'Send Connection Request'}</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Requests</Text>
          {pendingOnly.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📬</Text>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptyText}>Requests you send to patients will appear here while they review them.</Text>
            </View>
          ) : (
            pendingOnly.map(renderRequestCard)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Patients</Text>
          {connectedPatients.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No patients connected yet.</Text>
              <Text style={styles.emptyText}>Use the search tool above to send a caregiver request.</Text>
            </View>
          ) : (
            connectedPatients.map(renderPatientCard)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 32, width: '100%', maxWidth: 900, alignSelf: 'center' },
  headerRow: { marginBottom: spacing.md },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  searchCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  input: {
    backgroundColor: colors.inputFill,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '700' },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.7 },
  sendButton: { marginTop: spacing.md },
  searchResultBox: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  searchResultTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  searchResultMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  searchResultState: { marginTop: 10, fontSize: 12, fontWeight: '800' },
  activeStatus: { color: colors.success },
  permissionText: { marginTop: 5, fontSize: 11, color: colors.primary, fontWeight: '700' },
  pendingStatus: { color: colors.pending },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardPressed: { opacity: 0.9 },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontSize: 18 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statusText: { marginTop: 6, fontSize: 12, fontWeight: '800' },
  arrow: { fontSize: 20, color: colors.textMuted },
  emptyState: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  emptyIcon: { fontSize: 28, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.dangerText, fontWeight: '600' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
});
