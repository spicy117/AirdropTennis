import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Dimensions, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import DashboardScreen from './DashboardScreen';
import BookingsScreen from './BookingsScreen';
import ProfileScreen from './ProfileScreen';
import BookingDiscoveryScreen from './BookingDiscoveryScreen';
import AdminDashboardScreen from './AdminDashboardScreen';
import AdminStudentsScreen from './AdminStudentsScreen';
import AdminManageAvailabilityScreen from './AdminManageAvailabilityScreen';
import AdminLocationsCourtsScreen from './AdminLocationsCourtsScreen';
import AdminCoachesScreen from './AdminCoachesScreen';
import AdminHistoryScreen from './AdminHistoryScreen';
import CoachDashboardScreen from './CoachDashboardScreen';
import StudentHistoryScreen from './StudentHistoryScreen';
import { getSydneyToday, sydneyDateTimeToUTC } from '../utils/timezone';

const getIsDesktop = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth > 768;
  }
  return false;
};

export default function HomeScreen() {
  const { signOut, user, isAdmin, userRole } = useAuth();
  // Initialize with a safe default, will be updated when userRole is available
  const [activeScreen, setActiveScreen] = useState(() => {
    // Try to get initial screen from userRole if available immediately
    // Otherwise default to dashboard
    return 'dashboard';
  });
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [isDesktop, setIsDesktop] = useState(getIsDesktop());
  const [initialScreenSet, setInitialScreenSet] = useState(false);

  // Set initial screen based on user role (only once when role is first determined)
  useEffect(() => {
    if (!initialScreenSet && userRole !== null && userRole !== undefined) {
      if (userRole === 'coach') {
        setActiveScreen('coach-dashboard');
      } else if (userRole === 'admin') {
        setActiveScreen('admin-dashboard');
      } else {
        setActiveScreen('dashboard');
      }
      setInitialScreenSet(true);
    }
  }, [userRole, initialScreenSet]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleResize = () => {
        setIsDesktop(getIsDesktop());
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleBookLesson = () => {
    // Navigate to booking discovery screen
    setActiveScreen('booking-discovery');
  };

  const handleBookingNext = async (selectedSlots, summary, selectedDate = null) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make a booking.');
      return;
    }

    try {
      // Group slots by location and time to create bookings
      const bookingsToCreate = [];
      const availabilityIdsToUpdate = [];

      // Use provided selectedDate or default to today (both in Sydney local time)
      const bookingDate = selectedDate || getSydneyToday();

      // Group consecutive slots by location
      const byLocation = {};
      selectedSlots.forEach((slot) => {
        if (!byLocation[slot.locationId]) {
          byLocation[slot.locationId] = [];
        }
        byLocation[slot.locationId].push(slot);
      });

      // For each location, find matching availabilities and create bookings
      for (const [locationId, locationSlots] of Object.entries(byLocation)) {
        const sortedSlots = locationSlots.sort((a, b) => a.time24.localeCompare(b.time24));
        
        // Use the booking date
        const slotDate = bookingDate;
        
        // Get the earliest and latest times
        const earliestTime = sortedSlots[0].time24;
        const latestTime = sortedSlots[sortedSlots.length - 1].time24;
        
        // Parse times (in Sydney local time) for logging
        const [startHour, startMin] = earliestTime.split(':').map(Number);
        
        console.log('Creating booking for date (Sydney local):', {
          slotDate,
          selectedTime: `${startHour}:${startMin}`,
        });

        // Find matching availabilities and get their EXACT start_time and end_time
        // This ensures the booking matches exactly what the student saw
        const matchingAvailabilities = [];
        
        for (const slot of sortedSlots) {
          // Use the slot's startTime if available (from availability record)
          // This is the exact time from the database
          if (slot.startTime) {
            // Find the availability by ID to get exact times
            const { data: availability, error: availError } = await supabase
              .from('availabilities')
              .select('id, start_time, end_time, service_name')
              .eq('id', slot.id)
              .eq('is_booked', false)
              .single();

            if (availError) {
              console.error('Error finding availability:', availError);
              throw availError;
            }

            if (!availability) {
              Alert.alert(
                'Booking Failed',
                `The slot at ${slot.time} is no longer available. Please try again.`,
                [{ text: 'OK' }]
              );
              return;
            }

            matchingAvailabilities.push(availability);
          } else {
            // Fallback: find by time matching (less reliable)
            // Convert Sydney local time to UTC for query
            const [slotHour, slotMin] = slot.time24.split(':').map(Number);
            const slotStartUTC = sydneyDateTimeToUTC(slotDate, slotHour, slotMin);
            const slotStartDateTime = new Date(slotStartUTC);
            const timeWindowStart = new Date(slotStartDateTime.getTime() - 1000);
            const timeWindowEnd = new Date(slotStartDateTime.getTime() + 1000);
            
            const { data: slotAvailabilities, error: availError } = await supabase
              .from('availabilities')
              .select('id, start_time, end_time, service_name')
              .eq('location_id', locationId)
              .eq('is_booked', false)
              .gte('start_time', timeWindowStart.toISOString())
              .lte('start_time', timeWindowEnd.toISOString())
              .limit(1);

            if (availError) throw availError;

            if (!slotAvailabilities || slotAvailabilities.length === 0) {
              Alert.alert(
                'Booking Failed',
                `The slot at ${slot.time} is no longer available. Please try again.`,
                [{ text: 'OK' }]
              );
              return;
            }

            matchingAvailabilities.push(slotAvailabilities[0]);
          }
        }

        // Use the EXACT start_time from first availability and end_time from last availability
        // Sort by start_time to ensure correct order
        matchingAvailabilities.sort((a, b) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        const firstAvailability = matchingAvailabilities[0];
        const lastAvailability = matchingAvailabilities[matchingAvailabilities.length - 1];
        
        // Use the exact times from the availability records (already in UTC)
        const bookingStartTime = firstAvailability.start_time;
        const bookingEndTime = lastAvailability.end_time;
        
        // Get service_name from the first availability
        const serviceName = firstAvailability.service_name || null;

        // Check how many bookings already exist for this availability slot
        // Match by location_id, start_time, and end_time
        const { count: existingBookingsCount, error: countError } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', locationId)
          .eq('start_time', bookingStartTime)
          .eq('end_time', bookingEndTime);

        if (countError) {
          console.error('Error counting existing bookings:', countError);
          throw countError;
        }

        const currentBookingCount = existingBookingsCount || 0;
        // Get max_capacity from the first availability (all matching availabilities should have same capacity)
        const MAX_CAPACITY = firstAvailability.max_capacity || 10;

        // Check if slot is already full
        if (currentBookingCount >= MAX_CAPACITY) {
          Alert.alert(
            'Slot Full',
            `This time slot is already full (${currentBookingCount}/${MAX_CAPACITY} members). Please choose another time.`,
            [{ text: 'OK' }]
          );
          return;
        }

        // Create booking for this location using EXACT availability times
        console.log('Creating booking with exact availability times:', {
          user_id: user.id,
          location_id: locationId,
          start_time: bookingStartTime,
          end_time: bookingEndTime,
          credit_cost: 0,
          service_name: serviceName,
          current_count: currentBookingCount,
          max_capacity: MAX_CAPACITY,
          will_be_full: currentBookingCount + 1 >= MAX_CAPACITY,
        });
        
        // Insert booking using EXACT times from availability records
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            user_id: user.id,
            location_id: locationId,
            start_time: bookingStartTime, // Use exact availability start_time
            end_time: bookingEndTime, // Use exact availability end_time
            credit_cost: 0, // Set to 0 for testing
            service_name: serviceName, // Include service name
          })
          .select('id, user_id, location_id, start_time, end_time, credit_cost, service_name')
          .single();

        if (bookingError) {
          console.error('Booking insert error:', bookingError);
          throw bookingError;
        }
        
        console.log('Booking created successfully:', booking);

        bookingsToCreate.push(booking);

        // Check if slot is now full (current count + 1 >= MAX_CAPACITY)
        // Only mark as booked when it reaches capacity
        if (currentBookingCount + 1 >= MAX_CAPACITY) {
          const matchingAvailabilityIds = matchingAvailabilities.map(av => av.id);
          availabilityIdsToUpdate.push(...matchingAvailabilityIds);
        }
      }

      // Update availabilities to is_booked = true only when they reach capacity
      if (availabilityIdsToUpdate.length > 0) {
        const { error: updateError } = await supabase
          .from('availabilities')
          .update({ is_booked: true })
          .in('id', availabilityIdsToUpdate);

        if (updateError) throw updateError;
      }

      Alert.alert(
        'Booking Success! ✅',
        `Your booking has been confirmed.\n\nDuration: ${summary.duration.toFixed(1)} ${summary.duration === 1 ? 'hour' : 'hours'}\nCredits: ${summary.credits.toFixed(1)}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to dashboard or bookings screen
              setActiveScreen('bookings');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating booking:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        status: error.status,
        user_id: user?.id,
      });
      
      // Check for RLS policy issues
      if (error.code === '42501' || error.status === 403 || error.message?.includes('permission denied')) {
        const errorDetails = `Error Code: ${error.code || 'N/A'}\n` +
          `Message: ${error.message || 'Permission denied'}\n` +
          `User ID: ${user?.id || 'Not found'}\n\n` +
          'This is likely an RLS (Row Level Security) policy issue.\n\n' +
          'Please ensure:\n' +
          '1. RLS policies are set up correctly (run fix_bookings_rls.sql)\n' +
          '2. You have a profile entry in the profiles table\n' +
          '3. Your user_id matches auth.uid()';
        
        Alert.alert(
          'Permission Denied (403)',
          errorDetails,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Booking Failed ❌',
          `Unable to create booking:\n\n${error.message || 'Unknown error'}\n\nCode: ${error.code || 'N/A'}\n\nPlease try again.`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  const handleNavigateToDashboard = () => {
    setActiveScreen('dashboard');
    // Trigger refresh by updating the key
    setDashboardRefreshKey(prev => prev + 1);
  };

  const handleNavigate = (screen) => {
    setActiveScreen(screen);
    // If navigating to dashboard, trigger refresh
    if (screen === 'dashboard') {
      setDashboardRefreshKey(prev => prev + 1);
    }
  };

  const renderScreen = () => {
    switch (activeScreen) {
      // User screens
      case 'dashboard':
        return <DashboardScreen key={dashboardRefreshKey} onBookLesson={handleBookLesson} refreshTrigger={dashboardRefreshKey} />;
      case 'bookings':
        return <BookingsScreen onBookLesson={handleBookLesson} />;
      case 'history':
        return <StudentHistoryScreen onBookLesson={handleBookLesson} />;
      case 'profile':
        return <ProfileScreen onSignOut={handleSignOut} />;
      case 'booking-discovery':
        return (
          <BookingDiscoveryScreen
            onNext={handleBookingNext}
            onBack={handleNavigateToDashboard}
          />
        );
      // Admin screens
      case 'admin-dashboard':
        return <AdminDashboardScreen />;
      case 'admin-students':
        return <AdminStudentsScreen />;
      case 'admin-availability':
        // Only allow admins to access this screen
        if (userRole === 'admin') {
          return <AdminManageAvailabilityScreen onNavigate={handleNavigate} />;
        } else if (userRole === 'coach') {
          // Redirect coaches to their dashboard
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        } else {
          // Redirect students to their dashboard
          return <DashboardScreen key={dashboardRefreshKey} onBookLesson={handleBookLesson} refreshTrigger={dashboardRefreshKey} />;
        }
      case 'admin-locations-courts':
        return <AdminLocationsCourtsScreen />;
      case 'admin-coaches':
        return <AdminCoachesScreen />;
      case 'admin-history':
        return <AdminHistoryScreen />;
      // Coach screens
      case 'coach-dashboard':
        return <CoachDashboardScreen onNavigate={handleNavigate} />;
      default:
        return <DashboardScreen key={dashboardRefreshKey} onBookLesson={handleBookLesson} refreshTrigger={dashboardRefreshKey} />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Sidebar for Desktop */}
      {isDesktop && (
        <Sidebar
          activeScreen={activeScreen}
          onNavigate={handleNavigate}
          onSignOut={handleSignOut}
        />
      )}

      {/* Main Content */}
      <View style={styles.mainContent}>
        {renderScreen()}
      </View>

      {/* Bottom Navigation for Mobile */}
      {!isDesktop && (
        <BottomNav
          activeScreen={activeScreen}
          onNavigate={handleNavigate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
  },
  mainContent: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      overflow: 'auto',
    }),
  },
});
