/**
 * Follow-up Timing & Countdown Helper
 * Calculates exact remaining time, overdue time, 12h formatted time, and urgency styling
 * for marketing follow-up callbacks.
 */

/**
 * Normalizes time strings for field business hours.
 * In field marketing/library visits, times like "01:30", "02:00", "01:32" entered in HTML5
 * time pickers without explicit 24h conversion are ALWAYS afternoon/evening PM (1:00 PM to 7:59 PM = 13:00 to 19:59).
 * Nobody conducts library marketing visits at 1:30 AM in the middle of the night.
 */
export const normalizeBusinessTime = (timeStr) => {
  if (!timeStr) return '';
  const parts = String(timeStr).trim().split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] ? parts[1].padStart(2, '0') : '00';
  if (isNaN(h)) return timeStr;

  // 1 to 7 without PM flag -> convert to 13 to 19 (1 PM to 7 PM)
  if (h >= 1 && h <= 7) {
    h += 12;
  }
  return `${String(h).padStart(2, '0')}:${m}`;
};

export const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  const normalized = normalizeBusinessTime(timeStr);
  const parts = normalized.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] ? parts[1].padStart(2, '0') : '00';
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

export const getFollowUpTimingInfo = (dateStr, timeStr) => {
  if (!dateStr) {
    return {
      urgency: 'none',
      pillLabel: 'No date',
      countdown: 'No date scheduled',
      subText: '',
      timeFormatted: '',
      badgeColor: 'bg-slate-100 text-slate-600 border-slate-200',
      headerBg: 'bg-slate-50 text-slate-700 border-slate-200',
      cardBorder: 'border-slate-200',
    };
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeFormatted = formatTime12h(timeStr);

  // 1. Past Date (Overdue by days)
  if (dateStr < todayStr) {
    const dTarget = new Date(`${dateStr}T00:00:00`);
    const dToday = new Date(`${todayStr}T00:00:00`);
    const diffDays = Math.max(1, Math.round((dToday - dTarget) / (1000 * 60 * 60 * 24)));
    return {
      urgency: 'overdue',
      isOverdue: true,
      diffMinutes: -diffDays * 1440,
      pillLabel: `🚨 ${diffDays}d OVERDUE`,
      countdown: `${diffDays} day${diffDays > 1 ? 's' : ''} overdue`,
      subText: timeFormatted ? `Was set for ${dateStr} @ ${timeFormatted}` : `Was set for ${dateStr}`,
      timeFormatted,
      badgeColor: 'bg-rose-100 text-rose-700 border-rose-300 font-bold',
      headerBg: 'bg-rose-50 text-rose-900 border-rose-200',
      cardBorder: 'border-rose-300 ring-1 ring-rose-200',
    };
  }

  // 2. Today
  if (dateStr === todayStr) {
    if (!timeStr) {
      return {
        urgency: 'today_notime',
        isOverdue: false,
        diffMinutes: 9999,
        pillLabel: '📅 TODAY',
        countdown: 'Call anytime today',
        subText: 'No specific time set',
        timeFormatted: '',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
        headerBg: 'bg-amber-50 text-amber-900 border-amber-200',
        cardBorder: 'border-amber-200',
      };
    }

    const normalizedTime = normalizeBusinessTime(timeStr);
    const [hh, mm] = normalizedTime.split(':').map(Number);
    const targetDt = new Date();
    targetDt.setHours(hh || 0, mm || 0, 0, 0);

    const diffMs = targetDt.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < -15) {
      // Overdue today by minutes / hours
      const overdueMins = Math.abs(diffMins);
      const hrs = Math.floor(overdueMins / 60);
      const mins = overdueMins % 60;
      const overdueStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
      return {
        urgency: 'overdue',
        isOverdue: true,
        diffMinutes: diffMins,
        pillLabel: `🚨 ${overdueStr} LATE`,
        countdown: `Overdue by ${overdueStr}`,
        subText: `Was scheduled at ${timeFormatted}`,
        timeFormatted,
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300 ring-1 ring-rose-200 font-black',
        headerBg: 'bg-rose-50 text-rose-900 border-rose-200',
        cardBorder: 'border-rose-300 ring-1 ring-rose-200',
      };
    } else if (diffMins >= -15 && diffMins <= 5) {
      // Due right now (-15m to +5m window)
      return {
        urgency: 'due_now',
        isOverdue: false,
        diffMinutes: diffMins,
        pillLabel: '🔥 DUE RIGHT NOW',
        countdown: 'Call right now!',
        subText: `Scheduled for ${timeFormatted}`,
        timeFormatted,
        badgeColor: 'bg-red-600 text-white font-black border-red-700 animate-pulse shadow-xs',
        headerBg: 'bg-red-50 text-red-900 border-red-200',
        cardBorder: 'border-red-400 ring-2 ring-red-300',
      };
    } else if (diffMins <= 60) {
      // Within 1 hour
      return {
        urgency: 'urgent',
        isOverdue: false,
        diffMinutes: diffMins,
        pillLabel: `⏰ In ${diffMins} min${diffMins === 1 ? '' : 's'}`,
        countdown: `Call in ${diffMins} min${diffMins === 1 ? '' : 's'}`,
        subText: `Scheduled at ${timeFormatted}`,
        timeFormatted,
        badgeColor: 'bg-amber-500 text-white font-bold border-amber-600 shadow-xs',
        headerBg: 'bg-amber-50 text-amber-900 border-amber-200',
        cardBorder: 'border-amber-300 ring-1 ring-amber-200',
      };
    } else {
      // Later today (> 1 hour)
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      const leftStr = mins > 0 ? `${hrs}h ${mins}m` : `${hrs} hrs`;
      return {
        urgency: 'upcoming',
        isOverdue: false,
        diffMinutes: diffMins,
        pillLabel: `⏰ In ${leftStr}`,
        countdown: `Call in ${leftStr}`,
        subText: `Scheduled at ${timeFormatted}`,
        timeFormatted,
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 font-bold',
        headerBg: 'bg-slate-50 text-slate-700 border-slate-200',
        cardBorder: 'border-slate-200',
      };
    }
  }

  // 3. Future date
  return {
    urgency: 'future',
    isOverdue: false,
    diffMinutes: 99999,
    pillLabel: `📅 ${dateStr}`,
    countdown: `Scheduled on ${dateStr}`,
    subText: timeFormatted ? `@ ${timeFormatted}` : '',
    timeFormatted,
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
    headerBg: 'bg-slate-50 text-slate-700 border-slate-200',
    cardBorder: 'border-slate-200',
  };
};

/**
 * Sorts due follow-up visits chronologically by urgency:
 * 1. Due right now (🔥)
 * 2. Overdue visits (🚨)
 * 3. Upcoming today within 1 hr (⏰)
 * 4. Later today (sorted earliest time first)
 * 5. Today with no time set
 */
export const sortDueFollowUps = (visits) => {
  if (!Array.isArray(visits)) return [];
  return [...visits].sort((a, b) => {
    const infoA = getFollowUpTimingInfo(a.followUpDate, a.followUpTime);
    const infoB = getFollowUpTimingInfo(b.followUpDate, b.followUpTime);

    // Score based on urgency
    const scoreMap = {
      due_now: 0,
      urgent: 1,
      overdue: 2,
      upcoming: 3,
      today_notime: 4,
      future: 5,
      none: 6,
    };

    const scoreA = scoreMap[infoA.urgency] ?? 9;
    const scoreB = scoreMap[infoB.urgency] ?? 9;

    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }

    // Tie-break: lowest diffMinutes first (or earliest time)
    return (infoA.diffMinutes ?? 0) - (infoB.diffMinutes ?? 0);
  });
};
