import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getSydneyToday, sydneyDateToUTCStart, sydneyDateToUTCEnd, utcToSydneyDate } from '../utils/timezone';

const { width } = Dimensions.get('window');
const isDesktop = Platform.OS === 'web' && width > 768;
const DATE_CARD_WIDTH = 70;
const DATE_CARD_GAP = 12;

// Skeleton loader component
const SkeletonChip = () => {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;
  // useNativeDriver is not supported on web
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeletonChip,
        { opacity }
      ]}
    />
  );
};

export default function BookingDiscoveryScreen({ onNext, onBack }) {
  const insets = useSafeAreaInsets();
  // Initialize selectedDate as Sydney local date string
  const [selectedDate, setSelectedDate] = useState(getSydneyToday());
  const [availabilities, setAvailabilities] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState([]); // Array of { time, locationId, serviceName }
  const [selectedLocationId, setSelectedLocationId] = useState(null); // null = all locations
  const [viewMode, setViewMode] = useState('weekly'); // 'weekly' or 'monthly'
  // Use Sydney local time for calendar month/year
  const nowForCalendar = new Date();
  const [calendarMonth, setCalendarMonth] = useState(nowForCalendar.getMonth());
  const [calendarYear, setCalendarYear] = useState(nowForCalendar.getFullYear());
  const [dateCards, setDateCards] = useState([]);
  const [visibleDateRange, setVisibleDateRange] = useState({ start: 0, end: 14 });
  const dateScrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [showPrevArrow, setShowPrevArrow] = useState(false);
  const [showNextArrow, setShowNextArrow] = useState(true);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [availabilityHeatmap, setAvailabilityHeatmap] = useState({}); // { dateStr: boolean }
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const heatmapCacheRef = useRef({}); // Cache for heatmap data
  // Use Sydney local time for today
  const todayStr = getSydneyToday();

  // Generate date cards for a range (lazy loading) - using Sydney local time
  const generateDateCards = (startOffset, count = 14) => {
    const dates = [];
    const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
    const startDate = new Date(todayYear, todayMonth - 1, todayDay + startOffset, 0, 0, 0, 0);
    
    for (let i = 0; i < count; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Smart labeling - use Sydney local dates for comparison
      const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
      const tomorrowDate = new Date(todayYear, todayMonth - 1, todayDay + 1, 0, 0, 0, 0);
      const tomorrowYear = tomorrowDate.getFullYear();
      const tomorrowMonth = String(tomorrowDate.getMonth() + 1).padStart(2, '0');
      const tomorrowDay = String(tomorrowDate.getDate()).padStart(2, '0');
      const tomorrowStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
      
      let label = '';
      if (dateStr === todayStr) {
        label = 'Today';
      } else if (dateStr === tomorrowStr) {
        label = 'Tomorrow';
      } else {
        // Format using local date for display
        label = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      }
      
      dates.push({
        dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        day: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        label,
        isToday: dateStr === todayStr,
        isTomorrow: dateStr === tomorrowStr,
        offset: startOffset + i,
      });
    }
    return dates;
  };

  // Initialize date cards
  useEffect(() => {
    const initialCards = generateDateCards(0, 28); // Load 4 weeks initially
    setDateCards(initialCards);
    setVisibleDateRange({ start: 0, end: 28 });
  }, []);

  // Get current date range label
  const getDateRangeLabel = () => {
    if (viewMode === 'monthly') {
      return new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
    
    // For weekly view, find the visible range
    if (dateCards.length === 0) return 'This Week';
    
    const firstVisible = dateCards[0];
    const lastVisible = dateCards[dateCards.length - 1];
    
    if (!firstVisible || !lastVisible) return 'This Week';
    
    // Create today date from todayStr (Sydney local time)
    // Use todayStr from component scope, fallback to getSydneyToday() if not available
    const currentTodayStr = todayStr || getSydneyToday();
    const [todayYear, todayMonth, todayDay] = currentTodayStr.split('-').map(Number);
    const today = new Date(todayYear, todayMonth - 1, todayDay, 0, 0, 0, 0);
    
    const firstDate = new Date(today);
    firstDate.setDate(today.getDate() + firstVisible.offset);
    const lastDate = new Date(today);
    lastDate.setDate(today.getDate() + lastVisible.offset);
    
    const firstMonth = firstDate.toLocaleDateString('en-US', { month: 'short' });
    const lastMonth = lastDate.toLocaleDateString('en-US', { month: 'short' });
    
    if (firstMonth === lastMonth) {
      return `${firstMonth} ${firstDate.getDate()} - ${lastDate.getDate()}`;
    } else {
      return `${firstMonth} ${firstDate.getDate()} - ${lastMonth} ${lastDate.getDate()}`;
    }
  };

  // Generate monthly calendar grid - using Sydney local time
  const generateMonthlyCalendar = () => {
    const firstDay = new Date(calendarYear, calendarMonth, 1, 0, 0, 0, 0);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0, 23, 59, 59, 999);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(calendarYear, calendarMonth, day, 0, 0, 0, 0);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayStr}`;
      
      // Compare with today (Sydney local)
      const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
      const todayDate = new Date(todayYear, todayMonth - 1, todayDay, 0, 0, 0, 0);
      const isPast = date < todayDate;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      
      // Check if this date has available slots (will be updated by heatmap)
      const hasAvailability = availabilityHeatmap[dateStr] === true;
      
      days.push({
        day,
        dateStr,
        isPast,
        isToday,
        isSelected,
        hasAvailability,
      });
    }
    
    return days;
  };

  const monthlyDays = generateMonthlyCalendar();
  
  // Get availability count for a specific date (dateStr is in Sydney local time)
  const getDateAvailabilityCount = (dateStr) => {
    return availabilities.filter((av) => {
      // Convert UTC date from database to Sydney local date for matching
      const avDateStr = utcToSydneyDate(av.start_time);
      return avDateStr === dateStr;
    }).length;
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const handleMonthDateClick = (dateStr) => {
    if (dateStr) {
      setSelectedDate(dateStr);
      // If on mobile, the time slots will show below
    }
  };

  // Handle view mode change with fade transition
  const handleViewModeChange = (newMode) => {
    // useNativeDriver is not supported on web
    const useNativeDriver = Platform.OS !== 'web';
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver,
      }),
    ]).start();
    setViewMode(newMode);
  };

  // Sync calendar month/year when selected date changes - using Sydney local time
  useEffect(() => {
    if (selectedDate) {
      // Parse selectedDate as Sydney local date string (YYYY-MM-DD)
      const [year, month, day] = selectedDate.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      const monthLocal = date.getMonth();
      const yearLocal = date.getFullYear();
      if (monthLocal !== calendarMonth || yearLocal !== calendarYear) {
        setCalendarMonth(monthLocal);
        setCalendarYear(yearLocal);
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAvailabilities();
    }
  }, [selectedDate, selectedLocationId]);

  // Clear cache when location filter changes
  useEffect(() => {
    heatmapCacheRef.current = {};
  }, [selectedLocationId]);

  // Load availability heatmap for visible date range
  useEffect(() => {
    if (viewMode === 'weekly' && dateCards.length > 0) {
      loadAvailabilityHeatmap();
    } else if (viewMode === 'monthly') {
      loadMonthlyHeatmap();
    }
  }, [dateCards, selectedLocationId, viewMode, calendarMonth, calendarYear]);

  // Scroll to selected date when it changes
  useEffect(() => {
    if (dateScrollViewRef.current && selectedDate && viewMode === 'weekly') {
      const index = dateCards.findIndex((card) => card.dateStr === selectedDate);
      if (index >= 0) {
        setTimeout(() => {
          dateScrollViewRef.current?.scrollTo({
            x: index * (DATE_CARD_WIDTH + DATE_CARD_GAP) - (width / 2) + (DATE_CARD_WIDTH / 2),
            animated: true,
          });
        }, 100);
      }
    }
  }, [selectedDate, dateCards, viewMode]);

  // Handle scroll for lazy loading and arrow visibility
  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollX = contentOffset.x;
    const maxScroll = contentSize.width - layoutMeasurement.width;
    
    // Show/hide arrows
    setShowPrevArrow(scrollX > 50);
    setShowNextArrow(scrollX < maxScroll - 50);
    
    // Lazy load more dates when near the end
    const scrollPercentage = scrollX / maxScroll;
    if (scrollPercentage > 0.7 && dateCards.length < 100) {
      // Load more dates
      const newStart = dateCards.length;
      const newCards = generateDateCards(newStart, 14);
      setDateCards((prev) => [...prev, ...newCards]);
      setVisibleDateRange({ start: visibleDateRange.start, end: newStart + 14 });
      // Heatmap will reload automatically via useEffect when dateCards changes
    }
  };

  const handleScrollPrev = () => {
    if (dateScrollViewRef.current) {
      dateScrollViewRef.current.scrollTo({
        x: Math.max(0, (dateScrollViewRef.current._scrollMetrics?.contentOffset?.x || 0) - (width * 0.8)),
        animated: true,
      });
    }
  };

  const handleScrollNext = () => {
    if (dateScrollViewRef.current) {
      const currentScroll = dateScrollViewRef.current._scrollMetrics?.contentOffset?.x || 0;
      dateScrollViewRef.current.scrollTo({
        x: currentScroll + (width * 0.8),
        animated: true,
      });
    }
  };

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const loadAvailabilities = async () => {
    try {
      setLoading(true);
      
      // selectedDate is in Sydney local time format (YYYY-MM-DD)
      // Convert to UTC for database query
      const startOfDay = sydneyDateToUTCStart(selectedDate);
      const endOfDay = sydneyDateToUTCEnd(selectedDate);

      let query = supabase
        .from('availabilities')
        .select(`
          *,
          locations:location_id (id, name)
        `)
        .eq('is_booked', false)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      // Apply location filter if selected
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setAvailabilities(data || []);
    } catch (error) {
      console.error('Error loading availabilities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load availability heatmap for weekly view
  const loadAvailabilityHeatmap = async () => {
    if (dateCards.length === 0) return;

    try {
      setHeatmapLoading(true);

      // Get date range from visible cards
      const firstDate = dateCards[0].dateStr;
      const lastDate = dateCards[dateCards.length - 1].dateStr;
      
      // Check cache
      const cacheKey = `${firstDate}-${lastDate}-${selectedLocationId || 'all'}`;
      if (heatmapCacheRef.current[cacheKey]) {
        setAvailabilityHeatmap(heatmapCacheRef.current[cacheKey]);
        setHeatmapLoading(false);
        return;
      }

      // Convert Sydney local date strings to UTC for database query
      const startOfRange = sydneyDateToUTCStart(firstDate);
      const endOfRange = sydneyDateToUTCEnd(lastDate);

      let query = supabase
        .from('availabilities')
        .select('start_time, location_id')
        .eq('is_booked', false)
        .gte('start_time', startOfRange.toISOString())
        .lte('start_time', endOfRange.toISOString());

      // Apply location filter if selected
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Build heatmap: { dateStr: hasAvailability }
      const heatmap = {};
      dateCards.forEach((card) => {
        heatmap[card.dateStr] = false; // Default to no availability
      });

      if (data && data.length > 0) {
        data.forEach((av) => {
          // Convert UTC date from database to Sydney local date for matching
          const dateStr = utcToSydneyDate(av.start_time);
          if (heatmap.hasOwnProperty(dateStr)) {
            heatmap[dateStr] = true;
          }
        });
      }

      // Cache the result
      heatmapCacheRef.current[cacheKey] = heatmap;
      setAvailabilityHeatmap(heatmap);
    } catch (error) {
      console.error('Error loading availability heatmap:', error);
    } finally {
      setHeatmapLoading(false);
    }
  };

  // Load availability heatmap for monthly view
  const loadMonthlyHeatmap = async () => {
    try {
      setHeatmapLoading(true);

      // Get first and last day of the month in Sydney local time
      const firstDay = new Date(calendarYear, calendarMonth, 1, 0, 0, 0, 0);
      const lastDay = new Date(calendarYear, calendarMonth + 1, 0, 23, 59, 59, 999);
      
      // Convert to date strings for heatmap keys
      const firstDayStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`;
      const lastDayStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      
      // Convert to UTC for database query
      const firstDayUTC = sydneyDateToUTCStart(firstDayStr);
      const lastDayUTC = sydneyDateToUTCEnd(lastDayStr);
      
      const cacheKey = `${calendarYear}-${calendarMonth}-${selectedLocationId || 'all'}`;
      if (heatmapCacheRef.current[cacheKey]) {
        setAvailabilityHeatmap(heatmapCacheRef.current[cacheKey]);
        setHeatmapLoading(false);
        return;
      }

      let query = supabase
        .from('availabilities')
        .select('start_time, location_id')
        .eq('is_booked', false)
        .gte('start_time', firstDayUTC.toISOString())
        .lte('start_time', lastDayUTC.toISOString());

      // Apply location filter if selected
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Build heatmap for all days in month using Sydney local dates
      const heatmap = {};
      const daysInMonth = lastDay.getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(calendarYear, calendarMonth, day, 0, 0, 0, 0);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const dayStr = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayStr}`;
        heatmap[dateStr] = false;
      }

      if (data && data.length > 0) {
        data.forEach((av) => {
          // Convert UTC date from database to Sydney local date for matching
          const dateStr = utcToSydneyDate(av.start_time);
          if (heatmap.hasOwnProperty(dateStr)) {
            heatmap[dateStr] = true;
          }
        });
      }

      // Cache the result
      heatmapCacheRef.current[cacheKey] = heatmap;
      setAvailabilityHeatmap(heatmap);
    } catch (error) {
      console.error('Error loading monthly heatmap:', error);
    } finally {
      setHeatmapLoading(false);
    }
  };

  // Group availabilities by location and service
  const groupAvailabilities = () => {
    const grouped = {};
    
    availabilities.forEach((av) => {
      const locationName = av.locations?.name || 'Unknown Location';
      const serviceName = av.service_name || 'General';
      const key = `${locationName}::${serviceName}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          locationId: av.location_id,
          locationName,
          serviceName,
          slots: [],
        };
      }
      
      // Display time in local timezone to match what students expect
      // The availability start_time is stored in UTC, but we display it in local time
      const startTime = new Date(av.start_time);
      
      // Get local time components for display (matches what user sees in their timezone)
      const localHours = startTime.getHours();
      const localMinutes = startTime.getMinutes();
      const time24 = `${localHours.toString().padStart(2, '0')}:${localMinutes.toString().padStart(2, '0')}`;
      
      // Format for display (12-hour format)
      const displayHours = localHours % 12 || 12;
      const ampm = localHours >= 12 ? 'PM' : 'AM';
      const timeStr = `${displayHours}:${localMinutes.toString().padStart(2, '0')} ${ampm}`;
      
      grouped[key].slots.push({
        id: av.id,
        time: timeStr,
        time24: time24, // Use UTC time for sorting/comparison
        startTime: av.start_time, // Store exact start_time from database
        endTime: av.end_time, // Store exact end_time from database
        locationId: av.location_id,
        serviceName: av.service_name,
      });
    });

    // Sort slots by time within each group
    Object.keys(grouped).forEach((key) => {
      grouped[key].slots.sort((a, b) => a.time24.localeCompare(b.time24));
    });

    return Object.values(grouped);
  };

  const groupedAvailabilities = groupAvailabilities();

  // Check if a slot is selected
  const isSlotSelected = (slot) => {
    return selectedSlots.some(
      (s) => s.time === slot.time && s.locationId === slot.locationId
    );
  };

  // Get selected slots for a specific location, sorted by time
  const getSelectedSlotsForLocation = (locationId) => {
    return selectedSlots
      .filter((s) => s.locationId === locationId)
      .sort((a, b) => a.time24.localeCompare(b.time24));
  };

  // Check if selection has at least 1 hour (2 blocks)
  const hasValidSelection = () => {
    // Group by location and check each location has at least 2 slots
    const byLocation = {};
    selectedSlots.forEach((slot) => {
      if (!byLocation[slot.locationId]) {
        byLocation[slot.locationId] = [];
      }
      byLocation[slot.locationId].push(slot);
    });

    return Object.values(byLocation).some((slots) => slots.length >= 2);
  };

  // Find the next consecutive 30-minute slot
  const findNextSlot = (currentSlot) => {
    const [hours, minutes] = currentSlot.time24.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;
    const nextMinutes = currentMinutes + 30;
    const nextTime24 = formatTime24(nextMinutes);

    // Find the slot in the same location group
    for (const group of groupedAvailabilities) {
      if (group.locationId === currentSlot.locationId) {
        const nextSlot = group.slots.find((s) => s.time24 === nextTime24);
        if (nextSlot) return nextSlot;
      }
    }
    return null;
  };

  // Get the end slot of current selection for a location
  const getEndSlot = (locationId) => {
    const locationSlots = getSelectedSlotsForLocation(locationId);
    return locationSlots.length > 0 ? locationSlots[locationSlots.length - 1] : null;
  };

  // Handle slot selection with streamlined logic
  const handleSlotClick = (slot) => {
    const isSelected = isSlotSelected(slot);
    const locationSlots = getSelectedSlotsForLocation(slot.locationId);

    if (isSelected) {
      // Deselection: Clear entire range if it would result in < 1 hour
      const remainingSlots = selectedSlots.filter(
        (s) => !(s.time === slot.time && s.locationId === slot.locationId)
      );
      const remainingForLocation = remainingSlots.filter(
        (s) => s.locationId === slot.locationId
      );

      // If removing this slot would leave less than 2 slots for this location, clear all
      if (remainingForLocation.length < 2) {
        setSelectedSlots(remainingSlots.filter((s) => s.locationId !== slot.locationId));
      } else {
        setSelectedSlots(remainingSlots);
      }
    } else {
      // Selection logic
      if (locationSlots.length === 0) {
        // Initial selection: Auto-select this slot + next consecutive block
        const nextSlot = findNextSlot(slot);
        
        if (!nextSlot) {
          Alert.alert(
            'Cannot Select',
            'This slot requires a following 30-minute block to meet the 1-hour minimum.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Select both slots
        setSelectedSlots([
          ...selectedSlots,
          {
            time: slot.time,
            time24: slot.time24,
            locationId: slot.locationId,
            serviceName: slot.serviceName,
          },
          {
            time: nextSlot.time,
            time24: nextSlot.time24,
            locationId: nextSlot.locationId,
            serviceName: nextSlot.serviceName,
          },
        ]);
      } else {
        // Extension logic: Check if this is the slot immediately after the end
        const endSlot = getEndSlot(slot.locationId);
        if (endSlot) {
          const [endHours, endMinutes] = endSlot.time24.split(':').map(Number);
          const endTotalMinutes = endHours * 60 + endMinutes;
          const [slotHours, slotMinutes] = slot.time24.split(':').map(Number);
          const slotTotalMinutes = slotHours * 60 + slotMinutes;

          // Check if this slot is exactly 30 minutes after the end
          if (slotTotalMinutes === endTotalMinutes + 30) {
            // Extend the selection
            setSelectedSlots([
              ...selectedSlots,
              {
                time: slot.time,
                time24: slot.time24,
                locationId: slot.locationId,
                serviceName: slot.serviceName,
              },
            ]);
          } else {
            // Not consecutive - start a new selection
            const nextSlot = findNextSlot(slot);
            if (!nextSlot) {
              Alert.alert(
                'Cannot Select',
                'This slot requires a following 30-minute block to meet the 1-hour minimum.',
                [{ text: 'OK' }]
              );
              return;
            }

            // Clear existing selection for this location and start new
            const otherLocationSlots = selectedSlots.filter(
              (s) => s.locationId !== slot.locationId
            );
            setSelectedSlots([
              ...otherLocationSlots,
              {
                time: slot.time,
                time24: slot.time24,
                locationId: slot.locationId,
                serviceName: slot.serviceName,
              },
              {
                time: nextSlot.time,
                time24: nextSlot.time24,
                locationId: nextSlot.locationId,
                serviceName: nextSlot.serviceName,
              },
            ]);
          }
        }
      }
    }
  };


  // Find a slot by time24 format
  const findSlotByTime = (time24, locationId) => {
    const timeStr = formatTime24(time24);
    for (const group of groupedAvailabilities) {
      if (group.locationId === locationId) {
        const slot = group.slots.find((s) => s.time24 === timeStr);
        if (slot) return slot;
      }
    }
    return null;
  };

  // Format minutes to HH:MM
  const formatTime24 = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Calculate selection summary
  const calculateSummary = () => {
    if (selectedSlots.length === 0) {
      return {
        timeRange: null,
        duration: 0,
        credits: 0,
      };
    }

    // Group by location
    const byLocation = {};
    selectedSlots.forEach((slot) => {
      if (!byLocation[slot.locationId]) {
        byLocation[slot.locationId] = [];
      }
      byLocation[slot.locationId].push(slot);
    });

    // Calculate for each location and sum
    let totalDuration = 0;
    let earliestTime = null;
    let latestTime = null;

    Object.values(byLocation).forEach((locationSlots) => {
      const sorted = locationSlots.sort((a, b) => a.time24.localeCompare(b.time24));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      if (!earliestTime || first.time24 < earliestTime) {
        earliestTime = first.time24;
      }
      if (!latestTime || last.time24 > latestTime) {
        latestTime = last.time24;
      }

      // Calculate duration (30 min per slot)
      totalDuration += sorted.length * 30;
    });

    // Format time range
    const startTime = earliestTime
      ? formatTime12(earliestTime)
      : '';
    const endTime = latestTime
      ? formatTime12(add30Minutes(latestTime))
      : '';

    const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : null;
    const hours = totalDuration / 60;
    const credits = 0; // Set to 0 for testing (will be properly implemented later)

    return {
      timeRange,
      duration: hours,
      credits,
    };
  };

  const formatTime12 = (time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const add30Minutes = (time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + 30;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  };

  const handleBackToToday = () => {
    setSelectedDate(todayStr);
    // Scroll to today
    if (dateScrollViewRef.current) {
      setTimeout(() => {
        dateScrollViewRef.current?.scrollTo({
          x: 0,
          animated: true,
        });
      }, 100);
    }
  };

  const summary = calculateSummary();
  const canProceed = hasValidSelection(); // At least 1 hour (2 consecutive 30-min slots)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.title}>Book a Lesson</Text>
          <Text style={styles.subtitle}>Select your preferred date and time</Text>
        </View>
      </View>

      {/* Actions Row - Filters and View Toggle */}
      <View style={[styles.actionsRow, Platform.OS !== 'web' && styles.actionsRowMobile]}>
        {/* Location Filter */}
        {locations.length > 0 && (
          <View style={styles.filterContainer}>
            {locations.length < 4 ? (
              // Pill-based selector for < 4 locations
              <View style={styles.pillSelector}>
                <TouchableOpacity
                  style={[
                    styles.pill,
                    !selectedLocationId && styles.pillActive,
                  ]}
                  onPress={() => setSelectedLocationId(null)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      !selectedLocationId && styles.pillTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {locations.map((location) => (
                  <TouchableOpacity
                    key={location.id}
                    style={[
                      styles.pill,
                      selectedLocationId === location.id && styles.pillActive,
                    ]}
                    onPress={() => setSelectedLocationId(location.id)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selectedLocationId === location.id && styles.pillTextActive,
                      ]}
                    >
                      {location.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              // Dropdown for 4+ locations
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Location:</Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setShowLocationDropdown(!showLocationDropdown)}
                >
                  <Text style={styles.dropdownText}>
                    {selectedLocationId
                      ? locations.find((l) => l.id === selectedLocationId)?.name || 'Select Location'
                      : 'All Locations'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                </TouchableOpacity>
                {showLocationDropdown && (
                  <>
                    {/* Overlay to close dropdown on outside click */}
                    {Platform.OS === 'web' && (
                      <TouchableOpacity
                        style={styles.dropdownOverlay}
                        activeOpacity={1}
                        onPress={() => setShowLocationDropdown(false)}
                      />
                    )}
                    <View style={styles.dropdownMenu}>
                      <TouchableOpacity
                        style={styles.dropdownMenuItem}
                        onPress={() => {
                          setSelectedLocationId(null);
                          setShowLocationDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownMenuItemText, !selectedLocationId && styles.dropdownMenuItemTextActive]}>
                          All Locations
                        </Text>
                        {!selectedLocationId && (
                          <Ionicons name="checkmark" size={16} color="#000" />
                        )}
                      </TouchableOpacity>
                      {locations.map((location) => (
                        <TouchableOpacity
                          key={location.id}
                          style={styles.dropdownMenuItem}
                          onPress={() => {
                            setSelectedLocationId(location.id);
                            setShowLocationDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownMenuItemText, selectedLocationId === location.id && styles.dropdownMenuItemTextActive]}>
                            {location.name}
                          </Text>
                          {selectedLocationId === location.id && (
                            <Ionicons name="checkmark" size={16} color="#000" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* View Switcher */}
        <View style={styles.viewSwitcher}>
          <TouchableOpacity
            style={[
              styles.viewSwitchButton,
              viewMode === 'weekly' && styles.viewSwitchButtonActive,
            ]}
            onPress={() => handleViewModeChange('weekly')}
          >
            <Text
              style={[
                styles.viewSwitchText,
                viewMode === 'weekly' && styles.viewSwitchTextActive,
              ]}
            >
              Weekly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewSwitchButton,
              viewMode === 'monthly' && styles.viewSwitchButtonActive,
            ]}
            onPress={() => handleViewModeChange('monthly')}
          >
            <Text
              style={[
                styles.viewSwitchText,
                viewMode === 'monthly' && styles.viewSwitchTextActive,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Weekly View */}
      {viewMode === 'weekly' && (
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Date Range Label - Centered */}
          <View style={styles.dateRangeHeader}>
            <Text style={styles.dateRangeLabel}>{getDateRangeLabel()}</Text>
            {selectedDate !== todayStr && (
              <TouchableOpacity
                style={styles.backToTodayButton}
                onPress={handleBackToToday}
              >
                <Ionicons name="calendar-outline" size={14} color="#007AFF" />
                <Text style={styles.backToTodayText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal Date Picker with Infinite Scroll */}
          <View style={styles.datePickerContainer}>
            {/* Prev Arrow (Desktop only, on hover) */}
            {Platform.OS === 'web' && showPrevArrow && (
              <TouchableOpacity
                style={styles.datePickerArrow}
                onPress={handleScrollPrev}
              >
                <Ionicons name="chevron-back" size={24} color="#000" />
              </TouchableOpacity>
            )}

            <ScrollView
              ref={dateScrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.datePicker}
              contentContainerStyle={styles.datePickerContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              snapToInterval={DATE_CARD_WIDTH + DATE_CARD_GAP}
              decelerationRate="fast"
              snapToAlignment="center"
              {...(Platform.OS === 'web' && {
                scrollSnapType: 'x mandatory',
              })}
            >
              {dateCards.map((dateCard, index) => {
                const isSelected = dateCard.dateStr === selectedDate;
                const hasAvailability = availabilityHeatmap[dateCard.dateStr] === true;
                const hasNoAvailability = availabilityHeatmap[dateCard.dateStr] === false && !heatmapLoading;
                
                return (
                  <TouchableOpacity
                    key={`${dateCard.dateStr}-${index}`}
                    style={[
                      styles.dateCard,
                      hasAvailability && !isSelected && styles.dateCardAvailable,
                      hasNoAvailability && !isSelected && styles.dateCardUnavailable,
                      isSelected && styles.dateCardSelected,
                      Platform.OS === 'web' && { scrollSnapAlign: 'center' },
                    ]}
                    onPress={() => setSelectedDate(dateCard.dateStr)}
                  >
                    <Text style={[styles.dateLabel, isSelected && styles.dateLabelSelected]}>
                      {dateCard.label}
                    </Text>
                    <Text style={[styles.dateDay, isSelected && styles.dateDaySelected]}>
                      {dateCard.day}
                    </Text>
                    <Text style={[styles.dateMonth, isSelected && styles.dateMonthSelected]}>
                      {dateCard.month}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Next Arrow (Desktop only, on hover) */}
            {Platform.OS === 'web' && showNextArrow && (
              <TouchableOpacity
                style={[styles.datePickerArrow, { left: 'auto', right: 10 }]}
                onPress={handleScrollNext}
              >
                <Ionicons name="chevron-forward" size={24} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Monthly View */}
      {viewMode === 'monthly' && (
        <Animated.View
          style={[
            styles.monthlyView,
            Platform.OS !== 'web' && styles.monthlyViewMobile,
            { opacity: fadeAnim },
          ]}
        >
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={styles.monthNavButton}
              onPress={handlePrevMonth}
            >
              <Ionicons name="chevron-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.monthNavTitle}>
              {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <TouchableOpacity
              style={styles.monthNavButton}
              onPress={handleNextMonth}
            >
              <Ionicons name="chevron-forward" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <View key={day} style={styles.calendarDayHeader}>
                <Text style={styles.calendarDayHeaderText}>{day}</Text>
              </View>
            ))}

            {/* Calendar Days */}
            {monthlyDays.map((dayData, index) => {
              if (!dayData) {
                return <View key={`empty-${index}`} style={styles.calendarDay} />;
              }

              const { day, dateStr, isPast, isToday, isSelected } = dayData;
              const hasAvailability = availabilityHeatmap[dateStr] === true;
              const hasNoAvailability = availabilityHeatmap[dateStr] === false && !heatmapLoading && !isPast;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.calendarDay,
                    hasAvailability && !isSelected && !isPast && styles.calendarDayAvailable,
                    hasNoAvailability && !isSelected && styles.calendarDayUnavailable,
                    isSelected && styles.calendarDaySelected,
                    isPast && styles.calendarDayPast,
                  ]}
                  onPress={() => !isPast && handleMonthDateClick(dateStr)}
                  disabled={isPast}
                >
                  {isToday && !isSelected && (
                    <View style={styles.calendarDayTodayRing} />
                  )}
                  <Text
                    style={[
                      styles.calendarDayText,
                      isSelected && styles.calendarDayTextSelected,
                      isPast && styles.calendarDayTextPast,
                    ]}
                  >
                    {day}
                  </Text>
                  {hasAvailability && !isPast && !isSelected && (
                    <View style={styles.calendarDayDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* Availability List */}
      <ScrollView
        style={[
          styles.content,
          viewMode === 'monthly' && Platform.OS !== 'web' && styles.contentMonthlyMobile,
        ]}
        contentContainerStyle={styles.contentContainer}
      >
        {loading ? (
          // Skeleton Loaders
          <View style={styles.skeletonContainer}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonGroup}>
                <View style={styles.skeletonHeader}>
                  <SkeletonChip />
                  <SkeletonChip />
                </View>
                <View style={styles.skeletonSlots}>
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <SkeletonChip key={j} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : groupedAvailabilities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No availability</Text>
            <Text style={styles.emptyText}>
              There are no available time slots for this date.
            </Text>
          </View>
        ) : (
          groupedAvailabilities.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.group}>
              <View style={styles.groupHeader}>
                <Ionicons name="location" size={20} color="#000" />
                <Text style={styles.groupLocation}>{group.locationName}</Text>
                {group.serviceName && group.serviceName !== 'General' && (
                  <Text style={styles.groupService}>• {group.serviceName}</Text>
                )}
              </View>
              <View style={styles.slotsContainer}>
                {group.slots.map((slot, slotIndex) => {
                  const isSelected = isSlotSelected(slot);
                  const locationSlots = getSelectedSlotsForLocation(slot.locationId);
                  const sortedSlots = locationSlots.sort((a, b) => a.time24.localeCompare(b.time24));
                  
                  // Determine if this is start, middle, or end of selection
                  let isStartSlot = false;
                  let isEndSlot = false;
                  let isMiddleSlot = false;
                  
                  if (isSelected && sortedSlots.length > 0) {
                    const slotIndexInSelection = sortedSlots.findIndex((s) => s.time24 === slot.time24);
                    isStartSlot = slotIndexInSelection === 0;
                    isEndSlot = slotIndexInSelection === sortedSlots.length - 1;
                    isMiddleSlot = slotIndexInSelection > 0 && slotIndexInSelection < sortedSlots.length - 1;
                  }
                  
                  return (
                    <TouchableOpacity
                      key={slotIndex}
                      style={[
                        styles.slotChip,
                        isSelected && styles.slotChipSelected,
                        isStartSlot && styles.slotChipStart,
                        isEndSlot && styles.slotChipEnd,
                        isMiddleSlot && styles.slotChipMiddle,
                        !isSelected && styles.slotChipUnselected, // Normal margin for unselected
                      ]}
                      onPress={() => handleSlotClick(slot)}
                    >
                      <Text
                        style={[
                          styles.slotChipText,
                          isSelected && styles.slotChipTextSelected,
                        ]}
                      >
                        {slot.time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Selection Summary Bar - Full Width Sticky Footer */}
      {selectedSlots.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={[styles.summaryBarContent, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 20) }]}>
            <View style={[styles.summaryInfo, !isDesktop && styles.summaryInfoMobile]}>
              {summary.timeRange && (
                <View style={styles.summaryItem}>
                  <Ionicons name="time-outline" size={isDesktop ? 18 : 16} color="#000" />
                  <Text style={[styles.summaryText, !isDesktop && styles.summaryTextMobile]}>
                    {summary.timeRange}
                  </Text>
                </View>
              )}
              <View style={styles.summaryItem}>
                <Ionicons name="hourglass-outline" size={isDesktop ? 18 : 16} color="#000" />
                <Text style={[styles.summaryText, !isDesktop && styles.summaryTextMobile]}>
                  {summary.duration.toFixed(1)} {summary.duration === 1 ? 'Hour' : 'Hours'}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Ionicons name="wallet-outline" size={isDesktop ? 18 : 16} color="#000" />
                <Text style={[styles.summaryText, !isDesktop && styles.summaryTextMobile]}>
                  {summary.credits.toFixed(1)} {summary.credits === 1 ? 'Credit' : 'Credits'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
              onPress={() => canProceed && onNext && onNext(selectedSlots, summary, selectedDate)}
              disabled={!canProceed}
            >
              <Text style={[styles.nextButtonText, !canProceed && styles.nextButtonTextDisabled]}>
                Next
              </Text>
              <Ionicons
                name="arrow-forward"
                size={isDesktop ? 20 : 18}
                color={canProceed ? '#fff' : '#8E8E93'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  viewSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  viewSwitchButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewSwitchButtonActive: {
    backgroundColor: '#000',
  },
  viewSwitchText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  viewSwitchTextActive: {
    color: '#fff',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    position: 'relative',
    zIndex: 100, // Higher than date picker but lower than dropdown
  },
  actionsRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  filterContainer: {
    flex: 1,
  },
  pillSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  pillActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    zIndex: 10000,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 8,
    minWidth: 150,
    maxWidth: 200,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },
  dropdownOverlay: {
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      backgroundColor: 'transparent',
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 100, // Adjust based on header height
    paddingLeft: 20,
  },
  dropdownMenuModal: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minWidth: 200,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 20,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: 200, // Match the dropdown trigger width
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 20, // Higher elevation for Android
    }),
    zIndex: 10000, // Very high z-index to appear above everything
    maxHeight: 400, // Increased height to show more items
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    }),
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dropdownMenuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  dropdownMenuItemTextActive: {
    fontWeight: '600',
  },
  dateRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  dateRangeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  datePickerContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1, // Lower than dropdown
  },
  datePickerArrow: {
    position: 'absolute',
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    left: 10,
    ...(Platform.OS === 'web' && {
      opacity: 0.8,
    }),
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  dateNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  dateNavLeft: {
    flex: 1,
  },
  dateNavCenter: {
    flex: 1,
    alignItems: 'center',
  },
  dateNavRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  backToTodayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
  },
  backToTodayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  pagingIndicator: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  quickJumpButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  quickJumpText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  datePicker: {
    maxHeight: 120,
    flex: 1,
    zIndex: 1, // Lower than dropdown
    ...(Platform.OS === 'web' && {
      overflowX: 'auto',
      scrollSnapType: 'x mandatory',
      WebkitOverflowScrolling: 'touch',
    }),
  },
  datePickerContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: DATE_CARD_GAP,
    ...(Platform.OS === 'web' && {
      display: 'flex',
      flexDirection: 'row',
    }),
  },
  dateCard: {
    width: DATE_CARD_WIDTH,
    minHeight: Platform.OS === 'web' ? 100 : 88, // 44px * 2 for mobile
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    flexShrink: 0,
    ...(Platform.OS === 'web' && {
      scrollSnapAlign: 'center',
      scrollSnapStop: 'always',
    }),
    ...(Platform.OS !== 'web' && {
      minWidth: 70,
      minHeight: 88,
    }),
  },
  dateCardAvailable: {
    backgroundColor: '#F0F9F4', // Light green (similar to bg-green-50)
    borderColor: '#D1FAE5',
  },
  dateCardUnavailable: {
    backgroundColor: '#FEF2F2', // Light red (similar to bg-red-50)
    borderColor: '#FEE2E2',
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
    textAlign: 'center',
  },
  dateLabelSelected: {
    color: '#fff',
  },
  dateCardSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  dateDaySelected: {
    color: '#fff',
  },
  dateMonth: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  dateMonthSelected: {
    color: '#fff',
  },
  monthlyView: {
    padding: 20,
    paddingBottom: 12,
  },
  monthlyViewMobile: {
    maxHeight: '50%',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayHeader: {
    width: `${100 / 7}%`,
    paddingVertical: 8,
    alignItems: 'center',
  },
  calendarDayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    minHeight: 44, // Minimum 44px for mobile touch targets
    aspectRatio: 1,
    maxHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  calendarDaySelected: {
    backgroundColor: '#000',
    borderRadius: 20,
  },
  calendarDayAvailable: {
    backgroundColor: '#F0F9F4', // Light green (similar to bg-green-50)
  },
  calendarDayUnavailable: {
    backgroundColor: '#FEF2F2', // Light red (similar to bg-red-50)
  },
  calendarDayPast: {
    opacity: 0.3,
  },
  calendarDayTodayRing: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000',
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  calendarDayTextPast: {
    color: '#8E8E93',
  },
  calendarDayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#34C759',
  },
  content: {
    flex: 1,
  },
  contentMonthlyMobile: {
    maxHeight: '50%',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 140, // Space for full-width sticky footer (accounts for safe area insets)
  },
  skeletonContainer: {
    gap: 24,
  },
  skeletonGroup: {
    gap: 12,
  },
  skeletonHeader: {
    flexDirection: 'row',
    gap: 8,
  },
  skeletonSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skeletonChip: {
    width: 80,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  group: {
    marginBottom: 32,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  groupLocation: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  groupService: {
    fontSize: 16,
    color: '#8E8E93',
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  slotChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginRight: 8,
    marginBottom: 8,
  },
  slotChipUnselected: {
    // Normal styling for unselected slots
  },
  slotChipSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
    marginRight: 0, // No right margin for continuous bar
  },
  slotChipStart: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0, // Remove right border for continuous effect
  },
  slotChipEnd: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderLeftWidth: 0, // Remove left border for continuous effect
    marginRight: 8, // Add margin after end slot to separate from next unselected
  },
  slotChipMiddle: {
    borderRadius: 0,
    borderLeftWidth: 0, // Remove left border for continuous effect
    borderRightWidth: 0, // Remove right border for continuous effect
  },
  slotChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  slotChipTextSelected: {
    color: '#fff',
  },
  summaryBar: {
    ...(Platform.OS === 'web' ? {
      position: 'fixed',
    } : {
      position: 'absolute',
    }),
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    zIndex: 50,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    }),
    ...(Platform.OS === 'web' && {
      boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
    }),
  },
  summaryBarContent: {
    maxWidth: 1280, // max-w-7xl equivalent (80rem = 1280px)
    marginHorizontal: 'auto',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
    ...(Platform.OS === 'web' && {
      paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
    }),
    ...(!isDesktop && {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 12,
      paddingTop: 16,
    }),
  },
  summaryInfo: {
    flexDirection: 'row',
    gap: 24,
    flex: 1,
    flexWrap: 'wrap',
  },
  summaryInfoMobile: {
    gap: 16,
    justifyContent: 'space-between',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  summaryTextMobile: {
    fontSize: 12,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    ...(!isDesktop && {
      width: '100%',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    }),
  },
  nextButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  nextButtonTextDisabled: {
    color: '#8E8E93',
  },
});
