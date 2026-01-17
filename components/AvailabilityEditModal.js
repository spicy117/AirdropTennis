import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AvailabilityEditModal({
  visible,
  onClose,
  availability,
  locations = [],
  onUpdate,
  onDelete,
}) {
  const [formData, setFormData] = useState({
    serviceName: '',
    locationId: '',
    selectedLocationIds: [], // Array for multiple locations
  });

  useEffect(() => {
    if (availability) {
      // Check if this availability has multiple locations (from bulk create)
      const locationId = availability.location_id || '';
      const allLocationIds = availability.allLocationIds || (locationId ? [locationId] : []);
      
      console.log('Edit modal opened - Setting location:', locationId);
      console.log('All location IDs for this time slot:', allLocationIds);
      console.log('Available locations:', locations.map(l => ({ id: l.id, name: l.name })));
      
      setFormData({
        serviceName: availability.service_name || '',
        locationId: locationId, // Keep for backward compatibility
        selectedLocationIds: allLocationIds.filter(id => id), // Array of all selected locations, filter out empty
      });
    }
  }, [availability, locations]);

  const handleUpdate = async () => {
    if (!formData.selectedLocationIds || formData.selectedLocationIds.length === 0) {
      if (!formData.locationId) {
        alert('Please select at least one location');
        return;
      }
      // Fallback to single location if selectedLocationIds is empty
      await onUpdate({
        ...availability,
        service_name: formData.serviceName,
        location_id: formData.locationId,
      });
    } else {
      // Update with multiple locations - for now, update the primary one
      // TODO: In the future, we might want to update all matching availabilities
      await onUpdate({
        ...availability,
        service_name: formData.serviceName,
        location_id: formData.selectedLocationIds[0], // Use first selected as primary
        allLocationIds: formData.selectedLocationIds, // Pass all for reference
      });
    }

    onClose();
  };

  const handleDelete = async () => {
    console.log('=== DELETE BUTTON CLICKED ===');
    console.log('Availability:', availability);
    
    // Check if any of the availabilities are booked
    const allLocationIds = availability.allLocationIds || (availability.location_id ? [availability.location_id] : []);
    const isMultiple = allLocationIds.length > 1;
    
    console.log('All location IDs:', allLocationIds);
    console.log('Is multiple:', isMultiple);
    console.log('Is booked:', availability.is_booked);
    
    if (availability.is_booked) {
      console.log('Availability is booked, showing cannot delete alert');
      Alert.alert('Cannot Delete', 'Cannot delete a booked availability. Cancel the booking first.');
      return;
    }

    const deleteMessage = isMultiple
      ? `Are you sure you want to delete this availability for ${allLocationIds.length} location(s)?`
      : 'Are you sure you want to delete this availability?';

    console.log('Showing delete confirmation dialog');
    Alert.alert(
      'Delete Availability',
      deleteMessage,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => {
            console.log('User cancelled delete');
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('=== USER CONFIRMED DELETE IN ALERT ===');
              console.log('Alert Delete button onPress fired!');
              console.log('Calling onDelete with:', {
                id: availability.id,
                allLocationIds: availability.allLocationIds,
                start_time: availability.start_time,
                end_time: availability.end_time,
              });
              
              // Pass the availability with all location IDs so parent can delete all matching records
              const result = await onDelete(availability.id, availability);
              console.log('onDelete returned:', result);
              console.log('onDelete completed successfully, closing modal');
              
              // Close modal after successful deletion
              onClose();
              console.log('Modal closed');
            } catch (error) {
              console.error('❌ Error in delete handler:', error);
              console.error('Error stack:', error.stack);
              Alert.alert('Error', 'Failed to delete: ' + (error.message || 'Unknown error'));
              // Don't close modal if there was an error
            }
          },
        },
      ]
    );
  };

  if (!availability) return null;

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  };

  const dateTime = formatDateTime(availability.start_time);
  const endTime = new Date(availability.end_time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  
  // Get location name for display - show "Multiple" if there are multiple locations
  const allLocationIds = availability.allLocationIds || (availability.location_id ? [availability.location_id] : []);
  const locationName = allLocationIds.length > 1 
    ? 'Multiple' 
    : (locations.find((l) => l.id === availability.location_id)?.name || 'Unknown Location');

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
            <Text style={styles.title}>Edit Availability</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.timeInfo}>
              <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
              <Text style={styles.timeText}>{dateTime.date}</Text>
            </View>
            <View style={styles.timeInfo}>
              <Ionicons name="time-outline" size={20} color="#8E8E93" />
              <Text style={styles.timeText}>
                {dateTime.time} - {endTime}
              </Text>
            </View>
            <View style={styles.timeInfo}>
              <Ionicons name="location-outline" size={20} color="#8E8E93" />
              <Text style={styles.timeText}>{locationName}</Text>
            </View>
            {availability.is_booked && (
              <View style={styles.bookedBadge}>
                <Ionicons name="lock-closed" size={16} color="#007AFF" />
                <Text style={styles.bookedText}>Booked</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Service Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Tennis Lesson"
                value={formData.serviceName}
                onChangeText={(text) => setFormData({ ...formData, serviceName: text })}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Location</Text>
              {formData.selectedLocationIds && formData.selectedLocationIds.length > 0 && (
                <Text style={styles.selectedCount}>
                  {formData.selectedLocationIds.length} location(s) selected
                </Text>
              )}
              <View style={styles.selectContainer}>
                {locations.map((location) => {
                  const isSelected = formData.selectedLocationIds?.includes(location.id) || formData.locationId === location.id;
                  return (
                    <TouchableOpacity
                      key={location.id}
                      style={[
                        styles.selectOption,
                        isSelected && styles.selectOptionActive,
                      ]}
                      onPress={() => {
                        const currentIds = formData.selectedLocationIds || [];
                        const newIds = isSelected
                          ? currentIds.filter(id => id !== location.id)
                          : [...currentIds, location.id];
                        
                        setFormData({
                          ...formData,
                          locationId: newIds.length > 0 ? newIds[0] : '', // Keep first as primary
                          selectedLocationIds: newIds,
                        });
                      }}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#fff" style={styles.checkIcon} />
                      )}
                      <Text
                        style={[
                          styles.selectOptionText,
                          isSelected && styles.selectOptionTextActive,
                        ]}
                      >
                        {location.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>


            {availability.is_booked && (
              <View style={styles.bookedWarning}>
                <Ionicons name="information-circle" size={20} color="#FF9500" />
                <Text style={styles.warningText}>
                  This slot is booked and cannot be deleted
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            {!availability.is_booked && (
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={() => {
                  console.log('Delete button TouchableOpacity onPress fired!');
                  handleDelete();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleUpdate}
            >
              <Text style={styles.updateButtonText}>Update</Text>
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
    padding: 20,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 8,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  selectOptionActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#000',
  },
  selectOptionTextActive: {
    color: '#fff',
  },
  checkIcon: {
    marginRight: -4,
  },
  selectedCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    fontWeight: '500',
  },
  bookedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 8,
  },
  bookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  bookedText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  updateButton: {
    backgroundColor: '#000',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
