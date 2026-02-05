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
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

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
            credit_cost,
            coach_id,
            academy_id,
            service_name,
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
      const booking = request.booking;
      const creditCost = booking ? parseFloat(booking.credit_cost) || 0 : 0;
      const userId = booking?.user_id;

      if (request.request_type === 'cancel') {
        // Fetch full booking from bookings table to ensure we have coach_id (nested select can miss it)
        const { data: fullBooking, error: fetchErr } = await supabase
          .from('bookings')
          .select(`
            id,
            user_id,
            coach_id,
            location_id,
            start_time,
            end_time,
            service_name,
            credit_cost,
            academy_id,
            locations:location_id (name)
          `)
          .eq('id', request.booking_id)
          .single();

        if (fetchErr || !fullBooking) {
          console.error('Error fetching booking for cancellation:', fetchErr);
          Alert.alert('Error', 'Could not load booking details. Please try again.');
          setProcessingId(null);
          return;
        }

        const locationName = fullBooking.locations?.name || booking?.locations?.name || null;

        // 1. Insert into user_cancellation_history before deleting
        const { error: histErr } = await supabase.from('user_cancellation_history').insert({
          original_booking_id: request.booking_id,
          user_id: fullBooking.user_id ?? null,
          coach_id: fullBooking.coach_id ?? null,
          location_id: fullBooking.location_id ?? null,
          location_name: locationName,
          start_time: fullBooking.start_time,
          end_time: fullBooking.end_time,
          service_name: fullBooking.service_name ?? null,
          credit_cost: creditCost,
          reason: request.reason || null,
          academy_id: fullBooking.academy_id ?? null,
        });
        if (histErr) console.warn('user_cancellation_history insert failed (continuing):', histErr);

        // 2. Delete the booking
        const { error: deleteError } = await supabase
          .from('bookings')
          .delete()
          .eq('id', request.booking_id);

        if (deleteError) {
          console.error('Error deleting booking:', deleteError);
          Alert.alert('Warning', 'Request approved but failed to cancel booking. Please cancel manually.');
        } else {
          // 3. Notify admin and coach (fire-and-forget)
          const student = booking?.profiles;
          const studentName = student
            ? `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email
            : null;
          try {
            const smsRes = await fetch(`${SUPABASE_URL}/functions/v1/send-user-cancellation-sms`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                item: {
                  user_id: fullBooking.user_id,
                  student_name: studentName,
                  location_name: locationName || 'Unknown location',
                  start_time: fullBooking.start_time,
                  coach_id: fullBooking.coach_id ?? null,
                },
              }),
            });
            const smsText = await smsRes.text();
            if (!smsRes.ok) {
              console.warn('User cancellation SMS failed:', smsRes.status, smsText);
            } else {
              try {
                const smsData = JSON.parse(smsText);
                if (smsData?.sent === 0) {
                  console.warn('User cancellation SMS: no messages sent. Check ADMIN_PHONE and coach profiles.phone (E.164).', smsData);
                }
              } catch (_) {}
            }
          } catch (smsErr) {
            console.warn('User cancellation SMS request error:', smsErr);
          }
          // Refund credits to student's wallet if booking had a cost
          let refundSuccess = true;
          if (creditCost > 0 && userId) {
            try {
              const { data: refundData, error: refundError } = await supabase.rpc('add_wallet_balance', {
                user_id: userId,
                amount: creditCost,
              });

              if (refundError) {
                console.error('Error refunding credits:', refundError);
                refundSuccess = false;
                Alert.alert(
                  'Partial Success',
                  `Cancellation approved and booking cancelled, but failed to refund $${creditCost.toFixed(2)}. Please refund manually.`,
                  [{ text: 'OK' }]
                );
              } else {
                console.log('Credits refunded successfully:', refundData);
              }
            } catch (refundError) {
              console.error('Error refunding credits:', refundError);
              refundSuccess = false;
              Alert.alert(
                'Partial Success',
                `Cancellation approved and booking cancelled, but failed to refund $${creditCost.toFixed(2)}. Please refund manually.`,
                [{ text: 'OK' }]
              );
            }
          }
          
          if (refundSuccess) {
            if (creditCost > 0) {
              Alert.alert(
                'Success',
                `Cancellation approved. Booking cancelled and $${creditCost.toFixed(2)} refunded to student's wallet.`,
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert('Success', 'Cancellation approved. Booking cancelled successfully.');
            }
          }
        }
      } else if (request.request_type === 'raincheck') {
        // Cancel the booking (delete it) and refund credits
        if (!booking) {
          Alert.alert('Error', 'Booking not found for this rain check request.');
          setProcessingId(null);
          return;
        }

        const { error: deleteError } = await supabase
          .from('bookings')
          .delete()
          .eq('id', request.booking_id);

        if (deleteError) {
          console.error('Error deleting booking:', deleteError);
          Alert.alert('Warning', 'Request approved but failed to cancel booking. Please cancel manually.');
          // Still reload requests and call callback even if delete failed
          setAdminNotes({ ...adminNotes, [request.id]: '' });
          loadRequests();
          if (onRequestProcessed) onRequestProcessed();
          setProcessingId(null);
          return;
        }

        // Booking deleted successfully, now refund credits
        let refundSuccess = true;
        if (creditCost > 0 && userId) {
          try {
            const { data: refundData, error: refundError } = await supabase.rpc('add_wallet_balance', {
              user_id: userId,
              amount: creditCost,
            });

            if (refundError) {
              console.error('Error refunding credits:', refundError);
              refundSuccess = false;
              Alert.alert(
                'Partial Success',
                `Rain check approved and booking cancelled, but failed to refund $${creditCost.toFixed(2)}. Please refund manually.`,
                [{ text: 'OK' }]
              );
            } else {
              console.log('Credits refunded successfully:', refundData);
            }
          } catch (refundError) {
            console.error('Error refunding credits:', refundError);
            refundSuccess = false;
            Alert.alert(
              'Partial Success',
              `Rain check approved and booking cancelled, but failed to refund $${creditCost.toFixed(2)}. Please refund manually.`,
              [{ text: 'OK' }]
            );
          }
        }

        // Show success message
        if (refundSuccess) {
          if (creditCost > 0) {
            Alert.alert(
              'Rain Check Approved',
              `The rain check has been approved. The booking has been cancelled and $${creditCost.toFixed(2)} has been refunded to the student's wallet.`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Rain Check Approved',
              'The rain check has been approved and the booking has been cancelled.',
              [{ text: 'OK' }]
            );
          }
        }
      }

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
