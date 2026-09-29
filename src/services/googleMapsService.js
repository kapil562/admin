import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let googleMapsLoaded = false;
let optionsSet = false;

/**
 * Load Google Maps JS API with Places library using the new functional API
 */
export const loadGoogleMaps = async () => {
  if (googleMapsLoaded && window.google?.maps) {
    return window.google.maps;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    throw new Error('Google Maps API key is not configured. Please add your API key to .env file.');
  }

  if (!optionsSet) {
    setOptions({ key: apiKey, v: 'weekly' });
    optionsSet = true;
  }

  // Import required libraries
  await Promise.all([
    importLibrary('maps'),
    importLibrary('places'),
  ]);

  googleMapsLoaded = true;
  return window.google.maps;
};

// ── Haversine Distance (No API call needed) ──────────────────────────────────

/**
 * Calculate straight-line distance between two GPS coordinates using Haversine formula
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Format meters into human-readable distance
 */
export const formatDistance = (meters) => {
  if (meters == null) return '-';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

// ── Google Maps Navigation URL ───────────────────────────────────────────────

/**
 * Get Google Maps directions URL for navigation
 */
export const getNavigationUrl = (fromLat, fromLng, toLat, toLng) => {
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=driving`;
};

/**
 * Get Google Maps pin URL
 */
export const getPlaceMapUrl = (lat, lng) => {
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

/**
 * Geocode any city/address to coordinates
 */
export const geocodeAddress = async (address) => {
  await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        resolve({
          latitude: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
          longitude: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
          formattedAddress: results[0].formatted_address,
          city: results[0].address_components?.find((c) => c.types.includes('locality'))?.long_name || address,
        });
      } else {
        reject(new Error(`Could not locate "${address}". Please check spelling.`));
      }
    });
  });
};

/**
 * Reverse geocode lat/lng to readable city/address
 */
export const reverseGeocode = async (lat, lng) => {
  await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const cityComp = results[0].address_components?.find((c) => c.types.includes('locality'));
        resolve({
          formattedAddress: results[0].formatted_address,
          cityName: cityComp?.long_name || results[0].formatted_address,
        });
      } else {
        resolve({
          formattedAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          cityName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
      }
    });
  });
};

/**
 * Parse structured address components (city, state, area) from Google formatted address string
 */
export const parseAddressDetails = (address = '') => {
  if (!address) return { city: '', state: '', area: '' };

  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  let city = '';
  let state = '';
  let area = '';

  if (parts.length >= 2) {
    // If last part is country ("India"), pop it
    if (/india/i.test(parts[parts.length - 1])) {
      parts.pop();
    }
    // Now last part is usually "State Pincode" e.g. "Madhya Pradesh 473001" or "Rajasthan"
    const statePart = parts.pop() || '';
    state = statePart.replace(/\d{6}/g, '').trim();

    // Now last part is city e.g. "Guna", "Jaipur", "Indore"
    if (parts.length > 0) {
      city = parts.pop() || '';
    }

    // Remaining parts are the street / locality / area
    area = parts.join(', ');
  } else {
    area = address;
  }

  return { city, state, area };
};

/**
 * Fetch full Place Details including phone number and exact address components
 */
export const getPlaceDetails = async (placeId) => {
  if (!placeId) return null;
  await loadGoogleMaps();

  return new Promise((resolve) => {
    let mapDiv = document.getElementById('google-maps-hidden');
    if (!mapDiv) {
      mapDiv = document.createElement('div');
      mapDiv.id = 'google-maps-hidden';
      mapDiv.style.display = 'none';
      document.body.appendChild(mapDiv);
    }

    const map = new google.maps.Map(mapDiv, {
      center: { lat: 0, lng: 0 },
      zoom: 1,
    });

    const service = new google.maps.places.PlacesService(map);
    service.getDetails(
      {
        placeId,
        fields: ['name', 'formatted_phone_number', 'international_phone_number', 'address_components', 'formatted_address', 'website'],
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const comps = place.address_components || [];
          const getComp = (type) => comps.find((c) => c.types.includes(type))?.long_name || '';

          const city = getComp('locality') || getComp('administrative_area_level_2') || getComp('administrative_area_level_3');
          const state = getComp('administrative_area_level_1');

          resolve({
            name: place.name || '',
            phone: place.international_phone_number || place.formatted_phone_number || '',
            city,
            state,
            formattedAddress: place.formatted_address || '',
            website: place.website || '',
          });
        } else {
          resolve(null);
        }
      }
    );
  });
};

// ── Nearby Library Search (Places API New with Legacy fallback) ─────────────

/**
 * Search for nearby libraries / study points
 * Uses modern Place.searchByText/searchNearby if available, with fallback to PlacesService
 */
export const searchNearbyLibraries = async (lat, lng, radiusMeters = 5000) => {
  await loadGoogleMaps();

  // Try modern Place API (New) first (required for new accounts after March 2025)
  if (typeof google?.maps?.places?.Place?.searchByText === 'function') {
    try {
      const allResults = new Map();
      const queries = ['study library', 'study point', 'reading room', 'library'];

      for (const q of queries) {
        try {
          const { places } = await google.maps.places.Place.searchByText({
            textQuery: q,
            fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'regularOpeningHours'],
            locationBias: {
              center: { lat, lng },
              radius: radiusMeters,
            },
            maxResultCount: 20,
          });

          if (places && Array.isArray(places)) {
            places.forEach((p) => {
              if (p.id && !allResults.has(p.id)) {
                const placeLat = typeof p.location?.lat === 'function' ? p.location.lat() : p.location?.lat;
                const placeLng = typeof p.location?.lng === 'function' ? p.location.lng() : p.location?.lng;
                const distance = (placeLat != null && placeLng != null) ? calculateDistance(lat, lng, placeLat, placeLng) : null;

                allResults.set(p.id, {
                  placeId: p.id,
                  name: p.displayName || '',
                  address: p.formattedAddress || '',
                  rating: p.rating || null,
                  totalRatings: p.userRatingCount || 0,
                  lat: placeLat,
                  lng: placeLng,
                  distance,
                  distanceFormatted: formatDistance(distance),
                  isOpen: p.regularOpeningHours?.isOpen?.() ?? null,
                });
              }
            });
          }
        } catch (subErr) {
          console.warn('Place.searchByText query error:', subErr);
        }
      }

      if (allResults.size > 0) {
        return Array.from(allResults.values()).sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
      }
    } catch (newApiErr) {
      console.warn('Modern Place API error, trying fallback:', newApiErr);
    }
  }

  // Fallback to legacy PlacesService
  return fallbackPlacesServiceSearch(lat, lng, radiusMeters);
};

const fallbackPlacesServiceSearch = (lat, lng, radiusMeters) => {
  return new Promise((resolve) => {
    let mapDiv = document.getElementById('google-maps-hidden');
    if (!mapDiv) {
      mapDiv = document.createElement('div');
      mapDiv.id = 'google-maps-hidden';
      mapDiv.style.display = 'none';
      document.body.appendChild(mapDiv);
    }

    const map = new google.maps.Map(mapDiv, {
      center: { lat, lng },
      zoom: 15,
    });

    const service = new google.maps.places.PlacesService(map);
    const searchQueries = [
      { type: 'library', keyword: '' },
      { type: '', keyword: 'study library' },
      { type: '', keyword: 'study point' },
      { type: '', keyword: 'reading room' },
    ];

    const allResults = new Map();

    const searchPromises = searchQueries.map(
      (sq) =>
        new Promise((res) => {
          const request = {
            location: new google.maps.LatLng(lat, lng),
            radius: radiusMeters,
            ...(sq.type ? { type: sq.type } : {}),
            ...(sq.keyword ? { keyword: sq.keyword } : {}),
          };

          service.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              results.forEach((place) => {
                if (!allResults.has(place.place_id)) {
                  const placeLat = place.geometry.location.lat();
                  const placeLng = place.geometry.location.lng();
                  const distance = calculateDistance(lat, lng, placeLat, placeLng);

                  allResults.set(place.place_id, {
                    placeId: place.place_id,
                    name: place.name,
                    address: place.vicinity || place.formatted_address || '',
                    rating: place.rating || null,
                    totalRatings: place.user_ratings_total || 0,
                    lat: placeLat,
                    lng: placeLng,
                    distance,
                    distanceFormatted: formatDistance(distance),
                    isOpen: place.opening_hours?.isOpen?.() ?? null,
                    types: place.types || [],
                  });
                }
              });
            }
            res();
          });
        })
    );

    Promise.all(searchPromises).then(() => {
      resolve(Array.from(allResults.values()).sort((a, b) => a.distance - b.distance));
    });
  });
};

/**
 * Search libraries by text query (for manual search or specific categories)
 */
export const searchLibrariesByText = async (query, lat, lng) => {
  await loadGoogleMaps();

  // Filter out irrelevant results like toy shops, gift shops
  const isRelevantPlace = (p) => {
    const name = (p.displayName || p.name || '').toLowerCase();
    const address = (p.formattedAddress || p.address || '').toLowerCase();
    if (name.includes('toy world') || name.includes('toy library') || name.includes('khilone') || name.includes('toys')) {
      return false;
    }
    return true;
  };

  // Try modern Place API (New) first
  if (typeof google?.maps?.places?.Place?.searchByText === 'function') {
    try {
      // Check if user is searching for a specific city/location
      const hasSpecificLocation = query.split(/\s+/).length > 2;

      const { places } = await google.maps.places.Place.searchByText({
        textQuery: query,
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'regularOpeningHours'],
        locationBias: (lat && lng && !hasSpecificLocation) ? {
          center: { lat, lng },
          radius: 50000,
        } : undefined,
        maxResultCount: 20,
      });

      if (places && Array.isArray(places)) {
        const formatted = places
          .filter(isRelevantPlace)
          .map((p) => {
            const placeLat = typeof p.location?.lat === 'function' ? p.location.lat() : p.location?.lat;
            const placeLng = typeof p.location?.lng === 'function' ? p.location.lng() : p.location?.lng;
            const distance = (lat && lng && placeLat != null && placeLng != null) ? calculateDistance(lat, lng, placeLat, placeLng) : null;

            return {
              placeId: p.id,
              name: p.displayName || '',
              address: p.formattedAddress || '',
              rating: p.rating || null,
              totalRatings: p.userRatingCount || 0,
              lat: placeLat,
              lng: placeLng,
              distance,
              distanceFormatted: formatDistance(distance),
              isOpen: p.regularOpeningHours?.isOpen?.() ?? null,
            };
          });

        if (lat && lng) {
          formatted.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
        }
        return formatted;
      }
    } catch (newErr) {
      console.warn('Place.searchByText error, fallback to legacy:', newErr);
    }
  }

  // Fallback to legacy textSearch
  return new Promise((resolve) => {
    let mapDiv = document.getElementById('google-maps-hidden');
    if (!mapDiv) {
      mapDiv = document.createElement('div');
      mapDiv.id = 'google-maps-hidden';
      mapDiv.style.display = 'none';
      document.body.appendChild(mapDiv);
    }

    const map = new google.maps.Map(mapDiv, {
      center: { lat, lng },
      zoom: 12,
    });

    const service = new google.maps.places.PlacesService(map);

    service.textSearch(
      {
        query,
        location: new google.maps.LatLng(lat, lng),
        radius: 50000,
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const formatted = results
            .filter((p) => {
              const name = (p.name || '').toLowerCase();
              return !name.includes('toy world') && !name.includes('toy library') && !name.includes('khilone');
            })
            .map((place) => {
              const placeLat = place.geometry.location.lat();
              const placeLng = place.geometry.location.lng();
              const distance = calculateDistance(lat, lng, placeLat, placeLng);

              return {
                placeId: place.place_id,
                name: place.name,
                address: place.formatted_address || place.vicinity || '',
                rating: place.rating || null,
                totalRatings: place.user_ratings_total || 0,
                lat: placeLat,
                lng: placeLng,
                distance,
                distanceFormatted: formatDistance(distance),
                isOpen: place.opening_hours?.isOpen?.() ?? null,
                types: place.types || [],
              };
            });

          formatted.sort((a, b) => a.distance - b.distance);
          resolve(formatted);
        } else {
          resolve([]);
        }
      }
    );
  });
};
