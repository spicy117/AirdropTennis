/**
 * Google Geocoding API utility
 * Converts addresses to latitude/longitude coordinates
 */

// Google Maps API Key - should be set as environment variable in production
// For now, you can set it here or use an environment variable
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Geocode an address to get latitude and longitude
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lng: number, formatted_address: string} | null>}
 */
export const geocodeAddress = async (address) => {
  if (!address || !address.trim()) {
    return null;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured. Skipping geocoding.');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;

      return {
        lat: location.lat,
        lng: location.lng,
        formatted_address: result.formatted_address,
      };
    } else if (data.status === 'ZERO_RESULTS') {
      console.warn('No results found for address:', address);
      return null;
    } else {
      console.error('Geocoding error:', data.status, data.error_message);
      return null;
    }
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
};

/**
 * Get autocomplete suggestions for an address query
 * @param {string} query - The address query string
 * @returns {Promise<Array<{description: string, place_id: string}> | null>}
 */
export const getAutocompleteSuggestions = async (query) => {
  if (!query || !query.trim() || query.length < 3) {
    return [];
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured. Skipping autocomplete.');
    return [];
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedQuery}&key=${GOOGLE_MAPS_API_KEY}&types=address`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
      return data.predictions.map(prediction => ({
        description: prediction.description,
        place_id: prediction.place_id,
      }));
    } else if (data.status === 'ZERO_RESULTS') {
      return [];
    } else {
      console.error('Autocomplete error:', data.status, data.error_message);
      return [];
    }
  } catch (error) {
    console.error('Error getting autocomplete suggestions:', error);
    return [];
  }
};

/**
 * Get place details from a place_id
 * @param {string} placeId - The Google Place ID
 * @returns {Promise<{formatted_address: string, lat: number, lng: number} | null>}
 */
export const getPlaceDetails = async (placeId) => {
  if (!placeId) {
    return null;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured. Skipping place details.');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.result) {
      const result = data.result;
      return {
        formatted_address: result.formatted_address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      };
    } else {
      console.error('Place details error:', data.status);
      return null;
    }
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
};

/**
 * Reverse geocode coordinates to get an address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string | null>}
 */
export const reverseGeocode = async (lat, lng) => {
  if (!lat || !lng) {
    return null;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured. Skipping reverse geocoding.');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0].formatted_address;
    } else {
      console.error('Reverse geocoding error:', data.status);
      return null;
    }
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
};
