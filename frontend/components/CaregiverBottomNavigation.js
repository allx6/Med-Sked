import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CaregiverBottomNavigation({
  activeScreen,
  onHome,
  onPatients,
  onConnections,
  onProfile,
}) {
  const insets = useSafeAreaInsets();
  const NavItem = ({ icon, label, screen, onPress }) => {
    const active = activeScreen === screen;

    return (
      <Pressable
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => [
          styles.navItem,
          active && styles.navItemActive,
          pressed && styles.navItemPressed,
        ]}
      >
        <Text style={[styles.navIcon, active && styles.navIconActive]}>{icon}</Text>
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.outerContainer,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={styles.navigationBar}>
        <NavItem icon="⌂" label="Home" screen="caregiverDashboard" onPress={onHome} />
        <NavItem icon="👥" label="Patients" screen="caregiverPatients" onPress={onPatients} />
        <NavItem icon="＋" label="Connect" screen="caregiverConnections" onPress={onConnections} />
        <NavItem icon="⚙" label="Profile" screen="caregiverProfile" onPress={onProfile} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 10,
  },
  navigationBar: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#1E2A4A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 3,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  navItemActive: {
    backgroundColor: colors.primarySoft,
  },
  navItemPressed: {
    opacity: 0.8,
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
    color: colors.textSecondary,
  },
  navIconActive: {
    color: colors.primary,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
