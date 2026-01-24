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

/**
 * CoachRainCheckModal - Allows coaches to approve rain check requests
 * for bookings assigned to them
 */
export default function CoachRainCheckModal({
  visible,
  onClose,
  coachId,
  onRequestProcessed,
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [coachNotes, setCoachNotes] = useState({});

  useEffect(() => {
    if (visible && coachId) {
      loadRequests();
    }
  }, [visible, coachId]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      
      // Fetch rain check requests for bookings assigned to this coach
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
            coach_id,
            credit_cost,
            locations:location_id (id, name)
          )
        `)
        .eq('status', 'pending')
        .eq('request_type', 'raincheck') // Only rain checks for coaches
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Filter to only show requests where the booking is assigned to this coach
      const coachRequests = (data || []).filter(
        request => request.booking?.coach_id === coachId
      );

      // Fetch user profiles for the filtered requests
      if (coachRequests.length > 0) {
        const userIds = [...new Set(coachRequests.map(r => r.booking?.user_id).filter(Boolean))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);

        // Attach profiles to requests
        const requestsWithProfiles = coachRequests.map(request => {
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
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error loading rain check requests:', error);
      Alert.alert('Error', 'Failed to load rain check requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request) => {
    Alert.alert(
      'Approve Rain Check',
      'Are you sure you want to approve this rain check request? The booking will be cancelled and the student will receive a credit refund.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setProcessingId(request.id);
              
              const booking = request.booking;
              if (!booking) {
                throw new Error('Booking not found');
              }

              const creditCost = parseFloat(booking.credit_cost) || 0;
              const userId = booking.user_id;

              // Step 1: Update the booking request status
              const { error: updateError } = await supabase
                .from('booking_requests')
                .update({
                  status: 'approved',
                  reviewed_by: coachId,
                  reviewed_at: new Date().toISOString(),
                  admin_notes: coachNotes[request.id] ? `[Coach] ${coachNotes[request.id]}` : '[Approved by Coach]',
                })
                .eq('id', request.id);

              if (updateError) throw updateError;

              // Step 2: Cancel the booking (delete it)
              const { error: deleteError } = await supabase
                .from('bookings')
                .delete()
                .eq('id', booking.id);

              if (deleteError) {
                console.error('Error deleting booking:', deleteError);
                Alert.alert('Warning', 'Request approved but failed to cancel booking. Please cancel manually.');
              }

              // Step 3: Refund credits to student's wallet if booking had a cost
              if (creditCost > 0 && userId) {
                try {
                  // Call the database function to add wallet balance
                  const { data: refundData, error: refundError } = await supabase.rpc('add_wallet_balance', {
                    user_id: userId,
                    amount: creditCost,
                  });

                  if (refundError) {
                    console.error('Error refunding credits:', refundError);
                    Alert.alert(
                      'Partial Success',
                      'Rain check approved and booking cancelled, but failed to refund credits. Please refund manually.',
                      [{ text: 'OK' }]
                    );
                  } else {
                    console.log('Credits refunded successfully:', refundData);
                    Alert.alert(
                      'Rain Check Approved',
                      `The rain check has been approved. The booking has been cancelled and $${creditCost.toFixed(2)} has been refunded to the student's wallet.`,
                      [{ text: 'OK' }]
                    );
                  }
                } catch (refundError) {
                  console.error('Error refunding credits:', refundError);
                  Alert.alert(
                    'Partial Success',
                    'Rain check approved and booking cancelled, but failed to refund credits. Please refund manually.',
                    [{ text: 'OK' }]
                  );
                }
              } else {
                Alert.alert(
                  'Rain Check Approved',
                  'The rain check has been approved and the booking has been cancelled.',
                  [{ text: 'OK' }]
                );
              }
              
              setCoachNotes({ ...coachNotes, [request.id]: '' });
              loadRequests();
              if (onRequestProcessed) onRequestProcessed();
            } catch (error) {
              console.error('Error approving rain check:', error);
              Alert.alert('Error', 'Failed to approve rain check: ' + (error.message || 'Unknown error'));
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
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
            <View style={styles.headerLeft}>
              <Ionicons name="rainy" size={24} color="#007AFF" />
              <Text style={styles.title}>Rain Check Requests</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading requests...</Text>
              </View>
            ) : requests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={64} color="#34C759" />
                <Text style={styles.emptyTitle}>No Pending Requests</Text>
                <Text style={styles.emptyText}>
                  Rain check requests for your sessions will appear here
                </Text>
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
                      <View style={styles.rainCheckBadge}>
                        <Ionicons name="rainy" size={14} color="#fff" />
                        <Text style={styles.rainCheckText}>Rain Check</Text>
                      </View>
                      <Text style={styles.requestDate}>
                        Requested {formatDate(request.created_at)}
                      </Text>
                    </View>

                    <View style={styles.bookingInfo}>
                      <View style={styles.studentRow}>
                        <Ionicons name="person-circle-outline" size={20} color="#007AFF" />
                        <Text style={styles.studentName}>{studentName}</Text>
                      </View>
                      
                      {booking && (
                        <View style={styles.bookingDetails}>
                          <View style={styles.infoRow}>
                            <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
                            <Text style={styles.infoText}>
                              {formatDate(booking.start_time)}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Ionicons name="time-outline" size={16} color="#8E8E93" />
                            <Text style={styles.infoText}>
                              {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={16} color="#8E8E93" />
                            <Text style={styles.infoText}>
                              {booking.locations?.name || 'Unknown Location'}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    <View style={styles.reasonContainer}>
                      <Text style={styles.reasonLabel}>Student's Reason:</Text>
                      <Text style={styles.reasonText}>{request.reason}</Text>
                    </View>

                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Add a note (optional):</Text>
                      <TextInput
                        style={styles.notesInput}
                        placeholder="e.g., Rescheduled to next week..."
                        value={coachNotes[request.id] || ''}
                        onChangeText={(text) => {
                          setCoachNotes({ ...coachNotes, [request.id]: text });
                        }}
                        multiline
                        numberOfLines={2}
                        textAlignVertical="top"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.approveButton, processingId === request.id && styles.buttonDisabled]}
                      onPress={() => handleApprove(request)}
                      disabled={processingId === request.id}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.approveButtonText}>
                        {processingId === request.id ? 'Processing...' : 'Approve Rain Check'}
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.noteText}>
                      Note: Cancellation requests require admin approval
                    </Text>
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
    maxHeight: '85%',
    ...(Platform.OS === 'web' && {
      maxWidth: 600,
      alignSelf: 'center',
      width: '100%',
      borderRadius: 20,
      marginTop: 'auto',
      marginBottom: 'auto',
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  requestCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rainCheckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  rainCheckText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  requestDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  bookingInfo: {
    marginBottom: 14,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  studentName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  bookingDetails: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
  },
  reasonContainer: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  notesContainer: {
    marginBottom: 14,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
    minHeight: 60,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  noteText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
