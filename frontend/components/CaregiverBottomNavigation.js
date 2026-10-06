import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
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
        <MaterialCommunityIcons
          name={icon}
          size={21}
          style={[styles.navIcon, active && styles.navIconActive]}
        />
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
        <NavItem icon="home-outline" label="Home" screen="caregiverDashboard" onPress={onHome} />
        <NavItem icon="account-multiple-outline" label="Patients" screen="caregiverPatients" onPress={onPatients} />
        <NavItem icon="account-plus-outline" label="Connect" screen="caregiverConnections" onPress={onConnections} />
        <NavItem icon="account-outline" label="Profile" screen="caregiverProfile" onPress={onProfile} />
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
    backgroundColor: colors.navigation,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#17313A',
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
    backgroundColor: colors.navigationActive,
  },
  navItemPressed: {
    opacity: 0.8,
  },
  navIcon: {
    marginBottom: 2,
    color: colors.navigationText,
  },
  navIconActive: {
    color: colors.white,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.navigationText,
    textAlign: 'center',
  },
  navLabelActive: {
    color: colors.white,
    fontWeight: '800',
  },
});
