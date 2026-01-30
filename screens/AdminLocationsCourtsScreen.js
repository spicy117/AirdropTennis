import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// Conditionally import WebView only for native platforms
let WebView = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch (e) {
    console.warn('WebView not available:', e);
  }
}

const MIN_TOUCH_TARGET = 44; // iOS/Android recommended minimum

export default function AdminLocationsCourtsScreen({ onNavigate }) {
  const { width: screenWidth } = useWindowDimensions?.() ?? Dimensions.get('window');
  const isNarrow = screenWidth < 400;
  const contentPadding = isNarrow ? 14 : 20;

  const [locations, setLocations] = useState([]);
  const [courts, setCourts] = useState([]);
  const [courtTypes, setCourtTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingCourt, setSavingCourt] = useState(false);
  const [courtError, setCourtError] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  
  // Location modal state
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLatitude, setLocationLatitude] = useState('');
  const [locationLongitude, setLocationLongitude] = useState('');
  
  // Court modal state
  const [courtModalVisible, setCourtModalVisible] = useState(false);
  const [editingCourt, setEditingCourt] = useState(null);
  const [courtName, setCourtName] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedCourtTypeId, setSelectedCourtTypeId] = useState(null);
  const [showCourtTypeDropdown, setShowCourtTypeDropdown] = useState(false);
  const [courtTypeDropdownLayout, setCourtTypeDropdownLayout] = useState(null);
  const courtTypeDropdownRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel and wait for all to complete
      // Filter out soft-deleted locations and courts
      const [locationsResult, courtsResult, courtTypesResult] = await Promise.all([
        supabase
          .from('locations')
          .select('*')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('name'),
        supabase
          .from('courts')
          .select('*, locations:location_id (id, name), court_types:court_type_id (id, name)')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('name'),
        supabase
          .from('court_types')
          .select('*')
          .order('name')
      ]);

      // Process locations
      const { data: locationsData, error: locationsError } = locationsResult;
      if (locationsError) {
        console.error('Error loading locations:', locationsError);
        Alert.alert('Error', 'Failed to load locations: ' + locationsError.message);
        setLocations([]);
      } else {
        setLocations(locationsData || []);
      }

      // Process courts
      const { data: courtsData, error: courtsError } = courtsResult;
      if (courtsError) {
        console.error('Error loading courts:', courtsError);
        // If courts table doesn't exist, that's okay - we'll handle it gracefully
        if (!courtsError.message?.includes('does not exist')) {
          Alert.alert('Error', 'Failed to load courts: ' + courtsError.message);
        }
        setCourts([]);
      } else {
        setCourts(courtsData || []);
      }

      // Process court types
      const { data: courtTypesData, error: courtTypesError } = courtTypesResult;
      if (courtTypesError) {
        console.error('❌ Error loading court types:', courtTypesError);
        console.error('Error code:', courtTypesError.code);
        console.error('Error message:', courtTypesError.message);
        console.error('Error status:', courtTypesError.status);
        console.error('Error details:', courtTypesError.details);
        console.error('Error hint:', courtTypesError.hint);
        
        // Check for RLS/permission errors
        if (courtTypesError.code === '42501' || courtTypesError.status === 403 || courtTypesError.message?.includes('permission denied') || courtTypesError.message?.includes('new row violates row-level security')) {
          Alert.alert(
            'Permission Denied (RLS Policy)',
            'The court_types table exists but RLS policies are blocking access.\n\n' +
            'Please run this SQL in Supabase SQL Editor to allow reading court_types:\n\n' +
            'ALTER TABLE court_types ENABLE ROW LEVEL SECURITY;\n' +
            'CREATE POLICY "Allow public read access to court_types" ON court_types FOR SELECT USING (true);',
            [{ text: 'OK' }]
          );
        } else if (courtTypesError.message?.includes('does not exist') || courtTypesError.code === 'PGRST116') {
          Alert.alert(
            'Court Types Table Not Found',
            'The court_types table does not exist. Please run the migrations/add_court_types.sql file in Supabase SQL Editor first.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Error Loading Court Types',
            `Failed to load court types:\n\n${courtTypesError.message}\n\nCode: ${courtTypesError.code || 'N/A'}\nStatus: ${courtTypesError.status || 'N/A'}\n\nCheck console for details.`,
            [{ text: 'OK' }]
          );
        }
        setCourtTypes([]);
      } else {
        console.log('✅ Court types loaded:', courtTypesData?.length || 0, 'types');
        console.log('Court types data:', courtTypesData);
        if (!courtTypesData || courtTypesData.length === 0) {
          console.warn('⚠️ Court types query succeeded but returned no data');
        }
        setCourtTypes(courtTypesData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Group courts by location
  const courtsByLocation = courts.reduce((acc, court) => {
    const locationId = court.location_id;
    if (!acc[locationId]) {
      acc[locationId] = [];
    }
    acc[locationId].push(court);
    return acc;
  }, {});

  const filteredLocations = locations.filter((location) => {
    const query = searchQuery.toLowerCase();
    const locationMatches = (
      location.name?.toLowerCase().includes(query) ||
      location.address?.toLowerCase().includes(query)
    );
    
    // Also include location if any of its courts match
    const locationCourts = courtsByLocation[location.id] || [];
    const courtsMatch = locationCourts.some(court => 
      court.name?.toLowerCase().includes(query)
    );
    
    return locationMatches || courtsMatch;
  });
  
  // Filter courts by search query
  const getFilteredCourtsForLocation = (locationId) => {
    const locationCourts = courtsByLocation[locationId] || [];
    if (!searchQuery.trim()) return locationCourts;
    
    const query = searchQuery.toLowerCase();
    return locationCourts.filter(court => 
      court.name?.toLowerCase().includes(query)
    );
  };

  // Generate map HTML with Carto Voyager style and Leaflet
  const generateMapHTML = () => {
    const locationsWithCoords = filteredLocations.filter(
      loc => loc.latitude != null && loc.longitude != null
    );

    if (locationsWithCoords.length === 0) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            body { margin: 0; padding: 0; }
            #map { width: 100%; height: 100vh; }
            .no-coords { 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              font-family: Arial, sans-serif;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="no-coords">
            <p>No locations with coordinates available to display on map.</p>
          </div>
        </body>
        </html>
      `;
    }

    // Calculate center of all locations
    const avgLat = locationsWithCoords.reduce((sum, loc) => sum + parseFloat(loc.latitude), 0) / locationsWithCoords.length;
    const avgLng = locationsWithCoords.reduce((sum, loc) => sum + parseFloat(loc.longitude), 0) / locationsWithCoords.length;

    // Generate markers HTML
    const markers = locationsWithCoords.map((loc, index) => {
      const lat = parseFloat(loc.latitude);
      const lng = parseFloat(loc.longitude);
      const name = (loc.name || 'Unnamed Location').replace(/'/g, "\\'");
      const address = (loc.address || '').replace(/'/g, "\\'");
      const courtsCount = (courtsByLocation[loc.id] || []).length;
      
      return `
        L.marker([${lat}, ${lng}]).addTo(map)
          .bindPopup('<b>${name}</b><br>${address || 'No address'}<br><small>${courtsCount} court${courtsCount !== 1 ? 's' : ''}</small>');
      `;
    }).join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100%; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          var map = L.map('map').setView([${avgLat}, ${avgLng}], 12);
          
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
          }).addTo(map);
          
          ${markers}
        </script>
      </body>
      </html>
    `;
  };

  // Location CRUD operations
  const openLocationModal = (location = null) => {
    if (location) {
      setEditingLocation(location);
      setLocationName(location.name || '');
      setLocationAddress(location.address || '');
      setLocationLatitude(location.latitude?.toString() || '');
      setLocationLongitude(location.longitude?.toString() || '');
    } else {
      setEditingLocation(null);
      setLocationName('');
      setLocationAddress('');
      setLocationLatitude('');
      setLocationLongitude('');
    }
    setLocationModalVisible(true);
  };

  const closeLocationModal = () => {
    setLocationModalVisible(false);
    // Reset state after modal closes to avoid flash
    setTimeout(() => {
      setEditingLocation(null);
      setLocationName('');
      setLocationAddress('');
      setLocationLatitude('');
      setLocationLongitude('');
      setSavingLocation(false);
    }, 300); // Wait for modal close animation
  };

  const saveLocation = async () => {
    if (!locationName.trim()) {
      Alert.alert('Validation Error', 'Location name is required');
      return;
    }

    // Validate latitude and longitude if provided
    let latitude = null;
    let longitude = null;
    
    if (locationLatitude.trim()) {
      const lat = parseFloat(locationLatitude.trim());
      if (isNaN(lat) || lat < -90 || lat > 90) {
        Alert.alert('Validation Error', 'Latitude must be a number between -90 and 90');
        return;
      }
      latitude = lat;
    }

    if (locationLongitude.trim()) {
      const lng = parseFloat(locationLongitude.trim());
      if (isNaN(lng) || lng < -180 || lng > 180) {
        Alert.alert('Validation Error', 'Longitude must be a number between -180 and 180');
        return;
      }
      longitude = lng;
    }

    try {
      setSavingLocation(true);
      
      const locationData = {
        name: locationName.trim(),
        address: locationAddress.trim() || null,
        latitude: latitude,
        longitude: longitude,
      };

      if (editingLocation) {
        // Update existing location
        const { error } = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', editingLocation.id);

        if (error) throw error;
        Alert.alert('Success', 'Location updated successfully');
      } else {
        // Create new location
        const { error } = await supabase
          .from('locations')
          .insert(locationData);

        if (error) throw error;
        Alert.alert('Success', 'Location created successfully');
      }

      closeLocationModal();
      loadData();
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'Failed to save location: ' + error.message);
    } finally {
      setSavingLocation(false);
    }
  };

  const deleteLocation = async (location) => {
    if (!location || !location.id) {
      console.error('Invalid location object:', location);
      Alert.alert('Error', 'Invalid location data');
      return;
    }

    console.log('Deleting location:', location.id, location.name);

    // On web, use window.confirm as fallback
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete "${location.name}"? This will also delete all associated courts.`);
      if (!confirmed) {
        console.log('Delete cancelled by user');
        return;
      }
      
      // Proceed with deletion
      try {
        console.log('Delete confirmed, soft deleting location and courts:', location.id);
        
        // First, soft delete all courts associated with this location (cascade)
        const { error: courtsError } = await supabase
          .from('courts')
          .update({ is_deleted: true })
          .eq('location_id', location.id)
          .or('is_deleted.is.null,is_deleted.eq.false'); // Only update non-deleted courts

        if (courtsError) {
          console.error('Error soft deleting courts:', courtsError);
          // If column doesn't exist, fall back to hard delete for backward compatibility
          if (courtsError.message?.includes('column') || courtsError.message?.includes('does not exist')) {
            const { error: hardDeleteError } = await supabase
              .from('courts')
              .delete()
              .eq('location_id', location.id);
            if (hardDeleteError) {
              console.error('Error hard deleting courts:', hardDeleteError);
            }
          }
        }

        // Then soft delete the location
        const { error } = await supabase
          .from('locations')
          .update({ is_deleted: true })
          .eq('id', location.id);

        if (error) {
          // If column doesn't exist, fall back to hard delete for backward compatibility
          if (error.message?.includes('column') || error.message?.includes('does not exist')) {
            const { error: hardDeleteError } = await supabase
              .from('locations')
              .delete()
              .eq('id', location.id);
            if (hardDeleteError) throw hardDeleteError;
          } else {
            throw error;
          }
        }
        
        console.log('Location deleted successfully');
        Alert.alert('Success', 'Location deleted successfully');
        loadData();
      } catch (error) {
        console.error('Error deleting location:', error);
        Alert.alert('Error', 'Failed to delete location: ' + error.message);
      }
      return;
    }

    // For native platforms, use Alert.alert
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${location.name}"? This will also delete all associated courts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // First, soft delete all courts associated with this location (cascade)
              const { error: courtsError } = await supabase
                .from('courts')
                .update({ is_deleted: true })
                .eq('location_id', location.id)
                .or('is_deleted.is.null,is_deleted.eq.false'); // Only update non-deleted courts

              if (courtsError) {
                console.error('Error soft deleting courts:', courtsError);
                // If column doesn't exist, fall back to hard delete for backward compatibility
                if (courtsError.message?.includes('column') || courtsError.message?.includes('does not exist')) {
                  const { error: hardDeleteError } = await supabase
                    .from('courts')
                    .delete()
                    .eq('location_id', location.id);
                  if (hardDeleteError) {
                    console.error('Error hard deleting courts:', hardDeleteError);
                  }
                }
              }

              // Then soft delete the location
              const { error } = await supabase
                .from('locations')
                .update({ is_deleted: true })
                .eq('id', location.id);

              if (error) {
                // If column doesn't exist, fall back to hard delete for backward compatibility
                if (error.message?.includes('column') || error.message?.includes('does not exist')) {
                  const { error: hardDeleteError } = await supabase
                    .from('locations')
                    .delete()
                    .eq('id', location.id);
                  if (hardDeleteError) throw hardDeleteError;
                } else {
                  throw error;
                }
              }
              Alert.alert('Success', 'Location deleted successfully');
              loadData();
            } catch (error) {
              console.error('Error deleting location:', error);
              Alert.alert('Error', 'Failed to delete location: ' + error.message);
            }
          },
        },
      ]
    );
  };

  // Court CRUD operations
  const openCourtModal = (court = null, locationId = null) => {
    setCourtError(''); // Clear any previous errors
    setSavingCourt(false); // Reset saving state
    if (court) {
      setEditingCourt(court);
      setCourtName(court.name || '');
      setSelectedLocationId(court.location_id);
      setSelectedCourtTypeId(court.court_type_id || null);
    } else {
      setEditingCourt(null);
      setCourtName('');
      // locationId should always be provided when adding from a location
      setSelectedLocationId(locationId);
      setSelectedCourtTypeId(null);
    }
    setShowCourtTypeDropdown(false);
    setCourtModalVisible(true);
  };

  const closeCourtModal = () => {
    setCourtModalVisible(false);
    // Reset state after modal closes to avoid flash
    setTimeout(() => {
      setEditingCourt(null);
      setCourtName('');
      setSelectedLocationId(null);
      setSelectedCourtTypeId(null);
      setShowCourtTypeDropdown(false);
      setCourtError('');
      setSavingCourt(false);
    }, 300); // Wait for modal close animation
  };

  const saveCourt = async () => {
    setCourtError(''); // Clear previous errors
    
    // Validation
    if (!courtName.trim()) {
      setCourtError('Court name is required');
      return;
    }

    if (!selectedLocationId) {
      setCourtError('Please select a location');
      return;
    }

    // Check for duplicate court name in the same location
    try {
      const trimmedName = courtName.trim();
      const { data: existingCourts, error: checkError } = await supabase
        .from('courts')
        .select('id, name')
        .eq('location_id', selectedLocationId)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .ilike('name', trimmedName);

      if (checkError) {
        console.error('Error checking for duplicates:', checkError);
        // Continue anyway - might be a network issue
      } else {
        // Check if there's a duplicate (excluding the current court if editing)
        const duplicate = existingCourts?.find(
          court => court.id !== editingCourt?.id && court.name.toLowerCase() === trimmedName.toLowerCase()
        );
        
        if (duplicate) {
          setCourtError('A court with this name already exists at this location');
          return;
        }
      }
    } catch (checkError) {
      console.error('Error checking duplicates:', checkError);
      // Continue with save attempt
    }

    try {
      setSavingCourt(true);
      setCourtError(''); // Clear errors before saving
      
      const courtData = {
        name: courtName.trim(),
        location_id: selectedLocationId,
        court_type_id: selectedCourtTypeId || null,
      };

      if (editingCourt) {
        // Update existing court
        const { error } = await supabase
          .from('courts')
          .update(courtData)
          .eq('id', editingCourt.id);

        if (error) {
          // Handle specific error cases
          if (error.code === '23505') { // Unique constraint violation
            setCourtError('A court with this name already exists at this location');
          } else {
            setCourtError(error.message || 'Failed to update court');
          }
          setSavingCourt(false);
          return;
        }
        Alert.alert('Success', 'Court updated successfully');
      } else {
        // Create new court
        const { error } = await supabase
          .from('courts')
          .insert(courtData);

        if (error) {
          // Handle specific error cases
          if (error.code === '23505') { // Unique constraint violation
            setCourtError('A court with this name already exists at this location');
          } else {
            setCourtError(error.message || 'Failed to create court');
          }
          setSavingCourt(false);
          return;
        }
        Alert.alert('Success', 'Court created successfully');
      }

      closeCourtModal();
      loadData();
    } catch (error) {
      console.error('Error saving court:', error);
      setCourtError(error.message || 'An unexpected error occurred');
      setSavingCourt(false);
    }
  };

  const deleteCourt = async (court) => {
    if (!court || !court.id) {
      console.error('Invalid court object:', court);
      Alert.alert('Error', 'Invalid court data');
      return;
    }

    console.log('Deleting court:', court.id, court.name);
    
    // On web, use window.confirm as fallback
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete "${court.name}"?`);
      if (!confirmed) {
        console.log('Delete cancelled by user');
        return;
      }
      
      // Proceed with deletion
      try {
        console.log('Delete confirmed, soft deleting court:', court.id);
        
        // Soft delete the court
        const { error } = await supabase
          .from('courts')
          .update({ is_deleted: true })
          .eq('id', court.id);

        if (error) {
          console.error('Soft delete error:', error);
          // If column doesn't exist, fall back to hard delete for backward compatibility
          if (error.message?.includes('column') || error.message?.includes('does not exist')) {
            console.log('Falling back to hard delete');
            const { error: hardDeleteError } = await supabase
              .from('courts')
              .delete()
              .eq('id', court.id);
            if (hardDeleteError) {
              console.error('Hard delete error:', hardDeleteError);
              throw hardDeleteError;
            }
          } else {
            throw error;
          }
        }
        
        console.log('Court deleted successfully');
        Alert.alert('Success', 'Court deleted successfully');
        loadData();
      } catch (error) {
        console.error('Error deleting court:', error);
        Alert.alert('Error', 'Failed to delete court: ' + error.message);
      }
      return;
    }
    
    // For native platforms, use Alert.alert
    Alert.alert(
      'Delete Court',
      `Are you sure you want to delete "${court.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Delete confirmed, soft deleting court:', court.id);
              
              // Soft delete the court
              const { error } = await supabase
                .from('courts')
                .update({ is_deleted: true })
                .eq('id', court.id);

              if (error) {
                console.error('Soft delete error:', error);
                // If column doesn't exist, fall back to hard delete for backward compatibility
                if (error.message?.includes('column') || error.message?.includes('does not exist')) {
                  console.log('Falling back to hard delete');
                  const { error: hardDeleteError } = await supabase
                    .from('courts')
                    .delete()
                    .eq('id', court.id);
                  if (hardDeleteError) {
                    console.error('Hard delete error:', hardDeleteError);
                    throw hardDeleteError;
                  }
                } else {
                  throw error;
                }
              }
              
              console.log('Court deleted successfully');
              Alert.alert('Success', 'Court deleted successfully');
              loadData();
            } catch (error) {
              console.error('Error deleting court:', error);
              Alert.alert('Error', 'Failed to delete court: ' + error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingHorizontal: contentPadding, paddingVertical: contentPadding }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} />
        }
      >
        <View style={[styles.header, isNarrow && styles.headerNarrow]}>
          <View style={[styles.headerTextWrap, isNarrow && styles.headerTextWrapNarrow]}>
            <Text style={[styles.title, isNarrow && styles.titleNarrow]} numberOfLines={isNarrow ? 2 : 1}>
              Locations & Courts
            </Text>
            <Text style={[styles.subtitle, isNarrow && styles.subtitleNarrow]} numberOfLines={1}>
              {locations.length} locations, {courts.length} courts
            </Text>
          </View>
          <View style={[styles.headerActions, isNarrow && styles.headerActionsNarrow]}>
            {onNavigate && (
              <TouchableOpacity
                style={styles.dashboardBtn}
                onPress={() => onNavigate('admin-dashboard')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="grid-outline" size={18} color="#0D9488" />
                <Text style={styles.dashboardBtnText}>Dashboard</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
              onPress={() => setViewMode('list')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel="List view"
            >
              <Ionicons name="list" size={20} color={viewMode === 'list' ? '#fff' : '#000'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleButton, viewMode === 'map' && styles.viewToggleButtonActive]}
              onPress={() => setViewMode('map')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Map view"
            >
              <Ionicons name="map" size={20} color={viewMode === 'map' ? '#fff' : '#000'} />
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={styles.addButtonSmall}
                onPress={() => openLocationModal()}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addButtonSmallText}>Add Location</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Bar */}
        {viewMode === 'list' && (
          <View style={[styles.searchContainer, isNarrow && styles.searchContainerNarrow]}>
            <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search locations and courts..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
              fontSize={16}
            />
          </View>
        )}

        {/* Add Button (Mobile only) */}
        {Platform.OS !== 'web' && viewMode === 'list' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => openLocationModal()}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Add Location</Text>
          </TouchableOpacity>
        )}

        {/* Map View */}
        {viewMode === 'map' && (
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <iframe
                srcDoc={generateMapHTML()}
                style={styles.mapIframe}
                title="Locations Map"
              />
            ) : WebView ? (
              <WebView
                source={{ html: generateMapHTML() }}
                style={styles.mapWebView}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <Ionicons name="map-outline" size={64} color="#C7C7CC" />
                <Text style={styles.mapPlaceholderText}>
                  Map view requires react-native-webview.{'\n'}
                  Please restart the app after installation.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Locations List */}
        {viewMode === 'list' && (
          filteredLocations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyText}>No locations found</Text>
            </View>
          ) : (
          filteredLocations.map((location) => {
            const locationCourts = getFilteredCourtsForLocation(location.id);
            return (
              <View key={location.id} style={[styles.card, isNarrow && styles.cardNarrow]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, isNarrow && styles.cardIconNarrow]}>
                    <Ionicons name="location" size={isNarrow ? 20 : 24} color="#007AFF" />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, isNarrow && styles.cardTitleNarrow]} numberOfLines={2}>{location.name}</Text>
                    {location.address && (
                      <Text style={[styles.cardSubtitle, isNarrow && styles.cardSubtitleNarrow]} numberOfLines={2}>{location.address}</Text>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openLocationModal(location)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${location.name}`}
                    >
                      <Ionicons name="pencil" size={20} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => deleteLocation(location)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${location.name}`}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Courts Section */}
                <View style={styles.courtsList}>
                  <View style={styles.courtsListHeader}>
                    <Text style={styles.courtsListTitle}>
                      Courts ({locationCourts.length})
                    </Text>
                    <TouchableOpacity
                      style={styles.addCourtButton}
                      onPress={() => openCourtModal(null, location.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Add court"
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
                      <Text style={styles.addCourtButtonText}>Add Court</Text>
                    </TouchableOpacity>
                  </View>
                  {locationCourts.length === 0 ? (
                    <Text style={styles.noCourtsText}>No courts yet</Text>
                  ) : (
                    locationCourts.map((court) => (
                      <View key={court.id} style={[styles.courtItem, isNarrow && styles.courtItemNarrow]}>
                        <View style={styles.courtItemLeft}>
                          <Ionicons name="tennisball" size={16} color="#34C759" />
                          <View style={styles.courtItemInfo}>
                            <Text style={styles.courtItemText} numberOfLines={1}>{court.name}</Text>
                            {court.court_types?.name && (
                              <Text style={styles.courtItemType} numberOfLines={1}>{court.court_types.name}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.courtItemActions}>
                          <TouchableOpacity
                            style={styles.courtActionButton}
                            onPress={() => openCourtModal(court)}
                            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                            accessible
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${court.name}`}
                          >
                            <Ionicons name="pencil" size={16} color="#007AFF" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.courtActionButton}
                            onPress={() => deleteCourt(court)}
                            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                            accessible
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${court.name}`}
                          >
                            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })
          )
        )}
      </ScrollView>

      {/* Location Modal */}
      <Modal
        visible={locationModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeLocationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingLocation ? 'Edit Location' : 'New Location'}
              </Text>
              <TouchableOpacity onPress={closeLocationModal} style={styles.modalCloseHitArea} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessible accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Location name"
                placeholderTextColor="#8E8E93"
                value={locationName}
                onChangeText={setLocationName}
                autoFocus
              />

              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter address"
                placeholderTextColor="#8E8E93"
                value={locationAddress}
                onChangeText={setLocationAddress}
              />

              <Text style={styles.inputLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 40.7128"
                placeholderTextColor="#8E8E93"
                value={locationLatitude}
                onChangeText={setLocationLatitude}
                keyboardType="numeric"
              />
              <Text style={styles.inputHint}>
                Optional: Enter latitude between -90 and 90
              </Text>

              <Text style={styles.inputLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., -74.0060"
                placeholderTextColor="#8E8E93"
                value={locationLongitude}
                onChangeText={setLocationLongitude}
                keyboardType="numeric"
              />
              <Text style={styles.inputHint}>
                Optional: Enter longitude between -180 and 180
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={closeLocationModal}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave, savingLocation && styles.modalButtonDisabled]}
                  onPress={saveLocation}
                  disabled={savingLocation}
                >
                  {savingLocation ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSave}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Court Modal */}
      <Modal
        visible={courtModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeCourtModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCourt ? 'Edit Court' : 'New Court'}
              </Text>
              <TouchableOpacity onPress={closeCourtModal} style={styles.modalCloseHitArea} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessible accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <Text style={styles.inputLabel}>Location</Text>
              <View style={styles.lockedLocationDisplay}>
                <Ionicons name="location" size={20} color="#007AFF" />
                <Text style={styles.lockedLocationText}>
                  {locations.find(loc => loc.id === selectedLocationId)?.name || 'Unknown Location'}
                </Text>
              </View>

              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={[styles.input, courtError && styles.inputError]}
                placeholder="Court name"
                placeholderTextColor="#8E8E93"
                value={courtName}
                onChangeText={(text) => {
                  setCourtName(text);
                  if (courtError) setCourtError(''); // Clear error when user starts typing
                }}
                autoFocus
              />
              {courtError ? (
                <Text style={styles.fieldErrorText}>{courtError}</Text>
              ) : null}

              <Text style={styles.inputLabel}>Court Type</Text>
              <View 
                ref={courtTypeDropdownRef}
                style={styles.dropdownContainer}
                onLayout={() => {
                  if (courtTypeDropdownRef.current) {
                    courtTypeDropdownRef.current.measureInWindow((x, y, width, height) => {
                      setCourtTypeDropdownLayout({ x, y, width, height });
                    });
                  }
                }}
              >
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => {
                    console.log('Dropdown clicked. Court types available:', courtTypes.length);
                    console.log('Court types:', courtTypes);
                    if (courtTypeDropdownRef.current) {
                      courtTypeDropdownRef.current.measureInWindow((x, y, width, height) => {
                        console.log('Dropdown position:', { x, y, width, height });
                        setCourtTypeDropdownLayout({ x, y, width, height });
                      });
                    }
                    setShowCourtTypeDropdown(!showCourtTypeDropdown);
                  }}
                >
                  <Text style={styles.dropdownText}>
                    {selectedCourtTypeId
                      ? courtTypes.find((ct) => ct.id === selectedCourtTypeId)?.name || 'Select Court Type'
                      : 'Select Court Type'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={closeCourtModal}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave, savingCourt && styles.modalButtonDisabled]}
                  onPress={saveCourt}
                  disabled={locations.length === 0 || savingCourt}
                >
                  {savingCourt ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text
                      style={[
                        styles.modalButtonTextSave,
                        locations.length === 0 && styles.modalButtonTextDisabled,
                      ]}
                    >
                      Save
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
          {/* Dropdown menu rendered at Modal level to appear above everything */}
          {showCourtTypeDropdown && courtTypeDropdownLayout && (
            <>
              <TouchableOpacity
                style={styles.dropdownBackdrop}
                activeOpacity={1}
                onPress={() => setShowCourtTypeDropdown(false)}
              />
              <View 
                style={[
                  styles.dropdownMenuModal,
                  {
                    top: courtTypeDropdownLayout.y + courtTypeDropdownLayout.height + 4,
                    left: courtTypeDropdownLayout.x,
                    width: courtTypeDropdownLayout.width,
                  }
                ]}
              >
                {courtTypes.length === 0 ? (
                  <View style={styles.dropdownMenuItem}>
                    <Text style={styles.dropdownMenuItemText}>
                      No court types available. Please run the migration SQL.
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.dropdownMenuScroll} nestedScrollEnabled>
                    {courtTypes.map((courtType) => (
                      <TouchableOpacity
                        key={courtType.id}
                        style={[
                          styles.dropdownMenuItem,
                          selectedCourtTypeId === courtType.id && styles.dropdownMenuItemSelected,
                        ]}
                        onPress={() => {
                          console.log('Selected court type:', courtType);
                          setSelectedCourtTypeId(courtType.id);
                          setShowCourtTypeDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownMenuItemText,
                            selectedCourtTypeId === courtType.id && styles.dropdownMenuItemTextSelected,
                          ]}
                        >
                          {courtType.name}
                        </Text>
                        {selectedCourtTypeId === courtType.id && (
                          <Ionicons name="checkmark" size={16} color="#007AFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 16,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerTextWrapNarrow: {
    marginRight: 0,
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionsNarrow: {
    marginTop: 0,
    flexWrap: 'wrap',
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
  },
  dashboardBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D9488',
  },
  viewToggleButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  viewToggleButtonActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  titleNarrow: {
    fontSize: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  subtitleNarrow: {
    fontSize: 14,
  },
  addButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addButtonSmallText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  searchContainerNarrow: {
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  cardNarrow: {
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  cardTitleNarrow: {
    fontSize: 15,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  cardSubtitleNarrow: {
    fontSize: 13,
  },
  cardIconNarrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtsList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  courtsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  courtsListTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  addCourtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  addCourtButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  courtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
  },
  courtItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  courtItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  courtItemText: {
    fontSize: 14,
    color: '#000',
  },
  courtItemType: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  courtItemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  courtActionButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtItemNarrow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  noCourtsText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  mapContainer: {
    width: '100%',
    height: Platform.OS === 'web' ? 600 : Dimensions.get('window').height - 200,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  mapIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  mapWebView: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FAFAFA',
  },
  mapPlaceholderText: {
    marginTop: 16,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalCloseHitArea: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalBodyScroll: {
    flex: 1,
  },
  modalBody: {
    padding: 20,
    paddingBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  inputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 4,
  },
  inputHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontStyle: 'italic',
  },
  addressInputContainer: {
    position: 'relative',
    zIndex: 1,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    }),
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    }),
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
  },
  locationPicker: {
    maxHeight: 200,
    marginTop: 8,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
    gap: 12,
  },
  locationOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  locationOptionText: {
    fontSize: 16,
    color: '#000',
  },
  locationOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  lockedLocationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 8,
  },
  lockedLocationText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE5E5',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalButtonCancel: {
    backgroundColor: '#F5F5F5',
  },
  modalButtonSave: {
    backgroundColor: '#000',
  },
  modalButtonTextCancel: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextDisabled: {
    color: '#8E8E93',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 8,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },
  dropdownOverlay: {
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      backgroundColor: 'transparent',
    }),
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 20,
    }),
    zIndex: 10000,
    maxHeight: 150,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    }),
  },
  dropdownMenuScroll: {
    maxHeight: 200,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 8,
  },
  dropdownMenuItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  dropdownMenuItemText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  dropdownMenuItemTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10001,
    backgroundColor: 'transparent',
  },
  dropdownMenuModal: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    zIndex: 10002,
    maxHeight: 200,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 25,
    }),
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    }),
  },
});
