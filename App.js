import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Platform, Image } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AcademyProvider } from './contexts/AcademyContext';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import AuthLoadingScreen from './components/auth/AuthLoadingScreen';
import AuthSelectionScreen from './screens/AuthSelectionScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import EmailVerificationScreen from './screens/EmailVerificationScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import {
  consumePostAuthScrollReset,
  ensureViewportMeta,
  resetElementScroll,
  resetScrollAfterAuth,
  resetWebScrollPosition,
  shouldResetPostAuthScroll,
} from './utils/mobileWebScroll';

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
  const { session, loading, isPasswordRecovery, userRole, user, roleLoading } = useAuth();
  const navigationRef = useRef(null);

  // CRITICAL: Check for payment redirect on mount. Store session_id and clear URL
  // so HomeScreen can process it and we avoid re-detecting on every [user] change.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const credited = urlParams.get('credited');
      const balance = urlParams.get('balance');
      if (sessionId) {
        sessionStorage.setItem('stripe_session_id', sessionId);
        sessionStorage.setItem('stripe_redirect_time', Date.now().toString());
      }
      if (credited === '1') {
        sessionStorage.setItem('stripe_credited', '1');
        if (balance) sessionStorage.setItem('stripe_credited_balance', balance);
      }
      if (sessionId || credited === '1') {
        window.history.replaceState(null, '', '/home');
      }
    }
  }, []);

  // Navigate to Home when user signs in
  // HomeScreen will handle role-based routing internally
  useEffect(() => {
    if (loading || roleLoading || !session || isPasswordRecovery || !navigationRef.current) {
      return;
    }
    if (userRole == null) return;

    const timer = setTimeout(() => {
      try {
        const currentRoute = navigationRef.current?.getCurrentRoute();
        const navigatingToHome = currentRoute?.name !== 'Home';
        if (navigatingToHome) {
          navigationRef.current?.navigate('Home');
        }
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          if (navigatingToHome || shouldResetPostAuthScroll()) {
            resetScrollAfterAuth();
            resetWebScrollPosition();
          }
          if (userRole === 'coach') {
            window.history.replaceState(null, '', '/coach/dashboard');
          } else if (userRole === 'admin') {
            const path = window.location.pathname;
            if (path === '/coach/dashboard') {
              window.history.replaceState(null, '', '/home');
            } else if (path !== '/home' && path !== '/') {
              window.history.replaceState(null, '', '/home');
            }
          } else if (window.location.pathname !== '/home' && window.location.pathname !== '/') {
            window.history.replaceState(null, '', '/home');
          }
        }
      } catch (error) {
        console.error('Error navigating to home:', error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [session, loading, roleLoading, isPasswordRecovery, userRole]);

  // Navigate to Auth when user signs out
  useEffect(() => {
    if (!loading && !session) {
      const navigateToAuth = (attempt = 0) => {
        try {
          if (navigationRef.current) {
            const currentRoute = navigationRef.current?.getCurrentRoute();
            if (currentRoute?.name !== 'Auth') {
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
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.history.replaceState(null, '', '/');
            }
          } else if (attempt < 10) {
            setTimeout(() => navigateToAuth(attempt + 1), 100 * (attempt + 1));
          }
        } catch (error) {
          console.error('Error navigating to auth:', error);
          if (attempt < 10) {
            setTimeout(() => navigateToAuth(attempt + 1), 100 * (attempt + 1));
          }
        }
      };
      navigateToAuth();
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
            if (window.history?.replaceState) {
              window.history.replaceState(null, '', cleanUrl);
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
  useEffect(() => {
    if (!loading && !session && navigationRef.current) {
      const timer = setTimeout(() => {
        try {
          const currentRoute = navigationRef.current?.getCurrentRoute();
          if (currentRoute?.name === 'Home') {
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

  const hasPendingStripeRedirect = Platform.OS === 'web' && typeof window !== 'undefined' && (() => {
    try {
      return new URLSearchParams(window.location.search || '').get('session_id') ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('stripe_session_id'));
    } catch {
      return null;
    }
  })();

  // Add fallback timeout - if loading takes more than 5 seconds, show app anyway
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const waitingForRole = session && roleLoading;

  useEffect(() => {
    if (loading || waitingForRole) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true);
      }, 4000);
      return () => clearTimeout(timeout);
    }
    setLoadingTimeout(false);
  }, [loading, waitingForRole]);

  if ((loading || waitingForRole) && !hasPendingStripeRedirect && !loadingTimeout) {
    return <AuthLoadingScreen />;
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
      onStateChange={() => {
        if (Platform.OS !== 'web') return;
        const route = navigationRef.current?.getCurrentRoute();
        if (route?.name === 'Home' && shouldResetPostAuthScroll()) {
          resetScrollAfterAuth();
          resetWebScrollPosition();
        }
      }}
    >
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName={(session && !isPasswordRecovery) || hasPendingStripeRedirect ? "Home" : "Auth"}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Auth" component={AuthStack} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Tennis ball icon for favicon / tab (same as sign-in and Add to Home Screen)
const tennisBallIcon = require('./assets/tennis-ball-icon.png');

export default function App() {
  // Set tab favicon on web so browser tabs show tennis ball instead of default
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    ensureViewportMeta();
    const src = Image.resolveAssetSource?.(tennisBallIcon);
    const href = src?.uri ?? (typeof tennisBallIcon === 'number' ? null : tennisBallIcon);
    if (!href) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }, []);

  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <AcademyProvider fallbackSubdomain={null}>
          <LanguageProvider>
            <AppNavigator />
          </LanguageProvider>
        </AcademyProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
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
