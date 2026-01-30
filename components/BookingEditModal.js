import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';
import { supabase } from '../lib/supabase';

/**
 * Check if cancellation is within the free cancellation window
 * Free cancellation is allowed before 12pm (noon) the day before the booking
 * @param {string} bookingStartTime - ISO string of booking start time
 * @returns {boolean} - true if free cancellation is allowed
 */
const isFreeCancellationAllowed = (bookingStartTime) => {
  const bookingDate = new Date(bookingStartTime);
  const now = new Date();
  
  // Get the day before the booking at 12pm (noon)
  const cancellationDeadline = new Date(bookingDate);
  cancellationDeadline.setDate(cancellationDeadline.getDate() - 1);
  cancellationDeadline.setHours(12, 0, 0, 0);
  
  // Free cancellation is allowed if current time is before the deadline
  return now < cancellationDeadline;
};

export default function BookingEditModal({
  visible,
  onClose,
  booking,
  onBookingCancelled, // Optional callback when booking is cancelled
}) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const [requestType, setRequestType] = useState(null); // 'cancel' or 'raincheck'
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultModal, setResultModal] = useState({
    visible: false,
    success: false,
    title: '',
    message: '',
    isCancellation: false,
  });

  // Check if free cancellation is available for this booking
  const freeCancellationAvailable = booking ? isFreeCancellationAllowed(booking.start_time) : false;

  const handleResultModalClose = () => {
    const wasSuccess = resultModal.success;
    const wasCancellation = resultModal.title === t('cancelled') || resultModal.title.includes('Cancelled');
    
    // First just hide the modal, keep other state to prevent icon flash
    setResultModal(prev => ({ ...prev, visible: false }));
    
    // Then reset state after modal animation completes
    setTimeout(() => {
      setResultModal({ visible: false, success: false, title: '', message: '' });
      setRequestType(null);
      setReason('');
      
      if (wasSuccess && wasCancellation) {
        onBookingCancelled?.(); // Trigger refresh for cancellations
      }
      onClose();
    }, 300);
  };

  const handleCancelRequest = async () => {
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for cancellation.');
      return;
    }

    try {
      setLoading(true);

      if (freeCancellationAvailable) {
        // Get credit cost and user_id before deleting the booking
        const creditCost = parseFloat(booking.credit_cost) || 0;
        const userId = booking.user_id;

        // Free cancellation - directly delete the booking
        const { error: deleteError } = await supabase
          .from('bookings')
          .delete()
          .eq('id', booking.id);

        if (deleteError) throw deleteError;

        // Refund credits to user's wallet if booking had a cost
        if (creditCost > 0 && userId) {
          try {
            const { data: refundData, error: refundError } = await supabase.rpc('add_wallet_balance', {
              user_id: userId,
              amount: creditCost,
            });

            if (refundError) {
              console.error('Error refunding credits:', refundError);
              setResultModal({
                visible: true,
                success: false,
                title: t('partialSuccess'),
                message: t('bookingCancelledRefundFailed'),
              });
              return;
            }

            console.log('Credits refunded successfully:', refundData);
            setResultModal({
              visible: true,
              success: true,
              title: t('cancelled'),
              message: t('bookingCancelledRefundSuccess'),
              isCancellation: true,
            });
          } catch (refundError) {
            console.error('Error refunding credits:', refundError);
            setResultModal({
              visible: true,
              success: false,
              title: t('partialSuccess'),
              message: t('bookingCancelledRefundFailed'),
            });
          }
        } else {
          // No cost to refund
          setResultModal({
            visible: true,
            success: true,
            title: t('cancelled'),
            message: t('bookingCancelledSuccess'),
            isCancellation: true,
          });
        }
      } else {
        // Late cancellation - requires admin approval
        // Get current authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('You must be signed in to submit a cancellation request.');
        }

        const { error } = await supabase
          .from('booking_requests')
          .insert({
            booking_id: booking.id,
            requested_by: user.id, // Required field - user who made the request
            request_type: 'cancel',
            reason: reason.trim(),
            status: 'pending',
          });

        if (error) throw error;

        setResultModal({
          visible: true,
          success: true,
          title: t('requestSubmitted'),
          message: t('cancelRequestSubmittedMessage'),
        });
      }
    } catch (error) {
      console.error('Error submitting cancel request:', error);
      setResultModal({
        visible: true,
        success: false,
        title: t('error'),
        message: t('failedToProcessCancellation'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRainCheckRequest = async () => {
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for the rain check.');
      return;
    }
    if (!booking?.id) {
      Alert.alert('Error', 'Booking not found. Please try again.');
      return;
    }

    try {
      setLoading(true);

      // Verify the booking belongs to the current user (for RLS policy)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be signed in to submit a rain check request.');
      }

      // Verify booking ownership by fetching it - this ensures RLS allows access
      // This helps the RLS policy recognize the relationship
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('id, user_id')
        .eq('id', booking.id)
        .eq('user_id', user.id)
        .single();

      if (bookingError || !bookingData) {
        throw new Error('Booking not found or you do not have permission to modify this booking.');
      }

      // Check for existing pending rain check to avoid duplicates and give a clear message
      const { data: existing } = await supabase
        .from('booking_requests')
        .select('id')
        .eq('booking_id', booking.id)
        .eq('request_type', 'raincheck')
        .eq('status', 'pending')
        .limit(1);

      if (existing && existing.length > 0) {
        setResultModal({
          visible: true,
          success: false,
          title: t('requestSubmitted'),
          message: t('alreadySubmittedRainCheck'),
        });
        return;
      }

      const { error } = await supabase
        .from('booking_requests')
        .insert({
          booking_id: booking.id,
          requested_by: user.id, // Required field - user who made the request
          request_type: 'raincheck',
          reason: reason.trim(),
          status: 'pending',
        });

      if (error) throw error;

      setResultModal({
        visible: true,
        success: true,
        title: 'Request Submitted',
        message: 'Your rain check request has been submitted and is pending admin or coach approval.',
      });
    } catch (error) {
      console.error('Error submitting rain check request:', error?.message, error?.code, error?.details);
      setResultModal({
        visible: true,
        success: false,
        title: 'Error',
        message: 'Failed to submit rain check request. ' + (error?.message || 'Please try again.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setRequestType(null);
    setReason('');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => {
        resetModal();
        onClose();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('editBooking')}</Text>
            <TouchableOpacity
              onPress={() => {
                resetModal();
                onClose();
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {!requestType ? (
              <>
                <Text style={styles.subtitle}>Select an option:</Text>
                
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => setRequestType('cancel')}
                >
                  <View style={[styles.optionIconContainer, freeCancellationAvailable && styles.optionIconContainerGreen]}>
                    <Ionicons 
                      name={freeCancellationAvailable ? "checkmark-circle-outline" : "close-circle-outline"} 
                      size={24} 
                      color={freeCancellationAvailable ? "#34C759" : "#FF3B30"} 
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>
                      {freeCancellationAvailable ? 'Cancel Booking' : 'Cancel Request'}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {freeCancellationAvailable 
                        ? 'Free cancellation available - cancel instantly without approval.'
                        : 'Request to cancel this booking. Requires admin approval.'}
                    </Text>
                    {freeCancellationAvailable && (
                      <View style={styles.freeCancelBadge}>
                        <Ionicons name="time-outline" size={12} color="#34C759" />
                        <Text style={styles.freeCancelBadgeText}>Free cancellation</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </TouchableOpacity>

              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setRequestType(null)}
                >
                  <Ionicons name="arrow-back" size={20} color="#007AFF" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>

                <Text style={styles.subtitle}>
                  {requestType === 'cancel' 
                    ? (freeCancellationAvailable ? 'Cancel Booking' : 'Cancel Request') 
                    : 'Rain Check Request'}
                </Text>

                {requestType === 'cancel' && freeCancellationAvailable && (
                  <View style={styles.freeCancelNotice}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={styles.freeCancelNoticeText}>
                      You're within the free cancellation window. Your booking will be cancelled immediately.
                    </Text>
                  </View>
                )}

                {requestType === 'cancel' && !freeCancellationAvailable && (
                  <View style={styles.lateCancelNotice}>
                    <Ionicons name="information-circle" size={20} color="#FF9500" />
                    <Text style={styles.lateCancelNoticeText}>
                      Free cancellation ends at 12pm the day before your booking. This request requires admin approval.
                    </Text>
                  </View>
                )}

                <Text style={styles.label}>
                  Reason {requestType === 'cancel' ? 'for Cancellation' : 'for Rain Check'} *
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={`Please provide a reason ${requestType === 'cancel' ? 'for cancelling' : 'for the rain check'}...`}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={requestType === 'cancel' ? handleCancelRequest : handleRainCheckRequest}
                  disabled={loading}
                >
                  <Text style={styles.submitButtonText}>
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Result Modal */}
      <Modal
        visible={resultModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleResultModalClose}
      >
        <View style={styles.resultOverlay}>
          <View style={styles.resultContainer}>
            <View style={[
              styles.resultIconContainer,
              resultModal.success ? styles.successIconBg : styles.errorIconBg
            ]}>
              <Ionicons
                name={resultModal.success ? 'checkmark-circle' : 'close-circle'}
                size={48}
                color={resultModal.success ? '#10B981' : '#EF4444'}
              />
            </View>
            
            <Text style={styles.resultTitle}>{resultModal.title}</Text>
            <Text style={styles.resultMessage}>{resultModal.message}</Text>
            
            <TouchableOpacity
              style={[
                styles.resultButton,
                resultModal.success ? styles.successButton : styles.errorButton
              ]}
              onPress={handleResultModalClose}
            >
              <Text style={styles.resultButtonText}>{t('ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    ...(Platform.OS !== 'web' && {
      width: '100%',
      maxWidth: '90%',
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionIconContainerGreen: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  freeCancelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  freeCancelBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34C759',
  },
  freeCancelNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  freeCancelNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#1D6F42',
    lineHeight: 20,
  },
  lateCancelNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  lateCancelNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#996300',
    lineHeight: 20,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#F5F5F5',
    minHeight: 100,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Result Modal Styles
  resultOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 10,
    }),
  },
  resultIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIconBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  errorIconBg: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  resultButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  errorButton: {
    backgroundColor: '#EF4444',
  },
  resultButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
