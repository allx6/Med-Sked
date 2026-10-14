import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';

import { getAdherenceAnalytics } from '../services/api';
import { colors, radius, spacing, shadow } from '../theme';

const ranges = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
];

const dateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getRange = (days) => {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days);
  return { startDate: dateString(start), endDate: dateString(end) };
};

export default function AnalyticsScreen({ token, patientId, onBack }) {
  const { width: viewportWidth } = useWindowDimensions();
  const [selectedRange, setSelectedRange] = useState(1);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async (isRefresh = false, rangeIndex = selectedRange) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const data = await getAdherenceAnalytics(token, {
        ...getRange(ranges[rangeIndex].days),
        patientId,
      });
      setAnalytics(data || null);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load adherence analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId, selectedRange, token]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const changeRange = (index) => {
    setSelectedRange(index);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading adherence analytics...</Text>
      </View>
    );
  }

  const overall = analytics?.overall || { adherencePercentage: 0, totalEligible: 0, taken: 0, skipped: 0, missed: 0, pending: 0 };
  const complexity = analytics?.complexity || { activeMedicationCount: 0, scheduledDosesPerDay: 0, complexityBucket: 'low' };
  const timeOfDay = analytics?.timeOfDay || {};
  const maxTimeTotal = Math.max(...Object.values(timeOfDay).map((value) => value.total || 0), 1);
  const timeBuckets = ['morning', 'afternoon', 'evening', 'night'].map((bucket) => {
    const value = timeOfDay[bucket] || { total: 0, taken: 0, skipped: 0, missed: 0, adherencePercentage: 0 };
    const percentage = Number.isFinite(Number(value.adherencePercentage))
      ? Math.max(0, Math.min(100, Number(value.adherencePercentage)))
      : 0;

    return {
      bucket,
      value: { ...value, total: Math.max(0, Number(value.total) || 0) },
      percentage,
    };
  });
  const totalTimeDoses = timeBuckets.reduce((total, { value }) => total + value.total, 0);
  const pieSize = Math.min(220, Math.max(150, viewportWidth - 80));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAnalytics(true)} tintColor={colors.primary} />}
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={8}
            style={styles.backButton}
          >
            <MaterialCommunityIcons name="arrow-left" size={25} color="#D8F0F2" />
          </Pressable>
        ) : null}
        <Text style={styles.title}>Adherence Analytics</Text>
        <Text style={styles.subtitle}>Real dose outcomes for the selected period.</Text>
        <View style={styles.rangeRow}>
          {ranges.map((range, index) => (
            <Pressable key={range.label} onPress={() => changeRange(index)} style={[styles.rangeButton, selectedRange === index && styles.rangeButtonActive]}>
              <Text style={[styles.rangeText, selectedRange === index && styles.rangeTextActive]}>{range.label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadAnalytics()}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Overall adherence</Text>
          <Text style={styles.heroValue}>{overall.adherencePercentage}%</Text>
          <Text style={styles.heroMeta}>{overall.taken} taken of {overall.totalEligible} eligible doses</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dose outcomes</Text>
          <View style={styles.statsRow}>
            <Stat label="Taken" value={overall.taken} color={colors.success} />
            <Stat label="Skipped" value={overall.skipped} color={colors.skipped} />
            <Stat label="Missed" value={overall.missed} color={colors.danger} />
            <Stat label="Pending" value={overall.pending} color={colors.pending} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Doses by time of day</Text>
          <Text style={styles.chartCaption}>Share of doses in each period. Adherence is shown below.</Text>
          <DoseTimePieChart
            buckets={timeBuckets}
            size={pieSize}
            total={totalTimeDoses}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dose outcomes by time of day</Text>
          {timeBuckets.map(({ bucket, value }) => (
              <View key={bucket} style={styles.timeRow}>
                <View style={styles.timeHeader}>
                  <Text style={styles.timeLabel}>{bucket}</Text>
                  <Text style={styles.timeValue}>{value.adherencePercentage}% ({value.total})</Text>
                </View>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.round((value.total / maxTimeTotal) * 100)}%` }]} /></View>
                <Text style={styles.timeMeta}>{value.taken} taken, {value.skipped} skipped, {value.missed} missed</Text>
              </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Regimen complexity</Text>
          <Text style={styles.complexityValue}>{complexity.complexityBucket}</Text>
          <Text style={styles.detailText}>{complexity.activeMedicationCount} active medications</Text>
          <Text style={styles.detailText}>{complexity.scheduledDosesPerDay} scheduled doses per day</Text>
          <Text style={styles.noteText}>{complexity.note || 'Transparent system measure, not medically validated.'}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, color }) {
  return <View style={styles.stat}><Text style={[styles.statValue, { color }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const timeBucketColors = {
  morning: '#defc36',
  afternoon: '#ef9b9b',
  evening: '#15608f',
  night: '#8A78B8',
};

function DoseTimePieChart({ buckets, size, total }) {
  const center = size / 2;
  const radius = size * 0.46;
  let currentAngle = -90;

  const segments = buckets
    .filter(({ value }) => value.total > 0)
    .map(({ bucket, value }) => {
      const sweep = (value.total / total) * 360;
      const startAngle = currentAngle;
      currentAngle += sweep;

      if (sweep >= 360) {
        return {
          bucket,
          color: timeBucketColors[bucket],
          path: null,
          fullCircle: true,
        };
      }

      const endAngle = currentAngle;
      const startRadians = (startAngle * Math.PI) / 180;
      const endRadians = (endAngle * Math.PI) / 180;
      const startX = center + radius * Math.cos(startRadians);
      const startY = center + radius * Math.sin(startRadians);
      const endX = center + radius * Math.cos(endRadians);
      const endY = center + radius * Math.sin(endRadians);

      return {
        bucket,
        color: timeBucketColors[bucket],
        path: `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${endX} ${endY} Z`,
        fullCircle: false,
      };
    });

  return (
    <View>
      <View
        style={styles.pieWrap}
        accessibilityRole="image"
        accessibilityLabel={
          total > 0
            ? `Dose distribution by time of day, ${buckets.filter(({ value }) => value.total > 0).map(({ bucket, value }) => `${bucket}: ${value.total}`).join(', ')}`
            : 'No dose data by time of day'
        }
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total > 0 ? (
            segments.map((segment) => (
              segment.fullCircle ? (
                <Circle
                  key={segment.bucket}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill={segment.color}
                />
              ) : (
                <Path
                  key={segment.bucket}
                  d={segment.path}
                  fill={segment.color}
                  stroke={colors.cardTint}
                  strokeWidth={2}
                />
              )
            ))
          ) : (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              fill="#CDE8EE"
            />
          )}
        </Svg>
      </View>
      {total === 0 ? (
        <Text style={styles.noChartData}>No dose data for this period</Text>
      ) : null}
      <View style={styles.pieLegend}>
        {buckets.map(({ bucket, value, percentage }) => {
          const share = total > 0 ? Math.round((value.total / total) * 100) : 0;

          return (
            <View key={bucket} style={styles.pieLegendItem}>
              <View style={[styles.pieLegendDot, { backgroundColor: timeBucketColors[bucket] }]} />
              <View style={styles.pieLegendCopy}>
                <Text style={styles.pieLegendLabel}>
                  {bucket.charAt(0).toUpperCase() + bucket.slice(1)}
                  <Text style={styles.pieLegendCount}> · {value.total} {value.total === 1 ? 'dose' : 'doses'} ({share}%)</Text>
                </Text>
                <Text style={styles.pieLegendMeta}>
                  {value.total > 0 ? `${percentage}% adherence` : 'No dose data'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: spacing.lg, paddingBottom: 32 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: '#A7CDD0' },
  backButton: { width: 40, height: 40, justifyContent: 'center', marginBottom: spacing.md },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#A7CDD0', fontSize: 14, marginTop: 4, marginBottom: spacing.lg },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  rangeButton: { borderWidth: 1, borderColor: colors.cardTintBorder, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.cardTint },
  rangeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  rangeTextActive: { color: colors.white },
  errorBox: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.dangerText, fontWeight: '600' },
  retryText: { color: colors.dangerText, fontWeight: '800', marginTop: spacing.sm },
  heroCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.md, ...shadow.card },
  heroLabel: { color: colors.primarySoft, fontSize: 14, fontWeight: '700' },
  heroValue: { color: colors.white, fontSize: 42, fontWeight: '900', marginTop: 4 },
  heroMeta: { color: colors.primarySoft, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: colors.cardTint, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardTintBorder, padding: spacing.md, marginBottom: spacing.md, ...shadow.card },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 23, fontWeight: '900' },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  chartCaption: { color: colors.textSecondary, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md },
  pieWrap: { alignSelf: 'center', marginVertical: spacing.md },
  noChartData: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: spacing.md },
  pieLegend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.sm },
  pieLegendItem: { width: '48%', minWidth: 130, flexGrow: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pieLegendDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  pieLegendCopy: { flex: 1, minWidth: 0 },
  pieLegendLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  pieLegendCount: { color: colors.textSecondary, fontWeight: '600' },
  pieLegendMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  timeRow: { marginBottom: spacing.md },
  timeHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  timeLabel: { color: colors.text, fontWeight: '800', textTransform: 'capitalize' },
  timeValue: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  timeMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  complexityValue: { color: colors.primary, fontSize: 22, fontWeight: '900', textTransform: 'capitalize' },
  detailText: { color: colors.textSecondary, fontSize: 13, marginTop: 5 },
  noteText: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, lineHeight: 16 },
});