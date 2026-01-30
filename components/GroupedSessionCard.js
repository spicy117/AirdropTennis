import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * GroupedSessionCard - Elite Branded Session Card for Coaches/Admins
 * Displays grouped bookings with glassmorphism design
 * 
 * Props:
 * - session: { serviceName, startTime, endTime, locationName, students: [], totalRevenue }
 * - isAdmin: boolean - shows revenue info if true
 */
const GroupedSessionCard = ({ session, isAdmin = false, onRainCheckBookings }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState([]);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const isCoachMode = typeof onRainCheckBookings === 'function';

  const toggleBookingSelection = (bookingId) => {
    setSelectedBookingIds((prev) =>
      prev.includes(bookingId) ? prev.filter((id) => id !== bookingId) : [...prev, bookingId]
    );
  };

  const toggleSelectAll = () => {
    if (!session.bookings?.length) return;
    const allIds = session.bookings.map((b) => b.id);
    const allSelected = allIds.every((id) => selectedBookingIds.includes(id));
    setSelectedBookingIds(allSelected ? [] : allIds);
  };

  const handleRainCheckPress = () => {
    const selected = (session.bookings || []).filter((b) => selectedBookingIds.includes(b.id));
    if (selected.length && onRainCheckBookings) {
      onRainCheckBookings(selected);
      setSelectedBookingIds([]);
    }
  };

  const toggleExpand = () => {
    Animated.spring(rotateAnim, {
      toValue: expanded ? 0 : 1,
      useNativeDriver: true,
      friction: 10,
    }).start();
    setExpanded(!expanded);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDateCompact = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return { day, month };
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name || name === 'Unknown Student') return '?';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0]?.[0] || '?').toUpperCase();
  };

  // Generate a consistent color based on name
  const getAvatarColor = (name) => {
    const colors = [
      '#0D9488', // Teal
      '#7C3AED', // Purple
      '#2563EB', // Blue
      '#D97706', // Orange
      '#DC2626', // Red
      '#059669', // Green
      '#6366F1', // Indigo
      '#EC4899', // Pink
    ];
    
    if (!name) return colors[0];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const studentCount = session.students?.length || 0;
  const maxCapacity = 6; // Default max capacity
  const dateInfo = formatDateCompact(session.startTime);

  const CardContent = () => (
    <>
      {/* Main Card Header */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={toggleExpand}
        style={styles.cardContent}
      >
        {/* Hero Row: Date Badge + Service Info + Time/Capacity */}
        <View style={styles.heroRow}>
          {/* Date Badge */}
          <View style={styles.dateBadge}>
            <Text style={styles.dateDay}>{dateInfo.day}</Text>
            <Text style={styles.dateMonth}>{dateInfo.month}</Text>
          </View>

          {/* Service Info */}
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName} numberOfLines={1}>
              {session.serviceName || 'Tennis Session'}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color="#0D9488" />
                <Text style={styles.timeText}>
                  {formatTime(session.startTime)} - {formatTime(session.endTime)}
                </Text>
              </View>
            </View>
          </View>

          {/* Capacity Badge */}
          <View style={styles.capacityContainer}>
            <View style={styles.capacityBadge}>
              <Text style={styles.capacityCount}>{studentCount}</Text>
              <Text style={styles.capacityDivider}>/</Text>
              <Text style={styles.capacityMax}>{maxCapacity}</Text>
            </View>
            <Text style={styles.capacityLabel}>Students</Text>
          </View>
        </View>

        {/* Location & Coach Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={15} color="#6B7280" />
            <Text style={styles.infoText} numberOfLines={1}>{session.locationName}</Text>
          </View>
          {isAdmin && session.coachName && (
            <View style={styles.infoItem}>
              <Ionicons name="person-outline" size={15} color="#7C3AED" />
              <Text style={styles.coachText} numberOfLines={1}>{session.coachName}</Text>
            </View>
          )}
          {isAdmin && session.totalRevenue !== undefined && (
            <View style={styles.revenueItem}>
              <Text style={styles.revenueText}>${session.totalRevenue?.toFixed(2) || '0.00'}</Text>
            </View>
          )}
          <Animated.View style={[styles.expandIcon, { transform: [{ rotate: rotation }] }]}>
            <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Expandable Roster */}
      {expanded && (
        <View style={styles.rosterContainer}>
          {/* Coach: Select all row */}
          {isCoachMode && session.students?.length > 0 && (
            <View style={styles.selectAllRow}>
              {Platform.OS === 'web' ? (
                <label style={styles.selectAllLabel}>
                  <input
                    type="checkbox"
                    checked={session.bookings?.length > 0 && session.bookings.every((b) => selectedBookingIds.includes(b.id))}
                    onChange={toggleSelectAll}
                    style={{ marginRight: 8, cursor: 'pointer' }}
                  />
                  <span style={styles.selectAllText}>Select all</span>
                </label>
              ) : (
                <TouchableOpacity style={styles.selectAllTouchable} onPress={toggleSelectAll}>
                  <View style={[styles.studentCheckbox, session.bookings?.length > 0 && session.bookings.every((b) => selectedBookingIds.includes(b.id)) && styles.studentCheckboxChecked]}>
                    {(session.bookings?.length > 0 && session.bookings.every((b) => selectedBookingIds.includes(b.id))) && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.selectAllText}>Select all</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <ScrollView 
            style={styles.rosterScrollView}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
          >
            {session.students?.length > 0 ? (
              session.students.map((student, index) => {
                const booking = session.bookings?.find((b) => b.id === student.bookingId);
                const isSelected = booking && selectedBookingIds.includes(booking.id);
                return (
                  <View key={student.id || index} style={styles.studentRow}>
                    {isCoachMode && booking && (
                      <View style={styles.checkboxWrap}>
                        {Platform.OS === 'web' ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleBookingSelection(booking.id)}
                            style={{ cursor: 'pointer', margin: 0 }}
                            aria-label={`Select ${student.name}`}
                          />
                        ) : (
                          <TouchableOpacity
                            onPress={() => toggleBookingSelection(booking.id)}
                            style={[styles.studentCheckbox, isSelected && styles.studentCheckboxChecked]}
                          >
                            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    <View
                      style={[
                        styles.studentAvatar,
                        { backgroundColor: getAvatarColor(student.name) },
                      ]}
                    >
                      <Text style={styles.studentAvatarText}>
                        {getInitials(student.name)}
                      </Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName} numberOfLines={1}>
                        {student.name}
                      </Text>
                      {student.email && (
                        <Text style={styles.studentEmail} numberOfLines={1}>
                          {student.email}
                        </Text>
                      )}
                    </View>
                    <View style={styles.studentStatus}>
                      {student.isSeasonPass && (
                        <View style={styles.passIndicator}>
                          <Ionicons name="star" size={12} color="#D97706" />
                        </View>
                      )}
                      <View style={styles.presentIndicator}>
                        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyRoster}>
                <Ionicons name="people-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyRosterText}>No students enrolled</Text>
              </View>
            )}
          </ScrollView>
          {/* Coach: Rain check button when any selected */}
          {isCoachMode && selectedBookingIds.length > 0 && (
            <View style={styles.rainCheckFooter}>
              {Platform.OS === 'web' ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRainCheckPress();
                  }}
                  style={styles.rainCheckButtonWeb}
                >
                  <Ionicons name="rainy-outline" size={18} color="#007AFF" />
                  Rain check ({selectedBookingIds.length})
                </button>
              ) : (
                <TouchableOpacity style={styles.rainCheckButton} onPress={handleRainCheckPress} activeOpacity={0.8}>
                  <Ionicons name="rainy-outline" size={18} color="#007AFF" />
                  <Text style={styles.rainCheckButtonText}>Rain check ({selectedBookingIds.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </>
  );

  // Web: Use glassmorphism with CSS
  if (Platform.OS === 'web') {
    return (
      <View style={styles.cardWrapper}>
        <div style={webStyles.glassCard}>
          <CardContent />
        </div>
      </View>
    );
  }

  // Native: Use standard styling
  return (
    <View style={styles.cardWrapper}>
      <View style={styles.nativeCard}>
        <CardContent />
      </View>
    </View>
  );
};

/**
 * Utility function to group bookings by time slot and location
 * @param {Array} bookings - Array of booking objects
 * @returns {Array} - Array of grouped session objects
 */
export const groupBookingsBySession = (bookings) => {
  const sessionMap = new Map();

  for (const booking of bookings) {
    const sessionKey = `${booking.location_id}_${booking.start_time}_${booking.end_time}`;

    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, {
        key: sessionKey,
        locationId: booking.location_id,
        locationName: booking.locationName || booking.locations?.name || 'Unknown Location',
        startTime: booking.start_time,
        endTime: booking.end_time,
        serviceName: booking.service_name || 'Tennis Session',
        coachName: booking.coachName || null,
        coachId: booking.coach_id || null,
        students: [],
        bookings: [],
        totalRevenue: 0,
      });
    }

    const session = sessionMap.get(sessionKey);
    session.bookings.push({
      id: booking.id,
      user_id: booking.user_id,
      credit_cost: parseFloat(booking.credit_cost) || 0,
      location_id: booking.location_id,
      locationName: booking.locationName || booking.locations?.name || 'Unknown Location',
      start_time: booking.start_time,
      end_time: booking.end_time,
      service_name: booking.service_name || null,
      coach_id: booking.coach_id || null,
      academy_id: booking.academy_id || null,
    });

    if (!session.coachName && booking.coachName) {
      session.coachName = booking.coachName;
      session.coachId = booking.coach_id;
    }
    
    const existingStudent = session.students.find(s => s.id === booking.user_id);
    if (!existingStudent && booking.user_id) {
      session.students.push({
        id: booking.user_id,
        name: booking.studentName || 'Unknown Student',
        email: booking.studentEmail || null,
        isSeasonPass: booking.is_season_pass_booking || false,
        bookingId: booking.id,
      });
    }

    session.totalRevenue += parseFloat(booking.credit_cost) || 0;
  }

  return Array.from(sessionMap.values()).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
};

// Web-specific styles using CSS
const webStyles = {
  glassCard: {
    background: 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    borderRadius: '16px',
    border: '1px solid rgba(13, 148, 136, 0.15)',
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  },
};

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  nativeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardContent: {
    padding: 20,
  },
  // Hero Row
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateBadge: {
    width: 52,
    height: 56,
    backgroundColor: '#0D9488',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 26,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D9488',
  },
  capacityContainer: {
    alignItems: 'center',
  },
  capacityBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  capacityCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E40AF',
  },
  capacityDivider: {
    fontSize: 16,
    fontWeight: '500',
    color: '#93C5FD',
    marginHorizontal: 2,
  },
  capacityMax: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60A5FA',
  },
  capacityLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    gap: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    maxWidth: 160,
  },
  coachText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
    maxWidth: 120,
  },
  revenueItem: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  revenueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  expandIcon: {
    marginLeft: 'auto',
    padding: 4,
  },
  // Roster
  rosterContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: 'rgba(249, 250, 251, 0.5)',
  },
  rosterScrollView: {
    maxHeight: 280,
    paddingVertical: 8,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  selectAllLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer',
  },
  selectAllTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  checkboxWrap: {
    marginRight: 12,
    justifyContent: 'center',
  },
  studentCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentCheckboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    marginVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 10,
  },
  studentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  studentEmail: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  studentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passIndicator: {
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    padding: 4,
    borderRadius: 6,
  },
  presentIndicator: {
    opacity: 0.8,
  },
  emptyRoster: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyRosterText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
  },
  rainCheckFooter: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  rainCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.25)',
  },
  rainCheckButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  rainCheckButtonWeb: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    border: '1px solid rgba(0, 122, 255, 0.25)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: '#007AFF',
  },
});

export default GroupedSessionCard;
