import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function BookingRequestsModal({
  visible,
  onClose,
  onRequestProcessed,
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});

  useEffect(() => {
    if (visible) {
      loadRequests();
    }
  }, [visible]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('booking_requests')
        .select(`
          *,
          booking:booking_id (
            id,
            start_time,
            end_time,
            location_id,
            user_id,
            locations:location_id (id, name)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      // Fetch user profiles separately since nested select might not work
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.booking?.user_id).filter(Boolean))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);

        // Attach profiles to requests
        const requestsWithProfiles = data.map(request => {
          const profile = profilesData?.find(p => p.id === request.booking?.user_id);
          return {
            ...request,
            booking: {
              ...request.booking,
              profiles: profile || null,
            },
          };
        });
        setRequests(requestsWithProfiles);
        return;
      }

      if (error) throw error;
      // Requests are set in the profile fetch block above if data exists
      if (!data || data.length === 0) {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error loading booking requests:', error);
      Alert.alert('Error', 'Failed to load booking requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request) => {
    try {
      setProcessingId(request.id);
      
      // Get current user for reviewed_by
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes[request.id] || null,
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // If approved, handle the actual booking modification
      if (request.request_type === 'cancel') {
        // Delete the booking
        const { error: deleteError } = await supabase
          .from('bookings')
          .delete()
          .eq('id', request.booking_id);

        if (deleteError) {
          console.error('Error deleting booking:', deleteError);
          Alert.alert('Warning', 'Request approved but failed to cancel booking. Please cancel manually.');
        }
      } else if (request.request_type === 'raincheck') {
        // For rain check, we could update the booking or mark it for rescheduling
        // For now, we'll just mark the request as approved
        // The admin can manually reschedule if needed
        Alert.alert(
          'Rain Check Approved',
          'Please manually reschedule this booking to a new time slot.',
          [{ text: 'OK' }]
        );
      }

      Alert.alert('Success', 'Request approved successfully.');
      setAdminNotes({ ...adminNotes, [request.id]: '' });
      loadRequests();
      if (onRequestProcessed) onRequestProcessed();
    } catch (error) {
      console.error('Error approving request:', error);
      Alert.alert('Error', 'Failed to approve request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request) => {
    try {
      setProcessingId(request.id);
      
      // Get current user for reviewed_by
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes[request.id] || null,
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      Alert.alert('Success', 'Request rejected.');
      setAdminNotes({ ...adminNotes, [request.id]: '' });
      loadRequests();
      if (onRequestProcessed) onRequestProcessed();
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('Error', 'Failed to reject request.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Booking Requests</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#000" />
              </View>
            ) : requests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={64} color="#34C759" />
                <Text style={styles.emptyText}>No pending requests</Text>
              </View>
            ) : (
              requests.map((request) => {
                const booking = request.booking;
                const student = booking?.profiles;
                const studentName = student
                  ? `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email
                  : 'Unknown Student';

                return (
                  <View key={request.id} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      <View style={styles.requestTypeBadge}>
                        <Ionicons
                          name={request.request_type === 'cancel' ? 'close-circle' : 'rainy'}
                          size={16}
                          color="#fff"
                        />
                        <Text style={styles.requestTypeText}>
                          {request.request_type === 'cancel' ? 'Cancel' : 'Rain Check'}
                        </Text>
                      </View>
                      <Text style={styles.requestDate}>
                        {formatDate(request.created_at)}
                      </Text>
                    </View>

                    <View style={styles.bookingInfo}>
                      <Text style={styles.studentName}>{studentName}</Text>
                      {booking && (
                        <>
                          <View style={styles.infoRow}>
                            <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
                            <Text style={styles.infoText}>
                              {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={16} color="#8E8E93" />
                            <Text style={styles.infoText}>
                              {booking.locations?.name || 'Unknown Location'}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>

                    <View style={styles.reasonContainer}>
                      <Text style={styles.reasonLabel}>Reason:</Text>
                      <Text style={styles.reasonText}>{request.reason}</Text>
                    </View>

                    <View style={styles.adminNotesContainer}>
                      <Text style={styles.adminNotesLabel}>Admin Notes (optional):</Text>
                      <TextInput
                        style={styles.adminNotesInput}
                        placeholder="Add notes for this request..."
                        value={adminNotes[request.id] || ''}
                        onChangeText={(text) => {
                          setAdminNotes({ ...adminNotes, [request.id]: text });
                        }}
                        multiline
                        numberOfLines={2}
                        textAlignVertical="top"
                      />
                    </View>

                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.rejectButton, processingId === request.id && styles.buttonDisabled]}
                        onPress={() => handleReject(request)}
                        disabled={processingId === request.id}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.approveButton, processingId === request.id && styles.buttonDisabled]}
                        onPress={() => handleApprove(request)}
                        disabled={processingId === request.id}
                      >
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
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
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    ...(Platform.OS === 'web' && {
      maxWidth: 800,
      alignSelf: 'center',
      width: '100%',
      borderRadius: 20,
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
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  requestCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  requestTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  requestDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  bookingInfo: {
    marginBottom: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  reasonContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  adminNotesContainer: {
    marginBottom: 12,
  },
  adminNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  adminNotesInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
    minHeight: 60,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
