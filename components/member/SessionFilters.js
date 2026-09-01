import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberRadius, memberWebTransition } from '../../theme/memberTheme';

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable
      style={({ pressed, hovered }) => [
        styles.chip,
        active && styles.chipActive,
        hovered && Platform.OS === 'web' && !active && styles.chipHovered,
        pressed && styles.chipPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DropdownChip({ label, active, onPress }) {
  return (
    <Pressable
      style={({ pressed, hovered }) => [
        styles.dropdownChip,
        active && styles.dropdownChipActive,
        hovered && Platform.OS === 'web' && styles.dropdownChipHovered,
        pressed && styles.chipPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.dropdownText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={active ? memberColors.ink : memberColors.inkMuted} />
    </Pressable>
  );
}

export default function SessionFilters({
  serviceOptions,
  activeServiceKey,
  onServiceChange,
  periodLabel,
  onPeriodPress,
  locationLabel,
  onLocationPress,
  showLocationFilter,
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serviceRow}
        style={styles.serviceScroll}
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
        <DropdownChip label={periodLabel} active onPress={onPeriodPress} />
        {showLocationFilter ? (
          <DropdownChip label={locationLabel} onPress={onLocationPress} />
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: memberRadius.pill,
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.border,
    ...memberWebTransition('background-color, border-color, transform'),
  },
  chipActive: {
    backgroundColor: memberColors.court,
    borderColor: memberColors.court,
  },
  chipHovered: {
    ...(Platform.OS === 'web' && { borderColor: memberColors.borderStrong }),
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: memberColors.inkSecondary,
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
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: memberRadius.md,
    backgroundColor: memberColors.surfaceRaised,
    borderWidth: 1,
    borderColor: memberColors.border,
    maxWidth: '100%',
    ...memberWebTransition('background-color, border-color'),
  },
  dropdownChipActive: {
    borderColor: memberColors.court,
  },
  dropdownChipHovered: {
    ...(Platform.OS === 'web' && { backgroundColor: memberColors.limeSoft }),
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: memberColors.ink,
    flexShrink: 1,
  },
});
