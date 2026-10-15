import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Portal } from 'react-native-paper';
import TextField from './TextField';
import medicines from '../data/medicines.json';
import { colors, radius, spacing, type } from '../theme';

const MAX_SUGGESTIONS = 10;
const BLUR_CLOSE_DELAY_MS = 250;

const MedicineNameInput = forwardRef(function MedicineNameInput({
  value,
  onChangeText,
  editable = true,
  ...textFieldProps
}, ref) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const blurTimeout = useRef(null);
  const anchorRef = useRef(null);
  const { height: windowHeight } = useWindowDimensions();

  const query = String(value || '').trim().toLowerCase();
  const medicinesToShow = useMemo(() => {
    if (!query) {
      return dropdownOpen ? medicines : [];
    }

    const startsWithMatches = [];
    const otherMatches = [];

    for (const medicine of medicines) {
      const normalizedMedicine = medicine.toLowerCase();
      if (normalizedMedicine.startsWith(query)) {
        startsWithMatches.push(medicine);
      } else if (normalizedMedicine.includes(query)) {
        otherMatches.push(medicine);
      }
    }

    return [
      ...startsWithMatches.slice(0, MAX_SUGGESTIONS),
      ...otherMatches.slice(0, MAX_SUGGESTIONS),
    ].slice(0, MAX_SUGGESTIONS);
  }, [dropdownOpen, query]);

  const visibleDropdown = dropdownOpen && editable && medicinesToShow.length > 0;

  const updateAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }, []);

  const clearBlurTimeout = () => {
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
  };

  const closeDropdown = () => {
    clearBlurTimeout();
    setDropdownOpen(false);
  };

  useImperativeHandle(ref, () => ({ closeDropdown }), []);

  const handleOpenDropdown = () => {
    clearBlurTimeout();
    updateAnchor();
    setDropdownOpen(true);
  };

  const handleChangeText = (nextValue) => {
    clearBlurTimeout();
    if (!dropdownOpen) {
      updateAnchor();
    }
    setDropdownOpen(true);
    onChangeText(nextValue);
  };

  const handleSelect = (medicine) => {
    closeDropdown();
    onChangeText(medicine);
  };

  return (
    <View
      ref={anchorRef}
      collapsable={false}
      onLayout={updateAnchor}
      style={styles.container}
    >
      <TextField
        {...textFieldProps}
        value={value}
        onChangeText={handleChangeText}
        editable={editable}
        maxLength={100}
        inputStyle={[
          textFieldProps.inputStyle,
          styles.inputWithDropdownButton,
        ]}
        onFocus={() => {
          clearBlurTimeout();
          if (query) {
            handleOpenDropdown();
          }
        }}
        onBlur={() => {
          clearBlurTimeout();
          blurTimeout.current = setTimeout(() => {
            setDropdownOpen(false);
            blurTimeout.current = null;
          }, BLUR_CLOSE_DELAY_MS);
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dropdownOpen ? 'Close medicine list' : 'Browse medicines'}
        accessibilityState={{ expanded: dropdownOpen }}
        disabled={!editable}
        onPressIn={clearBlurTimeout}
        onPress={() => {
          if (dropdownOpen) {
            closeDropdown();
          } else {
            handleOpenDropdown();
          }
        }}
        style={({ pressed }) => [
          styles.dropdownButton,
          pressed && styles.dropdownButtonPressed,
          !editable && styles.dropdownButtonDisabled,
        ]}
      >
        <MaterialCommunityIcons
          name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.primary}
        />
      </Pressable>
      {visibleDropdown && anchor ? (
        <Portal>
          <View style={[StyleSheet.absoluteFill, styles.portalOverlay]}>
            <FlatList
              accessibilityLabel={query ? 'Medicine search results' : 'Browse medicines'}
              data={medicinesToShow}
              keyExtractor={(medicine, index) => `${index}:${medicine}`}
              keyboardShouldPersistTaps="always"
              style={[
                styles.suggestionList,
                getSuggestionPosition(anchor, windowHeight),
              ]}
              renderItem={({ item: medicine }) => (
                <Pressable
                  accessibilityRole="button"
                  onPressIn={clearBlurTimeout}
                  onPress={() => handleSelect(medicine)}
                  style={({ pressed }) => [
                    styles.suggestion,
                    pressed && styles.suggestionPressed,
                  ]}
                >
                  <Text style={styles.suggestionText}>{medicine}</Text>
                </Pressable>
              )}
            />
          </View>
        </Portal>
      ) : null}
    </View>
  );
});

export default MedicineNameInput;

const getSuggestionPosition = (anchor, windowHeight) => {
  const belowTop = anchor.y + anchor.height - 10;
  const spaceBelow = Math.max(0, windowHeight - belowTop - 12);
  const spaceAbove = Math.max(0, anchor.y - 20);
  const showBelow = spaceBelow >= 120 || spaceBelow >= spaceAbove;
  const availableSpace = showBelow ? spaceBelow : spaceAbove;
  const maxHeight = Math.min(280, availableSpace);

  return {
    position: 'absolute',
    left: anchor.x,
    top: showBelow ? belowTop : anchor.y - maxHeight - 10,
    width: anchor.width,
    maxHeight,
  };
};

const styles = StyleSheet.create({
  container: {},
  portalOverlay: {
    pointerEvents: 'box-none',
  },
  inputWithDropdownButton: {
    paddingRight: 50,
  },
  dropdownButton: {
    position: 'absolute',
    top: 17,
    right: 0,
    width: 46,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 22,
    elevation: 22,
  },
  dropdownButtonPressed: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
  },
  dropdownButtonDisabled: {
    opacity: 0.6,
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    elevation: 30,
  },
  suggestion: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionPressed: {
    backgroundColor: colors.primarySoft,
  },
  suggestionText: {
    color: colors.text,
    fontSize: type.caption,
  },
});
