import React from 'react';

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';

import { colors, radius } from '../theme';
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

        <Text
          style={[
            styles.navIcon,

            active &&
              styles.navIconActive,
          ]}
        >
          {icon}
        </Text>


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
          icon="⌂"
          label="Home"
          screen="dashboard"
          onPress={onHome}
        />


        {/* MEDICATIONS */}

        <NavItem
          icon="💊"
          label="Meds"
          screen="medications"
          onPress={onMedications}
        />


        {/* SCHEDULE */}

        <NavItem
          icon="🗓"
          label="Schedule"
          screen="schedules"
          onPress={onSchedules}
        />


        {/* HISTORY */}

        <NavItem
          icon="▤"
          label="History"
          screen="doseHistory"
          onPress={onHistory}
        />

        <NavItem
          icon="⚙"
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

    /*
     * IMPORTANT:
     * This is intentionally NOT absolute.
     *
     * The navigation now occupies its own space
     * instead of covering the screen content.
     */

    width: '100%',

    backgroundColor: colors.background,

    paddingHorizontal: 12,

    paddingTop: 8,

    paddingBottom:
      Platform.OS === 'ios'
        ? 18
        : 10,
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

    paddingHorizontal: 6,

    paddingVertical: 7,

    borderRadius: radius.xl,

    backgroundColor:
      colors.card,

    borderWidth: 1,

    borderColor:
      colors.border,

    shadowColor:
      colors.text,

    shadowOpacity: 0.06,

    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: -2,
    },

    elevation: 3,
  },


  // ===================================================
  // NAVIGATION ITEM
  // ===================================================

  navItem: {

    flex: 1,

    minHeight: 55,

    alignItems: 'center',

    justifyContent:
      'center',

    paddingVertical: 5,

    paddingHorizontal: 3,

    borderRadius: radius.md,
  },


  // ===================================================
  // ACTIVE ITEM
  // ===================================================

  navItemActive: {

    backgroundColor:
      colors.primarySoft,
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

    fontSize: 20,

    lineHeight: 23,

    color: colors.textSecondary,

    textAlign: 'center',
  },


  // ===================================================
  // ACTIVE ICON
  // ===================================================

  navIconActive: {

    color: colors.primary,
  },


  // ===================================================
  // LABEL
  // ===================================================

  navLabel: {

    marginTop: 3,

    fontSize: 10,

    fontWeight: '600',

    color: colors.textSecondary,

    textAlign: 'center',
  },


  // ===================================================
  // ACTIVE LABEL
  // ===================================================

  navLabelActive: {

    color: colors.primary,

    fontWeight: '800',
  },

});