import { calculateDistance, formatDistance } from './googleMapsService';

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
 * Evaluates whether a visit was genuine, verified on-site, or suspected fake/remote
 */
export const evaluateVisitAuthenticity = (visit) => {
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

  // 1. Distance Mismatch Alert (Staff was far away from the library)
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
      accuracy,
      duration,
    };
  }

  // 2. High Trust: GPS Verified AND Photo Proof attached
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
      accuracy,
      duration,
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

  let totalGroundMins = 0;
  let verifiedCount = 0;
  let missingGpsCount = 0;
  let missingPhotoCount = 0;
  let rapidVisitsCount = 0; // < 5 mins
  const timelineItems = [];

  // 1. Punch In
  if (attLog?.punchIn) {
    timelineItems.push({
      id: 'punch_in',
      type: 'punch_in',
      time: attLog.punchIn.time,
      isoTime: attLog.punchIn.isoTime,
      title: 'Duty Started (Punch-In)',
      subtitle: 'Staff arrived on duty',
      location: attLog.punchIn.location,
    });
  }

  // 2. Visits & Gaps
  let lastCheckoutMinutes = attLog?.punchIn?.time ? parseTimeToMinutes(attLog.punchIn.time) : null;

  sortedVisits.forEach((visit, idx) => {
    const duration = getVisitDurationMinutes(visit);
    totalGroundMins += duration;

    const auth = evaluateVisitAuthenticity(visit);
    if (auth.isGenuine) verifiedCount++;
    if (!auth.hasGps) missingGpsCount++;
    if (!auth.hasPhoto) missingPhotoCount++;
    if (duration < 5) rapidVisitsCount++;

    const checkInMins = parseTimeToMinutes(visit.checkInTime) || parseTimeToMinutes(visit.createdAt);
    const checkOutMins = parseTimeToMinutes(visit.checkOutTime) || (checkInMins ? checkInMins + duration : null);

    // If there was a significant transit / idle gap between visits
    if (lastCheckoutMinutes != null && checkInMins != null && checkInMins > lastCheckoutMinutes + 20) {
      const gapMins = checkInMins - lastCheckoutMinutes;
      timelineItems.push({
        id: `gap_${idx}`,
        type: 'gap',
        durationMins: gapMins,
        isLongGap: gapMins >= 60,
        title: gapMins >= 60 ? `⚠️ Long Idle Gap (${formatDurationMinutes(gapMins)})` : `🚗 Transit / Travel (${formatDurationMinutes(gapMins)})`,
      });
    }

    const startTime = formatDisplayTime(visit.checkInTime, visit.createdAt);
    const calculatedOut = calculateCheckoutTime(visit.checkInTime || startTime, duration);
    const endTime = formatDisplayTime(visit.checkOutTime, calculatedOut);
    const entryReceived = formatEntryTimestamp(visit.createdAt);
    const syncStatus = evaluateSyncDelay(visit.checkInTime || startTime, visit.createdAt);

    timelineItems.push({
      id: visit.id || `visit_${idx}`,
      type: 'visit',
      visit,
      durationMins: duration,
      auth,
      startTime,
      endTime,
      checkInTime: visit.checkInTime || startTime,
      checkOutTime: visit.checkOutTime || endTime,
      entryReceived,
      syncStatus,
    });

    if (checkOutMins != null) {
      lastCheckoutMinutes = checkOutMins;
    }
  });

  // 3. Punch Out
  if (attLog?.punchOut) {
    timelineItems.push({
      id: 'punch_out',
      type: 'punch_out',
      time: attLog.punchOut.time,
      isoTime: attLog.punchOut.isoTime,
      title: 'Duty Ended (Punch-Out)',
      subtitle: `Total shift hours: ${attLog.totalHours || 'Completed'}`,
      location: attLog.punchOut.location,
    });
  }

  const totalVisits = sortedVisits.length;
  const trustScore = totalVisits > 0 ? Math.round((verifiedCount / totalVisits) * 100) : 0;

  // Live status
  let liveStatus = 'Inactive';
  const isToday = dateStr === new Date().toISOString().split('T')[0];
  if (isToday) {
    if (attLog?.punchOut) {
      liveStatus = 'Shift Ended';
    } else if (attLog?.punchIn) {
      if (sortedVisits.length > 0) {
        const last = sortedVisits[sortedVisits.length - 1];
        const lastCreatedMs = new Date(last.createdAt).getTime();
        const diffMins = Math.round((Date.now() - lastCreatedMs) / (60 * 1000));
        if (diffMins < 45) {
          liveStatus = `🟢 Actively on Field (Visited ${diffMins}m ago)`;
        } else if (diffMins < 120) {
          liveStatus = `⚡ In Transit / Between Meetings (${diffMins}m ago)`;
        } else {
          liveStatus = `⚠️ Inactive on Field (${Math.floor(diffMins / 60)}h without update)`;
        }
      } else {
        liveStatus = '🟢 Punched-in, No visits yet';
      }
    } else {
      liveStatus = sortedVisits.length > 0 ? '🟢 Active (Visits without Punch-In)' : '❌ Not Started';
    }
  }

  return {
    date: dateStr,
    staffId,
    staffName,
    attLog,
    visits: sortedVisits,
    totalVisits,
    totalGroundMins,
    totalGroundFormatted: formatDurationMinutes(totalGroundMins),
    shiftHours: attLog?.totalHours || (attLog?.punchIn ? 'In Progress' : 'No Shift Record'),
    trustScore,
    verifiedCount,
    missingGpsCount,
    missingPhotoCount,
    rapidVisitsCount,
    timelineItems,
    liveStatus,
  };
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
