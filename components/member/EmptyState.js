import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberColors, memberTypography } from '../../theme/memberTheme';
import MemberButton from './MemberButton';

export default function EmptyState({ icon = 'calendar-outline', title, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color={memberColors.inkFaint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <MemberButton label={actionLabel} onPress={onAction} variant="lime" compact style={styles.btn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: memberColors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    ...memberTypography.h3,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...memberTypography.body,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 280,
  },
  btn: {
    marginTop: 4,
  },
});
