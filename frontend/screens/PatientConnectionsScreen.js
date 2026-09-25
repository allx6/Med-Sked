import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';

import {
  getMyCaregivers,
  getCaregiverRequestsForPatient,
  acceptCaregiverRequest,
  rejectCaregiverRequest,
  updateCaregiverPermission,
  removeCaregiver,
} from '../services/api';

import { colors, radius, spacing, shadow } from '../theme';
import ConfirmationDialog from '../components/ConfirmationDialog';

export default function PatientConnectionsScreen({ token, onBack }) {
  const [caregivers, setCaregivers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [permissionId, setPermissionId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const loadConnections = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const [caregiverData, requestData] = await Promise.all([
        getMyCaregivers(token),
        getCaregiverRequestsForPatient(token),
      ]);

      setCaregivers(Array.isArray(caregiverData) ? caregiverData : []);
      setPendingRequests(Array.isArray(requestData) ? requestData : []);
    } catch (err) {
      console.error('Patient connections load error:', err);
      setError(err.message || 'Failed to load caregiver connections.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleAccept = async (relationshipId) => {
    try {
      setActionId(relationshipId);
      await acceptCaregiverRequest(token, relationshipId);
      await loadConnections(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to accept this caregiver request.');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (relationshipId) => {
    try {
      setActionId(relationshipId);
      await rejectCaregiverRequest(token, relationshipId);
      await loadConnections(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to reject this caregiver request.');
    } finally {
      setActionId(null);
    }
  };

  const handlePermissionChange = async (relationshipId, permission) => {
    try {
      setPermissionId(relationshipId);
      setError('');
      const result = await updateCaregiverPermission(token, relationshipId, permission);
      const updatedRelationship = result?.relationship;
      setCaregivers((current) => current.map((relationship) => (
        relationship._id === relationshipId
          ? { ...relationship, permission: updatedRelationship?.permission || permission }
          : relationship
      )));
    } catch (err) {
      setError(err.message || 'Unable to update caregiver permission.');
    } finally {
      setPermissionId(null);
    }
  };

  const handleRevoke = async (relationshipId) => {
    try {
      setActionId(relationshipId);
      setError('');
      await removeCaregiver(token, relationshipId);
      setCaregivers((current) => current.filter((relationship) => relationship._id !== relationshipId));
    } catch (err) {
      setError(err.message || 'Unable to remove caregiver access.');
    } finally {
      setActionId(null);
    }
  };

  const requestPermissionChange = (relationship, nextPermission) => {
    const caregiver = relationship.caregiver || relationship;
    const currentPermission = relationship.permission || 'VIEW_ONLY';

    if (currentPermission === nextPermission) return;

    setConfirmation({
      type: 'permission',
      relationship,
      nextPermission,
      title: 'Change caregiver permission?',
      message: `${caregiver.username || caregiver.email || 'This caregiver'}: ${currentPermission} -> ${nextPermission}`,
    });
  };

  const requestRevoke = (relationship) => {
    const caregiver = relationship.caregiver || relationship;
    setConfirmation({
      type: 'revoke',
      relationship,
      title: 'Revoke caregiver access?',
      message: `${caregiver.username || caregiver.email || 'This caregiver'} will no longer access your medication information.`,
    });
  };

  const confirmConnectionAction = async () => {
    const current = confirmation;
    setConfirmation(null);
    if (current.type === 'permission') {
      await handlePermissionChange(current.relationship._id, current.nextPermission);
    } else {
      await handleRevoke(current.relationship._id);
    }
  };

  const renderCaregiverItem = (relation) => {
    const caregiver = relation.caregiver || relation;
    const caregiverName = caregiver.username || caregiver.name || 'Caregiver';
    const caregiverEmail = caregiver.email || 'No email shared';
    const permission = relation.permission || 'VIEW_ONLY';
    const updatingPermission = permissionId === relation._id;
    const revoking = actionId === relation._id;

    return (
      <View key={relation._id || relation.relationshipId} style={styles.card}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>👤</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{caregiverName}</Text>
          <Text style={styles.cardMeta}>{caregiverEmail}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text style={[styles.statusText, styles.activeStatus]}>Connected</Text>
          </View>
          <Text style={styles.permissionLabel}>Permission</Text>
          <View style={styles.permissionRow}>
            <Pressable
              onPress={() => requestPermissionChange(relation, 'VIEW_ONLY')}
              disabled={updatingPermission || revoking}
              style={[styles.permissionButton, permission === 'VIEW_ONLY' && styles.permissionButtonActive]}
            >
              <Text style={[styles.permissionButtonText, permission === 'VIEW_ONLY' && styles.permissionButtonTextActive]}>View only</Text>
            </Pressable>
            <Pressable
              onPress={() => requestPermissionChange(relation, 'ADHERENCE_SUPPORT')}
              disabled={updatingPermission || revoking}
              style={[styles.permissionButton, permission === 'ADHERENCE_SUPPORT' && styles.permissionButtonActive]}
            >
              <Text style={[styles.permissionButtonText, permission === 'ADHERENCE_SUPPORT' && styles.permissionButtonTextActive]}>Adherence support</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => requestRevoke(relation)}
            disabled={updatingPermission || revoking}
            style={({ pressed }) => [styles.revokeButton, pressed && styles.buttonPressed, revoking && styles.buttonDisabled]}
          >
            <Text style={styles.revokeButtonText}>{revoking ? 'Removing...' : 'Revoke access'}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderRequestItem = (request) => {
    const caregiver = request.caregiver || {};
    const caregiverName = caregiver.username || caregiver.name || 'Caregiver';
    const caregiverEmail = caregiver.email || 'No email shared';
    const relationshipId = request._id || request.relationshipId;

    return (
      <View key={relationshipId} style={styles.card}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>📩</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{caregiverName}</Text>
          <Text style={styles.cardMeta}>{caregiverEmail}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text style={[styles.statusText, styles.pendingStatus]}>Pending</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, actionId === relationshipId && styles.buttonDisabled]}
              onPress={() => handleAccept(relationshipId)}
              disabled={actionId === relationshipId}
            >
              <Text style={styles.primaryButtonText}>{actionId === relationshipId ? 'Working...' : 'Accept'}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed, actionId === relationshipId && styles.buttonDisabled]}
              onPress={() => handleReject(relationshipId)}
              disabled={actionId === relationshipId}
            >
              <Text style={styles.secondaryButtonText}>Reject</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading caregiver connections...</Text>
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
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.pageTitle}>Caregiver Connections</Text>
        <Text style={styles.pageSubtitle}>Manage who can view your medication routine.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadConnections()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Requests</Text>
          {pendingRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📬</Text>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptyText}>Incoming caregiver requests will appear here.</Text>
            </View>
          ) : (
            pendingRequests.map(renderRequestItem)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Caregivers</Text>
          {caregivers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No caregivers connected yet.</Text>
              <Text style={styles.emptyText}>Accept a request from a caregiver to allow them to monitor your routine.</Text>
            </View>
          ) : (
            caregivers.map(renderCaregiverItem)
          )}
        </View>
      </ScrollView>

      <ConfirmationDialog
        visible={Boolean(confirmation)}
        title={confirmation?.title || ''}
        message={confirmation?.message || ''}
        confirmLabel={confirmation?.type === 'revoke' ? 'Revoke access' : 'Confirm change'}
        cancelLabel="Cancel"
        danger={confirmation?.type === 'revoke'}
        onConfirm={confirmConnectionAction}
        onCancel={() => setConfirmation(null)}
      />
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontSize: 18 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusLabel: { fontSize: 12, color: colors.textSecondary, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '800' },
  activeStatus: { color: colors.success },
  pendingStatus: { color: colors.pending },
  permissionLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 10 },
  permissionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  permissionButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 9 },
  permissionButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  permissionButtonText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  permissionButtonTextActive: { color: colors.primary },
  revokeButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
  },
  revokeButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.dangerSoft,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '700' },
  secondaryButtonText: { color: colors.dangerText, fontWeight: '700' },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.7 },
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
  retryText: { color: colors.primary, fontWeight: '700', marginTop: 8 },
  confirmationBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, padding: spacing.md, marginBottom: spacing.md, ...shadow.card },
  confirmationTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  confirmationMessage: { color: colors.textSecondary, lineHeight: 19, marginTop: 6 },
  confirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: spacing.md },
  confirmationCancel: { paddingVertical: 8, paddingHorizontal: 12 },
  confirmationCancelText: { color: colors.textSecondary, fontWeight: '800' },
  confirmationConfirm: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 },
  confirmationConfirmText: { color: colors.white, fontWeight: '800' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
});
