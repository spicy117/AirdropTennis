import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import AuthSelectionScreen from './screens/AuthSelectionScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import EmailVerificationScreen from './screens/EmailVerificationScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import HomeScreen from './screens/HomeScreen';

// Note: Supabase will automatically process auth tokens from URL hash via detectSessionInUrl
// We'll clean up the URL after Supabase processes it (see AppNavigator useEffect)

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="AuthSelection"
    >
      <Stack.Screen name="AuthSelection" component={AuthSelectionScreen} />
      <Stack.Screen name="LogIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { session, loading, isPasswordRecovery, userRole } = useAuth();
  const navigationRef = useRef(null);

  // Navigate to Home when user signs in
  // HomeScreen will handle role-based routing internally
  useEffect(() => {
    if (!loading && session && !isPasswordRecovery && navigationRef.current) {
      const timer = setTimeout(() => {
        try {
          const currentRoute = navigationRef.current?.getCurrentRoute();
          // Only navigate if we're not already on Home screen
          if (currentRoute?.name !== 'Home') {
            navigationRef.current?.navigate('Home');
            // Update URL based on role - ensure coaches go to coach dashboard
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              const path = window.location.pathname;
              if (userRole === 'coach') {
                // Force redirect to coach dashboard for coaches
                window.history.replaceState(null, '', '/coach/dashboard');
              } else if (userRole === 'admin') {
                if (path !== '/home') {
                  window.history.replaceState(null, '', '/home');
                }
              } else if (path !== '/home' && path !== '/') {
                window.history.replaceState(null, '', '/home');
              }
            }
          } else if (userRole === 'coach') {
            // If already on Home, ensure URL reflects coach dashboard
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              const path = window.location.pathname;
              if (path !== '/coach/dashboard' && path !== '/home') {
                window.history.replaceState(null, '', '/coach/dashboard');
              }
            }
          }
        } catch (error) {
          console.error('Error navigating to home:', error);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [session, loading, isPasswordRecovery, userRole]);

  // Navigate to Auth when user signs out
  useEffect(() => {
    const sessionValue = session;
    const loadingValue = loading;
    console.log('Navigation effect triggered - loading:', loadingValue, 'session:', !!sessionValue, 'session type:', typeof sessionValue);
    
    if (!loadingValue && !sessionValue) {
      console.log('✅ Conditions met for navigation - loading is false and session is null/falsy');
      console.log('Session cleared, attempting to navigate to Auth...');
      // Navigate to Auth when signing out
      const navigateToAuth = (attempt = 0) => {
        try {
          if (navigationRef.current) {
            const currentRoute = navigationRef.current?.getCurrentRoute();
            console.log('Current route:', currentRoute?.name, 'Attempt:', attempt);
            
            // Navigate to Auth if we're not already there
            if (currentRoute?.name !== 'Auth') {
              console.log('Dispatching navigation to Auth...');
              // Use reset to clear navigation stack when signing out
              navigationRef.current?.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'Auth',
                      state: {
                        routes: [{ name: 'AuthSelection' }],
                      },
                    },
                  ],
                })
              );
              console.log('✅ Successfully navigated to Auth');
            } else {
              console.log('Already on Auth screen');
            }
            
            // Update URL to root when logged out
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.history.replaceState(null, '', '/');
            }
          } else {
            console.log('Navigation ref not ready, attempt:', attempt);
            // Navigation not ready yet, retry
            if (attempt < 10) {
              setTimeout(() => navigateToAuth(attempt + 1), 100 * (attempt + 1));
            } else {
              console.error('Navigation ref never became ready after 10 attempts');
            }
          }
        } catch (error) {
          console.error('Error navigating to auth:', error, 'Attempt:', attempt);
          // Retry on error
          if (attempt < 10) {
            setTimeout(() => navigateToAuth(attempt + 1), 100 * (attempt + 1));
          }
        }
      };

      // Start navigation attempts immediately
      navigateToAuth();
    } else {
      console.log('❌ Navigation effect skipped - loading:', loadingValue, 'hasSession:', !!sessionValue);
    }
  }, [session, loading]);

  // Handle password reset token and email verification
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      const path = window.location.pathname;
      const isRecovery = hash && hash.includes('type=recovery');
      const isSignup = hash && hash.includes('type=signup');
      const hasError = hash && hash.includes('error=');
      const isResetPasswordPath = path === '/reset-password';
      
      // Don't process auth URLs if user is already authenticated (unless it's recovery)
      if (session && !isRecovery && !isResetPasswordPath) {
        return;
      }
      
      // Check localStorage for persisted recovery mode
      const persistedRecovery = localStorage.getItem('supabase_password_recovery_mode') === 'true';
      
      // Navigate to reset password screen only if:
      // 1. There's a recovery token in the URL hash (from email link), OR
      // 2. The path is /reset-password AND recovery mode is active (user is already there)
      // This ensures reset-password is only accessible via email link, not by direct URL access
      if (isRecovery || (isResetPasswordPath && (isPasswordRecovery || persistedRecovery))) {
        const timer = setTimeout(() => {
          try {
            if (navigationRef.current) {
              navigationRef.current.navigate('Auth', {
                screen: 'ResetPassword',
                params: hasError ? { error: hash } : undefined,
              });
            }
          } catch (error) {
            console.error('Error navigating to reset password:', error);
          }
        }, 100);
        
        return () => clearTimeout(timer);
      }
      
      // Clean up URL hash after processing
      if (hash && (hash.includes('access_token') || isSignup || isRecovery || hasError)) {
        const timer = setTimeout(() => {
          try {
            const cleanUrl = window.location.pathname + window.location.search;
            if (window.history && window.history.replaceState) {
              window.history.replaceState(null, '', cleanUrl);
              console.log('Cleaned up auth callback URL');
            }
          } catch (error) {
            console.error('Error cleaning up URL:', error);
          }
        }, 1500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [session, isPasswordRecovery]); // React to recovery mode changes

  // Force navigation when session changes and we're logged out
  // This ensures navigation happens even if the conditional rendering doesn't trigger it
  // MUST be before any conditional returns to maintain hooks order
  useEffect(() => {
    if (!loading && !session && navigationRef.current) {
      console.log('Force navigation effect triggered - session is null');
      // Small delay to ensure navigator is ready
      const timer = setTimeout(() => {
        try {
          const currentRoute = navigationRef.current?.getCurrentRoute();
          console.log('Force navigation check - current route:', currentRoute?.name);
          if (currentRoute?.name === 'Home') {
            console.log('Force navigating from Home to Auth');
            navigationRef.current?.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'Auth',
                    state: {
                      routes: [{ name: 'AuthSelection' }],
                    },
                  },
                ],
              })
            );
          }
        } catch (error) {
          console.error('Error in force navigation:', error);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [session, loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Configure linking for web to sync URL with navigation state
  // Both /login and /signup route to AuthSelectionScreen which handles tab switching
  const linking = Platform.OS === 'web' ? {
    enabled: true,
    config: {
      screens: {
        Auth: {
          initialRouteName: 'AuthSelection',
          screens: {
            // Route root path to AuthSelectionScreen - it reads URL to determine active tab
            AuthSelection: '',
            EmailVerification: 'verify-email',
            ResetPassword: 'reset-password',
            // LogIn and SignUp routes are not in linking config - they're only for programmatic navigation
            // This prevents direct URL access to standalone screens
          },
        },
        Home: 'home',
      },
    },
    // Handle /login and /signup by routing to AuthSelectionScreen (keeps URL unchanged)
    getStateFromPath: (path, options) => {
      // Check if user has a session stored (Supabase stores it in localStorage)
      // If authenticated, route to Home instead of Auth
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          // Check for Supabase session in localStorage
          const supabaseSessionKey = Object.keys(localStorage).find(key => 
            key.includes('supabase') && key.includes('auth-token')
          );
          if (supabaseSessionKey && localStorage.getItem(supabaseSessionKey)) {
            // User is authenticated, route to Home
            if (path === '/login' || path === '/signup' || path === '/') {
              return {
                routes: [
                  {
                    name: 'Home',
                  },
                ],
              };
            }
          }
        } catch (e) {
          // Ignore errors when checking localStorage
        }
      }
      
      // If path is /login or /signup, route to AuthSelectionScreen
      // AuthSelectionScreen will read the URL and set the correct tab
      if (path === '/login' || path === '/signup' || path === '/') {
        return {
          routes: [
            {
              name: 'Auth',
              state: {
                routes: [
                  {
                    name: 'AuthSelection',
                  },
                ],
              },
            },
          ],
        };
      }
      // Let React Navigation handle other paths with default behavior
      return undefined;
    },
  } : undefined;

  return (
    <NavigationContainer 
      ref={navigationRef} 
      linking={linking}
    >
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName={session && !isPasswordRecovery ? "Home" : "Auth"}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Auth" component={AuthStack} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppNavigator />
      </LanguageProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
