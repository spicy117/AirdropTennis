import React from 'react';
import { TouchableOpacity, StyleSheet, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FloatingActionButton({ onPress, label = 'Book Lesson' }) {
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'web') {
    return null; // Hide on desktop (use header button instead)
  }

  return (
    <View
      style={[
        styles.container,
        {
          bottom: Math.max(insets.bottom, 16) + 60, // Above bottom nav
        },
      ]}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        accessible={true}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityHint="Opens the booking screen"
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    }),
  },
});
