import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// Service options for dropdown
const SERVICES = ['Stroke Clinic', 'Boot Camp', 'Private Lessons', 'UTR Points Play'];

// Simple Calendar Date Picker Component - Just the button
const CalendarDatePicker = ({ value, onChange, placeholder, onOpen }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <View style={styles.datePickerContainer}>
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={onOpen}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
        <Text style={[styles.datePickerText, !value && styles.datePickerPlaceholder]}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#8E8E93" />
      </TouchableOpacity>
    </View>
  );
};

// Calendar Modal Component - Renders in separate Modal above everything
const CalendarModal = ({ visible, onClose, value, onChange, minDate }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number);
      return { year, month: month - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Update selected month when value changes externally
  React.useEffect(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number);
      setSelectedMonth({ year, month: month - 1 });
    }
  }, [value]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const isDateDisabled = (day) => {
    if (!minDate) return false;
    const [minYear, minMonth, minDay] = minDate.split('-').map(Number);
    const currentDate = new Date(selectedMonth.year, selectedMonth.month, day);
    const minDateObj = new Date(minYear, minMonth - 1, minDay);
    return currentDate < minDateObj;
  };

  const handleDateSelect = (day) => {
    if (isDateDisabled(day)) return;
    const year = selectedMonth.year;
    const month = String(selectedMonth.month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    onChange(dateStr);
    onClose();
  };

  const handleTodaySelect = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    if (!isDateDisabled(parseInt(day, 10))) {
      onChange(dateStr);
      onClose();
    }
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() &&
           selectedMonth.year === today.getFullYear() &&
           selectedMonth.month === today.getMonth();
  };

  const navigateMonth = (direction) => {
    setSelectedMonth(prev => {
      let newMonth = prev.month + direction;
      let newYear = prev.year;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
      return { year: newYear, month: newMonth };
    });
  };

  const daysInMonth = getDaysInMonth(selectedMonth.year, selectedMonth.month);
  const firstDay = getFirstDayOfMonth(selectedMonth.year, selectedMonth.month);
  const monthName = new Date(selectedMonth.year, selectedMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = [];
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.calendarModalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.calendarModalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.calendarNavButton}>
              <Ionicons name="chevron-back" size={20} color="#000" />
            </TouchableOpacity>
            <Text style={styles.calendarMonthText}>{monthName}</Text>
            <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.calendarNavButton}>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.todayButton}
            onPress={handleTodaySelect}
            disabled={minDate && (() => {
              const today = new Date();
              const [minYear, minMonth, minDay] = minDate.split('-').map(Number);
              const minDateObj = new Date(minYear, minMonth - 1, minDay);
              return today < minDateObj;
            })()}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>

          <View style={styles.calendarWeekDays}>
            {weekDays.map(day => (
              <View key={day} style={styles.calendarWeekDay}>
                <Text style={styles.calendarWeekDayText}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarDays}>
            {days.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.calendarDay,
                  day && isDateDisabled(day) && styles.calendarDayDisabled,
                  day && isToday(day) && !value && styles.calendarDayToday,
                  day && value && (() => {
                    const [year, month, dayNum] = value.split('-').map(Number);
                    return day === dayNum && 
                           selectedMonth.year === year && 
                           selectedMonth.month === month - 1;
                  })() && styles.calendarDaySelected,
                ]}
                onPress={() => day && handleDateSelect(day)}
                disabled={!day || isDateDisabled(day)}
              >
                {day && (
                  <Text style={[
                    styles.calendarDayText,
                    day && isDateDisabled(day) && styles.calendarDayTextDisabled,
                    day && isToday(day) && !value && styles.calendarDayTextToday,
                    day && value && (() => {
                      const [year, month, dayNum] = value.split('-').map(Number);
                      return day === dayNum && 
                             selectedMonth.year === year && 
                             selectedMonth.month === month - 1;
                    })() && styles.calendarDayTextSelected,
                  ]}>
                    {day}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default function BulkAvailabilityDrawer({
  visible,
  onClose,
  onCreate,
}) {
  // Data fetching state
  const [locations, setLocations] = useState([]);
  const [allCourts, setAllCourts] = useState([]);
  
  // Selection state
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [filteredCourts, setFilteredCourts] = useState([]);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [serviceName, setServiceName] = useState('');

  const [formData, setFormData] = useState({
    selectedLocationIds: [], // Array of selected location IDs (for backward compatibility)
    startDate: '',
    endDate: '',
    daysOfWeek: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    },
    startTime: '09:00',
    endTime: '17:00',
    maxCapacity: '10', // Maximum number of users that can join
  });

  const [loading, setLoading] = useState(false);
  const [openCalendar, setOpenCalendar] = useState(null); // 'startDate' or 'endDate' or null

  // Fetch locations and courts on component mount
  useEffect(() => {
    if (visible) {
      loadLocationsAndCourts();
    }
  }, [visible]);

  // Filter courts when selectedLocation changes
  useEffect(() => {
    if (selectedLocation && allCourts.length > 0) {
      // Filter courts - convert both to strings to handle UUID comparison
      const filtered = allCourts.filter(court => {
        const courtLocationId = String(court.location_id || '').trim();
        const selectedLocationId = String(selectedLocation || '').trim();
        return courtLocationId === selectedLocationId;
      });
      
      console.log(`Filtered ${filtered.length} courts for location ${selectedLocation}`);
      setFilteredCourts(filtered);
      // Reset court selection when location changes
      setSelectedCourt(null);
    } else {
      setFilteredCourts([]);
      setSelectedCourt(null);
    }
  }, [selectedLocation, allCourts]);

  // Service name is now manual input, no auto-population needed

  const loadLocationsAndCourts = async () => {
    try {
      // Fetch all locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('name');

      if (locationsError) {
        console.error('Error loading locations:', locationsError);
        Alert.alert('Error', 'Failed to load locations: ' + locationsError.message);
        setLocations([]);
      } else {
        console.log('✅ Locations loaded successfully:', locationsData?.length || 0, 'locations');
        if (locationsData && locationsData.length > 0) {
          console.log('Sample location data:', {
            id: locationsData[0].id,
            name: locationsData[0].name,
          });
        }
        setLocations(locationsData || []);
      }

      // Fetch all courts with id, name, and location_id
      const { data: courtsData, error: courtsError } = await supabase
        .from('courts')
        .select('id, location_id, name')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('name');

      if (courtsError) {
        console.error('Error loading courts:', courtsError);
        // If courts table doesn't exist, that's okay - we'll handle it gracefully
        if (!courtsError.message?.includes('does not exist')) {
          Alert.alert('Error', 'Failed to load courts: ' + courtsError.message);
        }
        setAllCourts([]);
      } else {
        console.log('✅ Courts loaded successfully:', courtsData?.length || 0, 'courts');
        if (courtsData && courtsData.length > 0) {
          console.log('Sample court data:', {
            id: courtsData[0].id,
            name: courtsData[0].name,
            location_id: courtsData[0].location_id,
          });
          // Log all location_ids to see what we have
          const uniqueLocationIds = [...new Set(courtsData.map(c => c.location_id))];
          console.log('Unique location_ids in courts:', uniqueLocationIds);
        }
        setAllCourts(courtsData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'An error occurred while loading data: ' + (error.message || 'Unknown error'));
    }
  };

  // Reset form when drawer closes
  React.useEffect(() => {
    if (!visible) {
      setFormData({
        selectedLocationIds: [],
        startDate: '',
        endDate: '',
        daysOfWeek: {
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false,
        },
        startTime: '09:00',
        endTime: '17:00',
        maxCapacity: '10',
      });
      setSelectedLocation(null);
      setSelectedCourt(null);
      setServiceName('');
      setFilteredCourts([]);
      setLoading(false);
    }
  }, [visible]);

  const handleDayToggle = (day) => {
    setFormData({
      ...formData,
      daysOfWeek: {
        ...formData.daysOfWeek,
        [day]: !formData.daysOfWeek[day],
      },
    });
  };

  const handleGenerate = async () => {
    console.log('=== Generate Button Clicked ===');
    console.log('Form Data:', JSON.stringify(formData, null, 2));
    console.log('Selected Location:', selectedLocation);
    console.log('Selected Court:', selectedCourt);
    console.log('Service Name:', serviceName);
    console.log('Start Date:', formData.startDate);
    console.log('End Date:', formData.endDate);
    
    try {
      // Validation
      if (!selectedLocation) {
        console.log('Validation failed: No location selected');
        Alert.alert('Validation Error', 'Please select a location');
        return;
      }

      if (!selectedCourt) {
        console.log('Validation failed: No court selected');
        Alert.alert('Validation Error', 'Please select a court');
        return;
      }

      if (!serviceName) {
        console.log('Validation failed: No service name selected');
        Alert.alert('Validation Error', 'Please select a service name');
        return;
      }

      if (!formData.startDate || !formData.endDate) {
        console.log('Validation failed: Missing dates');
        Alert.alert('Validation Error', 'Please fill in start and end dates');
        return;
      }

      const selectedDays = Object.entries(formData.daysOfWeek)
        .filter(([_, selected]) => selected)
        .map(([day, _]) => day);

      if (selectedDays.length === 0) {
        console.log('Validation failed: No days selected');
        Alert.alert('Validation Error', 'Please select at least one day of the week');
        return;
      }

      // Validate max capacity
      const maxCapacity = parseInt(formData.maxCapacity, 10);
      if (isNaN(maxCapacity) || maxCapacity < 1) {
        Alert.alert('Validation Error', 'Please enter a valid maximum capacity (at least 1)');
        return;
      }

      console.log('✅ All validation passed');
      console.log('Selected days:', selectedDays);
      console.log('Selected location:', selectedLocation);
      console.log('Selected court:', selectedCourt);

      // Proceed with creation
      console.log('Proceeding with creation...');
      try {
        setLoading(true);
        // Prepare formData with selected location, court, and service name
        const formDataToSubmit = {
          ...formData,
          selectedLocationIds: [selectedLocation], // Single location
          selectedCourtId: selectedCourt, // Selected court ID
          serviceName: serviceName || '', // Manually typed service name
        };
        console.log('Calling onCreate with formData:', formDataToSubmit);
        
        try {
          await onCreate(formDataToSubmit);
          console.log('✅ onCreate completed successfully');
          // Success alert will be shown by the parent component
          // Don't close drawer immediately - let user see the success message
          setLoading(false);
          // Wait longer before closing to ensure alert is visible
          setTimeout(() => {
            onClose();
          }, 2000);
        } catch (error) {
          console.error('❌ Error in onCreate:', error);
          setLoading(false);
          Alert.alert(
            'Error ❌',
            'Failed to create availability:\n\n' + (error.message || 'Unknown error'),
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('❌ Error in creation handler:', error);
        setLoading(false);
        Alert.alert('Error', 'An unexpected error occurred: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error in handleGenerate:', error);
      Alert.alert('Error', 'An error occurred: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <>
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.drawer}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Bulk Availability</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {/* Location Dropdown */}
            <View style={styles.field}>
              <Text style={styles.label}>Location *</Text>
              {locations.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Loading locations...</Text>
                </View>
              ) : (
                <View style={styles.selectContainer}>
                  {locations.map((location) => (
                    <TouchableOpacity
                      key={location.id}
                      style={[
                        styles.selectOption,
                        selectedLocation === location.id && styles.selectOptionActive,
                      ]}
                      onPress={() => setSelectedLocation(location.id)}
                    >
                      <Text
                        style={[
                          styles.selectOptionText,
                          selectedLocation === location.id && styles.selectOptionTextActive,
                        ]}
                      >
                        {location.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Court Dropdown - Only shown when location is selected */}
            {selectedLocation && (
              <View style={styles.field}>
                <Text style={styles.label}>Court *</Text>
                {allCourts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>Loading courts...</Text>
                  </View>
                ) : filteredCourts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      No courts available for this location
                      {allCourts.length > 0 && ` (${allCourts.length} total courts in system)`}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.selectContainer}>
                    {filteredCourts.map((court) => (
                      <TouchableOpacity
                        key={court.id}
                        style={[
                          styles.selectOption,
                          selectedCourt === court.id && styles.selectOptionActive,
                        ]}
                        onPress={() => setSelectedCourt(court.id)}
                      >
                        <Text
                          style={[
                            styles.selectOptionText,
                            selectedCourt === court.id && styles.selectOptionTextActive,
                          ]}
                        >
                          {court.name || `Court ${court.id}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Service Name - Dropdown */}
            <View style={styles.field}>
              <Text style={styles.label}>Service Name *</Text>
              <View style={styles.selectContainer}>
                {SERVICES.map((service) => (
                  <TouchableOpacity
                    key={service}
                    style={[
                      styles.selectOption,
                      serviceName === service && styles.selectOptionActive,
                    ]}
                    onPress={() => setServiceName(service)}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        serviceName === service && styles.selectOptionTextActive,
                      ]}
                    >
                      {service}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Range */}
            <View style={styles.field}>
              <Text style={styles.label}>Start Date *</Text>
              <CalendarDatePicker
                value={formData.startDate}
                onChange={(date) => {
                  // If new start date is after end date, clear end date
                  const newFormData = { ...formData, startDate: date };
                  if (formData.endDate && date > formData.endDate) {
                    newFormData.endDate = '';
                  }
                  setFormData(newFormData);
                }}
                placeholder="Select start date"
                onOpen={() => setOpenCalendar('startDate')}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>End Date *</Text>
              <CalendarDatePicker
                value={formData.endDate}
                onChange={(date) => setFormData({ ...formData, endDate: date })}
                placeholder="Select end date"
                onOpen={() => setOpenCalendar('endDate')}
              />
            </View>

            {/* Days of Week */}
            <View style={styles.field}>
              <Text style={styles.label}>Days of Week *</Text>
              <View style={styles.daysContainer}>
                {[
                  { key: 'monday', label: 'Mon' },
                  { key: 'tuesday', label: 'Tue' },
                  { key: 'wednesday', label: 'Wed' },
                  { key: 'thursday', label: 'Thu' },
                  { key: 'friday', label: 'Fri' },
                  { key: 'saturday', label: 'Sat' },
                  { key: 'sunday', label: 'Sun' },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.dayButton,
                      formData.daysOfWeek[key] && styles.dayButtonActive,
                    ]}
                    onPress={() => handleDayToggle(key)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        formData.daysOfWeek[key] && styles.dayButtonTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Time Window */}
            <View style={styles.field}>
              <Text style={styles.label}>Daily Time Window *</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>Start Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="09:00"
                    value={formData.startTime}
                    onChangeText={(text) => setFormData({ ...formData, startTime: text })}
                  />
                </View>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>End Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="17:00"
                    value={formData.endTime}
                    onChangeText={(text) => setFormData({ ...formData, endTime: text })}
                  />
                </View>
              </View>
            </View>

            {/* Max Capacity */}
            <View style={styles.field}>
              <Text style={styles.label}>Maximum Capacity *</Text>
              <Text style={styles.fieldDescription}>
                Number of users that can join each availability slot
              </Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                value={formData.maxCapacity}
                onChangeText={(text) => setFormData({ ...formData, maxCapacity: text })}
                keyboardType="numeric"
              />
            </View>
          </ScrollView>


          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.generateButton, loading && styles.buttonDisabled]}
              onPress={() => {
                console.log('Generate button pressed');
                handleGenerate();
              }}
              disabled={loading}
            >
              <Text style={styles.generateButtonText}>
                {loading ? 'Generating...' : 'Generate Availability'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Calendar Modals - Render in separate Modals above everything */}
    <CalendarModal
      visible={openCalendar === 'startDate'}
      onClose={() => setOpenCalendar(null)}
      value={formData.startDate}
      onChange={(date) => {
        const newFormData = { ...formData, startDate: date };
        if (formData.endDate && date > formData.endDate) {
          newFormData.endDate = '';
        }
        setFormData(newFormData);
        setOpenCalendar(null);
      }}
      minDate={null}
    />

    <CalendarModal
      visible={openCalendar === 'endDate'}
      onClose={() => setOpenCalendar(null)}
      value={formData.endDate}
      onChange={(date) => {
        setFormData({ ...formData, endDate: date });
        setOpenCalendar(null);
      }}
      minDate={formData.startDate}
    />
    </>
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
  drawer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    ...(Platform.OS !== 'web' && {
      width: '100%',
      maxWidth: '90%',
    }),
    overflow: 'hidden',
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
    maxHeight: Platform.OS === 'web' ? 500 : 400,
    zIndex: 1,
    ...(Platform.OS === 'web' && {
      overflow: 'visible',
    }),
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F5F5F5',
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
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  dayButtonTextActive: {
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
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
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  generateButton: {
    backgroundColor: '#000',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#007AFF',
    flex: 1,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  checkboxContainer: {
    gap: 12,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  checkboxLabelChecked: {
    fontWeight: '600',
  },
  selectedCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
  },
  fieldDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    marginTop: -4,
  },
  emptyState: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  inputReadOnly: {
    backgroundColor: '#F5F5F5',
  },
  datePickerContainer: {
    position: 'relative',
    zIndex: 100,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  datePickerText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  datePickerPlaceholder: {
    color: '#8E8E93',
  },
  calendar: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      zIndex: 99999,
      position: 'fixed',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 1000,
    }),
    zIndex: 99999,
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100000,
  },
  calendarModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: Platform.OS === 'web' ? 350 : '90%',
    maxWidth: 400,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
    }),
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 1000,
    }),
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarNavButton: {
    padding: 8,
  },
  calendarMonthText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarWeekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDaySelected: {
    backgroundColor: '#000',
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#000',
  },
  calendarDayTextDisabled: {
    color: '#C7C7CC',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  calendarDayToday: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  calendarDayTextToday: {
    color: '#007AFF',
    fontWeight: '600',
  },
  todayButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginBottom: 12,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});
