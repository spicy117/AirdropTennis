import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Small contextual link to a section of Admin Guide.
 * @param {string} section - workflow id (availability, assign-lesson, new-booking, rain-check)
 */
export default function AdminGuideHelpLink({ section, onNavigate, label = 'How this works' }) {
  if (!onNavigate || !section) return null;

  return (
    <TouchableOpacity
      style={styles.link}
      onPress={() => onNavigate('admin-guide', { section })}
      activeOpacity={0.7}
      accessibilityRole="link"
    >
      <Ionicons name="help-circle-outline" size={15} color="#0D9488" />
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0D9488',
  },
});
