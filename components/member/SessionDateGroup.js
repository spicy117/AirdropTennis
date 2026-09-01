import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { memberColors, memberTypography } from '../../theme/memberTheme';
import SessionRow from './SessionRow';

export default function SessionDateGroup({
  dateLabel,
  sessions,
  formatTime,
  translateService,
  formatDuration,
  bookLabel,
  onBookSession,
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.dateHeader}>{dateLabel}</Text>
      <View style={styles.list}>
        {sessions.map((session, index) => (
          <View key={session.id}>
            <SessionRow
              time={formatTime(session.time24)}
              serviceName={translateService(session.serviceName)}
              locationName={session.locationName}
              duration={formatDuration(session.durationHours)}
              price={session.price}
              bookLabel={bookLabel}
              onBook={() => onBookSession(session)}
            />
            {index < sessions.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 28,
  },
  dateHeader: {
    ...memberTypography.label,
    fontSize: 13,
    fontWeight: '700',
    color: memberColors.court,
    textTransform: 'none',
    letterSpacing: 0,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: memberColors.border,
  },
  list: {},
  divider: {
    height: 1,
    backgroundColor: memberColors.border,
    marginLeft: 66,
  },
});
