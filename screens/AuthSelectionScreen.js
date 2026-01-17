import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import SignInScreen from './SignInScreen';
import SignUpScreen from './SignUpScreen';

const getWindowWidth = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth;
  }
  return Dimensions.get('window').width;
};

const isDesktop = () => {
  if (Platform.OS === 'web') {
    return getWindowWidth() > 768;
  }
  return false;
};

export default function AuthSelectionScreen({ navigation, route }) {
  // Get initial tab from URL or route params, default to 'login'
  const getInitialTab = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('/signup')) return 'signup';
      if (path.includes('/login')) return 'login';
    }
    return route?.params?.tab || 'login';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [desktop, setDesktop] = useState(isDesktop());

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleResize = () => {
        setDesktop(isDesktop());
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Sync active tab with URL changes (browser back/forward)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const updateTabFromUrl = () => {
        const path = window.location.pathname;
        if (path.includes('/login')) {
          setActiveTab('login');
        } else if (path.includes('/signup')) {
          setActiveTab('signup');
        }
      };
      
      // Listen for browser back/forward
      window.addEventListener('popstate', updateTabFromUrl);
      return () => window.removeEventListener('popstate', updateTabFromUrl);
    }
  }, []);

  // Update document title based on active tab (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const title = activeTab === 'login' 
        ? 'Log In - Airdrop Tennis' 
        : 'Sign Up - Airdrop Tennis';
      document.title = title;
    }
  }, [activeTab]);

  // Update URL when tab changes (web only)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const newPath = tab === 'login' ? '/login' : '/signup';
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', newPath);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        {desktop && (
          <View style={styles.sidePanel}>
            <View style={styles.illustrationContainer}>
              <Text style={styles.illustrationEmoji}>🎾</Text>
              <Text style={styles.illustrationTitle}>Welcome to Airdrop Tennis</Text>
              <Text style={styles.illustrationText}>
                Book high‑quality tennis coaching in just a few taps. Track your sessions,
                manage your schedule, and improve your game faster.
              </Text>
              <View style={styles.testimonial}>
                <Text style={styles.starRating}>★★★★★</Text>
                <Text style={styles.testimonialText}>
                  "Airdrop Tennis makes it so easy to find great coaches and stay consistent
                  with training."
                </Text>
                <Text style={styles.testimonialAuthor}>— Airdrop Tennis Student</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.authCard}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'login' && styles.tabActive]}
              onPress={() => handleTabChange('login')}
              accessible={true}
              accessibilityLabel="Log in tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'login' }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'login' && styles.tabTextActive,
                ]}
              >
                Log In
              </Text>
              {activeTab === 'login' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'signup' && styles.tabActive]}
              onPress={() => handleTabChange('signup')}
              accessible={true}
              accessibilityLabel="Sign up tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'signup' }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'signup' && styles.tabTextActive,
                ]}
              >
                Sign Up
              </Text>
              {activeTab === 'signup' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            {activeTab === 'login' ? (
              <SignInScreen navigation={navigation} embedded={true} />
            ) : (
              <SignUpScreen navigation={navigation} embedded={true} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    ...(Platform.OS === 'web' && {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      paddingVertical: 40,
    }),
  },
  contentRow: {
    width: '100%',
    ...(Platform.OS === 'web' && {
      maxWidth: 980,
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
    }),
  },
  sidePanel: {
    flex: 1,
    maxWidth: 500,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    ...(Platform.OS === 'web' && {
      display: 'flex',
    }),
  },
  illustrationContainer: {
    alignItems: 'center',
  },
  illustrationEmoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  illustrationTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  illustrationText: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 28,
  },
  testimonial: {
    backgroundColor: '#1A1A1A',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  starRating: {
    fontSize: 18,
    color: '#FFD700',
    marginBottom: 12,
  },
  testimonialText: {
    fontSize: 16,
    color: '#fff',
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 24,
  },
  testimonialAuthor: {
    fontSize: 14,
    color: '#999',
  },
  authCard: {
    flex: 1,
    maxWidth: Platform.OS === 'web' && isDesktop() ? 480 : '100%',
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' && {
      // Card styling handled by contentRow on web
    }),
    ...(Platform.OS !== 'web' && {
      paddingHorizontal: 20,
      paddingTop: 40,
    }),
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' && {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    }),
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#000',
  },
  formContainer: {
    flex: 1,
  },
});
