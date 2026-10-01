import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { univoDb } from '../config';
import { geocodeAddress, calculateDistance } from '../../services/googleMapsService';

const COLLECTION_NAME = 'market_research_reports';

/**
 * Save a generated market research report to Firestore
 */
export const saveResearchReport = async (reportData) => {
  try {
    const docRef = await addDoc(collection(univoDb, COLLECTION_NAME), {
      ...reportData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { id: docRef.id, ...reportData };
  } catch (err) {
    console.error('Error saving research report:', err);
    throw err;
  }
};

/**
 * Fetch all saved market research reports ordered by newest first
 */
export const getResearchReports = async () => {
  try {
    const q = query(collection(univoDb, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('Index on market_research_reports may be building, client-side fallback:', err);
    try {
      const snap = await getDocs(collection(univoDb, COLLECTION_NAME));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } catch (innerErr) {
      console.error('Error fetching research reports:', innerErr);
      return [];
    }
  }
};

/**
 * Delete a saved market research report
 */
export const deleteResearchReport = async (reportId) => {
  try {
    await deleteDoc(doc(univoDb, COLLECTION_NAME, reportId));
    return true;
  } catch (err) {
    console.error('Error deleting research report:', err);
    throw err;
  }
};

/**
 * Parse locality / neighborhood from address, recognizing key commercial & student corridors
 */
export const extractLocality = (address = '', cityName = '') => {
  if (!address) return 'City Core';
  const lower = address.toLowerCase();

  // High-profile outer corridors & hubs
  if (lower.includes('pithampur') || lower.includes('pitampur') || lower.includes('sagore')) return 'Pithampur Industrial Hub';
  if (lower.includes('mr 10') || lower.includes('mr-10') || lower.includes('mr10')) return 'MR 10 Corridor';
  if (lower.includes('aurobindo') || lower.includes('aurbindo') || lower.includes('bhawrasla') || lower.includes('sanwer road')) return 'Aurobindo / Bhawrasla';
  if (lower.includes('lavkush') || lower.includes('lovekush')) return 'Lavkush / Super Corridor';
  if (lower.includes('super corridor') || lower.includes('gandhi nagar')) return 'Super Corridor & Aerodrome';
  if (lower.includes('bhanwarkuan') || lower.includes('bhawar kuan') || lower.includes('bhawarkua') || lower.includes('bhanwar kuva') || lower.includes('vishnu puri') || lower.includes('tower square')) return 'Bhawar Kuan Education Hub';
  if (lower.includes('vijay nagar') || lower.includes('scheme 54') || lower.includes('scheme no 54')) return 'Vijay Nagar & Scheme 54';
  if (lower.includes('sudama nagar') || lower.includes('annapurna') || lower.includes('cat road')) return 'Sudama Nagar & Annapurna';
  if (lower.includes('rau') || lower.includes('silicon city')) return 'Rau & Silicon City';
  if (lower.includes('palasia') || lower.includes('geeta bhawan') || lower.includes('manorama ganj')) return 'Palasia & Geeta Bhawan';
  if (lower.includes('rajwada') || lower.includes('sarafa') || lower.includes('malharganj')) return 'Rajwada & Central City';
  if (lower.includes('sukhlia') || lower.includes('sukhliya') || lower.includes('bapat square')) return 'Sukliya & Bapat Square';
  if (lower.includes('bengali') || lower.includes('khajrana') || lower.includes('kanadia') || lower.includes('bypass')) return 'Bypass, Bengali & Khajrana';
  if (lower.includes('mhow') || lower.includes('ambedkar nagar')) return 'Mhow / Dr. Ambedkar Nagar';

  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return address;

  // Filter out country ("India"), pincode, and city name
  const filtered = parts.filter((part) => {
    if (/india/i.test(part)) return false;
    if (/\b\d{6}\b/.test(part)) return false;
    if (cityName && new RegExp(cityName, 'i').test(part)) return false;
    if (/(madhya pradesh|rajasthan|uttar pradesh|delhi|gujarat|maharashtra|haryana)/i.test(part)) return false;
    return true;
  });

  if (filtered.length === 0) return 'City Core';
  return filtered[filtered.length - 1] || filtered[0];
};

/**
 * Category Query Configurations with rich keyword coverage
 */
export const CATEGORY_CONFIGS = {
  library: {
    label: '📚 Libraries & Study Rooms',
    defaultQueries: (city) => [
      `study library in ${city}`,
      `self study library reading room in ${city}`,
      `pustakalaya study point in ${city}`,
      `digital library in ${city}`,
      `abhyasika reading hall in ${city}`,
      `library in ${city}`,
    ],
    keywordFilter: (name, types = [], primaryType = '') => {
      const n = name.toLowerCase();
      const allTypes = [...types, primaryType].map((t) => String(t).toLowerCase());
      if (allTypes.some((t) => t.includes('library'))) return true;
      return [
        'library', 'pustakalaya', 'reading', 'study', 'abhyasika', 'reader', 'gyan',
        'vidya', 'swadhyaya', 'self study', 'study point', 'study zone', 'study space',
        'study hall', 'abhyas', 'digital library', 'ac library', 'learning', 'book',
        'mindspace', 'peace room', 'zone'
      ].some((w) => n.includes(w));
    },
    badWords: ['toy library', 'toy world', 'school', 'vidyalaya', 'montessori', 'hospital', 'dairy', 'sweets', 'restaurant', 'dhaba', 'clothing'],
  },
  gym: {
    label: '🏋️ Gyms & Fitness Centers',
    defaultQueries: (city) => [
      `gym fitness center in ${city}`,
      `workout crossfit gym in ${city}`,
      `health club bodybuilding in ${city}`,
      `fitness studio in ${city}`,
      `iron gym in ${city}`,
    ],
    keywordFilter: (name, types = [], primaryType = '') => {
      const n = name.toLowerCase();
      const allTypes = [...types, primaryType].map((t) => String(t).toLowerCase());
      if (allTypes.some((t) => t.includes('gym') || t.includes('fitness'))) return true;
      return [
        'gym', 'fitness', 'workout', 'crossfit', 'bodybuilding', 'club', 'iron',
        'studio', 'muscle', 'health club', 'aerobic', 'zumba', 'boxing', 'powerhouse'
      ].some((w) => n.includes(w));
    },
    badWords: ['hospital', 'pharmacy', 'school', 'textile', 'hotel', 'restaurant'],
  },
  coaching: {
    label: '🎓 Coaching & Tuitions',
    defaultQueries: (city) => [
      `coaching institute in ${city}`,
      `classes study academy in ${city}`,
      `competitive exam coaching in ${city}`,
    ],
    keywordFilter: (name, types = [], primaryType = '') => {
      const n = name.toLowerCase();
      return ['coaching', 'classes', 'academy', 'institute', 'tutorials', 'study', 'iit', 'neet', 'upsc'].some((w) => n.includes(w));
    },
    badWords: ['dance academy', 'music classes', 'drawing school', 'restaurant', 'sweets'],
  },
  coworking: {
    label: '💼 Coworking Spaces',
    defaultQueries: (city) => [
      `coworking space in ${city}`,
      `shared office space in ${city}`,
      `business center flexible desk in ${city}`,
    ],
    keywordFilter: (name, types = [], primaryType = '') => {
      const n = name.toLowerCase();
      return ['coworking', 'co-working', 'shared office', 'work space', 'desk', 'workspace'].some((w) => n.includes(w));
    },
    badWords: ['hotel', 'restaurant', 'pg hostel'],
  },
  custom: {
    label: '🔍 Custom Search Query',
    defaultQueries: (city, customQ) => [`${customQ} in ${city}`],
    keywordFilter: () => true,
    badWords: [],
  },
};

/**
 * Generate Spatial Grid Zones across the city and outer corridors (Aurobindo, MR-10, Pithampur, Lavkush, etc.)
 */
export const generateCitySpatialZones = (cityLat, cityLng, scanDepth = 'exhaustive', cityName = '') => {
  const delta = 0.042; // ~4.6 km
  const diag = 0.032;  // ~3.5 km diagonal

  if (scanDepth === 'quick') {
    return [
      { name: 'City Center Hub', lat: cityLat, lng: cityLng, radius: 15000 },
    ];
  }

  if (scanDepth === 'standard') {
    return [
      { name: 'Central Urban Core', lat: cityLat, lng: cityLng, radius: 15000 },
      { name: 'South Zone (Student & Coaching Core)', lat: cityLat - delta, lng: cityLng, radius: 14000 },
      { name: 'North Zone (Commercial Corridor)', lat: cityLat + delta, lng: cityLng, radius: 14000 },
    ];
  }

  // 100% Exhaustive Mode: Base 7 spatial zones covering inner core and 4 quadrants
  const zones = [
    { name: 'Central Urban Core', lat: cityLat, lng: cityLng, radius: 15000 },
    { name: 'South Zone (Bhawar Kuan & Student Core)', lat: cityLat - delta, lng: cityLng, radius: 14000 },
    { name: 'North Zone (Vijay Nagar & Commercial Corridor)', lat: cityLat + delta, lng: cityLng, radius: 14000 },
    { name: 'East Zone (Outer Ring & Bypass)', lat: cityLat, lng: cityLng + delta, radius: 14000 },
    { name: 'West Zone (Old City & Traditional Markets)', lat: cityLat, lng: cityLng - delta, radius: 14000 },
    { name: 'South-West Hub', lat: cityLat - diag, lng: cityLng - diag, radius: 13000 },
    { name: 'North-East Hub', lat: cityLat + diag, lng: cityLng + diag, radius: 13000 },
  ];

  // Specific high-profile outer industrial & educational corridors for Indore
  if (cityName.toLowerCase().includes('indore')) {
    zones.push(
      { name: 'North Corridor (MR-10, Aurobindo, Lavkush, Bhawrasla)', lat: cityLat + 0.095, lng: cityLng - 0.015, radius: 15000 },
      { name: 'Pithampur Industrial & Manufacturing Belt', lat: cityLat - 0.095, lng: cityLng - 0.165, radius: 18000 },
      { name: 'Super Corridor & Aerodrome Tech Zone', lat: cityLat + 0.055, lng: cityLng - 0.095, radius: 14000 },
      { name: 'Rau, Bypass & Silicon City Hub', lat: cityLat - 0.095, lng: cityLng - 0.025, radius: 14000 }
    );
  } else {
    // For other cities, add 3 outer metropolitan perimeter zones (~11 km)
    zones.push(
      { name: 'Outer North Perimeter', lat: cityLat + 0.095, lng: cityLng, radius: 15000 },
      { name: 'Outer South-West Industrial Corridor', lat: cityLat - 0.095, lng: cityLng - 0.095, radius: 16000 },
      { name: 'Outer East Bypass Corridor', lat: cityLat, lng: cityLng + 0.095, radius: 15000 }
    );
  }

  return zones;
};

/**
 * Execute Deep City Market Research with Multi-Zone Exhaustive Grid
 */
export const runCityMarketResearch = async ({
  city,
  state = '',
  category = 'library',
  customQuery = '',
  scanDepth = 'exhaustive', // 'exhaustive' (100% full city grid) | 'standard' | 'quick'
  existingVisits = [],
  onProgress = () => {},
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key is missing. Please check .env configuration.');
  }

  const cleanCity = city.trim();
  if (!cleanCity) {
    throw new Error('Please enter a city name (e.g. Indore, Gwalior, Kota).');
  }

  const locationQuery = state && state !== 'Other / All India' && state !== 'Other / Custom State'
    ? `${cleanCity}, ${state}, India`
    : `${cleanCity}, India`;

  onProgress({
    stage: 'geocoding',
    message: `Locating coordinates and metropolitan boundaries for "${cleanCity}${state ? `, ${state}` : ''}"...`,
    percent: 3,
  });

  // 1. Geocode City Coordinates
  const cityGeo = await geocodeAddress(locationQuery);
  const { latitude: cityLat, longitude: cityLng, formattedAddress: fullCityName } = cityGeo;

  // 2. Build Spatial Grid Zones (including outer metro corridors like MR-10, Aurobindo, Pithampur)
  const zones = generateCitySpatialZones(cityLat, cityLng, scanDepth, cleanCity);

  // 3. Determine Specialized Queries for this Category
  const config = CATEGORY_CONFIGS[category] || CATEGORY_CONFIGS.library;
  let queriesToRun = [];

  if (category === 'custom') {
    if (!customQuery?.trim()) throw new Error('Please enter your custom search query.');
    queriesToRun = config.defaultQueries(cleanCity, customQuery.trim());
  } else {
    const allQ = config.defaultQueries(cleanCity);
    if (scanDepth === 'quick') {
      queriesToRun = [allQ[0]];
    } else if (scanDepth === 'standard') {
      queriesToRun = allQ.slice(0, 2);
    } else {
      // Exhaustive: Use full spectrum of targeted keywords + outer corridors
      queriesToRun = [...allQ];

      // Add specialized corridor queries for Indore
      if (cleanCity.toLowerCase().includes('indore')) {
        if (category === 'library') {
          queriesToRun.push(
            `study library in MR 10 Indore`,
            `library near Aurobindo Hospital Indore`,
            `library in Lavkush Awas Vihar Indore`,
            `study library reading room in Pithampur`,
            `library in Pithampur Sector 1`,
            `library in Rau Indore`,
            `study library in Super Corridor Indore`
          );
        } else if (category === 'gym') {
          queriesToRun.push(
            `gym in MR 10 Indore`,
            `gym near Aurobindo Indore`,
            `gym in Pithampur`,
            `gym in Rau Indore`
          );
        }
      }
    }
  }

  const maxPagesPerQuery = scanDepth === 'quick' ? 1 : scanDepth === 'standard' ? 2 : 3;
  const discoveredMap = new Map();
  const totalSteps = zones.length * queriesToRun.length;
  let currentStep = 0;

  for (const zone of zones) {
    const locationConfig = {
      locationBias: {
        circle: {
          center: { latitude: zone.lat, longitude: zone.lng },
          radius: zone.radius || 15000,
        },
      },
    };

    for (let qIndex = 0; qIndex < queriesToRun.length; qIndex++) {
      currentStep++;
      const qStr = queriesToRun[qIndex];
      let pageToken = null;

      onProgress({
        stage: 'scanning',
        message: `Scanning ${zone.name} (${qIndex + 1}/${queriesToRun.length}) • ${discoveredMap.size} unique places verified so far...`,
        percent: Math.min(92, Math.round((currentStep / totalSteps) * 90)),
      });

      for (let page = 0; page < maxPagesPerQuery; page++) {
        const reqBody = {
          textQuery: qStr,
          pageSize: 20,
          ...locationConfig,
        };
        if (pageToken) reqBody.pageToken = pageToken;

        try {
          const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask':
                'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.regularOpeningHours,places.types,places.primaryType,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,nextPageToken',
            },
            body: JSON.stringify(reqBody),
          });

          if (!res.ok) break;

          const data = await res.json();
          const batch = data.places || [];

          for (const p of batch) {
            if (!p.id || discoveredMap.has(p.id)) continue;

            const name = p.displayName?.text || p.displayName || '';
            const address = p.formattedAddress || '';
            const types = Array.isArray(p.types) ? p.types : [];
            const primaryType = p.primaryType || '';

            // Name & category validation filter
            if (config.keywordFilter && !config.keywordFilter(name, types, primaryType)) {
              // Check if address explicitly contains keyword
              const lowerAddr = address.toLowerCase();
              const hasKeywordInAddr = ['library', 'reading room', 'study point', 'pustakalaya', 'gym'].some((k) => lowerAddr.includes(k));
              if (!hasKeywordInAddr) continue;
            }

            if (config.badWords?.some((w) => name.toLowerCase().includes(w))) {
              const hasExplicitGood = ['library', 'reading room', 'pustakalaya', 'study point', 'abhyasika', 'gym'].some((w) => name.toLowerCase().includes(w));
              if (!hasExplicitGood) {
                continue;
              }
            }

            const placeLat = p.location?.latitude;
            const placeLng = p.location?.longitude;
            const distMeters =
              placeLat != null && placeLng != null
                ? calculateDistance(cityLat, cityLng, placeLat, placeLng)
                : null;

            // Reject if place is far outside metropolitan area (> 55km away from center to include Pithampur, Mhow & outer corridors)
            if (distMeters != null && distMeters > 55000) {
              continue;
            }

            const phone = p.nationalPhoneNumber || p.internationalPhoneNumber || '';
            const locality = extractLocality(address, cleanCity);

            // Cross-reference existing visits to mark CRM lead status
            const existingMatch = existingVisits.find((v) => {
              if (v.placeId && v.placeId === p.id) return true;
              if (v.businessName && name && v.businessName.toLowerCase().trim() === name.toLowerCase().trim()) return true;
              return false;
            });

            discoveredMap.set(p.id, {
              placeId: p.id,
              name,
              address,
              locality,
              city: cleanCity,
              state: state || '',
              phone,
              hasPhone: Boolean(phone),
              website: p.websiteUri || '',
              mapsUrl: p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + address)}`,
              rating: p.rating || null,
              totalRatings: p.userRatingCount || 0,
              lat: placeLat,
              lng: placeLng,
              distanceMeters: distMeters,
              distanceKm: distMeters != null ? Number((distMeters / 1000).toFixed(1)) : null,
              crmStatus: existingMatch ? (existingMatch.status || 'Visited') : 'Untapped Prospect',
              isCoveredInCrm: Boolean(existingMatch),
              lastVisitedAt: existingMatch?.createdAt || null,
              visitedByStaff: existingMatch?.staffName || null,
            });
          }

          pageToken = data.nextPageToken;
          if (!pageToken) break;

          // Brief delay for nextPageToken to be acknowledged by Google's backend
          await new Promise((r) => setTimeout(r, 350));
        } catch (err) {
          console.warn(`Query batch error for "${qStr}" in zone "${zone.name}":`, err);
          break;
        }
      }
    }
  }

  onProgress({ stage: 'analyzing', message: 'Synthesizing report analytics and area breakdown...', percent: 90 });

  const placesList = Array.from(discoveredMap.values()).sort((a, b) => {
    // Sort by rating count descending, then distance
    if ((b.totalRatings || 0) !== (a.totalRatings || 0)) {
      return (b.totalRatings || 0) - (a.totalRatings || 0);
    }
    return (a.distanceMeters || 999999) - (b.distanceMeters || 999999);
  });

  // 3. Analytics Synthesis
  const totalCount = placesList.length;
  const withPhoneCount = placesList.filter((p) => p.hasPhone).length;
  const topRatedCount = placesList.filter((p) => (p.rating || 0) >= 4.5).length;
  const alreadyVisitedCount = placesList.filter((p) => p.isCoveredInCrm).length;
  const untappedCount = totalCount - alreadyVisitedCount;

  const validRatings = placesList.filter((p) => p.rating != null).map((p) => p.rating);
  const avgRating = validRatings.length > 0
    ? Number((validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length).toFixed(1))
    : 0;

  const totalReviews = placesList.reduce((sum, p) => sum + (p.totalRatings || 0), 0);

  // Area Breakdown Map
  const areaCounts = {};
  placesList.forEach((p) => {
    const area = p.locality || 'City Center';
    areaCounts[area] = (areaCounts[area] || 0) + 1;
  });

  const areaBreakdown = Object.entries(areaCounts)
    .map(([area, count]) => ({
      area,
      count,
      percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  onProgress({ stage: 'completed', message: 'Report generated successfully!', percent: 100 });

  const report = {
    title: `${cleanCity}${state && state !== 'Other / All India' ? ` (${state})` : ''} - ${config.label} Market Intelligence Report`,
    city: cleanCity,
    state: state || '',
    fullCityName,
    cityLat,
    cityLng,
    category,
    categoryLabel: config.label,
    customQuery: category === 'custom' ? customQuery : null,
    scanDepth,
    totalCount,
    withPhoneCount,
    phonePercentage: totalCount > 0 ? Math.round((withPhoneCount / totalCount) * 100) : 0,
    topRatedCount,
    avgRating,
    totalReviews,
    alreadyVisitedCount,
    untappedCount,
    untappedPercentage: totalCount > 0 ? Math.round((untappedCount / totalCount) * 100) : 0,
    areaBreakdown,
    places: placesList,
    generatedAt: new Date().toISOString(),
  };

  return report;
};
