import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import { univoDb } from '../config';

const COLLECTION_NAME = 'field_marketing_targets';

/**
 * Smart Delta Sync: Pushes Market Research discovered places into Field Marketing Targets.
 * - Newly opened/discovered places are added with 'isNewLead: true' and 'status: Untapped'.
 * - Existing targets keep their visit records, staff notes, and statuses (Deal Closed, Demo Given, etc.) completely intact.
 * - Contact information (phone, coordinates, rating) is refreshed without overwriting visit progress.
 */
export const syncCityTargetsToFieldMarketing = async ({
  city,
  state = '',
  category = 'library',
  places = [],
  staffId = '',
  staffName = '',
}) => {
  if (!city || !places || places.length === 0) {
    throw new Error('City name and places list are required for syncing targets.');
  }

  const cleanCity = city.trim();
  const cleanCategory = category || 'library';

  try {
    // 1. Fetch existing targets for this city & category
    const q = query(
      collection(univoDb, COLLECTION_NAME),
      where('city', '==', cleanCity),
      where('category', '==', cleanCategory)
    );
    const existingSnap = await getDocs(q);

    const existingMapByPlaceId = new Map();
    const existingMapByName = new Map();

    existingSnap.docs.forEach((d) => {
      const data = d.data();
      const docId = d.id;
      if (data.placeId) {
        existingMapByPlaceId.set(data.placeId, { docId, ...data });
      }
      if (data.businessName) {
        existingMapByName.set(data.businessName.toLowerCase().trim(), { docId, ...data });
      }
    });

    let addedCount = 0;
    let preservedCount = 0;

    const operations = []; // array of { type: 'set' | 'update', ref, data }
    const nowIso = new Date().toISOString();

    for (const p of places) {
      const pId = p.placeId;
      const pName = (p.name || '').trim();
      const pNameLower = pName.toLowerCase();

      const existing = (pId && existingMapByPlaceId.get(pId)) || existingMapByName.get(pNameLower);

      if (existing) {
        // ── Existing Lead: Preserve Visit History & Status, update phone/address if fresh ──
        const docRef = doc(univoDb, COLLECTION_NAME, existing.docId);
        const updatePayload = {
          updatedAt: nowIso,
          lastSyncedAt: nowIso,
          // Only update phone if currently empty or fresh phone available
          ...(p.phone ? { phone: p.phone, hasPhone: true } : {}),
          ...(p.address ? { address: p.address } : {}),
          ...(p.locality ? { locality: p.locality } : {}),
          ...(p.rating != null ? { rating: p.rating } : {}),
          ...(p.totalRatings != null ? { totalRatings: p.totalRatings } : {}),
          ...(p.lat != null ? { lat: p.lat } : {}),
          ...(p.lng != null ? { lng: p.lng } : {}),
          ...(p.mapsUrl ? { mapsUrl: p.mapsUrl } : {}),
          ...(p.website ? { website: p.website } : {}),
        };

        operations.push({ type: 'update', ref: docRef, data: updatePayload });
        preservedCount++;
      } else {
        // ── Fresh New Lead: Insert as Untapped Target ──
        const newDocRef = doc(collection(univoDb, COLLECTION_NAME));
        const insertPayload = {
          placeId: p.placeId || newDocRef.id,
          businessName: pName,
          address: p.address || '',
          locality: p.locality || 'City Core',
          city: cleanCity,
          state: state || p.state || '',
          category: cleanCategory,
          phone: p.phone || '',
          hasPhone: Boolean(p.phone),
          website: p.website || '',
          mapsUrl: p.mapsUrl || '',
          rating: p.rating || null,
          totalRatings: p.totalRatings || 0,
          lat: p.lat || null,
          lng: p.lng || null,
          distanceKm: p.distanceKm || null,
          status: p.crmStatus && p.crmStatus !== 'Untapped Prospect' ? p.crmStatus : 'Untapped',
          isCoveredInCrm: Boolean(p.isCoveredInCrm),
          isNewLead: true,
          syncedByStaffId: staffId,
          syncedByStaffName: staffName,
          createdAt: nowIso,
          updatedAt: nowIso,
          lastSyncedAt: nowIso,
        };

        operations.push({ type: 'set', ref: newDocRef, data: insertPayload });
        addedCount++;
      }
    }

    // 2. Commit operations in batches of 400 (Firestore max is 500)
    const BATCH_SIZE = 400;
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(univoDb);

      for (const op of chunk) {
        if (op.type === 'set') {
          batch.set(op.ref, op.data);
        } else if (op.type === 'update') {
          batch.update(op.ref, op.data);
        }
      }

      await batch.commit();
    }

    return {
      success: true,
      city: cleanCity,
      category: cleanCategory,
      totalPlaces: places.length,
      addedCount,
      preservedCount,
    };
  } catch (err) {
    console.error('Error syncing city targets to field marketing:', err);
    throw err;
  }
};

/**
 * Fetch active target roster for a specific city & category
 */
export const getFieldMarketingTargets = async ({ city, category = 'library' }) => {
  if (!city) return [];
  const cleanCity = city.trim();
  const cleanCategory = category || 'library';

  try {
    const q = query(
      collection(univoDb, COLLECTION_NAME),
      where('city', '==', cleanCity),
      where('category', '==', cleanCategory)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching field marketing targets:', err);
    return [];
  }
};

/**
 * Fetch all available cities that have saved target rosters in Firestore
 */
export const getAvailableTargetCities = async () => {
  try {
    const snap = await getDocs(collection(univoDb, COLLECTION_NAME));
    const cityMap = new Map();

    snap.docs.forEach((d) => {
      const data = d.data();
      const city = data.city || '';
      const category = data.category || 'library';
      if (!city) return;

      const key = `${city}___${category}`;
      if (!cityMap.has(key)) {
        cityMap.set(key, {
          city,
          category,
          state: data.state || '',
          totalCount: 0,
          unvisitedCount: 0,
          visitedCount: 0,
          newLeadsCount: 0,
          lastSyncedAt: data.lastSyncedAt || data.updatedAt,
        });
      }

      const entry = cityMap.get(key);
      entry.totalCount += 1;
      const isVisited = data.status && data.status !== 'Untapped' && data.status !== 'Untapped Prospect';
      if (isVisited) {
        entry.visitedCount += 1;
      } else {
        entry.unvisitedCount += 1;
      }
      if (data.isNewLead) {
        entry.newLeadsCount += 1;
      }
    });

    return Array.from(cityMap.values()).sort((a, b) => b.totalCount - a.totalCount);
  } catch (err) {
    console.error('Error fetching available target cities:', err);
    return [];
  }
};

/**
 * Update target status in Firestore when a visit is logged
 */
export const updateTargetStatusOnVisit = async (targetId, newStatus, staffName = '') => {
  if (!targetId) return;
  try {
    const docRef = doc(univoDb, COLLECTION_NAME, targetId);
    await updateDoc(docRef, {
      status: newStatus,
      isCoveredInCrm: true,
      lastVisitedAt: new Date().toISOString(),
      ...(staffName ? { visitedByStaff: staffName } : {}),
      isNewLead: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Could not update field marketing target status:', err);
  }
};
