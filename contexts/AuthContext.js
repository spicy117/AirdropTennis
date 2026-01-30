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
  // True while we have a user but haven't yet resolved role from profiles (prevents nav flicker)
  const roleLoading = user !== null && userRole === null;
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

    // Get initial session with timeout to prevent hanging
    Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session load timeout')), 2000)
      )
    ]).then(async (result) => {
      const { data: { session } } = result;
      try {
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
          setUserRole(null);
        } else {
          // Normal session or email confirmation - set the session
          // Clear any stale recovery mode for email confirmations
          if (isSignupConfirmation) {
            updateRecoveryMode(false);
          }
          setSession(session);
          setUser(session?.user ?? null);
          // Check role from profiles if needed (don't await - let it run in background)
          if (session?.user) {
            checkUserRole(session.user).catch(err => {
              console.error('Error checking user role:', err);
            });
          }
        }
      } catch (error) {
        console.error('Error processing session:', error);
        // Still set loading to false so app can render
      } finally {
        setLoading(false);
      }
    }).catch((error) => {
      // Handle errors getting session - don't block the app from loading
      console.error('Error getting initial session (or timeout):', error);
      setSession(null);
      setUser(null);
      setUserRole(null);
      setLoading(false);
    });

    // Listen for auth changes (including email verification callbacks)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle password recovery - don't auto-login
      if (event === 'PASSWORD_RECOVERY') {
        updateRecoveryMode(true);
        // Don't set session - user needs to reset password first
        setSession(null);
        setUser(null);
        setUserRole(null);
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
          setTimeout(() => {
            recentEmailConfirmationRef.current = false;
          }, 5000);
          if (session?.user) {
            await checkUserRole(session.user);
          }
          setLoading(false);
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
          setUserRole(null);
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
          setUserRole(null);
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
          setUserRole(null);
        }
      } else if (event === 'SIGNED_OUT') {
        const isRecentEmailConfirmation = recentEmailConfirmationRef.current;
        const hash = Platform.OS === 'web' && typeof window !== 'undefined' 
          ? window.location.hash 
          : '';
        const isSignupConfirmation = hash && hash.includes('type=signup');
        
        if (isRecentEmailConfirmation || isSignupConfirmation) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const hasSessionInState = session !== null;
        if (!hasSessionInState && !isRecentEmailConfirmation && !isSignupConfirmation) {
          recentEmailConfirmationRef.current = false;
          setSession(null);
          setUser(null);
          setUserRole(null);
          setLoading(false);
          return;
        }
        
        let currentSession = null;
        try {
          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 300))
          ]);
          currentSession = sessionResult?.data?.session;
        } catch {
          currentSession = null;
        }
        
        if (currentSession || (hasSessionInState && (isRecentEmailConfirmation || isSignupConfirmation))) {
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
            await new Promise(resolve => setTimeout(resolve, 200));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              setSession(retrySession);
              setUser(retrySession?.user ?? null);
              if (retrySession?.user) {
                await checkUserRole(retrySession.user);
              }
            }
          }
          setLoading(false);
          return;
        }
        
        recentEmailConfirmationRef.current = false;
        setSession(null);
        setUser(null);
        setLoading(false);
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
          setUserRole(null);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async (user) => {
    // Profiles table is the source of truth; fallback to user_metadata only if profile has no role
    let role = null;
    try {
      // Add timeout to prevent hanging
      const profileQuery = supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const { data: profile } = await Promise.race([
        profileQuery,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Role query timeout')), 3000)
        )
      ]);
      
      if (profile?.role && ['admin', 'coach', 'student'].includes(profile.role)) {
        role = profile.role;
      }
    } catch (e) {
      // ignore - will fallback to user_metadata
    }
    if (!role && user?.user_metadata?.role && ['admin', 'coach', 'student'].includes(user.user_metadata.role)) {
      role = user.user_metadata.role;
    }
    setUserRole(role || 'student');
  };

  const signUp = async (email, password, userData) => {
    try {
      const options = { data: userData };
      // Ensure verification link redirects to this app (web). Supabase uses Site URL if not set.
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
        options.emailRedirectTo = window.location.origin;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options,
      });

      if (error) {
        console.error('Signup error:', error);
        
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
      
      if (!data || !data.user) {
        const duplicateError = {
          message: 'User already registered',
          code: 'user_already_registered',
        };
        return { data: null, error: duplicateError };
      }
      
      if (data.session) {
        if (userData?.phone && data.user?.id) {
          try {
            await supabase
              .from('profiles')
              .update({ phone: userData.phone })
              .eq('id', data.user.id);
          } catch {
            // Don't fail signup if phone save fails
          }
        }
        return { data, error: null };
      }
      
      const emailConfirmed = data?.user?.email_confirmed_at;
      
      if (!emailConfirmed) {
        if (userData?.phone && data.user?.id) {
          try {
            await supabase
              .from('profiles')
              .update({ phone: userData.phone })
              .eq('id', data.user.id);
          } catch {
            // Don't fail signup if phone save fails
          }
        }
        return { data, error: null };
      }
      
      // Email confirmed but no session - try to sign in
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
          const duplicateError = {
            message: 'User already registered',
            code: 'user_already_registered',
          };
          return { data: null, error: duplicateError };
        }
        
        return { data, error: null };
      }
      
      if (signInData?.user?.id === data.user?.id) {
        return { data: signInData, error: null };
      } else {
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
    if (userRole === 'coach') return false;
    const metadataRole = user?.user_metadata?.role;
    const profileRole = userRole;
    return profileRole === 'admin' || metadataRole === 'admin';
  };

  const refreshUserRole = async () => {
    if (user) {
      await checkUserRole(user);
    }
  };

  const value = {
    session,
    user,
    userRole,
    roleLoading,
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
    refreshUserRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
