import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Global Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI.
 */
class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console (you can also send to an error reporting service)
    console.error('GlobalErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo?.componentStack);
    
    this.setState({ errorInfo });

    // Optional: Send error to analytics/crash reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleRestart = () => {
    // Reset error state
    this.setState({ hasError: false, error: null, errorInfo: null });

    // On web, reload the page for a clean restart
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    }
    
    // On native, the state reset will re-render children
    // For a more complete restart, you might need to use expo-updates or similar
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
            </View>

            {/* Error Message */}
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              We're sorry for the inconvenience. Please try again.
            </Text>

            {/* Try Again Button */}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleRestart}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>

            {/* Error Details (only in development) */}
            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorLabel}>Error Details:</Text>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.stackText} numberOfLines={8}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
    ...(Platform.OS === 'web' && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 10,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    }),
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  errorDetails: {
    marginTop: 48,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
    maxWidth: '100%',
    width: 400,
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#991B1B',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
  },
  stackText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    marginTop: 8,
    lineHeight: 16,
  },
});

export default GlobalErrorBoundary;
