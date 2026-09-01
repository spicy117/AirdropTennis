import { loadStripe } from '@stripe/stripe-js';
import { Platform } from 'react-native';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

// When true, Stripe checkout is blocked and users see "This feature will be available soon"
export const STRIPE_CHECKOUT_DISABLED = false;

// Initialize Stripe with your publishable key
// Replace with your actual Stripe publishable key from Stripe Dashboard
// Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env file or environment variables
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here';

// Validate Stripe key on web platform
if (typeof window !== 'undefined' && STRIPE_PUBLISHABLE_KEY === 'pk_test_your_key_here') {
  console.warn('⚠️ Stripe publishable key not configured. Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env file.');
}

let stripePromise = null;

const getStripe = () => {
  if (!stripePromise) {
    if (STRIPE_PUBLISHABLE_KEY === 'pk_test_your_key_here') {
      console.error('❌ Stripe publishable key not configured. Payments will not work.');
    }
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

/**
 * Create a Stripe Checkout Session for booking payment
 * This calls a Supabase Edge Function that creates the session server-side
 */
export const createBookingCheckoutSession = async ({ userId, amount, bookingData, metadata = {} }) => {
  try {
    // Call Supabase Edge Function to create checkout session
    // The Edge Function will handle Stripe secret key securely
    const { data, error } = await supabase.functions.invoke('dynamic-task', {
      body: {
        userId,
        amount: Math.round(amount * 100), // Convert to cents
        bookingData,
        metadata: {
          ...metadata,
          type: 'booking',
        },
      },
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Create a Stripe Checkout Session for wallet top-up
 */
export const createTopUpCheckoutSession = async ({ userId, amount, metadata = {} }) => {
  try {
    const { data, error } = await supabase.functions.invoke('dynamic-task', {
      body: {
        userId,
        amount: Math.round(amount * 100), // Convert to cents
        metadata: {
          ...metadata,
          type: 'topup',
        },
      },
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating top-up checkout session:', error);
    throw error;
  }
};

/**
 * Redirect to Stripe Checkout using the session URL
 * Note: redirectToCheckout is deprecated in newer Stripe.js versions
 */
export const redirectToCheckout = async (checkoutUrl) => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // For web, redirect directly to the checkout URL
      window.location.href = checkoutUrl;
    } else {
      // For native, you might need to use Linking or a WebView
      throw new Error('Checkout redirect not implemented for native platforms');
    }
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    throw error;
  }
};

/**
 * Get user's wallet balance from Supabase
 */
export const getWalletBalance = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return parseFloat(data?.wallet_balance || 0);
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    throw error;
  }
};

/**
 * Admin-only manual wallet adjustment (delta-based, audited server-side).
 */
export const adminAdjustWallet = async ({ userId, amount, direction, reason, note }) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    const err = new Error('not_authenticated');
    err.code = 'not_authenticated';
    throw err;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-adjust-wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      userId,
      amount,
      direction,
      reason,
      note: note || null,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('Credit adjustment failed', {
      status: res.status,
      code: data.code,
      message: data.error,
      studentId: userId,
      direction,
      amount,
      reason,
    });
    const err = new Error(data.error || 'adjust_failed');
    err.code = data.code || 'adjust_failed';
    throw err;
  }

  return data;
};

/**
 * Deduct amount from user's wallet
 * This should be called server-side via Edge Function for security
 */
export const deductFromWallet = async (userId, amount) => {
  try {
    const { data, error } = await supabase.functions.invoke('deduct-wallet', {
      body: {
        userId,
        amount,
      },
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error deducting from wallet:', error);
    throw error;
  }
};

/**
 * Add amount to user's wallet (after successful payment)
 * This should be called server-side via Edge Function for security
 */
export const addToWallet = async (userId, amount) => {
  try {
    const { data, error } = await supabase.functions.invoke('smart-action', {
      body: {
        userId,
        amount,
      },
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error adding to wallet:', error);
    throw error;
  }
};

/**
 * Verify payment and add funds to wallet (for top-ups)
 * This calls an Edge Function that retrieves the session from Stripe and adds funds
 */
export const verifyPaymentAndAddFunds = async (sessionId, userId) => {
  try {
    // Call with the public anon key, not the user JWT. After Stripe redirect the
    // user session is often missing/expired, which made functions.invoke 401.
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dynamic-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        action: 'verify-payment',
        sessionId,
        userId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Payment verification failed (${res.status})`);
    }
    return data;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};

export default getStripe;
