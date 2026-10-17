import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, spacing } from '../theme';

const bucketOrder = ['morning', 'afternoon', 'evening', 'night'];
const bucketColors = {
  morning: '#defc36',
  afternoon: '#ef9b9b',
  evening: '#15608f',
  night: '#8A78B8',
};

const emptyBucket = () => ({
  total: 0,
  taken: 0,
  skipped: 0,
  missed: 0,
  adherencePercentage: 0,
});

export const getTimeOfDayBuckets = (timeOfDay = {}) => bucketOrder.map((bucket) => {
  const value = timeOfDay[bucket] || emptyBucket();
  const total = Math.max(0, Number(value.total) || 0);
  const percentage = Number.isFinite(Number(value.adherencePercentage))
    ? Math.max(0, Math.min(100, Number(value.adherencePercentage)))
    : 0;

  return {
    bucket,
    value: { ...emptyBucket(), ...value, total },
    percentage,
  };
});

export default function TimeOfDayPieChart({ timeOfDay, size: requestedSize }) {
  const { width: viewportWidth } = useWindowDimensions();
  const size = requestedSize || Math.min(220, Math.max(150, viewportWidth - 80));
  const center = size / 2;
  const radius = size * 0.46;
  const buckets = getTimeOfDayBuckets(timeOfDay);
  const total = buckets.reduce((sum, { value }) => sum + value.total, 0);
  let currentAngle = -90;

  const segments = buckets
    .filter(({ value }) => value.total > 0)
    .map(({ bucket, value }) => {
      const sweep = (value.total / total) * 360;
      const startAngle = currentAngle;
      currentAngle += sweep;

      if (sweep >= 360) {
        return { bucket, color: bucketColors[bucket], fullCircle: true };
      }

      const startRadians = (startAngle * Math.PI) / 180;
      const endRadians = (currentAngle * Math.PI) / 180;
      const startX = center + radius * Math.cos(startRadians);
      const startY = center + radius * Math.sin(startRadians);
      const endX = center + radius * Math.cos(endRadians);
      const endY = center + radius * Math.sin(endRadians);

      return {
        bucket,
        color: bucketColors[bucket],
        fullCircle: false,
        path: `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${endX} ${endY} Z`,
      };
    });

  return (
    <View>
      <View
        style={styles.chart}
        accessibilityRole="image"
        accessibilityLabel={
          total > 0
            ? `Dose distribution by time of day, ${buckets.filter(({ value }) => value.total > 0).map(({ bucket, value }) => `${bucket}: ${value.total}`).join(', ')}`
            : 'No dose data by time of day'
        }
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total > 0 ? segments.map((segment) => (
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
          )) : (
            <Circle cx={center} cy={center} r={radius} fill="#CDE8EE" />
          )}
        </Svg>
      </View>
      {total === 0 ? (
        <Text style={styles.noData}>No dose data for this period</Text>
      ) : null}
      <View style={styles.legend}>
        {buckets.map(({ bucket, value, percentage }) => {
          const share = total > 0 ? Math.round((value.total / total) * 100) : 0;
          return (
            <View key={bucket} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: bucketColors[bucket] }]} />
              <View style={styles.legendCopy}>
                <Text style={styles.legendLabel}>
                  {bucket.charAt(0).toUpperCase() + bucket.slice(1)}
                  <Text style={styles.legendCount}>
                    {' '}· {value.total} {value.total === 1 ? 'dose' : 'doses'} ({share}%)
                  </Text>
                </Text>
                <Text style={styles.legendMeta}>
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
  chart: { alignSelf: 'center', marginVertical: spacing.md },
  noData: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: spacing.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.sm },
  legendItem: { width: '48%', minWidth: 130, flexGrow: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  legendCopy: { flex: 1, minWidth: 0 },
  legendLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  legendCount: { color: colors.textSecondary, fontWeight: '600' },
  legendMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
});
