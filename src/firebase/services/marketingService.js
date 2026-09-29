import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { univoDb } from '../config';

/**
 * Capture device native GPS coordinates with high accuracy
 */
export const getCurrentGPSLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser or device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        resolve({
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          mapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
          capturedAt: new Date().toISOString(),
        });
      },
      (err) => {
        let msg = 'Failed to retrieve location.';
        if (err.code === 1) msg = 'Location permission denied. Please allow location access in your browser settings to verify on-site visit.';
        else if (err.code === 2) msg = 'Location position unavailable. Please ensure GPS is enabled.';
        else if (err.code === 3) msg = 'Location request timed out. Please retry.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
};

// ── Field Visits & Leads Management ──────────────────────────────────────────

export const getFieldVisits = async () => {
  try {
    const q = query(collection(univoDb, 'field_visits'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (err) {
    console.warn('Fallback field visits fetch:', err);
    try {
      const snap = await getDocs(collection(univoDb, 'field_visits'));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      console.error('Error fetching field visits:', e);
      return [];
    }
  }
};

export const logFieldVisit = async (visitData) => {
  const cleaned = {
    staffId: visitData.staffId || 'admin',
    staffName: visitData.staffName || 'Administrator',
    clientType: visitData.clientType || 'Library',
    businessName: visitData.businessName.trim(),
    ownerName: visitData.ownerName ? visitData.ownerName.trim() : 'Owner',
    phone: visitData.phone ? visitData.phone.trim() : '',
    state: visitData.state ? visitData.state.trim() : '',
    city: visitData.city ? visitData.city.trim() : '',
    address: visitData.address ? visitData.address.trim() : '',
    discussionNotes: visitData.discussionNotes ? visitData.discussionNotes.trim() : '',
    demoGiven: Boolean(visitData.demoGiven),
    status: visitData.status || 'Interested',
    followUpDate: visitData.followUpDate || '',
    location: visitData.location || null,
    checkInTime: visitData.checkInTime || new Date().toISOString(),
    checkOutTime: visitData.checkOutTime || new Date().toISOString(),
    durationMinutes: Number(visitData.durationMinutes) || 0,
    // Field Marketing Enhanced Fields
    photoUrl: visitData.photoUrl || null,
    personMet: visitData.personMet || 'Owner',
    contactPersonName: visitData.contactPersonName ? visitData.contactPersonName.trim() : '',
    secondaryPhone: visitData.secondaryPhone ? visitData.secondaryPhone.trim() : '',
    seatCapacity: visitData.seatCapacity || '',
    currentSoftwareType: visitData.currentSoftwareType || 'Manual Register',
    competitorName: visitData.competitorName ? visitData.competitorName.trim() : '',
    competitorExpiryDate: visitData.competitorExpiryDate || '',
    competitorDuration: visitData.competitorDuration || '',
    switchingReason: visitData.switchingReason || '',
    followUpTime: visitData.followUpTime || '',
    followUpType: visitData.followUpType || 'In-Person Re-Visit',
    nextActionItem: visitData.nextActionItem || '',
    reminderNote: visitData.reminderNote ? visitData.reminderNote.trim() : '',
    leadPriority: visitData.leadPriority || 'Warm',
    // Google Place linking fields
    placeId: visitData.placeId || null,
    placeName: visitData.placeName ? visitData.placeName.trim() : '',
    placeAddress: visitData.placeAddress ? visitData.placeAddress.trim() : '',
    placeRating: visitData.placeRating || null,
    placeLat: visitData.placeLat || null,
    placeLng: visitData.placeLng || null,
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(univoDb, 'field_visits'), cleaned);
  return { id: ref.id, ...cleaned };
};

/**
 * Update an existing field visit record
 */
export const updateFieldVisit = async (id, visitData) => {
  const cleaned = {};

  // Only include fields that are provided
  if (visitData.businessName !== undefined) cleaned.businessName = visitData.businessName.trim();
  if (visitData.ownerName !== undefined) cleaned.ownerName = visitData.ownerName.trim();
  if (visitData.phone !== undefined) cleaned.phone = visitData.phone.trim();
  if (visitData.state !== undefined) cleaned.state = visitData.state.trim();
  if (visitData.city !== undefined) cleaned.city = visitData.city.trim();
  if (visitData.address !== undefined) cleaned.address = visitData.address.trim();
  if (visitData.discussionNotes !== undefined) cleaned.discussionNotes = visitData.discussionNotes.trim();
  if (visitData.demoGiven !== undefined) cleaned.demoGiven = Boolean(visitData.demoGiven);
  if (visitData.status !== undefined) cleaned.status = visitData.status;
  if (visitData.followUpDate !== undefined) cleaned.followUpDate = visitData.followUpDate;
  if (visitData.clientType !== undefined) cleaned.clientType = visitData.clientType;
  if (visitData.checkInTime !== undefined) cleaned.checkInTime = visitData.checkInTime;
  if (visitData.checkOutTime !== undefined) cleaned.checkOutTime = visitData.checkOutTime;
  if (visitData.durationMinutes !== undefined) cleaned.durationMinutes = Number(visitData.durationMinutes);
  if (visitData.location !== undefined) cleaned.location = visitData.location;

  // Enhanced fields
  if (visitData.photoUrl !== undefined) cleaned.photoUrl = visitData.photoUrl;
  if (visitData.personMet !== undefined) cleaned.personMet = visitData.personMet;
  if (visitData.contactPersonName !== undefined) cleaned.contactPersonName = visitData.contactPersonName.trim();
  if (visitData.secondaryPhone !== undefined) cleaned.secondaryPhone = visitData.secondaryPhone.trim();
  if (visitData.seatCapacity !== undefined) cleaned.seatCapacity = visitData.seatCapacity;
  if (visitData.currentSoftwareType !== undefined) cleaned.currentSoftwareType = visitData.currentSoftwareType;
  if (visitData.competitorName !== undefined) cleaned.competitorName = visitData.competitorName.trim();
  if (visitData.competitorExpiryDate !== undefined) cleaned.competitorExpiryDate = visitData.competitorExpiryDate;
  if (visitData.competitorDuration !== undefined) cleaned.competitorDuration = visitData.competitorDuration;
  if (visitData.switchingReason !== undefined) cleaned.switchingReason = visitData.switchingReason;
  if (visitData.followUpTime !== undefined) cleaned.followUpTime = visitData.followUpTime;
  if (visitData.followUpType !== undefined) cleaned.followUpType = visitData.followUpType;
  if (visitData.nextActionItem !== undefined) cleaned.nextActionItem = visitData.nextActionItem;
  if (visitData.reminderNote !== undefined) cleaned.reminderNote = visitData.reminderNote.trim();
  if (visitData.leadPriority !== undefined) cleaned.leadPriority = visitData.leadPriority;

  cleaned.updatedAt = new Date().toISOString();

  await updateDoc(doc(univoDb, 'field_visits', id), cleaned);
  return { id, ...cleaned };
};

/**
 * Quick inline status update for a visit
 */
export const updateVisitStatus = async (id, newStatus) => {
  const updateData = {
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
  await updateDoc(doc(univoDb, 'field_visits', id), updateData);
  return { id, ...updateData };
};

export const deleteFieldVisit = async (id) => {
  return await deleteDoc(doc(univoDb, 'field_visits', id));
};

// ── Daily Staff Attendance & Timelines ────────────────────────────────────────

export const getAttendanceLogs = async () => {
  try {
    const q = query(collection(univoDb, 'staff_attendance'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (err) {
    try {
      const snap = await getDocs(collection(univoDb, 'staff_attendance'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return [];
    }
  }
};

export const punchAttendance = async ({ staffId, staffName, type = 'in', location = null }) => {
  const todayDate = new Date().toISOString().split('T')[0];
  const q = query(
    collection(univoDb, 'staff_attendance'),
    where('staffId', '==', staffId),
    where('date', '==', todayDate)
  );
  const snap = await getDocs(q);

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (snap.empty) {
    // New Punch In
    const docData = {
      staffId,
      staffName,
      date: todayDate,
      punchIn: {
        time: timeFormatted,
        isoTime: now.toISOString(),
        location,
      },
      punchOut: null,
      totalHours: 'Working...',
      status: 'Present',
      createdAt: now.toISOString(),
    };
    const ref = await addDoc(collection(univoDb, 'staff_attendance'), docData);
    return { id: ref.id, ...docData };
  } else {
    // Existing record today
    const existingDoc = snap.docs[0];
    const data = existingDoc.data();

    if (type === 'out') {
      const inIso = data.punchIn?.isoTime ? new Date(data.punchIn.isoTime) : now;
      const diffMs = now.getTime() - inIso.getTime();
      const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(1);

      const updateData = {
        punchOut: {
          time: timeFormatted,
          isoTime: now.toISOString(),
          location,
        },
        totalHours: `${diffHours} hrs`,
        updatedAt: now.toISOString(),
      };

      await updateDoc(doc(univoDb, 'staff_attendance', existingDoc.id), updateData);
      return { id: existingDoc.id, ...data, ...updateData };
    }
    return { id: existingDoc.id, ...data };
  }
};
