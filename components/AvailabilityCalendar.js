import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { utcToSydneyDate, utcToSydneyTime, sydneyDateTimeToUTC, getSydneyToday, getDayOfWeekFromDateString, addDaysToDateString } from '../utils/timezone';

// Custom calendar grid component
export default function AvailabilityCalendar({
  availabilities = [],
  selectedDate,
  onDateChange,
  onSlotClick,
  selectedLocationId,
  onQuickDelete,
}) {
  // Force re-render when availabilities change
  useEffect(() => {
    console.log('AvailabilityCalendar: availabilities updated', availabilities.length);
    if (availabilities.length > 0) {
      const firstAv = availabilities[0];
      const avStart = new Date(firstAv.start_time);
      console.log('First availability:', {
        id: firstAv.id,
        start_time: firstAv.start_time,
        date_utc: avStart.toISOString().split('T')[0],
        time_utc: `${avStart.getUTCHours().toString().padStart(2, '0')}:${avStart.getUTCMinutes().toString().padStart(2, '0')}`,
        location: firstAv.location_id,
        booking_count: firstAv.booking_count || 0,
      });
    } else {
      console.log('⚠️ No availabilities passed to calendar');
    }
  }, [availabilities]);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeSlots = [];
  
  // Generate 30-minute time slots from 6 AM to 10 PM
  for (let hour = 6; hour < 22; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  // Calculate week dates based on selectedDate (selectedDate is in Sydney local time)
  const getWeekDates = () => {
    // Get day of week using utility function (treats date as Sydney local)
    const dayOfWeek = getDayOfWeekFromDateString(selectedDate);
    
    // Calculate start of week (Sunday = 0) by subtracting days
    // Use date string arithmetic to avoid timezone issues
    const startOfWeekStr = addDaysToDateString(selectedDate, -dayOfWeek);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      // Add days using date string arithmetic to avoid timezone issues
      const weekDateStr = addDaysToDateString(startOfWeekStr, i);
      weekDates.push(weekDateStr);
    }
    return weekDates;
  };

  const weekDates = getWeekDates();

  const getSlotStatus = (date, time) => {
    // date and time are in Sydney local time format
    // Convert slot to UTC for past check, and convert availabilities from UTC to Sydney for matching
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    
    // Convert Sydney local slot time to UTC for "past" check
    const slotUTC = sydneyDateTimeToUTC(date, hours, minutes);
    const slotDateTime = new Date(slotUTC);
    const now = new Date();
    
    // Check if slot is in the past
    if (slotDateTime < now) {
      return 'past';
    }
    
    // Check if slot has availability - find ALL matching availabilities
    // Convert UTC availabilities to Sydney local time for matching
    const matchingAvailabilities = availabilities.filter((av) => {
      const avStart = new Date(av.start_time);
      
      // Convert UTC to Sydney local date and time
      const avDateStr = utcToSydneyDate(av.start_time);
      const avTimeStr = utcToSydneyTime(av.start_time);
      
      // Match date and time exactly (both in Sydney local time)
      const matchesDate = avDateStr === date;
      const matchesTime = avTimeStr === time;
      
      // Match location filter (if active)
      const matchesLocation = !selectedLocationId || av.location_id === selectedLocationId;
      
      return matchesDate && matchesTime && matchesLocation;
    });
    
    // If any matching availability exists, show it
    if (matchingAvailabilities.length > 0) {
      // Get the maximum booking count among all matching availabilities
      const maxBookingCount = Math.max(
        ...matchingAvailabilities.map(av => av.booking_count || 0),
        0 // Default to 0 if no availabilities
      );
      
      // Get max_capacity from the first availability (all should have same capacity for same slot)
      const MAX_CAPACITY = matchingAvailabilities[0]?.max_capacity || 10;
      
      if (maxBookingCount >= MAX_CAPACITY) {
        return 'booked';
      }
      
      if (maxBookingCount > 0) {
        return 'partially_booked';
      }
      
      return 'available';
    }
    
    return 'empty';
  };
  
  // Get booking count for a slot
  const getBookingCount = (date, time) => {
    const matchingAvailabilities = availabilities.filter((av) => {
      // Convert UTC to Sydney local time for matching
      const avDateStr = utcToSydneyDate(av.start_time);
      const avTimeStr = utcToSydneyTime(av.start_time);
      
      const matchesDate = avDateStr === date;
      const matchesTime = avTimeStr === time;
      const matchesLocation = !selectedLocationId || av.location_id === selectedLocationId;
      
      return matchesDate && matchesTime && matchesLocation;
    });
    
    if (matchingAvailabilities.length === 0) return 0;
    
    // Return the maximum booking count among matching availabilities
    return Math.max(...matchingAvailabilities.map(av => av.booking_count || 0));
  };

  // Get max capacity for a slot
  const getMaxCapacity = (date, time) => {
    const matchingAvailabilities = availabilities.filter((av) => {
      // Convert UTC to Sydney local time for matching
      const avDateStr = utcToSydneyDate(av.start_time);
      const avTimeStr = utcToSydneyTime(av.start_time);
      
      const matchesDate = avDateStr === date;
      const matchesTime = avTimeStr === time;
      const matchesLocation = !selectedLocationId || av.location_id === selectedLocationId;
      
      return matchesDate && matchesTime && matchesLocation;
    });
    
    if (matchingAvailabilities.length === 0) return 10; // Default if no availability found
    
    // Return max_capacity from the first matching availability (all should have same capacity for same slot)
    return matchingAvailabilities[0]?.max_capacity || 10;
  };

  const getSlotColor = (status) => {
    switch (status) {
      case 'available':
        return '#34C759'; // Green
      case 'partially_booked':
        return '#FF9500'; // Orange
      case 'booked':
        return '#007AFF'; // Blue
      case 'past':
        return '#C7C7CC'; // Gray
      default:
        return '#F5F5F5'; // Light gray for empty
    }
  };

  // Get availability for a specific slot (used in render)
  // Returns the first matching availability (prioritizes booked if multiple exist)
  const getAvailabilityForSlot = (date, time) => {
    const matching = availabilities.filter((av) => {
      // Convert UTC to Sydney local time for matching
      const avDateStr = utcToSydneyDate(av.start_time);
      const avTimeStr = utcToSydneyTime(av.start_time);
      
      return (
        avDateStr === date &&
        avTimeStr === time &&
        (selectedLocationId ? av.location_id === selectedLocationId : true)
      );
    });
    
    // If multiple exist, prioritize booked, then return first
    const booked = matching.find((av) => av.is_booked);
    return booked || matching[0] || null;
  };

  // Get count of availabilities for a slot (to show multiple locations)
  const getAvailabilityCount = (date, time) => {
    const matching = availabilities.filter((av) => {
      // Convert UTC to Sydney local time for matching
      const avDateStr = utcToSydneyDate(av.start_time);
      const avTimeStr = utcToSydneyTime(av.start_time);
      
      return (
        avDateStr === date &&
        avTimeStr === time &&
        (selectedLocationId ? av.location_id === selectedLocationId : true)
      );
    });
    
    return matching.length;
  };

  const handleSlotClick = (date, time) => {
    // date and time are in Sydney local time
    // Convert to UTC for database storage
    const [hours, minutes] = time.split(':').map(Number);
    const slotUTC = sydneyDateTimeToUTC(date, hours, minutes);
    const status = getSlotStatus(date, time);
    
    if (status === 'past') return; // Can't click past slots
    
    // Find the availability if it exists
    const availability = getAvailabilityForSlot(date, time);
    
    onSlotClick({
      date,
      time,
      status,
      datetime: slotUTC, // Already in ISO format from sydneyDateTimeToUTC
      availability: availability || null,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeColumn}>
        <View style={styles.timeHeader} />
        {timeSlots.map((time) => (
          <View key={time} style={styles.timeSlot}>
            <Text style={styles.timeText}>{time}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.calendarGrid}>
          {days.map((day, dayIndex) => {
            const dateStr = weekDates[dayIndex];
            // Parse as Sydney local date string (YYYY-MM-DD)
            const [year, month, dayNum] = dateStr.split('-').map(Number);
            // Compare today in Sydney local time
            const todayStr = getSydneyToday();
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <View key={day} style={styles.dayColumn}>
                <View style={[styles.dayHeader, isToday && styles.dayHeaderSelected]}>
                  <Text style={[styles.dayName, isToday && styles.dayNameSelected]}>
                    {day}
                  </Text>
                  <Text style={[styles.dayNumber, isToday && styles.dayNumberSelected]}>
                    {dayNum}
                  </Text>
                  {isToday && <View style={styles.todayIndicator} />}
                </View>
                {timeSlots.map((time) => {
                  const status = getSlotStatus(dateStr, time);
                  const color = getSlotColor(status);
                  const slotAvailability = getAvailabilityForSlot(dateStr, time);
                  const availabilityCount = getAvailabilityCount(dateStr, time);
                  const bookingCount = getBookingCount(dateStr, time);
                  const maxCapacity = getMaxCapacity(dateStr, time);
                  
                  return (
                    <TouchableOpacity
                      key={`${day}-${time}`}
                      style={[
                        styles.slot,
                        { backgroundColor: color },
                        status === 'past' && styles.slotDisabled,
                      ]}
                      onPress={() => handleSlotClick(dateStr, time)}
                      onLongPress={() => {
                        if ((status === 'available' || status === 'partially_booked') && slotAvailability && onQuickDelete) {
                          onQuickDelete(slotAvailability);
                        }
                      }}
                      disabled={status === 'past'}
                    >
                      {status === 'available' && (
                        <>
                          <Ionicons name="checkmark-circle" size={12} color="#fff" />
                          {/* Don't show count badge for available slots - only show for partially/fully booked */}
                        </>
                      )}
                      {status === 'partially_booked' && (
                        <>
                          <Ionicons name="people" size={12} color="#fff" />
                          <View style={styles.countBadge}>
                            <Text style={styles.countText}>{bookingCount}/{maxCapacity}</Text>
                          </View>
                        </>
                      )}
                      {status === 'booked' && (
                        <>
                          <Ionicons name="lock-closed" size={12} color="#fff" />
                          <View style={styles.countBadge}>
                            <Text style={styles.countText}>{bookingCount}/{maxCapacity}</Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  timeColumn: {
    width: 60,
    marginRight: 8,
  },
  timeHeader: {
    height: 60,
  },
  timeSlot: {
    height: 32, // Match slot height (30) + marginBottom (2)
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  calendarGrid: {
    flexDirection: 'row',
  },
  dayColumn: {
    width: 80,
    marginRight: 4,
  },
  dayHeader: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    position: 'relative',
  },
  dayHeaderSelected: {
    backgroundColor: '#000',
    borderRadius: 8,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
  },
  dayNameSelected: {
    color: '#fff',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  dayNumberSelected: {
    color: '#fff',
  },
  todayIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#007AFF',
  },
  slot: {
    height: 30,
    marginBottom: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  slotDisabled: {
    opacity: 0.5,
  },
  countBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});
