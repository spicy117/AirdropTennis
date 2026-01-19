import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper functions to persist recovery mode
const RECOVERY_MODE_KEY = 'supabase_password_recovery_mode';

const getRecoveryModeFromStorage = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return localStorage.getItem(RECOVERY_MODE_KEY) === 'true';
  }
  return false;
};

const setRecoveryModeInStorage = (value) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (value) {
      localStorage.setItem(RECOVERY_MODE_KEY, 'true');
    } else {
      localStorage.removeItem(RECOVERY_MODE_KEY);
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [userRole, setUserRole] = useState(null);
  // Track if we just processed an email confirmation to prevent false SIGNED_OUT events
  const recentEmailConfirmationRef = useRef(false);

  // Helper to update recovery mode state and storage
  const updateRecoveryMode = (value) => {
    setIsPasswordRecovery(value);
    setRecoveryModeInStorage(value);
  };

  useEffect(() => {
    // Check localStorage first for persisted recovery mode
    const persistedRecoveryMode = getRecoveryModeFromStorage();
    
    // Check URL hash for recovery token
    let isRecoveryFromHash = false;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      isRecoveryFromHash = hash && hash.includes('type=recovery');
      if (isRecoveryFromHash) {
        updateRecoveryMode(true);
      } else if (persistedRecoveryMode) {
        // Restore persisted recovery mode
        updateRecoveryMode(true);
      }
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Check if this is a recovery session or email confirmation
      const hash = Platform.OS === 'web' && typeof window !== 'undefined' 
        ? window.location.hash 
        : '';
      const isRecovery = hash && hash.includes('type=recovery');
      const isSignupConfirmation = hash && hash.includes('type=signup');
      const isRecoveryMode = (isRecovery || isRecoveryFromHash || persistedRecoveryMode) && !isSignupConfirmation;
      
      if (isRecoveryMode) {
        updateRecoveryMode(true);
        // Don't set session for recovery - user needs to reset password first
        // Also sign out to clear any session Supabase might have stored
        if (session) {
          supabase.auth.signOut().catch(() => {
            // Ignore errors - we're already clearing the session
          });
        }
        setSession(null);
        setUser(null);
      } else {
        // Normal session or email confirmation - set the session
        // Clear any stale recovery mode for email confirmations
        if (isSignupConfirmation) {
          updateRecoveryMode(false);
        }
        setSession(session);
        setUser(session?.user ?? null);
        // Check role from profiles if needed
        if (session?.user) {
          await checkUserRole(session.user);
        }
      }
      setLoading(false);
    });

    // Listen for auth changes (including email verification callbacks)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email, 'Current session in state:', !!session);
      
      // Handle password recovery - don't auto-login
      if (event === 'PASSWORD_RECOVERY') {
        updateRecoveryMode(true);
        // Don't set session - user needs to reset password first
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      // Handle email verification
      if (event === 'SIGNED_IN' && session) {
        // Check if this is a recovery session by checking URL hash and persisted state
        const hash = Platform.OS === 'web' && typeof window !== 'undefined' 
          ? window.location.hash 
          : '';
        const isRecoverySession = hash && hash.includes('type=recovery');
        const isSignupConfirmation = hash && hash.includes('type=signup');
        const persistedRecovery = getRecoveryModeFromStorage();
        
        // Email confirmation (signup) should always sign the user in
        if (isSignupConfirmation) {
          // This is an email confirmation - clear any stale recovery mode and sign in
          updateRecoveryMode(false);
          setSession(session);
          setUser(session?.user ?? null);
          // Mark that we just processed an email confirmation
          // Keep this flag for longer to prevent false SIGNED_OUT events
          recentEmailConfirmationRef.current = true;
          // Clear the flag after a longer delay (to handle delayed SIGNED_OUT events)
          setTimeout(() => {
            recentEmailConfirmationRef.current = false;
          }, 5000); // Increased from 2000ms to 5000ms
          // Check role from profiles if needed
          if (session?.user) {
            await checkUserRole(session.user);
          }
          setLoading(false);
          console.log('Email confirmation processed - session set, flag set for 5 seconds');
          return;
        }
        
        // Only sign in if not in recovery mode
        // Clear persisted recovery if this is a normal sign-in (no recovery token in URL)
        if (!isPasswordRecovery && !isRecoverySession && !persistedRecovery) {
          // Normal sign-in - clear any stale persisted recovery mode
          updateRecoveryMode(false);
          setSession(session);
          setUser(session?.user ?? null);
          // Check role from profiles if needed
          if (session?.user) {
            await checkUserRole(session.user);
          }
          setLoading(false);
        } else if (isRecoverySession) {
          // Recovery session - don't auto-login
          updateRecoveryMode(true);
          setSession(null);
          setUser(null);
          setLoading(false);
        } else if (persistedRecovery && !isRecoverySession) {
          // Persisted recovery exists but no recovery token in URL - clear it and sign in
          // This handles the case where user previously tried password reset but now signs in normally
          updateRecoveryMode(false);
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await checkUserRole(session.user);
          }
          setLoading(false);
        } else {
          // Recovery session - don't auto-login
          updateRecoveryMode(true);
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Check persisted recovery mode
        const persistedRecovery = getRecoveryModeFromStorage();
        // Only refresh if not in recovery mode
        if (!isPasswordRecovery && !persistedRecovery) {
          setSession(session);
          setUser(session?.user ?? null);
          // Check role from profiles if needed
          if (session?.user) {
            await checkUserRole(session.user);
          }
        } else {
          // Still in recovery mode - don't set session
          updateRecoveryMode(true);
          setSession(null);
          setUser(null);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('SIGNED_OUT event received, checking if session actually exists...');
        console.log('Current session state:', !!session, 'Session value:', session);
        
        // Check if we just processed an email confirmation
        const isRecentEmailConfirmation = recentEmailConfirmationRef.current;
        const hash = Platform.OS === 'web' && typeof window !== 'undefined' 
          ? window.location.hash 
          : '';
        const isSignupConfirmation = hash && hash.includes('type=signup');
        
        console.log('Email confirmation check:', {
          isRecentEmailConfirmation,
          isSignupConfirmation,
          hash: hash ? hash.substring(0, 50) : 'no hash'
        });
        
        // If this is a recent email confirmation, wait a bit before checking session
        // Supabase might need time to fully process the confirmation
        if (isRecentEmailConfirmation || isSignupConfirmation) {
          console.log('SIGNED_OUT during email confirmation - waiting before verifying...');
          // Wait a bit for Supabase to process
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // If session is already null and not an email confirmation, proceed immediately
        const hasSessionInState = session !== null;
        if (!hasSessionInState && !isRecentEmailConfirmation && !isSignupConfirmation) {
          console.log('Session already null and not email confirmation - proceeding to clear immediately');
          // Actually signed out - clear session and reset email confirmation flag
          console.log('✅ Actually signed out - clearing session and user (fast path)');
          recentEmailConfirmationRef.current = false;
          setSession(null);
          setUser(null);
          setLoading(false);
          console.log('✅ Session and user cleared, loading set to false - state updates dispatched');
          return;
        }
        
        // Always verify we're actually signed out before clearing the session
        // This prevents false positives from race conditions or event ordering issues
        console.log('Calling supabase.auth.getSession()...');
        let currentSession = null;
        try {
          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 1000))
          ]);
          currentSession = sessionResult?.data?.session;
          console.log('Supabase getSession result:', !!currentSession, 'Error:', sessionResult?.error);
        } catch (error) {
          console.error('Error getting session (or timeout):', error);
          // If getSession fails or times out, assume we're signed out
          currentSession = null;
        }
        
        console.log('Session state check:', {
          hasSessionInState,
          currentSession: !!currentSession,
          shouldIgnore: currentSession || (hasSessionInState && (isRecentEmailConfirmation || isSignupConfirmation))
        });
        
        if (currentSession || (hasSessionInState && (isRecentEmailConfirmation || isSignupConfirmation))) {
          // We still have a session, so this SIGNED_OUT event is a false positive
          // This can happen during email confirmation or other auth flows
          console.log('SIGNED_OUT event received, but session still exists or was just confirmed - ignoring and restoring session', {
            hasCurrentSession: !!currentSession,
            hasSessionInState,
            isRecentEmailConfirmation,
            isSignupConfirmation
          });
          
          if (isSignupConfirmation || isRecentEmailConfirmation) {
            // Clear any stale recovery mode for email confirmations
            updateRecoveryMode(false);
          }
          
          // Restore the session (use currentSession if available, otherwise keep existing)
          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            if (currentSession?.user) {
              await checkUserRole(currentSession.user);
            }
          } else if (hasSessionInState) {
            // Session exists in state but not in Supabase yet - wait a bit more and check again
            console.log('Session in state but not in Supabase yet - checking again...');
            await new Promise(resolve => setTimeout(resolve, 200));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              setSession(retrySession);
              setUser(retrySession?.user ?? null);
              if (retrySession?.user) {
                await checkUserRole(retrySession.user);
              }
            } else {
              // Still no session, but keep the one in state for now
              console.log('Still no session in Supabase, but keeping session in state');
            }
          }
          setLoading(false);
          return;
        }
        
        // Actually signed out - clear session and reset email confirmation flag
        console.log('✅ Actually signed out - clearing session and user');
        recentEmailConfirmationRef.current = false;
        // Ensure we clear the session even if it's already null (force state update)
        setSession((prevSession) => {
          console.log('setSession called, previous session:', !!prevSession, 'Setting to null');
          return null;
        });
        setUser((prevUser) => {
          console.log('setUser called, previous user:', !!prevUser, 'Setting to null');
          return null;
        });
        setLoading((prevLoading) => {
          console.log('setLoading called, previous loading:', prevLoading, 'Setting to false');
          return false;
        });
        console.log('✅ Session and user cleared, loading set to false - state updates dispatched');
      } else {
        // Check persisted recovery mode before setting session
        const persistedRecovery = getRecoveryModeFromStorage();
        if (!persistedRecovery) {
          setSession(session);
          setUser(session?.user ?? null);
          // Check role from profiles if needed
          if (session?.user) {
            await checkUserRole(session.user);
          }
        } else {
          // Still in recovery mode
          updateRecoveryMode(true);
          setSession(null);
          setUser(null);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async (user) => {
    // Check user_metadata first
    let role = user?.user_metadata?.role;
    
    // If not in user_metadata, check profiles table
    if (!role || (role !== 'admin' && role !== 'coach' && role !== 'student')) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile?.role) {
          role = profile.role;
        }
      } catch (error) {
        console.error('Error checking profile role:', error);
      }
    }
    
    setUserRole(role);
  };

  const signUp = async (email, password, userData) => {
    try {
      console.log('Attempting signup with:', { email, hasPassword: !!password });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData, // Additional user metadata
        },
      });

      if (error) {
        console.error('Signup error:', error);
        // Log full error details for debugging
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          status: error.status,
          name: error.name,
        });
        
        // Check for duplicate email errors in various formats
        const errorMessage = (error.message || '').toLowerCase();
        const errorCode = (error.code || '').toLowerCase();
        
        if (
          errorMessage.includes('already registered') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('user already') ||
          errorCode.includes('user_already') ||
          errorCode.includes('email_exists')
        ) {
          const duplicateError = {
            message: 'User already registered',
            code: 'user_already_registered',
            originalError: error,
          };
          return { data: null, error: duplicateError };
        }
        
        throw error;
      }
      
      // Log the full response for debugging
      const userCreatedAt = data?.user?.created_at;
      const now = new Date();
      const createdAt = userCreatedAt ? new Date(userCreatedAt) : null;
      const secondsSinceCreation = createdAt ? (now - createdAt) / 1000 : null;
      
      console.log('Signup response:', {
        hasData: !!data,
        hasUser: !!data?.user,
        userId: data?.user?.id,
        email: data?.user?.email,
        emailConfirmed: data?.user?.email_confirmed_at,
        hasSession: !!data?.session,
        createdAt: userCreatedAt,
        secondsSinceCreation,
      });
      
      // Additional check: if no user was created, it might be a duplicate email
      if (!data || !data.user) {
        console.warn('Signup returned success but no user was created - likely duplicate email');
        const duplicateError = {
          message: 'User already registered',
          code: 'user_already_registered',
        };
        return { data: null, error: duplicateError };
      }
      
      // Check if we have a session - if yes, it's definitely a new account
      if (data.session) {
        console.log('Signup success with session - new account created');
        // Update profile with phone number if provided
        if (userData?.phone && data.user?.id) {
          try {
            await supabase
              .from('profiles')
              .update({ phone: userData.phone })
              .eq('id', data.user.id);
            console.log('Phone number saved to profile');
          } catch (phoneError) {
            console.warn('Failed to save phone number:', phoneError);
            // Don't fail signup if phone save fails
          }
        }
        return { data, error: null };
      }
      
      // When email confirmations are enabled, Supabase returns a user object but no session.
      // If the email is not confirmed, we should NOT try to sign in as it will create
      // a temporary session that gets invalidated, causing the user to be signed out.
      const emailConfirmed = data?.user?.email_confirmed_at;
      
      if (!emailConfirmed) {
        // Email not confirmed - this is expected for new signups with email confirmation enabled
        // Don't try to sign in, just return the signup data
        console.log('Signup success - new account created, email verification required');
        // Update profile with phone number if provided (profile should exist from trigger)
        if (userData?.phone && data.user?.id) {
          try {
            await supabase
              .from('profiles')
              .update({ phone: userData.phone })
              .eq('id', data.user.id);
            console.log('Phone number saved to profile');
          } catch (phoneError) {
            console.warn('Failed to save phone number:', phoneError);
            // Don't fail signup if phone save fails
          }
        }
        return { data, error: null };
      }
      
      // Email is confirmed but no session - this is unusual, but try to sign in
      // This might happen if email confirmations were disabled or user confirmed before this check
      console.log('No session after signup but email is confirmed, attempting sign in...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        const errorMsg = (signInError.message || '').toLowerCase();
        
        // If it's "Invalid login credentials", the email likely already exists with a different password
        if (errorMsg.includes('invalid login') || 
            errorMsg.includes('invalid credentials') ||
            errorMsg.includes('invalid password')) {
          console.warn('Sign in failed with invalid credentials - likely duplicate email');
          const duplicateError = {
            message: 'User already registered',
            code: 'user_already_registered',
          };
          return { data: null, error: duplicateError };
        }
        
        // Other errors - log but assume it's a new account (might be network issues, etc.)
        console.warn('Sign in check failed with unexpected error:', signInError);
        return { data, error: null };
      }
      
      // Sign in succeeded - check if user ID matches
      if (signInData?.user?.id === data.user?.id) {
        // Same user ID - new account that we can sign into
        console.log('Signup success - new account created and signed in');
        return { data: signInData, error: null };
      } else {
        // Different user ID - email already existed, we signed into the existing account
        console.warn('Sign in returned different user ID - email already exists');
        // Sign out since we don't want to sign into someone else's account
        await supabase.auth.signOut();
        const duplicateError = {
          message: 'User already registered',
          code: 'user_already_registered',
        };
        return { data: null, error: duplicateError };
      }
    } catch (error) {
      console.error('Signup catch error:', error);
      // Check error in catch block too
      const errorMessage = (error?.message || '').toLowerCase();
      const errorCode = (error?.code || '').toLowerCase();
      
      if (
        errorMessage.includes('already registered') ||
        errorMessage.includes('already exists') ||
        errorMessage.includes('user already') ||
        errorCode.includes('user_already') ||
        errorCode.includes('email_exists')
      ) {
        const duplicateError = {
          message: 'User already registered',
          code: 'user_already_registered',
          originalError: error,
        };
        return { data: null, error: duplicateError };
      }
      
      return { data: null, error };
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // Check role from user_metadata first
      let userRole = data.user?.user_metadata?.role;
      
      // If not in user_metadata, check profiles table
      if (!userRole || (userRole !== 'admin' && userRole !== 'coach' && userRole !== 'student')) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        
        if (!profileError && profile?.role) {
          userRole = profile.role;
          
          // Sync role back to user_metadata for future logins
          if (userRole === 'admin' || userRole === 'coach' || userRole === 'student') {
            await supabase.auth.updateUser({
              data: { role: userRole }
            });
          }
        }
      }
      
      // Update state
      setUserRole(userRole);
      
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const resendVerificationEmail = async (email) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const resetPassword = async (email) => {
    try {
      const options = {};
      
      // Set redirect URL for web platform
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        options.redirectTo = `${window.location.origin}/reset-password`;
      }
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, options);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      // Clear recovery mode after successful password update
      updateRecoveryMode(false);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const isAdmin = () => {
    // Check both user_metadata and state
    const metadataRole = user?.user_metadata?.role;
    const profileRole = userRole;
    
    return (
      metadataRole === 'admin' || 
      metadataRole === 'coach' ||
      profileRole === 'admin' || 
      profileRole === 'coach'
    );
  };

  const value = {
    session,
    user,
    userRole,
    loading,
    isPasswordRecovery,
    setIsPasswordRecovery,
    signUp,
    signIn,
    signOut,
    resendVerificationEmail,
    resetPassword,
    updatePassword,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
