import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { createTopUpCheckoutSession, redirectToCheckout, STRIPE_CHECKOUT_DISABLED } from '../lib/stripe';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = Platform.OS !== 'web' || SCREEN_WIDTH <= 480;
const TOP_UP_AMOUNTS = [25, 50, 100, 200, 500];

export default function WalletTopUpModal({ visible, onClose, userId, onTopUpSuccess }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    if (!userId) {
      Alert.alert(t('error'), t('userNotAuthenticated'));
      return;
    }

    const amount = selectedAmount || parseFloat(customAmount);
    
    if (!amount || amount <= 0) {
      Alert.alert(t('error'), t('selectOrEnterValidAmount'));
      return;
    }

    if (amount < 5) {
      Alert.alert(t('error'), t('minTopUp5'));
      return;
    }

    if (STRIPE_CHECKOUT_DISABLED) {
      Alert.alert('Coming soon', 'This feature will be available soon.');
      return;
    }

    try {
      setLoading(true);

      // Create Stripe checkout session
      const { sessionId, url, error } = await createTopUpCheckoutSession({
        userId,
        amount,
        metadata: {
          topUpAmount: amount.toString(),
        },
      });

      if (error) throw error;

      if (!url) {
        throw new Error('Checkout URL not returned from server');
      }

      // Redirect to Stripe checkout using the URL directly
      await redirectToCheckout(url);

      // Note: After successful payment, Stripe will redirect back
      // The webhook will handle adding funds to wallet
      // We'll close the modal and show success message
      onClose();
      
      if (onTopUpSuccess) {
        onTopUpSuccess();
      }
    } catch (error) {
      console.error('Error processing top-up:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to process payment. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (text) => {
    // Only allow numbers and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return; // Only one decimal point allowed
    
    setCustomAmount(cleaned);
    setSelectedAmount(null);
  };

  const displayAmount = selectedAmount || (customAmount ? parseFloat(customAmount) : null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('topUpWallet')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Quick Amount Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('quickTopUp')}</Text>
            <View style={styles.amountGrid}>
              {TOP_UP_AMOUNTS.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.amountButton,
                    selectedAmount === amount && styles.amountButtonSelected,
                  ]}
                  onPress={() => handleAmountSelect(amount)}
                >
                  <Text
                    style={[
                      styles.amountButtonText,
                      selectedAmount === amount && styles.amountButtonTextSelected,
                    ]}
                  >
                    ${amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Custom Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('customAmountLabel')}</Text>
            <View style={styles.customAmountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.customAmountInput}
                placeholder={t('enterAmount')}
                placeholderTextColor="#9CA3AF"
                value={customAmount}
                onChangeText={handleCustomAmountChange}
                keyboardType="decimal-pad"
                editable={!loading}
              />
            </View>
            <Text style={styles.minAmountText}>{t('minimum5')}</Text>
          </View>

          {/* Selected Amount Display */}
          {displayAmount && (
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('topUpAmountLabel')}</Text>
                <Text style={styles.summaryValue}>${displayAmount.toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.cancelButton, loading && styles.buttonDisabled]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.topUpButton,
                (!displayAmount || loading) && styles.buttonDisabled,
              ]}
              onPress={handleTopUp}
              disabled={!displayAmount || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="wallet" size={20} color="#FFFFFF" />
                  <Text style={styles.topUpButtonText}>{t('proceedToPayment')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={14} color="#64748B" />
            <Text style={styles.securityNoteText}>{t('securePayment')}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' && {
      alignItems: 'center',
      justifyContent: 'center',
    }),
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...(Platform.OS === 'web' && {
      borderRadius: 24,
      maxWidth: 500,
      width: '90%',
    }),
    padding: isMobile ? 20 : 24,
    maxHeight: '90%',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isMobile ? 20 : 24,
  },
  title: {
    fontSize: isMobile ? 20 : 24,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: isMobile ? 6 : 4,
    minWidth: isMobile ? 36 : undefined,
    minHeight: isMobile ? 36 : undefined,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: isMobile ? 20 : 24,
  },
  sectionTitle: {
    fontSize: isMobile ? 14 : 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: isMobile ? 10 : 12,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isMobile ? 10 : 12,
  },
  amountButton: {
    flex: 1,
    minWidth: isMobile ? '28%' : '30%',
    paddingVertical: isMobile ? 16 : 14,
    paddingHorizontal: isMobile ? 12 : 16,
    borderRadius: isMobile ? 10 : 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isMobile ? 48 : undefined, // Better touch target
  },
  amountButtonSelected: {
    borderColor: '#0D9488',
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
  },
  amountButtonText: {
    fontSize: isMobile ? 15 : 16,
    fontWeight: '600',
    color: '#374151',
  },
  amountButtonTextSelected: {
    color: '#0D9488',
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: isMobile ? 10 : 12,
    paddingHorizontal: isMobile ? 14 : 16,
    paddingVertical: isMobile ? 16 : 14,
    backgroundColor: '#F9FAFB',
  },
  currencySymbol: {
    fontSize: isMobile ? 16 : 18,
    fontWeight: '600',
    color: '#374151',
    marginRight: isMobile ? 6 : 8,
  },
  customAmountInput: {
    flex: 1,
    fontSize: isMobile ? 16 : 18,
    fontWeight: '600',
    color: '#111827',
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
    }),
  },
  minAmountText: {
    fontSize: isMobile ? 11 : 12,
    color: '#6B7280',
    marginTop: isMobile ? 6 : 8,
  },
  summaryContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: isMobile ? 10 : 12,
    padding: isMobile ? 14 : 16,
    marginBottom: isMobile ? 20 : 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: isMobile ? 13 : 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: isMobile ? 18 : 20,
    fontWeight: '700',
    color: '#111827',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: isMobile ? 10 : 12,
    marginBottom: isMobile ? 14 : 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: isMobile ? 16 : 14,
    paddingHorizontal: isMobile ? 18 : 20,
    borderRadius: isMobile ? 10 : 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isMobile ? 48 : undefined, // Better touch target
  },
  cancelButtonText: {
    fontSize: isMobile ? 15 : 16,
    fontWeight: '600',
    color: '#374151',
  },
  topUpButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isMobile ? 6 : 8,
    paddingVertical: isMobile ? 16 : 14,
    paddingHorizontal: isMobile ? 18 : 20,
    borderRadius: isMobile ? 10 : 12,
    backgroundColor: '#0D9488',
    minHeight: isMobile ? 48 : undefined, // Better touch target
  },
  topUpButtonText: {
    fontSize: isMobile ? 15 : 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  securityNoteText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
