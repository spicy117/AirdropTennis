import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberWebTransition } from '../../theme/memberTheme';

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable
      style={({ pressed, hovered, focused }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipInactive,
        !active && hovered && Platform.OS === 'web' && styles.chipHovered,
        pressed && styles.chipPressed,
        focused && Platform.OS === 'web' && styles.chipFocused,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DropdownChip({ label, onPress, menuOpen }) {
  return (
    <Pressable
      style={({ pressed, hovered, focused }) => [
        styles.dropdownChip,
        menuOpen && styles.dropdownChipOpen,
        hovered && Platform.OS === 'web' && styles.dropdownChipHovered,
        pressed && styles.chipPressed,
        focused && Platform.OS === 'web' && styles.dropdownChipFocused,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: menuOpen }}
    >
      <Text style={styles.dropdownText} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={memberColors.inkSecondary} />
    </Pressable>
  );
}

export default function SessionFilters({
  serviceOptions,
  activeServiceKey,
  onServiceChange,
  periodLabel,
  onPeriodPress,
  periodMenuOpen,
  locationLabel,
  onLocationPress,
  locationMenuOpen,
  showLocationFilter,
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serviceRow}
        style={styles.serviceScroll}
        keyboardShouldPersistTaps="handled"
      >
        {serviceOptions.map((opt) => (
          <FilterChip
            key={opt.key}
            label={opt.label}
            active={activeServiceKey === opt.key}
            onPress={() => onServiceChange(opt.key)}
          />
        ))}
      </ScrollView>

      <View style={styles.metaRow}>
        <DropdownChip label={periodLabel} onPress={onPeriodPress} menuOpen={periodMenuOpen} />
        {showLocationFilter ? (
          <DropdownChip label={locationLabel} onPress={onLocationPress} menuOpen={locationMenuOpen} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  serviceScroll: {
    marginHorizontal: -4,
  },
  serviceRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  chip: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: memberRadius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...memberWebTransition('background-color, border-color, transform'),
  },
  chipInactive: {
    backgroundColor: memberColors.surfaceRaised,
    borderColor: memberColors.borderStrong,
  },
  chipActive: {
    backgroundColor: memberColors.court,
    borderColor: memberColors.court,
  },
  chipHovered: {
    ...(Platform.OS === 'web' && {
      backgroundColor: memberColors.bg,
      borderColor: memberColors.court,
    }),
  },
  chipFocused: {
    ...(Platform.OS === 'web' && {
      outlineStyle: 'solid',
      outlineWidth: 2,
      outlineColor: memberColors.court,
      outlineOffset: 2,
    }),
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.94,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextInactive: {
    color: memberColors.ink,
  },
  chipTextActive: {
    color: memberColors.white,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dropdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: memberRadius.md,
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.borderStrong,
    flexShrink: 1,
    ...memberWebTransition('background-color, border-color'),
  },
  dropdownChipOpen: {
    borderColor: memberColors.court,
    backgroundColor: memberColors.bg,
  },
  dropdownChipHovered: {
    ...(Platform.OS === 'web' && {
      backgroundColor: memberColors.bg,
      borderColor: memberColors.court,
    }),
  },
  dropdownChipFocused: {
    ...(Platform.OS === 'web' && {
      outlineStyle: 'solid',
      outlineWidth: 2,
      outlineColor: memberColors.court,
      outlineOffset: 2,
    }),
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: memberColors.ink,
    flexShrink: 1,
  },
});
