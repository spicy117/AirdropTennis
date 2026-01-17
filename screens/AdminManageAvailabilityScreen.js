import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import BulkAvailabilityDrawer from '../components/BulkAvailabilityDrawer';
import AvailabilityEditModal from '../components/AvailabilityEditModal';
import BookingDetailsModal from '../components/BookingDetailsModal';
import BookingRequestsModal from '../components/BookingRequestsModal';
import ActiveBookingsModal from '../components/ActiveBookingsModal';
import { getSydneyToday, sydneyDateToUTCStart, sydneyDateToUTCEnd, sydneyDateTimeToUTC, getDayOfWeekFromDateString, addDaysToDateString, utcToSydneyDate, utcToSydneyTime } from '../utils/timezone';

export default function ManageAvailabilityScreen({ onNavigate }) {
  const { user, userRole } = useAuth();
  const [availabilities, setAvailabilities] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWeek, setLoadingWeek] = useState(false); // Separate loading state for week navigation
  const [selectedDate, setSelectedDate] = useState(getSydneyToday());
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [showBulkDrawer, setShowBulkDrawer] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render key
  const [bookingDetailsModalVisible, setBookingDetailsModalVisible] = useState(false);
  const [bookingDetails, setBookingDetails] = useState([]);
  const [loadingBookingDetails, setLoadingBookingDetails] = useState(false);
  const [selectedSlotInfo, setSelectedSlotInfo] = useState(null);
  const [listViewTab, setListViewTab] = useState('today'); // today, upcoming, past
  const [listViewAvailabilities, setListViewAvailabilities] = useState([]);
  const [loadingListView, setLoadingListView] = useState(false);
  const [requestsModalVisible, setRequestsModalVisible] = useState(false);
  const [activeBookingsModalVisible, setActiveBookingsModalVisible] = useState(false);
  const [unassignedBookingsCount, setUnassignedBookingsCount] = useState(0);

  useEffect(() => {
    loadData();
    checkMyRole(); // Check role on mount
    loadUnassignedBookingsCount();
    verifyAdminAccess(); // Verify admin access on mount
  }, []);

  const verifyAdminAccess = async () => {
    // Server-side verification: Ensure user is admin
    if (!user?.id) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error verifying admin access:', error);
        return;
      }

      // If not admin, redirect based on role
      if (!profile || profile.role !== 'admin') {
        if (profile?.role === 'coach') {
          // Redirect coaches to their dashboard
          Alert.alert(
            'Access Denied',
            'This page is only accessible to administrators. Redirecting to Coach Dashboard.',
            [{ text: 'OK' }]
          );
          // Navigation will be handled by HomeScreen based on role
        } else {
          // Redirect students to their dashboard
          Alert.alert(
            'Access Denied',
            'This page is only accessible to administrators.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error in verifyAdminAccess:', error);
    }
  };

  // Reload count when active bookings modal closes (coach may have been assigned)
  useEffect(() => {
    if (!activeBookingsModalVisible) {
      loadUnassignedBookingsCount();
    }
  }, [activeBookingsModalVisible]);

  // Periodically refresh the count (every 30 seconds) to catch changes from other sources
  useEffect(() => {
    const interval = setInterval(() => {
      loadUnassignedBookingsCount();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadUnassignedBookingsCount = async () => {
    // Only load count if user is admin
    if (userRole !== 'admin') {
      setUnassignedBookingsCount(0);
      return;
    }

    try {
      // Server-side verification: Check admin role before counting
      if (!user?.id) return;

      const { data: profile, error: roleError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (roleError || !profile || profile.role !== 'admin') {
        setUnassignedBookingsCount(0);
        return;
      }

      // Count bookings that have at least one student (all bookings have user_id) but have NULL coach_id
      const { count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .is('coach_id', null);

      if (error) throw error;
      setUnassignedBookingsCount(count || 0);
    } catch (error) {
      console.error('Error loading unassigned bookings count:', error);
      setUnassignedBookingsCount(0);
    }
  };

  const checkMyRole = async () => {
    try {
      // Check role from profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('Error checking role:', error);
        Alert.alert(
          'Role Check Failed',
          `Could not check your role: ${error.message}\n\nPlease run CHECK_MY_ROLE.sql in Supabase SQL Editor.`,
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Your current role:', profile?.role || 'Not set');
      
      if (!profile || !profile.role || (profile.role !== 'admin' && profile.role !== 'coach')) {
        Alert.alert(
          'Role Not Set',
          `Your role is: ${profile?.role || 'NOT SET'}\n\nYou need admin or coach role to access availabilities.\n\nRun this SQL to set your role:\n\nUPDATE public.profiles\nSET role = 'admin'\nWHERE id = '${user?.id}';\n\nOr run CHECK_MY_ROLE.sql file.`,
          [{ text: 'OK' }]
        );
      } else {
        console.log('✅ Role check passed:', profile.role);
      }
    } catch (error) {
      console.error('Error in checkMyRole:', error);
    }
  };

  // Load calendar availabilities when date or location changes
  useEffect(() => {
    console.log('useEffect triggered - loading calendar availabilities');
    if (selectedLocationId) {
      loadAvailabilities(); // Load for calendar (week view based on selectedDate)
    } else {
      setAvailabilities([]); // Clear calendar when "All" is selected
    }
  }, [selectedDate, selectedLocationId]);

  // Load list view availabilities when location changes (independent of calendar date)
  useEffect(() => {
    console.log('useEffect triggered - loading list view availabilities');
    loadAllAvailabilitiesForListView();
  }, [selectedLocationId]);

  useEffect(() => {
    // Update list view when availabilities change for specific location
    if (selectedLocationId && availabilities.length > 0) {
      setListViewAvailabilities(availabilities);
    }
  }, [selectedDate, selectedLocationId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load locations (excluding soft-deleted)
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('name');

      if (locationsError) {
        console.error('Error loading locations:', locationsError);
        console.error('Error details:', {
          message: locationsError.message,
          details: locationsError.details,
          hint: locationsError.hint,
          code: locationsError.code,
        });
        Alert.alert(
          'Error Loading Locations',
          locationsError.message + '\n\nCheck console for details. This might be an RLS policy issue.',
          [{ text: 'OK' }]
        );
      }

      console.log('Locations loaded:', locationsData);

      setLocations(locationsData || []);

      // Don't auto-select - let user choose "All" or a specific location
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailabilities = async (locationFilterOverride = null) => {
    try {
      // Use override if provided, otherwise use state
      const locationFilter = locationFilterOverride !== null ? locationFilterOverride : selectedLocationId;
      
      console.log('=== LOADING AVAILABILITIES ===');
      console.log('Selected date:', selectedDate);
      console.log('Selected location:', locationFilter);
      setLoading(true);
      
      // First check if table exists by trying a simple query
      let query = supabase
        .from('availabilities')
        .select('*')
        .limit(1);

      const { data: testData, error: testError } = await query;

      if (testError) {
        console.error('❌ Error accessing availabilities table:', testError);
        console.error('Error code:', testError.code);
        console.error('Error message:', testError.message);
        
        if (testError.code === 'PGRST116' || testError.message?.includes('relation') || testError.message?.includes('does not exist')) {
          Alert.alert(
            'Table Not Found',
            'The availabilities table does not exist. Please run the availabilities_migration.sql in Supabase SQL Editor first.',
            [{ text: 'OK' }]
          );
          setAvailabilities([]);
          setLoading(false);
          return;
        }
        throw testError;
      }
      
      console.log('✅ Table exists, test query successful');

      // Debug: Check if there are ANY availabilities in the database
      const { data: allAvailabilities, error: allError } = await supabase
        .from('availabilities')
        .select('id, start_time, location_id')
        .limit(10);
      
      if (!allError && allAvailabilities) {
        console.log(`📊 Total availabilities in DB (sample): ${allAvailabilities.length}`);
        if (allAvailabilities.length > 0) {
          console.log('Sample availability:', {
            id: allAvailabilities[0].id,
            start_time: allAvailabilities[0].start_time,
            location_id: allAvailabilities[0].location_id,
          });
        }
      }

      // Now do the full query - use simpler syntax without joins for now
      query = supabase
        .from('availabilities')
        .select('*')
        .order('start_time', { ascending: true });

      // Filter by date (current week) - selectedDate is in Sydney local time
      // Convert Sydney local week range to UTC for database query
      
      // Get day of week using utility function (treats date as Sydney local)
      const dayOfWeek = getDayOfWeekFromDateString(selectedDate);
      
      // Calculate start of week in Sydney local time (Sunday = 0)
      // Use date string arithmetic to avoid timezone issues
      const startOfWeekStr = addDaysToDateString(selectedDate, -dayOfWeek);
      
      // Calculate end of week in Sydney local time (7 days later)
      const endOfWeekStr = addDaysToDateString(startOfWeekStr, 7);
      
      // Convert Sydney local dates to UTC for database query
      const startOfWeek = sydneyDateToUTCStart(startOfWeekStr);
      const endOfWeek = sydneyDateToUTCEnd(endOfWeekStr);

      console.log('Query date range:', startOfWeek.toISOString(), 'to', endOfWeek.toISOString());
      console.log('Selected date (Sydney local):', selectedDate);

      // Query for availabilities that start within the week
      // Use gte and lte to include the full range
      query = query
        .gte('start_time', startOfWeek.toISOString())
        .lte('start_time', endOfWeek.toISOString());

      // Filter by location (required - no "All" option)
      if (!locationFilter) {
        console.log('No location selected, skipping availability load');
        setAvailabilities([]);
        setLoading(false);
        setLoadingWeek(false);
        return;
      }
      
      query = query.eq('location_id', locationFilter);
      console.log('Filtering by location:', locationFilter);

      console.log('Executing query with filters...');
      const { data, error } = await query;
      
      console.log('=== QUERY RESULT ===');
      console.log('Availabilities found:', data?.length || 0);
      console.log('Error:', error ? error.message : 'None');

      if (error) {
        console.error('❌ Error loading availabilities:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          status: error.status,
        });
        
        // Check for 403 (Forbidden) - RLS policy issue
        if (error.code === '42501' || error.status === 403 || error.message?.includes('permission denied')) {
          Alert.alert(
            'Permission Denied (403)',
            'Your user role may not be set correctly, or RLS policies need to be updated.\n\n' +
            'Please:\n' +
            '1. Verify your user has admin/coach role in Supabase\n' +
            '2. Run fix_availabilities_rls_v2.sql in Supabase SQL Editor\n\n' +
            'File: UserApp/supabase/fix_availabilities_rls_v2.sql',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Error Loading Availabilities',
            error.message + '\n\nCheck console for details.',
            [{ text: 'OK' }]
          );
        }
        // Don't clear availabilities on error - keep previous data visible
        // setAvailabilities([]);
        setLoading(false);
        setLoadingWeek(false); // Clear week loading state
        return;
      }

      const availabilitiesData = data || [];
      console.log('=== SETTING AVAILABILITIES ===');
      console.log('Total items:', availabilitiesData.length);
      
      if (availabilitiesData.length === 0) {
        console.warn('⚠️ No availabilities found for the selected week/location');
        console.log('This could mean:');
        console.log('  1. No availabilities exist in the database');
        console.log('  2. All availabilities are outside the selected week');
        console.log('  3. Location filter is excluding all availabilities');
        console.log('  4. RLS policies are blocking access');
      }
      
      // OPTIMIZATION: Fetch all bookings for the week and all locations at once
      // This is much more efficient than fetching bookings per availability
      const locationIds = availabilitiesData.length > 0 
        ? [...new Set(availabilitiesData.map(av => av.location_id))] 
        : [];
      
      let allBookings = [];
      if (locationIds.length > 0) {
        // Fetch all bookings for all locations in the week range
        // Use a wider time range to catch any bookings that might overlap
        const extendedStart = new Date(startOfWeek.getTime() - 24 * 60 * 60 * 1000); // 1 day before
        const extendedEnd = new Date(endOfWeek.getTime() + 24 * 60 * 60 * 1000); // 1 day after
        
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('location_id, start_time, end_time')
          .in('location_id', locationIds)
          .gte('start_time', extendedStart.toISOString())
          .lte('start_time', extendedEnd.toISOString());

        if (bookingsError) {
          console.error('Error fetching bookings:', bookingsError);
        } else {
          allBookings = bookingsData || [];
          console.log(`Fetched ${allBookings.length} bookings for ${locationIds.length} locations`);
        }
      }
      
      // Now match bookings to availabilities in memory (much faster)
      const availabilitiesWithCounts = availabilitiesData.map((availability) => {
        try {
          const availabilityStart = new Date(availability.start_time);
          const availabilityEnd = new Date(availability.end_time);
          
          // Filter bookings that overlap with this availability slot
          const overlappingBookings = allBookings.filter((booking) => {
            // Only check bookings for the same location
            if (booking.location_id !== availability.location_id) {
              return false;
            }
            
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            
            // Check if booking overlaps with availability slot
            // Overlap occurs when: bookingStart < availabilityEnd AND bookingEnd > availabilityStart
            return bookingStart < availabilityEnd && bookingEnd > availabilityStart;
          });

          const bookingCount = overlappingBookings.length;
          // Use max_capacity from availability, default to 10 if not set
          const MAX_CAPACITY = availability.max_capacity || 10;
          // Update is_booked based on actual booking count
          const isFullyBooked = bookingCount >= MAX_CAPACITY;

          return {
            ...availability,
            booking_count: bookingCount,
            is_booked: isFullyBooked, // Update is_booked based on count
          };
        } catch (error) {
          console.error('Error processing availability:', availability.id, error);
          return { ...availability, booking_count: 0 };
        }
      });

      // Update availabilities in database if is_booked status changed
      // Only update if the actual status differs from what's in the database
      for (const availability of availabilitiesWithCounts) {
        const shouldBeBooked = availability.booking_count >= 10;
        // Only update if the status actually changed
        if (availability.is_booked !== shouldBeBooked) {
          try {
            await supabase
              .from('availabilities')
              .update({ is_booked: shouldBeBooked })
              .eq('id', availability.id);
          } catch (updateError) {
            console.error('Error updating availability status:', availability.id, updateError);
          }
        }
      }
      
      // Group by location for debugging
      const byLocation = {};
      availabilitiesWithCounts.forEach((av) => {
        const locId = av.location_id;
        if (!byLocation[locId]) {
          byLocation[locId] = [];
        }
        byLocation[locId].push(av);
      });
      console.log('Availabilities by location:');
      if (Object.keys(byLocation).length === 0) {
        console.log('  (none)');
      } else {
        Object.entries(byLocation).forEach(([locId, avs]) => {
          const locName = locations.find((l) => l.id === locId)?.name || 'Unknown';
          console.log(`  ${locName}: ${avs.length} slots`);
        });
      }
      
      if (availabilitiesWithCounts.length > 0) {
        console.log('Sample availability:', {
          id: availabilitiesWithCounts[0].id,
          location_id: availabilitiesWithCounts[0].location_id,
          start_time: availabilitiesWithCounts[0].start_time,
          is_booked: availabilitiesWithCounts[0].is_booked,
          booking_count: availabilitiesWithCounts[0].booking_count,
        });
      }
      
      // Force update by creating a new array reference
      setAvailabilities([...availabilitiesWithCounts]);
      console.log('✅ Availabilities state updated with booking counts');
      
      setLoading(false);
      setLoadingWeek(false); // Clear week loading state
      
      // Only update refresh key when absolutely necessary (e.g., after bulk create)
      // Don't update it on every load to prevent unnecessary remounts
    } catch (error) {
      console.error('Error loading availabilities:', error);
      Alert.alert('Error', 'Error loading availabilities: ' + error.message);
      // Don't clear availabilities on error - keep previous data visible
      // setAvailabilities([]);
      setLoading(false);
      setLoadingWeek(false); // Clear week loading state
    }
  };

  const loadBookingDetails = async (slot) => {
    try {
      setLoadingBookingDetails(true);
      setSelectedSlotInfo({
        date: slot.date,
        time: slot.time,
      });

      // Find matching availabilities for this slot
      const matchingAvailabilities = availabilities.filter((av) => {
        const avDateStr = utcToSydneyDate(av.start_time);
        const avTimeStr = utcToSydneyTime(av.start_time);
        return avDateStr === slot.date && avTimeStr === slot.time;
      });

      if (matchingAvailabilities.length === 0) {
        setBookingDetails([]);
        setBookingDetailsModalVisible(true);
        setLoadingBookingDetails(false);
        return;
      }

      // Get all location IDs for this slot
      const locationIds = matchingAvailabilities.map(av => av.location_id);
      
      // Get the time range from the first availability
      const firstAvailability = matchingAvailabilities[0];
      const availabilityStart = new Date(firstAvailability.start_time);
      const availabilityEnd = new Date(firstAvailability.end_time);

      // Fetch all bookings that overlap with this availability slot
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .in('location_id', locationIds);

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        setBookingDetails([]);
        setBookingDetailsModalVisible(true);
        setLoadingBookingDetails(false);
        return;
      }

      // Filter bookings that overlap with the availability slot
      const overlappingBookings = (bookingsData || []).filter((booking) => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        // Overlap occurs when: bookingStart < availabilityEnd AND bookingEnd > availabilityStart
        return bookingStart < availabilityEnd && bookingEnd > availabilityStart;
      });

      // Fetch details for each booking
      const bookingsWithDetails = await Promise.all(
        overlappingBookings.map(async (booking) => {
          // Fetch location
          let locationName = 'Unknown Location';
          if (booking.location_id) {
            try {
              const { data: location, error: locError } = await supabase
                .from('locations')
                .select('name')
                .eq('id', booking.location_id)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .single();
              if (!locError && location) {
                locationName = location.name;
              }
            } catch (err) {
              console.error('Error fetching location:', err);
            }
          }

          // Fetch user profile (student name)
          let studentFirstName = null;
          let studentLastName = null;
          let studentName = 'Unknown Student';
          if (booking.user_id) {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('first_name, last_name, email')
                .eq('id', booking.user_id)
                .single();
              if (!profileError && profile) {
                studentFirstName = profile.first_name || null;
                studentLastName = profile.last_name || null;
                
                // Build full name from first_name and last_name
                if (studentFirstName || studentLastName) {
                  studentName = [studentFirstName, studentLastName]
                    .filter(Boolean)
                    .join(' ');
                } else {
                  // Fallback to email if no name available
                  studentName = profile.email || 'Unknown Student';
                }
              }
            } catch (err) {
              console.error('Error fetching profile:', err);
            }
          }

          return {
            ...booking,
            locationName,
            studentName,
          };
        })
      );

      // Sort bookings by student name for easier scanning
      const sortedBookings = bookingsWithDetails.sort((a, b) => {
        const nameA = (a.studentName || '').toLowerCase();
        const nameB = (b.studentName || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setBookingDetails(sortedBookings);
      setBookingDetailsModalVisible(true);
    } catch (error) {
      console.error('Error loading booking details:', error);
      Alert.alert('Error', 'Failed to load booking details: ' + error.message);
      setBookingDetails([]);
    } finally {
      setLoadingBookingDetails(false);
    }
  };

  const handleSlotClick = (slot) => {
    if (slot.status === 'empty') {
      // Create new availability
      createAvailability(slot);
    } else if (slot.status === 'partially_booked') {
      // Load and show booking details for partially booked slots
      loadBookingDetails(slot);
    } else if (slot.status === 'available' || slot.status === 'booked') {
      // Find ALL availabilities for this time slot (same date and time, all locations)
      console.log('=== FINDING MATCHING AVAILABILITIES ===');
      console.log('Slot date:', slot.date);
      console.log('Slot time:', slot.time);
      console.log('Total availabilities in state:', availabilities.length);
      
      const matchingAvailabilities = availabilities.filter((av) => {
        const avStart = new Date(av.start_time);
        const avDateStr = avStart.toISOString().split('T')[0];
        const avTimeStr = avStart.toTimeString().substring(0, 5);
        
        const matches = (
          avDateStr === slot.date &&
          avTimeStr === slot.time
        );
        
        if (matches) {
          console.log('Found matching availability:', av.id, 'location:', av.location_id);
        }
        
        return matches;
      });
      
      console.log(`Found ${matchingAvailabilities.length} matching availabilities`);
      console.log('Location IDs:', matchingAvailabilities.map(av => av.location_id));
      
      if (matchingAvailabilities.length > 0) {
        // Use the first one as the primary (for service name, etc.)
        // But we'll pass all location IDs to the modal
        const primaryAvailability = matchingAvailabilities[0];
        const allLocationIds = matchingAvailabilities.map(av => av.location_id);
        
        console.log('Creating availabilityWithAllLocations with', allLocationIds.length, 'location IDs');
        
        // Add all location IDs to the availability object
        const availabilityWithAllLocations = {
          ...primaryAvailability,
          allLocationIds: allLocationIds,
        };
        
        console.log('Setting selectedAvailability with allLocationIds:', availabilityWithAllLocations.allLocationIds);
        setSelectedAvailability(availabilityWithAllLocations);
        setEditModalVisible(true);
      } else {
        console.warn('Availability not found for slot:', slot);
      }
    }
  };

  const handleQuickDelete = async (availability) => {
    if (availability.is_booked) {
      Alert.alert('Cannot Delete', 'This availability is booked and cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Availability',
      'Are you sure you want to delete this availability slot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('availabilities')
                .delete()
                .eq('id', availability.id);

              if (error) throw error;
              
              Alert.alert('Success', 'Availability deleted successfully');
              loadAvailabilities();
            } catch (error) {
              console.error('Error deleting availability:', error);
              Alert.alert('Error', 'Error deleting availability: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const createAvailability = async (slot) => {
    if (!selectedLocationId) {
      Alert.alert('Location Required', 'Please select a location first');
      return;
    }

    // slot.date and slot.time are in Sydney local time
    // slot.datetime is already converted to UTC ISO string by calendar component
    const startTime = new Date(slot.datetime);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // Add 30 minutes

    try {
      const { data, error } = await supabase
        .from('availabilities')
        .insert({
          location_id: selectedLocationId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          service_name: null,
          is_booked: false,
          max_capacity: 10, // Default capacity for individually created slots
        })
        .select();

      if (error) {
        console.error('Error creating availability:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          status: error.status,
        });
        
        // Check if table doesn't exist
        if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.code === 'PGRST116') {
          Alert.alert(
            'Table Not Found',
            'The availabilities table does not exist. Please run the availabilities_migration.sql in Supabase SQL Editor first.\n\nFile: UserApp/supabase/availabilities_migration.sql',
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Check for 403 (Forbidden) - RLS policy issue
        if (error.code === '42501' || error.status === 403 || error.message?.includes('permission denied')) {
          Alert.alert(
            'Permission Denied (403)',
            'You do not have permission to access availabilities. This is likely an RLS policy issue.\n\n' +
            'Please:\n' +
            '1. Verify your user has admin/coach role in the profiles table\n' +
            '2. Run fix_availabilities_rls_v3.sql in Supabase SQL Editor\n\n' +
            'File: UserApp/supabase/fix_availabilities_rls_v3.sql',
            [{ text: 'OK' }]
          );
          return;
        }
        
        Alert.alert('Error', 'Error creating availability: ' + error.message);
        return;
      }

      console.log('Availability created:', data);
      loadAvailabilities();
    } catch (error) {
      console.error('Error creating availability:', error);
      Alert.alert('Error', 'Error creating availability: ' + error.message);
    }
  };

  const handleBulkCreate = async (formData) => {
    try {
      console.log('=== BULK CREATE STARTED ===');
      console.log('Form Data:', JSON.stringify(formData, null, 2));
      
      if (!formData.startDate || !formData.endDate) {
        const error = new Error('Please provide start and end dates');
        Alert.alert('Error', error.message);
        throw error;
      }

      // Parse dates as Sydney local time (formData dates are in Sydney local)
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(formData.startDate) || !dateRegex.test(formData.endDate)) {
        const error = new Error('Invalid date format. Please use YYYY-MM-DD format.');
        Alert.alert('Error', error.message);
        throw error;
      }
      
      console.log('Start Date (Sydney local):', formData.startDate);
      console.log('End Date (Sydney local):', formData.endDate);
      
      // Compare date strings directly (YYYY-MM-DD format is sortable)
      if (formData.startDate > formData.endDate) {
        const error = new Error('Start date must be before or equal to end date.');
        Alert.alert('Error', error.message);
        throw error;
      }

      const [startHour, startMinute] = formData.startTime.split(':').map(Number);
      const [endHour, endMinute] = formData.endTime.split(':').map(Number);
      
      console.log('Time Window:', `${startHour}:${startMinute} - ${endHour}:${endMinute}`);

      const dayMap = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 0,
      };

      const selectedDays = Object.entries(formData.daysOfWeek)
        .filter(([_, selected]) => selected)
        .map(([day, _]) => dayMap[day]);

      console.log('Selected Days:', selectedDays);

      if (selectedDays.length === 0) {
        const error = new Error('Please select at least one day of the week');
        Alert.alert('Error', error.message);
        throw error;
      }

      // Determine which locations to use - allow multiple locations per time slot
      const selectedLocationIds = formData.selectedLocationIds || [];
      const targetLocations = locations.filter((l) => selectedLocationIds.includes(l.id));

      console.log('Selected Location IDs:', selectedLocationIds);
      console.log('Target Locations:', targetLocations.map(l => l.name));

      if (targetLocations.length === 0) {
        const error = new Error('No locations selected.');
        Alert.alert('Error', error.message);
        throw error;
      }

      const slots = [];
      
      // Helper function to compare date strings (YYYY-MM-DD format is sortable)
      const dateStrLessOrEqual = (dateStr1, dateStr2) => {
        return dateStr1 <= dateStr2;
      };

      console.log('Processing dates from', formData.startDate, 'to', formData.endDate, '(Sydney local)');

      let currentDateStr = formData.startDate;
      
      while (dateStrLessOrEqual(currentDateStr, formData.endDate)) {
        // Calculate day of week using the utility function (treats date as Sydney local)
        const dayOfWeek = getDayOfWeekFromDateString(currentDateStr);
        
        if (selectedDays.includes(dayOfWeek)) {
          console.log(`Processing ${currentDateStr} (day ${dayOfWeek}, Sydney local)`);
          
          // Generate 30-minute slots within the time window (in Sydney local time)
          let currentHour = startHour;
          let currentMinute = startMinute;
          
          while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
            // Convert current Sydney local time to UTC
            const slotStartUTC = sydneyDateTimeToUTC(currentDateStr, currentHour, currentMinute);
            
            // Calculate end time (30 minutes later) in Sydney local time
            let endHourLocal = currentHour;
            let endMinuteLocal = currentMinute + 30;
            if (endMinuteLocal >= 60) {
              endMinuteLocal = endMinuteLocal % 60;
              endHourLocal = currentHour + 1;
            }
            const slotEndUTC = sydneyDateTimeToUTC(currentDateStr, endHourLocal, endMinuteLocal);
            
            // Create slots for each selected location (allowing multiple locations per time slot)
            for (const location of targetLocations) {
              const slot = {
                location_id: location.id,
                start_time: slotStartUTC,
                end_time: slotEndUTC,
                service_name: formData.serviceName || null,
                is_booked: false,
                max_capacity: parseInt(formData.maxCapacity || '10', 10), // Use capacity from form, default to 10
              };
              slots.push(slot);
            }

            // Move to next 30-minute slot in Sydney local time
            currentMinute += 30;
            if (currentMinute >= 60) {
              currentMinute = 0;
              currentHour += 1;
            }
          }
          
          console.log(`Created ${targetLocations.length} slots for ${currentDateStr}`);
        }
        
        // Move to next day (using date string manipulation)
        currentDateStr = addDaysToDateString(currentDateStr, 1);
      }

      console.log('=== TOTAL SLOTS GENERATED ===');
      console.log('Total slots:', slots.length);
      console.log('Slots per location:', targetLocations.length);
      console.log('Expected total:', slots.length, 'slots');

      if (slots.length === 0) {
        const error = new Error('No availability slots match your criteria. Please check your date range and time window.');
        Alert.alert('No Slots', error.message);
        throw error;
      }

      // Insert in batches to avoid overwhelming the database
      const batchSize = 50;
      let totalCreated = 0;
      let errors = [];

      for (let i = 0; i < slots.length; i += batchSize) {
        const batch = slots.slice(i, i + batchSize);
        
        // Ensure all times are on 30-minute increments
        const processedBatch = batch.map((slot) => {
          const start = new Date(slot.start_time);
          const end = new Date(slot.end_time);
          
          // Round to 30-minute increments
          if (start.getMinutes() % 30 !== 0) {
            start.setMinutes(Math.floor(start.getMinutes() / 30) * 30, 0, 0);
          }
          if (end.getMinutes() % 30 !== 0) {
            end.setMinutes(Math.floor(end.getMinutes() / 30) * 30, 0, 0);
          }
          
          return {
            ...slot,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
          };
        });

        console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(slots.length / batchSize)} (${processedBatch.length} slots)`);
        console.log('Batch sample (first slot):', JSON.stringify(processedBatch[0], null, 2));

        // Try inserting with max_capacity first
        let { data, error } = await supabase
          .from('availabilities')
          .insert(processedBatch)
          .select();
        
        // If max_capacity column doesn't exist, retry without it
        if (error && error.code === 'PGRST204' && error.message?.includes('max_capacity')) {
          console.log('max_capacity column not found, retrying without it...');
          const batchWithoutMaxCapacity = processedBatch.map(({ max_capacity, ...slot }) => slot);
          const retryResult = await supabase
            .from('availabilities')
            .insert(batchWithoutMaxCapacity)
            .select();
          data = retryResult.data;
          error = retryResult.error;
        }
        
        console.log(`=== BATCH ${Math.floor(i / batchSize) + 1} RESULT ===`);
        console.log('Data returned:', data ? `${data.length} rows` : 'null');
        console.log('Error:', error ? JSON.stringify(error, null, 2) : 'none');
        if (data && data.length > 0) {
          console.log('First inserted row:', JSON.stringify(data[0], null, 2));
        }

        if (error) {
          console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
          });
          
          // Check if table doesn't exist
          if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.code === 'PGRST116') {
            const tableError = new Error('The availabilities table does not exist. Please run the availabilities_migration.sql in Supabase SQL Editor first.\n\nFile: UserApp/supabase/availabilities_migration.sql');
            Alert.alert('Table Not Found', tableError.message);
            throw tableError;
          }
          
          // Check for permission denied
          if (error.code === '42501' || error.message?.includes('permission denied')) {
            const permError = new Error('You do not have permission to create availabilities. Please:\n\n' +
              '1. Verify your user has admin/coach role\n' +
              '2. Run fix_availabilities_rls_v3.sql in Supabase SQL Editor\n\n' +
              'File: UserApp/supabase/fix_availabilities_rls_v3.sql');
            Alert.alert('Permission Denied', permError.message);
            throw permError;
          }
          
          errors.push(error.message);
        } else {
          totalCreated += processedBatch.length;
          console.log(`Batch ${Math.floor(i / batchSize) + 1} inserted successfully`);
        }
      }

      console.log('Bulk create completed. Total created:', totalCreated, 'Errors:', errors.length);
      
      // Update selectedDate to the start date of the created availabilities
      // This ensures the calendar shows the week where the new availabilities were created
      if (totalCreated > 0 && formData.startDate) {
        console.log('Updating selectedDate to show created availabilities:', formData.startDate);
        setSelectedDate(formData.startDate);
        // Wait a moment for state to update, then refresh
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // If multiple locations were created, reset location filter to show all locations
      // This ensures all newly created availabilities are visible
      if (formData.selectedLocationIds?.length > 1 && totalCreated > 0) {
        console.log('Multiple locations created, resetting location filter to show all locations');
        setSelectedLocationId(null);
      }
      
      // Refresh immediately - loadAvailabilities uses selectedDate which we just updated
      console.log('Refreshing availabilities immediately...');
      setLoading(true);
      await loadAvailabilities();
      setLoading(false);
      console.log('Availabilities refreshed');
      
      // Update refresh key after bulk create to ensure calendar updates
      setRefreshKey((prev) => prev + 1);
      
      // Force a second refresh after a short delay to ensure data is loaded
      setTimeout(async () => {
        console.log('Second refresh to ensure data is loaded...');
        setLoading(true);
        await loadAvailabilities();
        setLoading(false);
        console.log('Second refresh completed');
      }, 1000);
      
      // Show success/failure message immediately (don't wait for refresh)
      // This ensures the user sees feedback right away
      if (totalCreated === 0) {
        const error = new Error('No availability slots were created. Please check:\n\n' +
          '• Date range is valid\n' +
          '• Days of week are selected\n' +
          '• Time window is valid\n' +
          '• Locations are selected');
        Alert.alert('No Slots Created', error.message);
        throw error;
      } else if (errors.length > 0) {
        Alert.alert(
          'Partial Success ⚠️',
          `Created ${totalCreated} out of ${slots.length} availability slots.\n\nSome errors occurred:\n\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`,
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('User acknowledged partial success');
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Success! ✅',
          `Successfully created ${totalCreated} availability slot${totalCreated !== 1 ? 's' : ''}${formData.selectedLocationIds?.length > 1 ? ` across ${formData.selectedLocationIds.length} locations` : ''}!\n\nThe calendar has been updated with the new availability.`,
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('User acknowledged success');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error creating bulk availability:', error);
      
      let errorMessage = 'An error occurred while creating availability.';
      let errorTitle = 'Error ❌';
      
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.code === 'PGRST116') {
        errorTitle = 'Table Not Found';
        errorMessage = 'The availabilities table does not exist. Please run the availabilities_migration.sql in Supabase SQL Editor first.\n\nFile: UserApp/supabase/availabilities_migration.sql';
      } else if (error.code === '42501' || error.message?.includes('permission denied')) {
        errorTitle = 'Permission Denied';
        errorMessage = 'You do not have permission to create availabilities. Please:\n\n' +
          '1. Verify your user has admin/coach role\n' +
          '2. Run fix_availabilities_rls_simple.sql in Supabase SQL Editor\n\n' +
          'File: UserApp/supabase/fix_availabilities_rls_simple.sql';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        errorTitle,
        errorMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('User acknowledged error');
            },
          },
        ]
      );
    }
  };

  const handleUpdateAvailability = async (updatedAvailability) => {
    try {
      const { error } = await supabase
        .from('availabilities')
        .update({
          service_name: updatedAvailability.service_name,
          location_id: updatedAvailability.location_id,
        })
        .eq('id', updatedAvailability.id);

      if (error) throw error;
      loadAvailabilities();
    } catch (error) {
      console.error('Error updating availability:', error);
      alert('Error updating availability: ' + error.message);
    }
  };

  const handleDeleteAvailability = async (availabilityId, availability = null) => {
    try {
      console.log('=== DELETE AVAILABILITY STARTED ===');
      console.log('Availability ID:', availabilityId);
      console.log('Availability object:', availability);
      
      // If availability has multiple locations, delete all matching availabilities for that time slot
      if (availability && availability.allLocationIds && availability.allLocationIds.length > 1) {
        console.log('Multiple locations detected, querying database for all matching availabilities...');
        console.log('All location IDs to delete:', availability.allLocationIds);
        console.log('Start time:', availability.start_time);
        console.log('End time:', availability.end_time);
        
        // Query database directly to find all matching availabilities for this time slot
        // Use a small time range to account for any timestamp precision differences
        const availabilityStart = new Date(availability.start_time);
        const availabilityEnd = new Date(availability.end_time);
        
        // Create a small window (1 second) to account for any precision differences
        const startTimeMin = new Date(availabilityStart.getTime() - 1000);
        const startTimeMax = new Date(availabilityStart.getTime() + 1000);
        const endTimeMin = new Date(availabilityEnd.getTime() - 1000);
        const endTimeMax = new Date(availabilityEnd.getTime() + 1000);
        
        console.log('Querying with time range:', {
          startTimeMin: startTimeMin.toISOString(),
          startTimeMax: startTimeMax.toISOString(),
          endTimeMin: endTimeMin.toISOString(),
          endTimeMax: endTimeMax.toISOString(),
        });
        
        // Find all availabilities with the same start_time and end_time (same time slot)
        // Also filter by the location IDs we know about
        const { data: matchingAvailabilities, error: queryError } = await supabase
          .from('availabilities')
          .select('id, location_id, is_booked, start_time, end_time')
          .gte('start_time', startTimeMin.toISOString())
          .lte('start_time', startTimeMax.toISOString())
          .gte('end_time', endTimeMin.toISOString())
          .lte('end_time', endTimeMax.toISOString())
          .in('location_id', availability.allLocationIds)
          .eq('is_booked', false); // Only delete unbooked ones

        if (queryError) {
          console.error('Error querying matching availabilities:', queryError);
          throw queryError;
        }

        console.log(`Found ${matchingAvailabilities?.length || 0} matching availabilities to delete:`, matchingAvailabilities);

        if (matchingAvailabilities && matchingAvailabilities.length > 0) {
          const idsToDelete = matchingAvailabilities.map(av => av.id);
          console.log(`Deleting ${idsToDelete.length} availabilities:`, idsToDelete);
          
          const { data, error } = await supabase
            .from('availabilities')
            .delete()
            .in('id', idsToDelete)
            .select();

          console.log('Delete result:', { data, error });

          if (error) {
            console.error('Delete error:', error);
            throw error;
          }
          
          console.log(`✅ Successfully deleted ${idsToDelete.length} availability slot(s)`);
          Alert.alert('Success', `Successfully deleted ${idsToDelete.length} availability slot(s).`);
        } else {
          console.log('No matching availabilities found in database, trying to delete by location IDs and time...');
          // Try deleting directly by location IDs and time
          const { data, error } = await supabase
            .from('availabilities')
            .delete()
            .in('location_id', availability.allLocationIds)
            .gte('start_time', startTimeMin.toISOString())
            .lte('start_time', startTimeMax.toISOString())
            .eq('is_booked', false)
            .select();

          console.log('Direct delete result:', { data, error });

          if (error) {
            console.error('Delete error:', error);
            throw error;
          }
          
          const deletedCount = data?.length || 0;
          console.log(`✅ Successfully deleted ${deletedCount} availability slot(s) directly`);
          Alert.alert('Success', `Successfully deleted ${deletedCount} availability slot(s).`);
        }
      } else {
        console.log('Single location delete');
        // Single availability delete
        const { data, error } = await supabase
          .from('availabilities')
          .delete()
          .eq('id', availabilityId)
          .select();

        console.log('Delete result:', { data, error });

        if (error) {
          console.error('Delete error:', error);
          throw error;
        }
        
        console.log('✅ Successfully deleted availability');
        Alert.alert('Success', 'Successfully deleted availability.');
      }

      // Refresh the availabilities list
      console.log('Refreshing availabilities...');
      await loadAvailabilities();
      console.log('✅ Availabilities refreshed');
    } catch (error) {
      console.error('❌ Error deleting availability:', error);
      Alert.alert('Error', 'Failed to delete availability: ' + (error.message || 'Unknown error'));
      throw error; // Re-throw so modal doesn't close on error
    }
  };

  const navigateWeek = (direction) => {
    // Set loading state immediately for better UX
    setLoadingWeek(true);
    
    // Parse selectedDate as Sydney local date
    const [year, month, day] = selectedDate.split('-').map(Number);
    const current = new Date(year, month - 1, day, 0, 0, 0, 0);
    current.setDate(current.getDate() + (direction * 7));
    const newYear = current.getFullYear();
    const newMonth = String(current.getMonth() + 1).padStart(2, '0');
    const newDay = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${newYear}-${newMonth}-${newDay}`);
    // Note: loadingWeek will be set to false when loadAvailabilities completes
  };

  const loadAllAvailabilitiesForListView = async () => {
    setLoadingListView(true);
    
    try {
      let query = supabase
        .from('availabilities')
        .select('*')
        .order('start_time', { ascending: true });
      
      // Filter by location if one is selected, otherwise load all
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }
      
      const { data: availabilitiesData, error: availabilitiesError } = await query;
      
      if (availabilitiesError) {
        console.error('Error loading availabilities for list:', availabilitiesError);
        setListViewAvailabilities([]);
        setLoadingListView(false);
        return;
      }
      
      // Get booking counts for all availabilities
      const locationIds = selectedLocationId 
        ? [selectedLocationId]
        : [...new Set((availabilitiesData || []).map(av => av.location_id))];
      
      let allBookings = [];
      
      if (locationIds.length > 0) {
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('location_id, start_time, end_time')
          .in('location_id', locationIds);
        
        allBookings = bookingsData || [];
      }
      
      const availabilitiesWithCounts = (availabilitiesData || []).map((availability) => {
        const availabilityStart = new Date(availability.start_time);
        const availabilityEnd = new Date(availability.end_time);
        
        const overlappingBookings = allBookings.filter((booking) => {
          if (booking.location_id !== availability.location_id) return false;
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);
          return bookingStart < availabilityEnd && bookingEnd > availabilityStart;
        });
        
        const bookingCount = overlappingBookings.length;
        const MAX_CAPACITY = availability.max_capacity || 10;
        const isFullyBooked = bookingCount >= MAX_CAPACITY;
        
        return {
          ...availability,
          booking_count: bookingCount,
          is_booked: isFullyBooked,
        };
      });
      
      setListViewAvailabilities(availabilitiesWithCounts);
    } catch (error) {
      console.error('Error loading availabilities for list:', error);
      setListViewAvailabilities([]);
    } finally {
      setLoadingListView(false);
    }
  };

  const updateListView = () => {
    const now = new Date();
    const todayStr = getSydneyToday();
    const todayStart = sydneyDateToUTCStart(todayStr);
    const todayEnd = sydneyDateToUTCEnd(todayStr);
    
    const sourceAvailabilities = selectedLocationId ? availabilities : listViewAvailabilities;
    
    if (!sourceAvailabilities || sourceAvailabilities.length === 0) {
      return;
    }
    
    const filtered = sourceAvailabilities.filter((availability) => {
      const startTime = new Date(availability.start_time);
      
      if (listViewTab === 'today') {
        return startTime >= todayStart && startTime <= todayEnd;
      } else if (listViewTab === 'upcoming') {
        return startTime > now;
      } else if (listViewTab === 'past') {
        return startTime < now;
      }
      return false;
    }).sort((a, b) => {
      return new Date(a.start_time) - new Date(b.start_time);
    });
    
    // Store filtered results - but we need a separate state for this
    // Actually, let's just filter in getFilteredAvailabilitiesForList
  };

  const getFilteredAvailabilitiesForList = () => {
    const now = new Date();
    const todayStr = getSydneyToday();
    const todayStart = sydneyDateToUTCStart(todayStr);
    const todayEnd = sydneyDateToUTCEnd(todayStr);
    
    const sourceAvailabilities = selectedLocationId ? availabilities : listViewAvailabilities;
    
    if (!sourceAvailabilities || sourceAvailabilities.length === 0) return [];
    
    return sourceAvailabilities.filter((availability) => {
      const startTime = new Date(availability.start_time);
      
      if (listViewTab === 'today') {
        return startTime >= todayStart && startTime <= todayEnd;
      } else if (listViewTab === 'upcoming') {
        return startTime > now;
      } else if (listViewTab === 'past') {
        return startTime < now;
      }
      return false;
    }).sort((a, b) => {
      return new Date(a.start_time) - new Date(b.start_time);
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => {
          loadAvailabilities();
          loadData();
          loadUnassignedBookingsCount();
        }} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Manage Availability & Bookings</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.requestsButton}
            onPress={() => setRequestsModalVisible(true)}
          >
            <Ionicons name="document-text-outline" size={20} color="#007AFF" />
            <Text style={styles.requestsButtonText}>Requests</Text>
          </TouchableOpacity>
          {userRole === 'admin' && (
            <>
              <TouchableOpacity
                style={styles.activeBookingsButton}
                onPress={() => setActiveBookingsModalVisible(true)}
              >
                <View style={styles.activeBookingsButtonContent}>
                  <Ionicons name="calendar-outline" size={20} color="#34C759" />
                  <Text style={styles.activeBookingsButtonText}>Active Bookings</Text>
                </View>
                {unassignedBookingsCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unassignedBookingsCount > 99 ? '99+' : unassignedBookingsCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => onNavigate && onNavigate('admin-history')}
              >
                <View style={styles.historyButtonContent}>
                  <Ionicons name="time-outline" size={20} color="#007AFF" />
                  <Text style={styles.historyButtonText}>View Past Sessions</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.bulkButton}
            onPress={() => setShowBulkDrawer(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.bulkButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Location Filter */}
      <View style={styles.filters}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Location:</Text>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                !selectedLocationId && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedLocationId(null)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  !selectedLocationId && styles.filterButtonTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {locations.map((location) => (
              <TouchableOpacity
                key={location.id}
                style={[
                  styles.filterButton,
                  selectedLocationId === location.id && styles.filterButtonActive,
                ]}
                onPress={() => {
                  setSelectedLocationId(location.id);
                }}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selectedLocationId === location.id && styles.filterButtonTextActive,
                  ]}
                >
                  {location.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </View>

      {/* Calendar and List View Container */}
      <View style={styles.calendarListViewContainer}>
        {/* Calendar - Always render to prevent disappearing */}
        <View style={styles.calendarWrapper}>
          {/* Week Navigation - inside white calendar container */}
          <View style={styles.weekNav}>
            <TouchableOpacity onPress={() => navigateWeek(-1)}>
              <Ionicons name="chevron-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.weekText}>
              {new Date(selectedDate).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <TouchableOpacity onPress={() => navigateWeek(1)}>
              <Ionicons name="chevron-forward" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <View style={styles.calendarContainer}>
            {loadingWeek && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.loadingText}>Loading week...</Text>
              </View>
            )}
            {!selectedLocationId ? (
              <View style={styles.calendarDisabledContainer}>
                <View style={styles.calendarDisabledCard}>
                  <Ionicons name="location-outline" size={56} color="#007AFF" />
                  <Text style={styles.calendarDisabledTitle}>
                    Select a Location
                  </Text>
                  <Text style={styles.calendarDisabledText}>
                    To view the calendar schedule, please select a specific location from the filter above.
                  </Text>
                  <Text style={styles.calendarDisabledSubtext}>
                    The calendar view is only available when viewing a single location at a time.
                  </Text>
                </View>
              </View>
            ) : (
              <AvailabilityCalendar
                key={`${selectedDate}-${selectedLocationId}`} // Stable key based on date/location, not refreshKey
                availabilities={availabilities}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onSlotClick={handleSlotClick}
                selectedLocationId={selectedLocationId}
                onQuickDelete={handleQuickDelete}
              />
            )}
          </View>
        </View>

        {/* List View */}
        <View style={styles.listViewWrapper}>
          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, listViewTab === 'today' && styles.tabActive]}
              onPress={() => setListViewTab('today')}
            >
              <Text style={[styles.tabText, listViewTab === 'today' && styles.tabTextActive]}>
                Today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, listViewTab === 'upcoming' && styles.tabActive]}
              onPress={() => setListViewTab('upcoming')}
            >
              <Text style={[styles.tabText, listViewTab === 'upcoming' && styles.tabTextActive]}>
                Upcoming
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, listViewTab === 'past' && styles.tabActive]}
              onPress={() => setListViewTab('past')}
            >
              <Text style={[styles.tabText, listViewTab === 'past' && styles.tabTextActive]}>
                Past
              </Text>
            </TouchableOpacity>
          </View>

          {/* List Content */}
          <ScrollView style={styles.listContent} showsVerticalScrollIndicator={false}>
            {loadingListView ? (
              <View style={styles.emptyListState}>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.emptyListText}>Loading...</Text>
              </View>
            ) : getFilteredAvailabilitiesForList().map((availability) => (
              <TouchableOpacity
                key={availability.id}
                style={styles.listItem}
                onPress={() => {
                  const slot = {
                    date: utcToSydneyDate(availability.start_time),
                    time: utcToSydneyTime(availability.start_time),
                    status: availability.is_booked ? 'booked' : 'available',
                  };
                  handleSlotClick(slot);
                }}
              >
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemDate}>
                    {new Date(availability.start_time).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <View style={[
                    styles.listItemStatus,
                    availability.is_booked && styles.listItemStatusBooked,
                    !availability.is_booked && availability.booking_count > 0 && styles.listItemStatusPartial,
                  ]}>
                    <Text style={styles.listItemStatusText}>
                      {availability.is_booked ? 'Booked' : availability.booking_count > 0 ? 'Partial' : 'Available'}
                    </Text>
                  </View>
                </View>
                <View style={styles.listItemDetails}>
                  <View style={styles.listItemRow}>
                    <Ionicons name="time-outline" size={16} color="#8E8E93" />
                    <Text style={styles.listItemText}>
                      {new Date(availability.start_time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })} - {new Date(availability.end_time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  {availability.booking_count > 0 && (
                    <View style={styles.listItemRow}>
                      <Ionicons name="people-outline" size={16} color="#8E8E93" />
                      <Text style={styles.listItemText}>
                        {availability.booking_count}/{availability.max_capacity || 10} booked
                      </Text>
                    </View>
                  )}
                  {availability.service_name && (
                    <View style={styles.listItemRow}>
                      <Ionicons name="tennisball-outline" size={16} color="#8E8E93" />
                      <Text style={styles.listItemText}>{availability.service_name}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            {getFilteredAvailabilitiesForList().length === 0 && (
              <View style={styles.emptyListState}>
                <Ionicons name="calendar-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyListText}>
                  No {listViewTab === 'today' ? 'availabilities' : listViewTab} found
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Bulk Availability Drawer */}
      <BulkAvailabilityDrawer
        visible={showBulkDrawer}
        onClose={() => setShowBulkDrawer(false)}
        locations={locations}
        onCreate={handleBulkCreate}
      />

      {/* Edit Modal */}
      <AvailabilityEditModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedAvailability(null);
        }}
        availability={selectedAvailability}
        locations={locations}
        onUpdate={handleUpdateAvailability}
        onDelete={handleDeleteAvailability}
      />

      {/* Booking Details Modal */}
      <BookingDetailsModal
        visible={bookingDetailsModalVisible}
        onClose={() => {
          setBookingDetailsModalVisible(false);
          setBookingDetails([]);
          setSelectedSlotInfo(null);
        }}
        bookings={bookingDetails}
        loading={loadingBookingDetails}
        slotInfo={selectedSlotInfo}
      />

      {/* Booking Requests Modal */}
      <BookingRequestsModal
        visible={requestsModalVisible}
        onClose={() => setRequestsModalVisible(false)}
        onRequestProcessed={() => {
          // Refresh availabilities when a request is processed
          loadAvailabilities();
        }}
      />

      {/* Active Bookings Modal */}
      <ActiveBookingsModal
        visible={activeBookingsModalVisible}
        onClose={() => {
          setActiveBookingsModalVisible(false);
          loadUnassignedBookingsCount(); // Refresh count when modal closes
        }}
        onCoachAssigned={() => {
          loadUnassignedBookingsCount(); // Refresh count immediately when coach is assigned
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  requestsButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  activeBookingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34C759',
    position: 'relative',
  },
  activeBookingsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBookingsButtonText: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: '600',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  historyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    }),
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  bulkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filters: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F5F5F5',
  },
  filterButtonActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  calendarWrapper: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    // Width matches calendar: timeColumn (60 + 8 margin) + 7 dayColumns (80*7 + 4*6 margins) + padding (16*2) = 68 + 584 + 32 = 684px
    width: 684,
    minHeight: 600,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    paddingLeft: 16, // Match calendar container padding
    paddingRight: 16, // Match calendar container padding
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#fff',
    // Width matches calendar: timeColumn (60 + 8 margin) + 7 dayColumns (80*7 + 4*6 margins) + padding (16*2) = 68 + 584 + 32 = 684px
    width: 684,
  },
  weekText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  hintText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  calendarListViewContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  calendarContainer: {
    position: 'relative',
    minHeight: 600,
  },
  calendarDisabledContainer: {
    width: '100%',
    minHeight: 600,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  listViewWrapper: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 800,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FAFAFA',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  listContent: {
    flex: 1,
    padding: 16,
  },
  listItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItemDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  listItemStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  listItemStatusBooked: {
    backgroundColor: '#007AFF',
  },
  listItemStatusPartial: {
    backgroundColor: '#FF9500',
  },
  listItemStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  listItemDetails: {
    gap: 6,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemText: {
    fontSize: 13,
    color: '#000',
  },
  emptyListState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyListText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  calendarDisabledCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    }),
  },
  calendarDisabledTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  calendarDisabledText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  calendarDisabledSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
});
