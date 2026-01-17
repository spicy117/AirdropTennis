import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { getStrengthColor } from '../utils/passwordValidation';

export default function PasswordStrengthMeter({ strength, accessible = true }) {
  const strengthPercentage = (strength / 4) * 100;
  const color = getStrengthColor(strength);

  return (
    <View
      style={styles.container}
      accessible={accessible}
      accessibilityLabel={`Password strength: ${strength} out of 4`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 4, now: strength }}
    >
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${strengthPercentage}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 8,
    marginBottom: 12,
  },
  track: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
});
