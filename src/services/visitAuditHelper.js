import { calculateDistance, formatDistance } from './googleMapsService';
export { calculateDistance, formatDistance };

/**
 * Extract or compute duration in minutes spent on a visit
 */
export const getVisitDurationMinutes = (visit) => {
  if (!visit) return 0;
  if (visit.durationMinutes && Number(visit.durationMinutes) > 0) {
    return Number(visit.durationMinutes);
  }
  if (!visit.checkInTime || !visit.checkOutTime) return 15; // default reasonable estimate

  try {
    const parseTime = (str) => {
      if (!str) return null;
      const match = String(str).match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) return null;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    const inMins = parseTime(visit.checkInTime);
    const outMins = parseTime(visit.checkOutTime);
    if (inMins != null && outMins != null) {
      let diff = outMins - inMins;
      if (diff < 0) diff += 24 * 60; // crossed midnight
      return diff > 0 ? diff : 15;
    }
  } catch (e) {}
  return 15;
};

/**
 * Format minutes into "1 hr 15 min" or "35 min"
 */
export const formatDurationMinutes = (minutes) => {
  if (!minutes || minutes <= 0) return '0 min';
  const hrs = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  if (hrs > 0) {
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  }
  return `${remMins}m`;
};

/**
 * Evaluates whether a visit was genuine, verified on-site, or suspected fake/remote.
 * Includes anti-fraud check for staff submitting visits while still at morning Punch-In (Home) location.
 */
export const evaluateVisitAuthenticity = (visit, morningPunchLocation = null) => {
  if (!visit) {
    return {
      level: 'unverified',
      statusText: 'No Proof',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      pillClass: 'bg-rose-100 text-rose-800',
      explanation: 'No location or photo captured.',
      isGenuine: false,
      hasGps: false,
      hasPhoto: false,
    };
  }

  const hasGps = Boolean(visit.location && visit.location.latitude && visit.location.longitude);
  const hasPhoto = Boolean(visit.photoUrl);
  const accuracy = visit.location?.accuracy || 10;
  const duration = getVisitDurationMinutes(visit);

  // 1. Home / Morning Location Fraud Check: Did staff even leave home?
  const startLoc = morningPunchLocation || visit.morningLocation;
  let distanceFromMorning = visit.distanceFromMorningKm != null ? visit.distanceFromMorningKm * 1000 : null;
  let isNearHome = Boolean(visit.isNearHome);

  if (hasGps && startLoc && startLoc.latitude && startLoc.longitude && distanceFromMorning == null) {
    distanceFromMorning = calculateDistance(
      Number(visit.location.latitude),
      Number(visit.location.longitude),
      Number(startLoc.latitude),
      Number(startLoc.longitude)
    );
    if (distanceFromMorning < 250) {
      isNearHome = true;
    }
  }

  if (isNearHome || (distanceFromMorning != null && distanceFromMorning < 250)) {
    return {
      level: 'home_fake_alert',
      statusText: '🚨 Fake: At Home (Did not leave)',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-400 font-black',
      pillClass: 'bg-rose-600 text-white font-black animate-pulse',
      explanation: `Fake Entry Detected: Staff logged this visit while still at their morning Punch-In location (${Math.round(distanceFromMorning || 0)}m away). Banda ghar se nikla hi nahi!`,
      isGenuine: false,
      hasGps: true,
      hasPhoto,
      distanceToPlace: null,
      distanceFromMorning: distanceFromMorning ? Number((distanceFromMorning / 1000).toFixed(2)) : 0,
      accuracy,
      duration,
      isNearHome: true,
    };
  }

  let distanceToPlace = null;
  let isDistanceMismatch = false;

  // Check if library coordinates were recorded to compare with staff device GPS
  if (hasGps && visit.placeLat && visit.placeLng) {
    distanceToPlace = calculateDistance(
      Number(visit.location.latitude),
      Number(visit.location.longitude),
      Number(visit.placeLat),
      Number(visit.placeLng)
    );
    // If staff was more than 800m away from the library building
    if (distanceToPlace > 800) {
      isDistanceMismatch = true;
    }
  }

  // 2. Distance Mismatch Alert (Staff was far away from the library)
  if (isDistanceMismatch) {
    return {
      level: 'distance_alert',
      statusText: `⚠️ Far Away (${formatDistance(distanceToPlace)})`,
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
      pillClass: 'bg-rose-600 text-white font-bold animate-pulse',
      explanation: `GPS Mismatch: Staff was ${formatDistance(distanceToPlace)} away from library coordinates!`,
      isGenuine: false,
      hasGps: true,
      hasPhoto,
      distanceToPlace,
      distanceFromMorning: distanceFromMorning ? Number((distanceFromMorning / 1000).toFixed(2)) : null,
      accuracy,
      duration,
      isNearHome: false,
    };
  }

  // 3. High Trust: GPS Verified AND Photo Proof attached
  if (hasGps && hasPhoto) {
    return {
      level: 'verified',
      statusText: 'Verified On-Site',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      pillClass: 'bg-emerald-100 text-emerald-800 font-bold',
      explanation: `100% Genuine: Device GPS locked (±${accuracy}m) & On-Site photo proof uploaded.`,
      isGenuine: true,
      hasGps: true,
      hasPhoto: true,
      distanceToPlace,
      distanceFromMorning: distanceFromMorning ? Number((distanceFromMorning / 1000).toFixed(2)) : null,
      accuracy,
      duration,
      isNearHome: false,
    };
  }

  // 3. Medium: GPS Verified, Photo Missing
  if (hasGps && !hasPhoto) {
    return {
      level: 'gps_only',
      statusText: 'GPS Locked (No Photo)',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      pillClass: 'bg-blue-100 text-blue-800',
      explanation: `GPS locked on site (±${accuracy}m), but on-site photo was not uploaded.`,
      isGenuine: true,
      hasGps: true,
      hasPhoto: false,
      distanceToPlace,
      accuracy,
      duration,
    };
  }

  // 4. Medium: Photo Uploaded, GPS missing
  if (!hasGps && hasPhoto) {
    return {
      level: 'photo_only',
      statusText: 'Photo Proof (No GPS)',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      pillClass: 'bg-amber-100 text-amber-800',
      explanation: `Photo uploaded, but phone GPS was not captured.`,
      isGenuine: false,
      hasGps: false,
      hasPhoto: true,
      distanceToPlace: null,
      accuracy: null,
      duration,
    };
  }

  // 5. Low / Unverified: Neither GPS nor Photo
  return {
    level: 'unverified',
    statusText: 'Unverified / No Proof ⚠️',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
    pillClass: 'bg-rose-100 text-rose-800 font-bold',
    explanation: `Neither GPS location nor photo captured. Potential remote or office entry!`,
    isGenuine: false,
    hasGps: false,
    hasPhoto: false,
    distanceToPlace: null,
    accuracy: null,
    duration,
  };
};

/**
 * Builds a chronological day timeline for a given staff on a given date
 * Combines Attendance Punch-In/Out + All Visits in exact order
 */
export const buildStaffDailyTimeline = (staffId, staffName, dateStr, visits = [], attendanceLogs = []) => {
  // Find attendance for that day
  const attLog = attendanceLogs.find(
    (l) =>
      (l.staffId === staffId ||
        (staffName && l.staffName && l.staffName.toLowerCase() === staffName.toLowerCase())) &&
      l.date === dateStr
  );

  // Filter visits for that staff on that date
  const dayVisits = visits.filter((v) => {
    const isSameStaff =
      v.staffId === staffId ||
      (staffName && v.staffName && v.staffName.toLowerCase() === staffName.toLowerCase());
    if (!isSameStaff) return false;
    const vDate = (v.createdAt || '').substring(0, 10);
    return vDate === dateStr;
  });

  // Sort visits chronologically by checkInTime or createdAt
  const sortedVisits = [...dayVisits].sort((a, b) => {
    const timeA = a.checkInTime || a.createdAt || '';
    const timeB = b.checkInTime || b.createdAt || '';
    return timeA.localeCompare(timeB);
  });

  // 1. Gather all Punch events from attendance log (supports multiple punches or legacy punchIn/punchOut)
  const punchEvents = [];
  const rawPunches = attLog?.punches || [];

  if (rawPunches.length > 0) {
    rawPunches.forEach((p, idx) => {
      const isPunchIn = p.type === 'in';
      punchEvents.push({
        id: p.id || `punch_${idx}`,
        type: isPunchIn ? 'punch_in' : 'punch_out',
        time: p.time || formatDisplayTime(p.isoTime),
        isoTime: p.isoTime || `${dateStr}T10:00:00Z`,
        title: isPunchIn
          ? idx === 0
            ? 'Duty Started (Punch-In)'
            : 'Resumed Duty (Punch-In)'
          : p.note?.toLowerCase().includes('lunch')
          ? 'Lunch Break (Punch-Out)'
          : 'Left / On Break (Punch-Out)',
        subtitle: p.note || (isPunchIn ? 'Staff on field duty' : 'Staff stepped out / break'),
        location: p.location || null,
        note: p.note || '',
      });
    });
  } else {
    // Fallback to legacy punchIn / punchOut
    if (attLog?.punchIn) {
      punchEvents.push({
        id: 'punch_in',
        type: 'punch_in',
        time: attLog.punchIn.time,
        isoTime: attLog.punchIn.isoTime || `${dateStr}T10:00:00Z`,
        title: 'Duty Started (Punch-In)',
        subtitle: 'Staff arrived on duty',
        location: attLog.punchIn.location,
        note: 'Duty Started',
      });
    }
    if (attLog?.punchOut) {
      punchEvents.push({
        id: 'punch_out',
        type: 'punch_out',
        time: attLog.punchOut.time,
        isoTime: attLog.punchOut.isoTime || `${dateStr}T18:00:00Z`,
        title: 'Duty Ended (Punch-Out)',
        subtitle: `Total shift hours: ${attLog.totalHours || 'Completed'}`,
        location: attLog.punchOut.location,
        note: 'Duty Ended',
      });
    }
  }

  // 2. Prepare Visit Items
  let totalGroundMins = 0;
  let verifiedCount = 0;
  let missingGpsCount = 0;
  let missingPhotoCount = 0;
  let rapidVisitsCount = 0; // < 5 mins
  let fakeHomeVisitsCount = 0;

  const morningPunchLoc = attLog?.punchIn?.location || (punchEvents.length > 0 ? punchEvents[0].location : null);

  const visitItems = sortedVisits.map((visit, idx) => {
    const duration = getVisitDurationMinutes(visit);
    totalGroundMins += duration;

    const auth = evaluateVisitAuthenticity(visit, morningPunchLoc);
    if (auth.isGenuine) verifiedCount++;
    if (!auth.hasGps) missingGpsCount++;
    if (!auth.hasPhoto) missingPhotoCount++;
    if (duration < 5) rapidVisitsCount++;
    if (auth.level === 'home_fake_alert' || auth.isNearHome) fakeHomeVisitsCount++;

    const startTime = formatDisplayTime(visit.checkInTime, visit.createdAt);
    const calculatedOut = calculateCheckoutTime(visit.checkInTime || startTime, duration);
    const endTime = formatDisplayTime(visit.checkOutTime, calculatedOut);
    const entryReceived = formatEntryTimestamp(visit.createdAt);
    const syncStatus = evaluateSyncDelay(visit.checkInTime || startTime, visit.createdAt);

    return {
      id: visit.id || `visit_${idx}`,
      type: 'visit',
      visit,
      isoTime: visit.createdAt || `${dateStr}T12:00:00Z`,
      time: startTime,
      durationMins: duration,
      auth,
      startTime,
      endTime,
      checkInTime: visit.checkInTime || startTime,
      checkOutTime: visit.checkOutTime || endTime,
      location: visit.location || null,
      placeLat: visit.placeLat || null,
      placeLng: visit.placeLng || null,
      entryReceived,
      syncStatus,
      distanceFromMorningKm: auth.distanceFromMorning != null ? auth.distanceFromMorning : (visit.distanceFromMorningKm != null ? visit.distanceFromMorningKm : null),
      isNearHome: auth.isNearHome,
    };
  });

  // 3. Merge Punches + Visits into one unified chronological timeline
  const allChronologicalEvents = [...punchEvents, ...visitItems].sort((a, b) => {
    const timeA = a.isoTime || a.time || '';
    const timeB = b.isoTime || b.time || '';
    return timeA.localeCompare(timeB);
  });

  // 4. Calculate Road Distances (KM) between consecutive GPS stops
  let totalDistanceKm = 0;
  let lastGpsPoint = null;
  const validGpsCoordinates = [];
  const timelineItems = [];

  allChronologicalEvents.forEach((item, idx) => {
    let hasGps = Boolean(item.location && item.location.latitude && item.location.longitude);
    let curLat = hasGps ? Number(item.location.latitude) : null;
    let curLng = hasGps ? Number(item.location.longitude) : null;
    const placeLat = item.placeLat || item.visit?.placeLat ? Number(item.placeLat || item.visit?.placeLat) : null;
    const placeLng = item.placeLng || item.visit?.placeLng ? Number(item.placeLng || item.visit?.placeLng) : null;

    let legDistanceKm = 0;
    let isGpsAnomaly = false;

    if (hasGps && lastGpsPoint) {
      const straightMeters = calculateDistance(lastGpsPoint.lat, lastGpsPoint.lng, curLat, curLng);

      // Check for impossible GPS teleportation (> 40km jump between local marketing stops)
      if (straightMeters > 40000) {
        isGpsAnomaly = true;
        // If the visit has a verified Google Place location near the last stop, use the real library position!
        if (placeLat && placeLng) {
          const placeMeters = calculateDistance(lastGpsPoint.lat, lastGpsPoint.lng, placeLat, placeLng);
          if (placeMeters < 30000) {
            curLat = placeLat;
            curLng = placeLng;
            legDistanceKm = placeMeters < 100 ? 0 : Number(((placeMeters * 1.25) / 1000).toFixed(1));
            totalDistanceKm += legDistanceKm;
            lastGpsPoint = { lat: curLat, lng: curLng };
            validGpsCoordinates.push(`${curLat},${curLng}`);
          }
        }
      } else {
        legDistanceKm = straightMeters < 100 ? 0 : Number(((straightMeters * 1.25) / 1000).toFixed(1));
        totalDistanceKm += legDistanceKm;
        lastGpsPoint = { lat: curLat, lng: curLng };
        validGpsCoordinates.push(`${curLat},${curLng}`);
      }
    } else if (hasGps) {
      if (placeLat && placeLng) {
        const diffFromPlace = calculateDistance(curLat, curLng, placeLat, placeLng);
        if (diffFromPlace > 40000) {
          curLat = placeLat;
          curLng = placeLng;
          isGpsAnomaly = true;
        }
      }
      lastGpsPoint = { lat: curLat, lng: curLng };
      validGpsCoordinates.push(`${curLat},${curLng}`);
    } else if (placeLat && placeLng) {
      if (lastGpsPoint) {
        const placeMeters = calculateDistance(lastGpsPoint.lat, lastGpsPoint.lng, placeLat, placeLng);
        if (placeMeters < 30000) {
          legDistanceKm = placeMeters < 100 ? 0 : Number(((placeMeters * 1.25) / 1000).toFixed(1));
          totalDistanceKm += legDistanceKm;
          lastGpsPoint = { lat: placeLat, lng: placeLng };
          validGpsCoordinates.push(`${placeLat},${placeLng}`);
        }
      } else {
        lastGpsPoint = { lat: placeLat, lng: placeLng };
        validGpsCoordinates.push(`${placeLat},${placeLng}`);
      }
    }

    timelineItems.push({
      ...item,
      legDistanceKm,
      cumulativeDistanceKm: Number(totalDistanceKm.toFixed(1)),
      hasGps: hasGps || Boolean(placeLat && placeLng),
      isGpsAnomaly,
    });
  });

  // 5. Generate Google Maps Route URL for all day stops
  const googleMapsRouteUrl =
    validGpsCoordinates.length >= 2
      ? `https://www.google.com/maps/dir/${validGpsCoordinates.join('/')}`
      : validGpsCoordinates.length === 1
      ? `https://www.google.com/maps?q=${validGpsCoordinates[0]}`
      : null;

  const totalVisits = sortedVisits.length;
  const trustScore = totalVisits > 0 ? Math.round((verifiedCount / totalVisits) * 100) : 100;

  // 6. Current Live Duty Status
  let liveStatus = 'Inactive';
  const isToday = dateStr === new Date().toISOString().split('T')[0];

  const latestPunch = punchEvents.length > 0 ? punchEvents[punchEvents.length - 1] : null;
  const isCurrentlyOnDuty = latestPunch?.type === 'punch_in';

  if (isToday) {
    if (latestPunch) {
      if (latestPunch.type === 'punch_in') {
        if (sortedVisits.length > 0) {
          const last = sortedVisits[sortedVisits.length - 1];
          const lastCreatedMs = new Date(last.createdAt).getTime();
          const diffMins = Math.round((Date.now() - lastCreatedMs) / (60 * 1000));
          if (diffMins < 45) {
            liveStatus = `🟢 On Duty (Visited ${diffMins}m ago)`;
          } else {
            liveStatus = `🟢 On Duty (Active on Field)`;
          }
        } else {
          liveStatus = '🟢 Punched-in, Ready on Field';
        }
      } else {
        liveStatus = latestPunch.note?.toLowerCase().includes('lunch')
          ? '🥪 Out on Lunch Break'
          : '⚪ Off Duty / Out on Break';
      }
    } else {
      liveStatus = sortedVisits.length > 0 ? '🟢 Active (Visits without Punch-In)' : '❌ Not Started Today';
    }
  }

  return {
    date: dateStr,
    staffId,
    staffName,
    attLog,
    punches: punchEvents,
    visits: sortedVisits,
    totalVisits,
    totalGroundMins,
    totalGroundFormatted: formatDurationMinutes(totalGroundMins),
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    totalActiveMinutes: attLog?.totalActiveMinutes || 0,
    totalBreakMinutes: attLog?.totalBreakMinutes || 0,
    shiftHours: attLog?.totalHours || (isCurrentlyOnDuty ? 'Active on Duty' : 'No Shift Record'),
    trustScore,
    verifiedCount,
    missingGpsCount,
    missingPhotoCount,
    rapidVisitsCount,
    fakeHomeVisitsCount,
    timelineItems,
    googleMapsRouteUrl,
    liveStatus,
    isCurrentlyOnDuty,
    latestPunch,
    hasActivity: totalVisits > 0 || punchEvents.length > 0,
  };
};

/**
 * Quick helper to calculate total KM traveled by a staff member on a specific date
 */
export const calculateStaffDailyDistanceKm = (staffId, staffName, dateStr, visits = [], logs = []) => {
  const timeline = buildStaffDailyTimeline(staffId, staffName, dateStr, visits, logs);
  return timeline.totalDistanceKm || 0;
};

function parseTimeToMinutes(str) {
  if (!str) return null;
  try {
    // If ISO date string
    if (str.includes('T')) {
      const d = new Date(str);
      return d.getHours() * 60 + d.getMinutes();
    }
    const match = String(str).match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && h < 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  } catch (e) {
    return null;
  }
}

/**
 * Given a check-in time string (e.g. "11:15 AM") and duration in minutes, compute check-out time string
 */
export const calculateCheckoutTime = (checkInTimeStr, durationMinutes = 30) => {
  if (!checkInTimeStr) {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  const mins = parseTimeToMinutes(checkInTimeStr);
  if (mins == null) return checkInTimeStr;
  const outMins = (mins + Number(durationMinutes)) % (24 * 60);
  const h = Math.floor(outMins / 60);
  const m = outMins % 60;
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(displayH)}:${pad(m)} ${meridiem}`;
};

/**
 * Format any time string (HH:mm, ISO date, or AM/PM) into 12-hour formatted time (e.g. "02:30 PM")
 */
export const formatDisplayTime = (timeStr, fallbackDateStr = null) => {
  if (!timeStr && !fallbackDateStr) {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  const target = timeStr || fallbackDateStr;
  try {
    if (typeof target === 'string' && target.includes('T')) {
      const d = new Date(target);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }
    const match = String(target).match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = String(match[2]).padStart(2, '0');
      let meridiem = match[4]?.toUpperCase();
      if (!meridiem) {
        meridiem = h >= 12 ? 'PM' : 'AM';
        h = h % 12 === 0 ? 12 : h % 12;
      }
      return `${String(h).padStart(2, '0')}:${m} ${meridiem}`;
    }
    if (fallbackDateStr) {
      const d = new Date(fallbackDateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }
  } catch (e) {}
  return String(timeStr || fallbackDateStr || 'Live');
};

/**
 * Format exact entry creation/reception timestamp for Boss audit
 * returns { time: "03:25 PM", date: "30 Sep 2026", full: "03:25 PM • 30 Sep" }
 */
export const formatEntryTimestamp = (createdAt) => {
  if (!createdAt) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const date = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return { time, date, full: `${time} (${date})` };
  }
  try {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      return { time, date, full: `${time} (${date})` };
    }
  } catch (e) {}
  return { time: String(createdAt), date: '', full: String(createdAt) };
};

/**
 * Evaluates whether entry was submitted live on site or delayed
 */
export const evaluateSyncDelay = (checkInTime, createdAt) => {
  if (!createdAt) {
    return { isLive: true, label: '⚡ Live On-Site Entry', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  try {
    const createdMins = parseTimeToMinutes(createdAt);
    const visitMins = parseTimeToMinutes(checkInTime);
    if (createdMins != null && visitMins != null) {
      let diff = createdMins - visitMins;
      if (diff < 0) diff += 24 * 60;
      if (diff <= 35) {
        return { isLive: true, label: '⚡ Live On-Site Entry', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
      return {
        isLive: false,
        label: `🕒 Delayed Entry (+${formatDurationMinutes(diff)} after visit)`,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
      };
    }
  } catch (e) {}
  return { isLive: true, label: '⚡ Live Entry', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' };
};
