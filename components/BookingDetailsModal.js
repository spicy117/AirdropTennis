import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BookingDetailsModal({
  visible,
  onClose,
  bookings = [],
  loading = false,
  slotInfo = null,
}) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Booking Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.loadingText}>Loading bookings...</Text>
              </View>
            ) : bookings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyText}>No bookings found for this time slot</Text>
              </View>
            ) : (
              <>
                {slotInfo && (
                  <View style={styles.slotInfo}>
                    <View style={styles.slotInfoRow}>
                      <Ionicons name="calendar-outline" size={18} color="#8E8E93" />
                      <Text style={styles.slotInfoText}>
                        {slotInfo.date} at {slotInfo.time}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={styles.bookingsHeader}>
                  <Text style={styles.bookingsCount}>
                    {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                  </Text>
                  {bookings.length > 1 && (
                    <Text style={styles.bookingsSubtext}>
                      Scroll to view all bookings
                    </Text>
                  )}
                </View>
                {bookings.map((booking, index) => (
                  <View key={booking.id || index} style={styles.bookingCard}>
                    <View style={styles.bookingHeader}>
                      <View style={styles.studentInfo}>
                        <View style={styles.studentIconContainer}>
                          <Ionicons name="person" size={20} color="#007AFF" />
                        </View>
                        <View style={styles.studentNameContainer}>
                          <Text style={styles.studentName}>
                            {booking.studentName || 'Unknown Student'}
                          </Text>
                          {bookings.length > 1 && (
                            <Text style={styles.bookingNumber}>
                              Booking {index + 1} of {bookings.length}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.bookingDetails}>
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={18} color="#8E8E93" />
                        <Text style={styles.detailText}>
                          {booking.locationName || 'Unknown Location'}
                        </Text>
                      </View>

                      {booking.serviceName && (
                        <View style={styles.detailRow}>
                          <Ionicons name="tennisball-outline" size={18} color="#8E8E93" />
                          <Text style={styles.detailText}>
                            {booking.serviceName}
                          </Text>
                        </View>
                      )}

                      <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={18} color="#8E8E93" />
                        <Text style={styles.detailText}>
                          {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={18} color="#8E8E93" />
                        <Text style={styles.detailText}>
                          {formatDate(booking.start_time)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeButtonFooter}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    flexDirection: 'column',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  slotInfo: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  slotInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotInfoText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  bookingsHeader: {
    marginBottom: 16,
  },
  bookingsCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  bookingsSubtext: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  bookingCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    }),
  },
  bookingHeader: {
    marginBottom: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  studentIconContainer: {
    paddingTop: 2,
  },
  studentNameContainer: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  bookingNumber: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  bookingDetails: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  closeButtonFooter: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
