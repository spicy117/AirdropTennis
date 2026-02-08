/**
 * Admin/Coach Performance Management screen.
 * On web: renders AdminPerformancePage.
 * On native: placeholder (uses web-only libraries).
 */
import React from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

let AdminPerformancePage;
if (Platform.OS === 'web') {
  AdminPerformancePage = require('../pages/AdminPerformancePage').default;
}

export default function AdminPerformanceScreen({ onBack }) {
  if (Platform.OS === 'web' && AdminPerformancePage) {
    return <AdminPerformancePage onBack={onBack} />;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.placeholder}>Performance Management available on web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  back: { marginBottom: 20 },
  backText: { color: '#64748B', fontSize: 16 },
  placeholder: { color: '#334155', fontSize: 18 },
});
