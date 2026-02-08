/**
 * Performance screen for students.
 * On web: renders PerformancePage (Tailwind + Framer Motion).
 * On native: placeholder - PerformancePage uses web-only libraries.
 */
import React from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

let PerformancePage;
if (Platform.OS === 'web') {
  PerformancePage = require('../pages/PerformancePage').default;
}

export default function PerformanceScreen({ onBack }) {
  if (Platform.OS === 'web' && PerformancePage) {
    return <PerformancePage onBack={onBack} />;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.placeholder}>Performance page available on web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#0f172a' },
  back: { marginBottom: 20 },
  backText: { color: '#94a3b8', fontSize: 16 },
  placeholder: { color: '#e2e8f0', fontSize: 18 },
});
