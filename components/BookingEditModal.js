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
import { supabase } from '../lib/supabase';

export default function BookingEditModal({
  visible,
  onClose,
  booking,
}) {
  const [requestType, setRequestType] = useState(null); // 'cancel' or 'raincheck'
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCancelRequest = async () => {
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for cancellation.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('booking_requests')
        .insert({
          booking_id: booking.id,
          request_type: 'cancel',
          reason: reason.trim(),
          status: 'pending',
          requested_by: booking.user_id,
        });

      if (error) throw error;

      Alert.alert(
        'Request Submitted',
        'Your cancellation request has been submitted and is pending admin approval.',
        [{ text: 'OK', onPress: () => {
          setRequestType(null);
          setReason('');
          onClose();
        }}]
      );
    } catch (error) {
      console.error('Error submitting cancel request:', error);
      Alert.alert('Error', 'Failed to submit cancellation request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRainCheckRequest = async () => {
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for the rain check.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('booking_requests')
        .insert({
          booking_id: booking.id,
          request_type: 'raincheck',
          reason: reason.trim(),
          status: 'pending',
          requested_by: booking.user_id,
        });

      if (error) throw error;

      Alert.alert(
        'Request Submitted',
        'Your rain check request has been submitted and is pending admin approval.',
        [{ text: 'OK', onPress: () => {
          setRequestType(null);
          setReason('');
          onClose();
        }}]
      );
    } catch (error) {
      console.error('Error submitting rain check request:', error);
      Alert.alert('Error', 'Failed to submit rain check request. Please try again.');
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
            <Text style={styles.title}>Edit Booking</Text>
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
                  <View style={styles.optionIconContainer}>
                    <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Cancel Request</Text>
                    <Text style={styles.optionDescription}>
                      Request to cancel this booking. Requires admin approval.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => setRequestType('raincheck')}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons name="rainy-outline" size={24} color="#007AFF" />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Rain Check</Text>
                    <Text style={styles.optionDescription}>
                      Request to reschedule due to rain. Requires admin approval.
                    </Text>
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
                  {requestType === 'cancel' ? 'Cancel Request' : 'Rain Check Request'}
                </Text>

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
});
