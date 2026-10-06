import React from 'react';

import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BottomNavigation({
  activeScreen,
  onHome,
  onMedications,
  onSchedules,
  onHistory,
  onProfile,
}) {
  const insets = useSafeAreaInsets();

  // =====================================================
  // NAVIGATION ITEM
  // =====================================================

  const NavItem = ({
    icon,
    label,
    screen,
    onPress,
  }) => {

    const active =
      activeScreen === screen;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => [
          styles.navItem,

          active &&
            styles.navItemActive,

          pressed &&
            styles.navItemPressed,
        ]}
      >

        {/* ICON */}

        <MaterialCommunityIcons
          name={icon}
          size={22}
          style={[
            styles.navIcon,

            active &&
              styles.navIconActive,
          ]}
        />


        {/* LABEL */}

        <Text
          style={[
            styles.navLabel,

            active &&
              styles.navLabelActive,
          ]}
        >
          {label}
        </Text>

      </Pressable>
    );
  };


  // =====================================================
  // NAVIGATION
  // =====================================================

  return (
    <View
      style={[
        styles.outerContainer,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >

      <View style={styles.navigationBar}>

        {/* HOME */}

        <NavItem
          icon="home-outline"
          label="Home"
          screen="dashboard"
          onPress={onHome}
        />


        {/* MEDICATIONS */}

        <NavItem
          icon="pill"
          label="Meds"
          screen="medications"
          onPress={onMedications}
        />


        {/* SCHEDULE */}

        <NavItem
          icon="calendar-month-outline"
          label="Schedule"
          screen="schedules"
          onPress={onSchedules}
        />


        {/* HISTORY */}

        <NavItem
          icon="history"
          label="History"
          screen="doseHistory"
          onPress={onHistory}
        />

        <NavItem
          icon="account-outline"
          label="Profile"
          screen="profile"
          onPress={onProfile}
        />

      </View>

    </View>
  );
}


// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  // ===================================================
  // OUTER CONTAINER
  // ===================================================

  outerContainer: {
    width: '100%',

    backgroundColor: colors.background,

    paddingHorizontal: 2,

    paddingTop: 1,

    paddingBottom: 10,
  },


  // ===================================================
  // NAVIGATION BAR
  // ===================================================

  navigationBar: {

    width: '100%',

    maxWidth: 500,

    alignSelf: 'center',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-around',

    paddingHorizontal: 5,

    paddingVertical: 5,

    borderRadius: 12,

    backgroundColor:
      colors.navigation,

  },


  // ===================================================
  // NAVIGATION ITEM
  // ===================================================

  navItem: {

    flex: 1,

    minHeight: 50,

    alignItems: 'center',

    justifyContent:
      'center',

    paddingVertical: 3,

    paddingHorizontal: 3,

    borderRadius: 12,
  },


  // ===================================================
  // ACTIVE ITEM
  // ===================================================

  navItemActive: {

    backgroundColor:
      colors.navigationActive,
  },


  // ===================================================
  // PRESSED
  // ===================================================

  navItemPressed: {

    opacity: 0.70,
  },


  // ===================================================
  // ICON
  // ===================================================

  navIcon: {
    color: '#E8F3EF',
  },


  // ===================================================
  // ACTIVE ICON
  // ===================================================

  navIconActive: {

    color: colors.white,
  },


  // ===================================================
  // LABEL
  // ===================================================

  navLabel: {

    marginTop: 2,

    fontSize: 9,

    fontWeight: '600',

    color: '#E8F3EF',

    textAlign: 'center',
  },


  // ===================================================
  // ACTIVE LABEL
  // ===================================================

  navLabelActive: {

    color: colors.white,

    fontWeight: '800',
  },

});