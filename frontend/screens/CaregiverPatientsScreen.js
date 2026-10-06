import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { getMyPatients } from '../services/api';
import { colors, radius, spacing, shadow } from '../theme';

export default function CaregiverPatientsScreen({ token, onSelectPatient, onOpenConnections }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadPatients = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError('');
      const data = await getMyPatients(token);
      setPatients(Array.isArray(data) ? data : Array.isArray(data?.patients) ? data.patients : []);
    } catch (err) {
      console.error('Caregiver patients load error:', err);
      setError(err.message || 'Failed to load patients.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading patients...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPatients(true)} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.pageTitle}>My Patients</Text>
        <Text style={styles.pageSubtitle}>Select a patient to review their medication routine.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadPatients()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {patients.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="account-multiple-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No patients connected yet.</Text>
            <Text style={styles.emptyText}>Use the Connect tab to search by Patient ID or email.</Text>
            <Pressable onPress={onOpenConnections} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Connect Patient</Text>
            </Pressable>
          </View>
        ) : (
          patients.map((patient) => {
            const patientRecord = patient.patient || patient.user || patient;
            const patientId = patientRecord.patientId || patientRecord._id || 'Unknown';
            const patientName = patientRecord.username || patientRecord.name || 'Patient';
            const permission = patient.permission || 'VIEW_ONLY';

            return (
              <Pressable
                key={patientRecord._id || patientId}
                onPress={() => onSelectPatient?.(patientRecord)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.avatarWrap}>
                  <MaterialCommunityIcons name="account-outline" size={24} color={colors.primary} />
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{patientName}</Text>
                  <Text style={styles.cardMeta}>Patient ID: {patientId}</Text>
                  <View style={styles.statusRow}>
                    <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
                    <Text style={[styles.statusText, styles.activeStatus]}>Active</Text>
                  </View>
                  <Text style={styles.permissionText}>
                    Permission: {permission === 'ADHERENCE_SUPPORT' ? 'Adherence support' : 'View only'}
                  </Text>
                </View>

                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 32, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  pageSubtitle: { fontSize: 14, color: '#A7CDD0', marginBottom: spacing.lg },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.dangerText, fontWeight: '600' },
  retryText: { color: colors.dangerText, fontWeight: '800', marginTop: spacing.sm },
  emptyState: { backgroundColor: colors.cardTint, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.cardTintBorder, ...shadow.card },
  emptyIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptyText: { marginTop: 6, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  emptyButton: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 18 },
  emptyButtonText: { color: colors.white, fontWeight: '800' },
  card: {
    backgroundColor: colors.cardTint,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardTintBorder,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.card,
  },
  cardPressed: { opacity: 0.8 },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardMeta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },
  activeStatus: { color: colors.success },
  permissionText: { marginTop: 5, fontSize: 11, color: colors.primary, fontWeight: '700' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: '#A7CDD0' },
});
