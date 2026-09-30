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

/**
 * Format duration string from Google Routes API (e.g. "118s") to human readable format
 */
export const formatDuration = (durationStr) => {
  if (!durationStr) return null;
  const seconds = parseInt(durationStr, 10);
  if (isNaN(seconds) || seconds <= 0) return null;
  if (seconds < 60) return '< 1 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs} hr ${remMins} min` : `${hrs} hr`;
};

/**
 * Compute real driving road distance and travel time for places using Google Routes API
 * Matches exactly what Google Maps Navigation displays on road routes.
 */
export const enrichWithRealRoadDistances = async (originLat, originLng, places) => {
  if (!originLat || !originLng || !places || places.length === 0) return places;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return places;

  try {
    const validPlaces = places.filter((p) => p.lat != null && p.lng != null).slice(0, 25);
    if (validPlaces.length === 0) return places;

    const postData = {
      origins: [
        {
          waypoint: {
            location: {
              latLng: { latitude: originLat, longitude: originLng },
            },
          },
        },
      ],
      destinations: validPlaces.map((p) => ({
        waypoint: {
          location: {
            latLng: { latitude: p.lat, longitude: p.lng },
          },
        },
      })),
      travelMode: 'DRIVE',
    };

    const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'destinationIndex,status,distanceMeters,duration',
      },
      body: JSON.stringify(postData),
    });

    if (!res.ok) {
      console.warn('Routes API computeRouteMatrix error status:', res.status);
      return places;
    }

    const data = await res.json();
    if (!Array.isArray(data)) return places;

    const matrixMap = new Map();
    for (const item of data) {
      if (item.destinationIndex != null && item.distanceMeters != null) {
        matrixMap.set(item.destinationIndex, {
          distanceMeters: item.distanceMeters,
          duration: item.duration,
        });
      }
    }

    const enriched = places.map((place) => {
      const idx = validPlaces.findIndex((p) => p.placeId === place.placeId);
      if (idx !== -1 && matrixMap.has(idx)) {
        const routeInfo = matrixMap.get(idx);
        return {
          ...place,
          distance: routeInfo.distanceMeters,
          distanceFormatted: formatDistance(routeInfo.distanceMeters),
          durationFormatted: formatDuration(routeInfo.duration),
          isRoadDistance: true,
        };
      }
      return place;
    });

    enriched.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
    return enriched;
  } catch (err) {
    console.warn('Failed to compute real road distances, falling back to straight-line:', err);
    return places;
  }
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
  return searchLibrariesByText('study library reading room', lat, lng, radiusMeters, 100);
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
/**
 * Search libraries by text query with configurable radius and maxResults limit
 */
export const searchLibrariesByText = async (query, lat, lng, radius = null, maxResults = null) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Filter out irrelevant businesses (toys, restaurants, dairies, clothes, salons, clinics, etc.)
  const isRelevantPlace = (p) => {
    const name = (p.displayName?.text || p.displayName || p.name || '').toLowerCase();
    const address = (p.formattedAddress || p.address || '').toLowerCase();
    const text = `${name} ${address}`;
    const badWords = [
      'toy world', 'toy library', 'khilone', 'toys',
      'restaurant', 'dairy', 'sweets', 'mithai', 'dhaba', 'hotel', 'cafe',
      'bhojnalaya', 'bakery', 'fast food', 'pizza', 'burger', 'tea stall', 'chai',
      'clothing', 'garment', 'textile', 'saree', 'footwear', 'shoe',
      'electronics', 'hardware', 'saloon', 'beauty parlour', 'spa',
      'pharmacy', 'medical store', 'chemist', 'hospital', 'pathology'
    ];
    return !badWords.some((w) => text.includes(w));
  };

  // 1. Direct REST Places API (New) with proper pagination and radius handling
  if (apiKey) {
    try {
      const targetCount = maxResults && Number(maxResults) > 0 ? Number(maxResults) : 100;
      const cleanQ = (query || '').trim();
      const isGym = cleanQ.toLowerCase().includes('gym') || cleanQ.toLowerCase().includes('fitness');

      let queryList = [];
      if (cleanQ && cleanQ !== 'study library reading room' && cleanQ !== 'gym fitness center') {
        queryList = [cleanQ];
        // If searching a specific query and wanting a larger count, add contextual query variations
        if (targetCount > 20) {
          if (isGym) {
            queryList.push(`${cleanQ} gym`, 'gym fitness center', 'fitness club gym');
          } else {
            queryList.push(`${cleanQ} library`, 'study library', 'reading room library', 'study point library', 'pustakalaya');
          }
        }
      } else {
        queryList = isGym
          ? ['gym fitness center', 'fitness club gym', 'workout health gym', 'crossfit gym']
          : ['study library', 'reading room library', 'study point library', 'pustakalaya', 'self study digital library', 'library'];
      }

      // Location configuration: handle circles <= 50km and bounding box rectangles > 50km (up to 1000km)
      let locationConfig = {};
      if (lat && lng) {
        if (radius && Number(radius) > 50000) {
          const radiusKm = Number(radius) / 1000;
          const dLat = radiusKm / 111;
          const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
          locationConfig = {
            locationRestriction: {
              rectangle: {
                low: { latitude: Math.max(-90, lat - dLat), longitude: Math.max(-180, lng - dLng) },
                high: { latitude: Math.min(90, lat + dLat), longitude: Math.min(180, lng + dLng) },
              },
            },
          };
        } else {
          locationConfig = {
            locationBias: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: Math.min(Number(radius) || 50000, 50000),
              },
            },
          };
        }
      }

      const allPlacesMap = new Map();

      for (const q of queryList) {
        let pageToken = null;
        const initialBody = {
          textQuery: q,
          pageSize: 20,
          ...locationConfig,
        };

        for (let page = 0; page < 3; page++) {
          const body = { ...initialBody };
          if (pageToken) {
            body.pageToken = pageToken;
          }

          const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.regularOpeningHours,nextPageToken',
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) break;
          const data = await res.json();
          const batch = data.places || [];

          for (const p of batch) {
            if (!p.id || allPlacesMap.has(p.id)) continue;
            if (!isRelevantPlace(p)) continue;

            const placeLat = p.location?.latitude;
            const placeLng = p.location?.longitude;
            const distance = (lat && lng && placeLat != null && placeLng != null)
              ? calculateDistance(lat, lng, placeLat, placeLng)
              : null;

            // Strict user radius filtering
            if (radius && Number(radius) > 0 && distance != null && distance > Number(radius)) {
              continue;
            }

            allPlacesMap.set(p.id, {
              placeId: p.id,
              name: p.displayName?.text || p.displayName || '',
              address: p.formattedAddress || '',
              rating: p.rating || null,
              totalRatings: p.userRatingCount || 0,
              lat: placeLat,
              lng: placeLng,
              distance,
              distanceFormatted: formatDistance(distance),
              isOpen: p.regularOpeningHours?.openNow ?? null,
            });
          }

          if (allPlacesMap.size >= targetCount) break;
          if (!data.nextPageToken) break;
          pageToken = data.nextPageToken;
        }

        if (allPlacesMap.size >= targetCount) break;
      }

      if (allPlacesMap.size > 0) {
        let formatted = Array.from(allPlacesMap.values());

        // Sort strictly by straight-line distance from user's current location
        if (lat && lng) {
          formatted.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
        }

        // Road route enrichment for top candidate nearest places (up to 25 places)
        const candidateLimit = Math.min(Math.max(targetCount, 15), 25);
        const candidates = formatted.slice(0, candidateLimit);

        if (lat && lng && candidates.length > 0) {
          const enriched = await enrichWithRealRoadDistances(lat, lng, candidates);
          enriched.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
          const remaining = formatted.slice(candidateLimit);
          const finalAll = [...enriched, ...remaining];
          return finalAll.slice(0, targetCount);
        }

        return formatted.slice(0, targetCount);
      }
    } catch (restErr) {
      console.warn('Direct Places REST error, fallback to JS SDK:', restErr);
    }
  }

  // 2. Fallback to Google Maps JS SDK
  await loadGoogleMaps();

  if (typeof google?.maps?.places?.Place?.searchByText === 'function') {
    try {
      const { places } = await google.maps.places.Place.searchByText({
        textQuery: query,
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'regularOpeningHours'],
        locationBias: (lat && lng) ? {
          center: { lat, lng },
          radius: Math.min(Number(radius) || 10000, 50000),
        } : undefined,
        maxResultCount: Math.min(maxResults, 20),
      });

      if (places && Array.isArray(places)) {
        let formatted = places
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

        if (lat && lng && radius && Number(radius) > 0) {
          formatted = formatted.filter((p) => p.distance != null && p.distance <= Number(radius));
        }

        if (lat && lng) {
          formatted.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
          const enriched = await enrichWithRealRoadDistances(lat, lng, formatted);
          return enriched;
        }
        return formatted;
      }
    } catch (newErr) {
      console.warn('Place.searchByText error, fallback to legacy:', newErr);
    }
  }

  // 3. Fallback to legacy textSearch
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
        radius: Number(radius) || 10000,
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          let formatted = results
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

          if (lat && lng && radius && Number(radius) > 0) {
            formatted = formatted.filter((p) => p.distance != null && p.distance <= Number(radius));
          }

          formatted.sort((a, b) => a.distance - b.distance);
          if (lat && lng) {
            enrichWithRealRoadDistances(lat, lng, formatted)
              .then(resolve)
              .catch(() => resolve(formatted));
          } else {
            resolve(formatted);
          }
        } else {
          resolve([]);
        }
      }
    );
  });
};
