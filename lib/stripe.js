import { loadStripe } from '@stripe/stripe-js';
import { Platform } from 'react-native';
import { supabase } from './supabase';

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
    // #region agent log
    try {
      const logData = JSON.stringify({location:'stripe.js:164',message:'verifyPaymentAndAddFunds called',data:{sessionId,userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'});
      fetch('http://127.0.0.1:7243/ingest/990d24e9-9395-464d-a5dc-85b6df2740b2',{method:'POST',headers:{'Content-Type':'application/json'},body:logData}).catch(()=>{});
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const existingLogs = JSON.parse(window.localStorage.getItem('debug_logs') || '[]');
        existingLogs.push(JSON.parse(logData));
        window.localStorage.setItem('debug_logs', JSON.stringify(existingLogs.slice(-50)));
      }
    } catch(e) {}
    // #endregion
    console.log('📞 [DEBUG] Calling Edge Function to verify payment...', { sessionId, userId });
    
    // #region agent log
    try {
      const logData = JSON.stringify({location:'stripe.js:168',message:'About to invoke Edge Function',data:{functionName:'dynamic-task',body:{action:'verify-payment',sessionId,userId}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'});
      fetch('http://127.0.0.1:7243/ingest/990d24e9-9395-464d-a5dc-85b6df2740b2',{method:'POST',headers:{'Content-Type':'application/json'},body:logData}).catch(()=>{});
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const existingLogs = JSON.parse(window.localStorage.getItem('debug_logs') || '[]');
        existingLogs.push(JSON.parse(logData));
        window.localStorage.setItem('debug_logs', JSON.stringify(existingLogs.slice(-50)));
      }
    } catch(e) {}
    // #endregion
    // Call Edge Function to verify payment and add funds
    // The function will retrieve the session from Stripe and add funds if payment was successful
    const { data, error } = await supabase.functions.invoke('dynamic-task', {
      body: {
        action: 'verify-payment',
        sessionId,
        userId,
      },
    });

    // #region agent log
    try {
      const logData = JSON.stringify({location:'stripe.js:177',message:'Edge Function response received',data:{hasError:!!error,hasData:!!data,errorMessage:error?.message,errorCode:error?.code,dataKeys:data?Object.keys(data):null,newBalance:data?.newBalance,success:data?.success,type:data?.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'});
      fetch('http://127.0.0.1:7243/ingest/990d24e9-9395-464d-a5dc-85b6df2740b2',{method:'POST',headers:{'Content-Type':'application/json'},body:logData}).catch(()=>{});
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const existingLogs = JSON.parse(window.localStorage.getItem('debug_logs') || '[]');
        existingLogs.push(JSON.parse(logData));
        window.localStorage.setItem('debug_logs', JSON.stringify(existingLogs.slice(-50)));
      }
    } catch(e) {}
    // #endregion
    if (error) {
      // #region agent log
      try {
        const logData = JSON.stringify({location:'stripe.js:179',message:'Edge Function returned error',data:{errorMessage:error.message,errorString:error.toString(),errorName:error.name,errorCode:error.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
        fetch('http://127.0.0.1:7243/ingest/990d24e9-9395-464d-a5dc-85b6df2740b2',{method:'POST',headers:{'Content-Type':'application/json'},body:logData}).catch(()=>{});
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          const existingLogs = JSON.parse(window.localStorage.getItem('debug_logs') || '[]');
          existingLogs.push(JSON.parse(logData));
          window.localStorage.setItem('debug_logs', JSON.stringify(existingLogs.slice(-50)));
        }
      } catch(e) {}
      // #endregion
      console.error('❌ [DEBUG] Edge Function error:', error);
      throw error;
    }

    console.log('✅ [DEBUG] Edge Function response:', data);
    return data;
  } catch (error) {
    // #region agent log
    try {
      const logData = JSON.stringify({location:'stripe.js:185',message:'Exception in verifyPaymentAndAddFunds',data:{errorMessage:error.message,errorString:error.toString(),errorName:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
      fetch('http://127.0.0.1:7243/ingest/990d24e9-9395-464d-a5dc-85b6df2740b2',{method:'POST',headers:{'Content-Type':'application/json'},body:logData}).catch(()=>{});
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const existingLogs = JSON.parse(window.localStorage.getItem('debug_logs') || '[]');
        existingLogs.push(JSON.parse(logData));
        window.localStorage.setItem('debug_logs', JSON.stringify(existingLogs.slice(-50)));
      }
    } catch(e) {}
    // #endregion
    console.error('❌ Error verifying payment:', error);
    console.error('Error details:', {
      message: error.message,
      error: error.toString(),
    });
    throw error;
  }
};

export default getStripe;
