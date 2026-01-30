import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import DashboardScreen from './DashboardScreen';
import BookingsScreen from './BookingsScreen';
import ProfileScreen from './ProfileScreen';
import BookingDiscoveryScreen from './BookingDiscoveryScreen';
import ServicesScreen from './ServicesScreen';
import AdminDashboardScreen from './AdminDashboardScreen';
import AdminStudentsScreen from './AdminStudentsScreen';
import AdminManageAvailabilityScreen from './AdminManageAvailabilityScreen';
import AdminLocationsCourtsScreen from './AdminLocationsCourtsScreen';
import AdminCoachesScreen from './AdminCoachesScreen';
import AdminHistoryScreen from './AdminHistoryScreen';
import CoachDashboardScreen from './CoachDashboardScreen';
import StudentHistoryScreen from './StudentHistoryScreen';
import { getSydneyToday, sydneyDateTimeToUTC } from '../utils/timezone';
import { calculateBookingCost } from '../utils/pricing';
import { 
  getWalletBalance, 
  deductFromWallet, 
  createBookingCheckoutSession, 
  redirectToCheckout,
  verifyPaymentAndAddFunds
} from '../lib/stripe';

// Test mode flag - when true, skips Stripe checkout and immediately creates booking
const IS_TEST_MODE = false; // Set to false to enable Stripe checkout

const getIsDesktop = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth > 768;
  }
  return false;
};

export default function HomeScreen() {
  const { signOut, user, isAdmin, userRole } = useAuth();
  
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [isDesktop, setIsDesktop] = useState(getIsDesktop());
  const [initialScreenSet, setInitialScreenSet] = useState(false);
  const [serviceFilter, setServiceFilter] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  // Booking result modal state
  const [bookingModal, setBookingModal] = useState({
    visible: false,
    success: false,
    title: '',
    message: '',
  });

  // Set initial screen based on user role (only once when role is first determined)
  useEffect(() => {
    if (!initialScreenSet && userRole !== null && userRole !== undefined) {
      if (userRole === 'coach') {
        setActiveScreen('coach-dashboard');
      } else if (userRole === 'admin') {
        setActiveScreen('admin-dashboard');
      } else {
        setActiveScreen('dashboard'); // Students start on Dashboard screen
      }
      setInitialScreenSet(true);
    }
  }, [userRole, initialScreenSet]);

  // STRICT: Monitor activeScreen and redirect coaches if they somehow access restricted screens
  // CRITICAL: Coaches should NEVER see admin functions - they can ONLY access coach-dashboard and profile
  useEffect(() => {
    if (userRole === 'coach') {
      const allowedScreens = ['coach-dashboard', 'profile'];
      if (!allowedScreens.includes(activeScreen)) {
        console.warn(`Coach on restricted screen: ${activeScreen}. Redirecting to coach-dashboard.`);
        setActiveScreen('coach-dashboard');
      }
    }
  }, [activeScreen, userRole]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleResize = () => {
        setIsDesktop(getIsDesktop());
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Track processed session IDs to avoid duplicate processing
  const [processedSessions, setProcessedSessions] = useState(new Set());

  // Handle Stripe redirects after payment - comprehensive detection
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Check for session_id immediately - check both URL and sessionStorage
      const urlParams = new URLSearchParams(window.location.search);
      let immediateSessionId = urlParams.get('session_id');
      
      // ALSO check sessionStorage (in case App.js captured it before URL was cleaned)
      if (!immediateSessionId && typeof sessionStorage !== 'undefined') {
        const storedSessionId = sessionStorage.getItem('stripe_session_id');
        if (storedSessionId) {
          immediateSessionId = storedSessionId;
        }
      }
      
      if (immediateSessionId) {
        // Process immediately if we have user
        if (user && !processedSessions.has(immediateSessionId)) {
          setProcessedSessions(prev => new Set([...prev, immediateSessionId]));
          // Clear from sessionStorage
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('stripe_session_id');
          }
          handleStripeSuccess(immediateSessionId);
        }
      }

      const checkRedirect = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        const path = window.location.pathname;
        
        // Try multiple ways to extract session_id
        let sessionId = urlParams.get('session_id');
        if (!sessionId && hash) {
          const hashMatch = hash.match(/[?&]session_id=([^&]+)/);
          if (hashMatch) {
            sessionId = hashMatch[1];
          }
        }

        // Handle successful payment - if we have a session_id, process it
        if (sessionId) {
          if (!user) {
            // Retry in a moment when user might be loaded
            setTimeout(() => checkRedirect(), 500);
            return;
          }

          if (processedSessions.has(sessionId)) {
            return;
          }

          setProcessedSessions(prev => new Set([...prev, sessionId]));
          handleStripeSuccess(sessionId);
          return;
        }

        // Handle cancelled payment
        const isCanceled = urlParams.get('canceled') === 'true' || 
                          path.includes('booking-cancel');
        if (isCanceled && !processedSessions.has('canceled')) {
          setProcessedSessions(prev => new Set([...prev, 'canceled']));
          handleStripeCancel();
        }
      };

      // Check immediately
      checkRedirect();

      // Also check on popstate (back/forward navigation)
      const handlePopState = () => {
        setTimeout(checkRedirect, 100);
      };
      window.addEventListener('popstate', handlePopState);

      // Check periodically for redirects (reduced frequency)
      const intervalId = setInterval(() => {
        checkRedirect();
      }, 2000); // Check every 2 seconds instead of 1
      const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
      }, 10000); // Check for 10 seconds instead of 30

      // Also listen for hash changes
      const handleHashChange = () => {
        setTimeout(checkRedirect, 100);
      };
      window.addEventListener('hashchange', handleHashChange);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('hashchange', handleHashChange);
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, [user, processedSessions]);

  const handleStripeSuccess = async (sessionId) => {
    if (!user) {
      console.error('❌ [PAYMENT] No user found, cannot verify payment');
      Alert.alert('Error', 'You must be logged in to verify payment.');
      return;
    }

    if (!sessionId) {
      Alert.alert('Error', 'Payment session ID is missing.');
      return;
    }

    try {
      // Verify payment and add funds to wallet (if it was a top-up)
      // The Edge Function will check the session and add funds if payment was successful
      // Add timeout to prevent hanging
      const result = await Promise.race([
        verifyPaymentAndAddFunds(sessionId, user.id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Payment verification timeout')), 10000)
        )
      ]);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Payment verification failed');
      }

      // If this was a booking payment, create bookings from stored data (webhook/Edge
      // Function may not create them). This ensures they show in Upcoming Bookings.
      if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem('stripe_pending_booking_' + sessionId);
        if (raw) {
          try {
            const segments = JSON.parse(raw);
            if (Array.isArray(segments) && segments.length > 0) {
              const oneWeekFromNow = new Date();
              oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
              for (const seg of segments) {
                const now = new Date();
                const startTime = new Date(seg.bookingStartTime);
                if (startTime < now) {
                  console.warn('[PAYMENT] Skipping booking in the past after Stripe return:', seg.bookingStartTime);
                  continue;
                }
                if (startTime < oneWeekFromNow) {
                  console.warn('[PAYMENT] Skipping booking less than 1 week in advance:', seg.bookingStartTime);
                  sessionStorage.removeItem('stripe_pending_booking_' + sessionId);
                  setBookingModal({
                    visible: true,
                    success: false,
                    title: 'Booking Failed',
                    message: 'Bookings must be at least 1 week in advance.',
                  });
                  if (typeof window !== 'undefined') {
                    window.history.replaceState({}, '', '/home');
                  }
                  return;
                }
                const { error: bookingError } = await supabase
                  .from('bookings')
                  .insert({
                    user_id: user.id,
                    location_id: seg.locationId,
                    start_time: seg.bookingStartTime,
                    end_time: seg.bookingEndTime,
                    credit_cost: seg.cost,
                    service_name: seg.serviceName || null,
                  })
                  .select('id')
                  .single();
                if (bookingError) {
                  console.error('[PAYMENT] Error creating booking from Stripe return:', bookingError);
                  throw bookingError;
                }
                if (seg.currentBookingCount + 1 >= seg.MAX_CAPACITY && Array.isArray(seg.matchingAvailabilityIds) && seg.matchingAvailabilityIds.length > 0) {
                  await supabase.from('availabilities').update({ is_booked: true }).in('id', seg.matchingAvailabilityIds);
                }
              }
              sessionStorage.removeItem('stripe_pending_booking_' + sessionId);
              setBookingModal({
                visible: true,
                success: true,
                title: 'Booking Confirmed!',
                message: 'Your lesson has been booked successfully.',
              });
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', '/home');
              }
              setDashboardRefreshKey(prev => prev + 1);
              return;
            }
          } catch (e) {
            console.error('[PAYMENT] Error processing pending booking data:', e);
            sessionStorage.removeItem('stripe_pending_booking_' + sessionId);
            throw e;
          }
        }
      }

      // Check if it was a topup and funds were added
      if (result.type === 'topup' && result.newBalance !== undefined) {
        setBookingModal({
          visible: true,
          success: true,
          title: 'Top-Up Successful!',
          message: `Your wallet has been topped up successfully. New balance: $${result.newBalance.toFixed(2)}`,
        });
      } else {
        setBookingModal({
          visible: true,
          success: true,
          title: 'Payment Successful!',
          message: `Your payment was processed successfully.${result.newBalance ? ` New balance: $${result.newBalance.toFixed(2)}` : ' However, wallet was not updated. Please contact support.'}`,
        });
      }

      // Clean up URL
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/');
      }

      // Refresh dashboard if on dashboard
      if (activeScreen === 'dashboard') {
        setDashboardRefreshKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('❌ [PAYMENT] Error handling payment:', error);
      console.error('Error details:', {
        message: error.message,
        error: error.toString(),
        stack: error.stack,
      });
      
      const errorMessage = error.message || 'There was an issue processing your payment. Please contact support.';
      setBookingModal({
        visible: true,
        success: false,
        title: 'Payment Error',
        message: errorMessage,
      });
    }
  };

  const handleStripeCancel = () => {
    setBookingModal({
      visible: true,
      success: false,
      title: 'Payment Cancelled',
      message: 'Your payment was cancelled. No charges were made.',
    });

    // Clean up URL
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  };

  const handleOpenSidebar = useCallback(() => setSidebarVisible(true), []);
  const handleCloseSidebar = useCallback(() => setSidebarVisible(false), []);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleBookLesson = () => {
    // Navigate to booking discovery screen and clear any service filter
    // so all availabilities are shown (not filtered by a specific service)
    setServiceFilter(null);
    setActiveScreen('booking-discovery');
  };

  const handleBookingNext = async (selectedSlots, summary, selectedDate = null) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make a booking.');
      return;
    }

    try {
      // Step 1: Collect all booking data and calculate total cost
      const bookingsToCreate = [];
      const availabilityIdsToUpdate = [];
      const bookingData = []; // Store booking data for payment processing

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

      // For each location, find matching availabilities and prepare booking data
      for (const [locationId, locationSlots] of Object.entries(byLocation)) {
        const sortedSlots = locationSlots.sort((a, b) => a.time24.localeCompare(b.time24));
        
        // Find matching availabilities and get their EXACT start_time and end_time
        const matchingAvailabilities = [];
        
        for (const slot of sortedSlots) {
          if (slot.startTime) {
            const { data: availability, error: availError } = await supabase
              .from('availabilities')
              .select('id, start_time, end_time, service_name, max_capacity')
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
            const [slotHour, slotMin] = slot.time24.split(':').map(Number);
            const slotStartUTC = sydneyDateTimeToUTC(bookingDate, slotHour, slotMin);
            const slotStartDateTime = new Date(slotStartUTC);
            const timeWindowStart = new Date(slotStartDateTime.getTime() - 1000);
            const timeWindowEnd = new Date(slotStartDateTime.getTime() + 1000);
            
            const { data: slotAvailabilities, error: availError } = await supabase
              .from('availabilities')
              .select('id, start_time, end_time, service_name, max_capacity')
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

        // Sort by start_time
        matchingAvailabilities.sort((a, b) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        const firstAvailability = matchingAvailabilities[0];
        const lastAvailability = matchingAvailabilities[matchingAvailabilities.length - 1];
        
        const bookingStartTime = firstAvailability.start_time;
        const bookingEndTime = lastAvailability.end_time;
        const serviceName = firstAvailability.service_name || null;
        const MAX_CAPACITY = firstAvailability.max_capacity || 10;

        // Check capacity
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

        if (currentBookingCount >= MAX_CAPACITY) {
          Alert.alert(
            'Slot Full',
            `This time slot is already full (${currentBookingCount}/${MAX_CAPACITY} members). Please choose another time.`,
            [{ text: 'OK' }]
          );
          return;
        }

        // Calculate cost for this booking
        const durationHours = (new Date(bookingEndTime) - new Date(bookingStartTime)) / (1000 * 60 * 60);
        const cost = calculateBookingCost(serviceName, durationHours);

        // Store booking data
        bookingData.push({
          locationId,
          bookingStartTime,
          bookingEndTime,
          serviceName,
          cost,
          matchingAvailabilities,
          currentBookingCount,
          MAX_CAPACITY,
        });
      }

      // Enforce minimum 1 week in advance for student bookings
      const earliestStart = new Date(
        Math.min(...bookingData.map((b) => new Date(b.bookingStartTime).getTime()))
      );
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      if (earliestStart < oneWeekFromNow) {
        setBookingModal({
          visible: true,
          success: false,
          title: 'Booking Failed',
          message: 'Bookings must be at least 1 week in advance.',
        });
        return;
      }

      // Step 2: Calculate total cost
      const totalCost = bookingData.reduce((sum, booking) => sum + booking.cost, 0);

      // Step 3: Handle payment (only if not in test mode)
      if (!IS_TEST_MODE) {
        // Get wallet balance
        const walletBalance = await getWalletBalance(user.id);

        if (walletBalance >= totalCost) {
          // Sufficient wallet balance - deduct and proceed
          console.log(`Using wallet balance: $${walletBalance.toFixed(2)} for booking cost: $${totalCost.toFixed(2)}`);
          
          try {
            await deductFromWallet(user.id, totalCost);
            console.log('Wallet balance deducted successfully');
          } catch (walletError) {
            console.error('Error deducting from wallet:', walletError);
            Alert.alert(
              'Payment Error',
              'Failed to process wallet payment. Please try again or use card payment.'
            );
            return;
          }
        } else {
          // Insufficient wallet balance - create Stripe checkout
          console.log(`Insufficient wallet balance: $${walletBalance.toFixed(2)}. Required: $${totalCost.toFixed(2)}`);
          
          try {
            const { sessionId, id, url, error: checkoutError } = await createBookingCheckoutSession({
              userId: user.id,
              amount: totalCost,
              bookingData: bookingData.map(b => ({
                locationId: b.locationId,
                startTime: b.bookingStartTime,
                endTime: b.bookingEndTime,
                serviceName: b.serviceName,
                cost: b.cost,
              })),
              metadata: {
                bookingType: 'direct',
              },
            });

            if (checkoutError) throw checkoutError;

            if (!url) {
              throw new Error('Checkout URL not returned from server');
            }

            // Store booking data so we can create bookings after Stripe redirect (in case
            // the webhook/Edge Function does not create them).
            const sid = sessionId || id;
            if (sid && Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
              const toStore = bookingData.map(b => ({
                locationId: b.locationId,
                bookingStartTime: b.bookingStartTime,
                bookingEndTime: b.bookingEndTime,
                serviceName: b.serviceName,
                cost: b.cost,
                matchingAvailabilityIds: (b.matchingAvailabilities || []).map(a => a.id),
                currentBookingCount: b.currentBookingCount,
                MAX_CAPACITY: b.MAX_CAPACITY,
              }));
              sessionStorage.setItem('stripe_pending_booking_' + sid, JSON.stringify(toStore));
            }

            // Redirect to Stripe checkout using the URL directly
            await redirectToCheckout(url);
            
            // After successful payment, Stripe redirects back; handleStripeSuccess will
            // create bookings from stripe_pending_booking_<sessionId> if present.
            return;
          } catch (checkoutError) {
            console.error('Error creating checkout session:', checkoutError);
            Alert.alert(
              'Payment Error',
              checkoutError.message || 'Failed to initiate payment. Please try again.'
            );
            return;
          }
        }
      } else {
        console.log('🧪 TEST MODE: Skipping payment, proceeding directly to booking creation');
      }

      // Step 4: Create bookings in Supabase
      // Create bookings from prepared booking data
      for (const bookingInfo of bookingData) {
        const { locationId, bookingStartTime, bookingEndTime, serviceName, cost, matchingAvailabilities, currentBookingCount, MAX_CAPACITY } = bookingInfo;

        // VALIDATION: Prevent creating bookings in the past
        const now = new Date();
        const startTime = new Date(bookingStartTime);
        if (startTime < now) {
          console.error('❌ [BOOKING] Attempted to create booking in the past:', {
            bookingStartTime,
            now: now.toISOString(),
            difference: now - startTime,
          });
          Alert.alert(
            'Invalid Booking Time',
            'Cannot create a booking for a time that has already passed. Please select a future time slot.',
            [{ text: 'OK' }]
          );
          throw new Error('Cannot create booking in the past');
        }

        console.log('Creating booking:', {
          user_id: user.id,
          location_id: locationId,
          start_time: bookingStartTime,
          end_time: bookingEndTime,
          credit_cost: cost,
          service_name: serviceName,
        });
        
        // Insert booking with actual cost
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            user_id: user.id,
            location_id: locationId,
            start_time: bookingStartTime,
            end_time: bookingEndTime,
            credit_cost: cost, // Use actual calculated cost
            service_name: serviceName,
          })
          .select('id, user_id, location_id, start_time, end_time, credit_cost, service_name')
          .single();

        if (bookingError) {
          console.error('Booking insert error:', bookingError);
          throw bookingError;
        }
        
        console.log('Booking created successfully:', booking);
        bookingsToCreate.push(booking);

        // Check if slot is now full
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

      // Show success modal
      setBookingModal({
        visible: true,
        success: true,
        title: 'Booking Confirmed!',
        message: `Your lesson has been booked successfully.\n\nDuration: ${summary.duration.toFixed(1)} ${summary.duration === 1 ? 'hour' : 'hours'}`,
      });
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
      
      // Show error modal
      let errorMessage = error.message || 'Unknown error occurred';
      
      // Make error messages more user-friendly
      if (error.code === '42501' || error.status === 403 || error.message?.includes('permission denied')) {
        errorMessage = 'You do not have permission to make this booking. Please try logging out and back in.';
      } else if (error.message?.includes('overlaps')) {
        errorMessage = 'This time slot is no longer available. Please select a different time.';
      } else if (error.message?.includes('no longer available')) {
        errorMessage = error.message;
      }
      
      setBookingModal({
        visible: true,
        success: false,
        title: 'Booking Failed',
        message: errorMessage,
      });
    }
  };

  const handleBookingModalClose = () => {
    const wasSuccess = bookingModal.success;
    
    // First just hide the modal, keep other state to prevent icon flash
    setBookingModal(prev => ({ ...prev, visible: false }));
    
    // Then reset state and navigate after modal animation completes
    setTimeout(() => {
      setBookingModal({ visible: false, success: false, title: '', message: '' });
      
      if (wasSuccess) {
        // Navigate to My Bookings on success
        setActiveScreen('bookings');
        setDashboardRefreshKey(prev => prev + 1);
      }
      // On failure, stay on booking screen so user can try again
    }, 300);
  };

  const handleViewAvailability = (serviceId, serviceName) => {
    // Navigate to booking discovery when a service is selected
    // Store the service filter to pass to BookingDiscoveryScreen
    setActiveScreen('booking-discovery');
    // Store service filter in state to pass to BookingDiscoveryScreen
    setServiceFilter(serviceName);
  };

  const handleNavigate = (screen) => {
    if (userRole === 'coach') {
      const allowedScreens = ['coach-dashboard', 'profile'];
      if (!allowedScreens.includes(screen)) {
        console.warn(`Coach attempted to access restricted screen: ${screen}. Redirecting to coach-dashboard.`);
        setActiveScreen('coach-dashboard');
        return;
      }
    }
    setActiveScreen(screen);
    if (screen === 'dashboard') {
      setDashboardRefreshKey(prev => prev + 1);
    }
  };

  const handleSidebarNavigate = (screen) => {
    handleNavigate(screen);
    handleCloseSidebar();
  };

  const renderScreen = () => {
    const studentFallbackDashboard = (
      <DashboardScreen
        key={dashboardRefreshKey}
        onBookLesson={handleBookLesson}
        onSelectService={(serviceName) => {
          setServiceFilter(serviceName);
          setActiveScreen('booking-discovery');
        }}
        refreshTrigger={dashboardRefreshKey}
        onOpenSidebar={handleOpenSidebar}
        onGoToHistory={() => setActiveScreen('history')}
        onGoToBookings={() => setActiveScreen('bookings')}
      />
    );

    switch (activeScreen) {
      // User screens - STRICT: Coaches cannot access student screens
      case 'services':
        if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return <ServicesScreen onViewAvailability={handleViewAvailability} />;
      case 'dashboard':
        if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return (
          <DashboardScreen
            key={dashboardRefreshKey}
            onBookLesson={handleBookLesson}
            onSelectService={(serviceName) => {
              setServiceFilter(serviceName);
              setActiveScreen('booking-discovery');
            }}
            refreshTrigger={dashboardRefreshKey}
            onGoToHistory={() => setActiveScreen('history')}
            onGoToBookings={() => setActiveScreen('bookings')}
          />
        );
      case 'bookings':
        if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return (
          <BookingsScreen
            onBookLesson={handleBookLesson}
            refreshTrigger={dashboardRefreshKey}
            onGoHome={() => setActiveScreen('dashboard')}
          />
        );
      case 'history':
        if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return (
          <StudentHistoryScreen
            onBookLesson={handleBookLesson}
            onGoHome={() => setActiveScreen('dashboard')}
          />
        );
      case 'profile':
        // Profile is accessible to all roles; admins get Dashboard button to return to admin home
        return <ProfileScreen onSignOut={handleSignOut} onNavigate={handleNavigate} />;
      case 'booking-discovery':
        if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return (
          <BookingDiscoveryScreen
            onNext={handleBookingNext}
            onBack={() => {
              setActiveScreen('dashboard');
              setServiceFilter(null); // Clear filter when going back
            }}
            serviceFilter={serviceFilter}
          />
        );
      // Admin screens - STRICT: Only admins can access these
      // CRITICAL: Coaches should NEVER see these admin screens - redirect immediately
      case 'admin-dashboard':
        if (userRole === 'admin') {
          return <AdminDashboardScreen onNavigate={handleNavigate} />;
        } else if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return studentFallbackDashboard;
      case 'admin-students':
        if (userRole === 'admin') {
          return <AdminStudentsScreen onNavigate={handleNavigate} />;
        } else if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return studentFallbackDashboard;
      case 'admin-availability':
        if (userRole === 'admin') {
          return <AdminManageAvailabilityScreen onNavigate={handleNavigate} />;
        } else if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return studentFallbackDashboard;
      case 'admin-locations-courts':
        if (userRole === 'admin') {
          return <AdminLocationsCourtsScreen onNavigate={handleNavigate} />;
        } else if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return studentFallbackDashboard;
      case 'admin-coaches':
        if (userRole === 'admin') {
          return <AdminCoachesScreen onNavigate={handleNavigate} />;
        } else if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return studentFallbackDashboard;
      case 'admin-history':
        if (userRole === 'admin') {
          return <AdminHistoryScreen onNavigate={handleNavigate} />;
        } else if (userRole === 'coach') {
          return <CoachDashboardScreen onNavigate={handleNavigate} />;
        }
        return studentFallbackDashboard;
      // Coach screens
      case 'coach-dashboard':
        return <CoachDashboardScreen onNavigate={handleNavigate} />;
      default:
        // Default to dashboard for students
        if (userRole === 'student' || (!userRole || (userRole !== 'admin' && userRole !== 'coach'))) {
          return (
            <DashboardScreen
              key={dashboardRefreshKey}
              onBookLesson={handleBookLesson}
              onSelectService={(serviceName) => {
                setServiceFilter(serviceName);
                setActiveScreen('booking-discovery');
              }}
              refreshTrigger={dashboardRefreshKey}
              onOpenSidebar={handleOpenSidebar}
              onGoToHistory={() => setActiveScreen('history')}
              onGoToBookings={() => setActiveScreen('bookings')}
            />
          );
        }
        return (
          <DashboardScreen
            key={dashboardRefreshKey}
            onBookLesson={handleBookLesson}
            onSelectService={(serviceName) => {
              setServiceFilter(serviceName);
              setActiveScreen('booking-discovery');
            }}
            refreshTrigger={dashboardRefreshKey}
            onGoToHistory={() => setActiveScreen('history')}
            onGoToBookings={() => setActiveScreen('bookings')}
          />
        );
    }
  };

  // While returning from Stripe, user may not be loaded yet. Show a focused state
  // so we don't render Dashboard etc. with null user; payment effect will run when user is ready.
  const hasPendingStripe = Platform.OS === 'web' && typeof sessionStorage !== 'undefined' && sessionStorage.getItem('stripe_session_id');
  if (!user && hasPendingStripe) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#6B7280' }}>Completing your payment…</Text>
      </View>
    );
  }

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

      {/* Mobile Sidebar Modal */}
      {!isDesktop && (
        <Modal
          visible={sidebarVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={handleCloseSidebar}
        >
          <View style={styles.sidebarModalOverlay}>
            <TouchableOpacity
              style={styles.sidebarModalBackdrop}
              activeOpacity={1}
              onPress={handleCloseSidebar}
            />
            <View style={styles.sidebarModalContent}>
              <View style={styles.sidebarModalHeader}>
                <Text style={styles.sidebarModalTitle}>Menu</Text>
                <TouchableOpacity
                  onPress={handleCloseSidebar}
                  style={styles.sidebarModalCloseButton}
                  accessible={true}
                  accessibilityLabel="Close menu"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={24} color="#0F172A" />
                </TouchableOpacity>
              </View>
              <Sidebar
                activeScreen={activeScreen}
                onNavigate={handleSidebarNavigate}
                onSignOut={async () => {
                  handleCloseSidebar();
                  await handleSignOut();
                }}
                isMobile={true}
              />
            </View>
          </View>
        </Modal>
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

      {/* Booking Result Modal */}
      <Modal
        visible={bookingModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleBookingModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={[
              styles.modalIconContainer,
              bookingModal.success ? styles.successIconBg : styles.errorIconBg
            ]}>
              <Ionicons
                name={bookingModal.success ? 'checkmark-circle' : 'close-circle'}
                size={48}
                color={bookingModal.success ? '#10B981' : '#EF4444'}
              />
            </View>
            
            <Text style={styles.modalTitle}>{bookingModal.title}</Text>
            <Text style={styles.modalMessage}>{bookingModal.message}</Text>
            
            <TouchableOpacity
              style={[
                styles.modalButton,
                bookingModal.success ? styles.successButton : styles.errorButton
              ]}
              onPress={handleBookingModalClose}
            >
              <Text style={styles.modalButtonText}>
                {bookingModal.success ? 'View My Bookings' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // Booking Result Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    }),
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIconBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  errorIconBg: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  errorButton: {
    backgroundColor: '#1F2937',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Mobile Sidebar Modal Styles
  sidebarModalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarModalContent: {
    width: 280,
    backgroundColor: '#FAFAFA',
    height: '100%',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: -2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    }),
  },
  sidebarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  sidebarModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  sidebarModalCloseButton: {
    padding: 4,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
