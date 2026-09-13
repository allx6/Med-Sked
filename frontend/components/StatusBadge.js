import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

const STATUS = {
  taken: { label: 'Taken', bg: colors.successSoft, text: colors.success },
  pending: { label: 'Pending', bg: colors.pendingSoft, text: colors.pending },
  skipped: { label: 'Skipped', bg: colors.skippedSoft, text: colors.skipped },
  missed: { label: 'Missed', bg: colors.missedSoft, text: colors.missed },
  active: { label: 'Active', bg: colors.successSoft, text: colors.success },
  connected: { label: 'Connected', bg: colors.successSoft, text: colors.success },
  disabled: { label: 'Disabled', bg: colors.skippedSoft, text: colors.skipped },
  inactive: { label: 'Inactive', bg: colors.skippedSoft, text: colors.skipped },
  revoked: { label: 'Removed', bg: colors.skippedSoft, text: colors.skipped },
  unread: { label: 'Unread', bg: colors.primarySoft, text: colors.primary },
};

export default function StatusBadge({ status, label }) {
  const config = STATUS[status] || STATUS.pending;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>
        {label || config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
  },
});
