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

/** Create or update public.profiles for an auth user (signup / first login). */
async function ensureUserProfile(user, userData = {}, { forceRole } = {}) {
  if (!user?.id) return;

  const meta = { ...(user.user_metadata || {}), ...userData };
  const role =
    forceRole ||
    (['admin', 'coach', 'student'].includes(meta.role) ? meta.role : 'student');
  const first_name = meta.first_name || null;
  const last_name = meta.last_name || null;
  const full_name =
    meta.full_name ||
    [first_name, last_name].filter(Boolean).join(' ').trim() ||
    user.email ||
    null;
  const phone = meta.phone || null;
  const email = user.email || meta.email || null;

  let academy_id = null;
  try {
    const { data: academy } = await supabase
      .from('academies')
      .select('id')
      .eq('subdomain_prefix', 'airdroptennis')
      .maybeSingle();
    academy_id = academy?.id ?? null;
  } catch {
    // academies table optional during setup
  }

  const profileFields = {
    first_name,
    last_name,
    full_name,
    phone,
    email,
    ...(academy_id ? { academy_id } : {}),
  };

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existing?.id) {
    // Never overwrite role from auth metadata on update — admins are promoted in Supabase/dashboard.
    const updatePayload = forceRole ? { ...profileFields, role: forceRole } : profileFields;
    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', user.id);
    if (error) console.error('ensureUserProfile update failed:', error.message);
    return;
  }

  const { error: insertError } = await supabase.from('profiles').insert({
    id: user.id,
    ...profileFields,
    role,
  });
  if (insertError) {
    console.error('ensureUserProfile insert failed:', insertError.message);
  }
}

// Fallback only if INITIAL_SESSION never fires (do not call getSession in parallel with onAuthStateChange — it can hang).
const AUTH_INIT_FALLBACK_MS = 5000;
const PROFILE_ROLE_LOAD_TIMEOUT_MS = 8000;

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
  const resolveProfileAndRoleRef = useRef(null);
  const initialSessionHandledRef = useRef(false);

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

    const applyInitialSession = (session) => {
      const hash =
        Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash : '';
      const isRecovery = hash && hash.includes('type=recovery');
      const isSignupConfirmation = hash && hash.includes('type=signup');
      const isRecoveryMode =
        (isRecovery || isRecoveryFromHash || persistedRecoveryMode) && !isSignupConfirmation;

      if (isRecoveryMode) {
        updateRecoveryMode(true);
        if (session) {
          supabase.auth.signOut().catch(() => {});
        }
        setSession(null);
        setUser(null);
        setUserRole(null);
        return;
      }

      if (isSignupConfirmation) {
        updateRecoveryMode(false);
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Don't clear role on reload (same user) — only clear when account changes
        const switchingUser = user?.id && user.id !== session.user.id;
        resolveProfileAndRoleRef.current?.(session.user, {
          clearStaleRole: !!switchingUser,
        });
      } else {
        setUserRole(null);
      }
    };

    // Listen for auth changes (including email verification callbacks)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        initialSessionHandledRef.current = true;
        applyInitialSession(session);
        setLoading(false);
        return;
      }

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
            resolveProfileAndRoleRef.current?.(session.user, { clearStaleRole: true });
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
          if (session?.user) {
            resolveProfileAndRoleRef.current?.(session.user, { clearStaleRole: true });
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
            resolveProfileAndRoleRef.current?.(session.user, { clearStaleRole: true });
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
          if (session?.user) {
            resolveProfileAndRoleRef.current?.(session.user);
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
              resolveProfileAndRoleRef.current?.(currentSession.user);
            }
          } else if (hasSessionInState) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              setSession(retrySession);
              setUser(retrySession?.user ?? null);
              if (retrySession?.user) {
                resolveProfileAndRoleRef.current?.(retrySession.user);
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
          if (session?.user) {
            resolveProfileAndRoleRef.current?.(session.user);
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

    const fallbackTimer = setTimeout(async () => {
      if (initialSessionHandledRef.current) return;
      initialSessionHandledRef.current = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        applyInitialSession(session);
      } catch (e) {
        console.warn('Auth init fallback:', e?.message || e);
        setSession(null);
        setUser(null);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    }, AUTH_INIT_FALLBACK_MS);

    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const checkUserRole = async (user) => {
    if (!user?.id) {
      setUserRole(null);
      return null;
    }

    let role = null;
    try {
      const { data: profile, error: profileError } = await Promise.race([
        supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Role query timeout')), 2500)
        ),
      ]);

      if (profileError) {
        console.error('checkUserRole profiles error:', profileError.message);
      }
      if (profile?.role && ['admin', 'coach', 'student'].includes(profile.role)) {
        role = profile.role;
      }
    } catch (e) {
      console.error('checkUserRole failed:', e?.message || e);
    }

    // Only use metadata when profiles row is missing — never override a resolved profile role
    if (!role && user?.user_metadata?.role && ['admin', 'coach', 'student'].includes(user.user_metadata.role)) {
      role = user.user_metadata.role;
    }

    const resolved = role || 'student';
    setUserRole(resolved);

    // Sync metadata in background — never block login on this
    if (role && role !== user.user_metadata?.role) {
      void supabase.auth.updateUser({ data: { role } }).catch(() => {});
    }
    return resolved;
  };

  const resolveProfileAndRole = (user, { clearStaleRole = false } = {}) => {
    if (!user?.id) {
      setUserRole(null);
      return;
    }
    // Only clear when switching accounts; clearing on every reload causes an infinite spinner
    // if the profiles read is slow/blocked.
    if (clearStaleRole) {
      setUserRole(null);
    }

    const fallbackRole = () => {
      const meta = user?.user_metadata?.role;
      setUserRole(['admin', 'coach', 'student'].includes(meta) ? meta : 'student');
    };

    // Always unblock UI within a few seconds even if Supabase hangs
    const hardTimeout = setTimeout(fallbackRole, 3500);

    void (async () => {
      try {
        await checkUserRole(user);
      } catch (e) {
        console.error('resolveProfileAndRole role failed:', e?.message || e);
        fallbackRole();
      } finally {
        clearTimeout(hardTimeout);
      }
      // Profile field sync must not gate role / UI
      try {
        await Promise.race([
          ensureUserProfile(user),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile sync timeout')), PROFILE_ROLE_LOAD_TIMEOUT_MS)
          ),
        ]);
      } catch (e) {
        console.warn('ensureUserProfile skipped:', e?.message || e);
      }
    })();
  };
  resolveProfileAndRoleRef.current = resolveProfileAndRole;

  const signUp = async (email, password, userData) => {
    try {
      // Public signup is always student (coaches/admins are created in admin flows)
      const signupMeta = { ...userData, role: 'student' };
      const options = { data: signupMeta };
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

      // DB trigger should create profile; this covers immediate session + confirmed signup
      if (data.session) {
        await ensureUserProfile(data.user, signupMeta, { forceRole: 'student' });
        await checkUserRole(data.user);
        return { data, error: null };
      }

      const emailConfirmed = data?.user?.email_confirmed_at;

      if (!emailConfirmed) {
        // No session until email is confirmed — profile must come from handle_new_user trigger
        return { data, error: null };
      }

      await ensureUserProfile(data.user, signupMeta, { forceRole: 'student' });
      
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

      setUserRole(null);
      await checkUserRole(data.user);
      await ensureUserProfile(data.user);

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

  const isAdmin = () => userRole === 'admin';

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
