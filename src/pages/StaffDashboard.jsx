import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getFieldVisits, logFieldVisit, updateFieldVisit, getCurrentGPSLocation, getAttendanceLogs, updateVisitStatus, punchAttendance } from '../firebase/services/marketingService';
import { calculateStaffPayroll, getStaffUsers } from '../firebase/services/staffService';
import { getSoftwareVerticals } from '../firebase/services/verticalService';
import { searchNearbyLibraries, formatDistance, getNavigationUrl } from '../services/googleMapsService';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Navigation,
  IndianRupee,
  TrendingUp,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  LogIn,
  LogOut,
  Plus,
  Crosshair,
  ExternalLink,
  Building2,
  Check,
  Phone,
  MessageCircle, 
  Compass, 
  Search, 
  Star, 
  AlertTriangle, 
  PhoneCall, 
  Edit3,
  Camera,
  X,
  Layers,
  BellRing,
  ShieldCheck,
  ShieldAlert,
  Send,
  Bell,
  RotateCcw,
  Target,
  Utensils,
  Coffee,
  Route,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  evaluateVisitAuthenticity,
  getVisitDurationMinutes,
  formatDurationMinutes,
  calculateCheckoutTime,
  formatDisplayTime,
  formatEntryTimestamp,
  evaluateSyncDelay,
  calculateStaffDailyDistanceKm,
  calculateDistance,
} from '../services/visitAuditHelper';

const VISIT_STATUSES = ['Interested', 'Demo Given', 'Follow Up', 'Deal Closed', 'Not Interested'];

const PERSON_MET_OPTIONS = [
  'Owner / Director',
  'Manager / In-Charge',
  'Receptionist / Staff',
  'Partner / Co-Founder',
  'Other',
];

const SEAT_CAPACITY_OPTIONS = [
  '< 50 Seats',
  '50 - 100 Seats',
  '100 - 150 Seats',
  '150 - 250 Seats',
  '250+ Seats',
];

const CURRENT_SOFTWARE_OPTIONS = [
  { id: 'Manual Register', label: '📒 Register / Diary' },
  { id: 'Excel / Spreadsheets', label: '📊 Excel / Sheets' },
  { id: 'Competitor Software', label: '💻 Other Software' },
  { id: 'New Library', label: '🆕 New Setup' },
];

const NEXT_ACTION_TAGS = [
  '💻 Give Full Demo',
  '🤝 Meet Owner Directly',
  '💰 Price Negotiation',
  '📝 Collect Payment',
  '🔄 Excel Data Help',
  '📞 Call back',
];

const compressImage = (file, maxWidth = 1000, maxHeight = 1000, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const initialStaffVisitForm = {
  clientType: 'Library',
  businessName: '',
  ownerName: '',
  phone: '',
  secondaryPhone: '',
  state: '',
  city: '',
  address: '',
  discussionNotes: '',
  demoGiven: false,
  status: 'Interested',
  personMet: 'Owner / Director',
  contactPersonName: '',
  seatCapacity: '',
  currentSoftwareType: 'Manual Register',
  competitorName: '',
  competitorExpiryDate: '',
  competitorDuration: '',
  switchingReason: '',
  followUpDate: '',
  followUpTime: '',
  followUpType: 'In-Person Re-Visit',
  nextActionItem: '',
  reminderNote: '',
  photoUrl: null,
  checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  durationMinutes: 20,
  placeId: '',
  placeName: '',
  placeAddress: ''
};

export const StaffDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showVisitModal, setShowVisitModal] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsData, setGpsData] = useState(null);
  const [statusDropdownId, setStatusDropdownId] = useState(null);
  const [revisitTarget, setRevisitTarget] = useState(null);

  // Form State for logging visit
  const [form, setForm] = useState(initialStaffVisitForm);

  // 1. Fetch Staff info for compensation details
  const { data: staffList = [] } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // 2. Fetch Active Software Verticals
  const { data: verticals = [] } = useQuery({
    queryKey: ['software_verticals'],
    queryFn: getSoftwareVerticals,
  });
  const activeVerticals = verticals.filter((v) => v.isActive);

  // 3. Fetch Visits
  const { data: allVisits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  // 4. Fetch Attendance
  const { data: attendanceLogs = [], isLoading: loadingAtt } = useQuery({
    queryKey: ['admin_attendance_logs'],
    queryFn: getAttendanceLogs,
  });

  // 6. Log Visit Mutation
  const addVisitMutation = useMutation({
    mutationFn: logFieldVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Client visit logged successfully!');
      setShowVisitModal(false);
      resetVisitForm();
    },
  });

  // 6b. Update / Re-Visit Mutation (updates existing document in-place and preserves history)
  const editVisitMutation = useMutation({
    mutationFn: ({ id, data }) => updateFieldVisit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Re-visit updated successfully! History preserved.');
      setShowVisitModal(false);
      resetVisitForm();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update re-visit');
    },
  });

  // 7. Update Visit Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: updateVisitStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Status updated successfully');
    },
  });

  const [punchingAction, setPunchingAction] = useState(false);
  const [showPunchHistory, setShowPunchHistory] = useState(false);

  // 8. Attendance Multi-Punch Mutation (Duty In, Lunch Break, Tea Break, Duty End)
  const punchMutation = useMutation({
    mutationFn: punchAttendance,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin_attendance_logs'] });
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      const punchType = data.lastPunchType || 'in';
      if (punchType === 'in') {
        toast.success('🟢 Punched In Successfully! (Duty Active)', { icon: '🟢' });
      } else {
        toast.success(`Punched Out Recorded (${data.punches?.[data.punches.length - 1]?.note || 'Break/Out'})`, { icon: '🥪' });
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to record punch attendance');
    },
    onSettled: () => {
      setPunchingAction(false);
    },
  });

  const handlePunch = async (type, note = '') => {
    setPunchingAction(true);
    let location = null;
    try {
      toast.loading('Acquiring phone GPS for punch...', { id: 'gps-punch' });
      location = await getCurrentGPSLocation();
      toast.success(`GPS Locked (±${location.accuracy}m)`, { id: 'gps-punch' });
    } catch (e) {
      toast.dismiss('gps-punch');
      toast.error('Could not get GPS location. Recording punch without device GPS.');
    }

    punchMutation.mutate({
      staffId: myId,
      staffName: user?.displayName || user?.name || 'Staff Member',
      type,
      location,
      note,
    });
  };

  const resetVisitForm = (prefill = null) => {
    const now = new Date();
    const liveTimeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const liveOutStr = new Date(now.getTime() + 20 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (prefill) {
      setRevisitTarget(prefill.id ? prefill : null);
      setForm({
        ...initialStaffVisitForm,
        clientType: prefill.clientType || (activeVerticals.length === 1 ? activeVerticals[0].shortName : 'Library'),
        businessName: prefill.businessName || '',
        ownerName: prefill.ownerName || '',
        phone: prefill.phone || '',
        secondaryPhone: prefill.secondaryPhone || '',
        state: prefill.state || '',
        city: prefill.city || '',
        address: prefill.address || '',
        personMet: prefill.personMet || 'Owner / Director',
        contactPersonName: prefill.contactPersonName || '',
        seatCapacity: prefill.seatCapacity || '',
        currentSoftwareType: prefill.currentSoftwareType || 'Manual Register',
        competitorName: prefill.competitorName || '',
        competitorExpiryDate: prefill.competitorExpiryDate || '',
        competitorDuration: prefill.competitorDuration || '',
        status: prefill.status || 'Follow Up',
        discussionNotes: '', // Clean for fresh notes entry
        placeId: prefill.placeId || '',
        placeName: prefill.placeName || '',
        placeAddress: prefill.placeAddress || '',
        checkInTime: liveTimeStr,
        checkOutTime: liveOutStr,
      });
    } else {
      setRevisitTarget(null);
      setForm({
        ...initialStaffVisitForm,
        clientType: activeVerticals.length === 1 ? activeVerticals[0].shortName : 'Library',
        checkInTime: liveTimeStr,
        checkOutTime: liveOutStr,
      });
    }
    setGpsData(null);
  };

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading('Processing photo proof...', { id: 'staff-photo' });
      const compressed = await compressImage(file);
      setForm((prev) => ({ ...prev, photoUrl: compressed }));
      toast.success('Photo attached! 📷', { id: 'staff-photo' });
    } catch (err) {
      console.error('Failed to compress image:', err);
      toast.error('Failed to process image', { id: 'staff-photo' });
    }
  };

  const setQuickFollowUp = (type) => {
    const now = new Date();
    let targetDate = new Date();
    let timeStr = '14:00';

    if (type === '30min') {
      targetDate = new Date(now.getTime() + 30 * 60 * 1000);
      const hrs = String(targetDate.getHours()).padStart(2, '0');
      const mins = String(targetDate.getMinutes()).padStart(2, '0');
      timeStr = `${hrs}:${mins}`;
    } else if (type === '1hr') {
      targetDate = new Date(now.getTime() + 60 * 60 * 1000);
      const hrs = String(targetDate.getHours()).padStart(2, '0');
      const mins = String(targetDate.getMinutes()).padStart(2, '0');
      timeStr = `${hrs}:${mins}`;
    } else if (type === '2hr') {
      targetDate = new Date(now.getTime() + 120 * 60 * 1000);
      const hrs = String(targetDate.getHours()).padStart(2, '0');
      const mins = String(targetDate.getMinutes()).padStart(2, '0');
      timeStr = `${hrs}:${mins}`;
    } else if (type === 'today_evening') {
      timeStr = '17:00';
    } else if (type === 'tomorrow_11am') {
      targetDate.setDate(targetDate.getDate() + 1);
      timeStr = '11:00';
    } else if (type === 'tomorrow_2pm') {
      targetDate.setDate(targetDate.getDate() + 1);
      timeStr = '14:00';
    } else if (type === '2days') {
      targetDate.setDate(targetDate.getDate() + 2);
      timeStr = '12:00';
    } else if (type === '7days') {
      targetDate.setDate(targetDate.getDate() + 7);
      timeStr = '12:00';
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    setForm((prev) => ({
      ...prev,
      status: 'Follow Up',
      followUpDate: dateStr,
      followUpTime: timeStr,
    }));
    toast.success(`Follow-up: ${dateStr} @ ${timeStr}`);
  };

  const setCompetitorPreset = (months, label) => {
    const target = new Date();
    target.setMonth(target.getMonth() + months);
    const expiryStr = target.toISOString().split('T')[0];

    const reminderDate = new Date(target);
    reminderDate.setDate(reminderDate.getDate() - 10);
    const reminderStr = reminderDate.toISOString().split('T')[0];

    setForm((prev) => ({
      ...prev,
      currentSoftwareType: 'Competitor Software',
      competitorDuration: label,
      competitorExpiryDate: expiryStr,
      followUpDate: reminderStr,
      followUpTime: '11:00',
      status: 'Follow Up',
      nextActionItem: `Competitor expiring - offer migration`,
      reminderNote: `Competitor plan expires on ${expiryStr}`,
    }));
    toast.success(`Expiry set: ${expiryStr} (Reminder: 10 days before)`);
  };

  const openVisitModal = (prefill = null) => {
    resetVisitForm(prefill);
    setShowVisitModal(true);
    getCurrentGPSLocation().then(loc => {
      setGpsData(loc);
      toast.success(`GPS Auto-locked (±${loc.accuracy}m)`);
    }).catch(() => {});
  };

  const handleCaptureGPS = async () => {
    setCapturingGps(true);
    try {
      const loc = await getCurrentGPSLocation();
      setGpsData(loc);
      toast.success(`GPS Locked (±${loc.accuracy}m)`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCapturingGps(false);
    }
  };

  const myId = user?.uid || user?.id;
  const myName = (user?.displayName || user?.name || '').toLowerCase();

  const staffData = staffList.find(
    (s) => s.id === myId || s.email?.toLowerCase() === user?.email?.toLowerCase()
  ) || user;

  const todayStr = new Date().toISOString().split('T')[0];
  const myTodayLog = attendanceLogs.find(
    (l) => (l.staffId === myId || (l.staffName && l.staffName.toLowerCase() === myName)) && l.date === todayStr
  );

  // Morning punch-in location of the staff for anti-fraud detection
  const morningPunchLoc = useMemo(() => {
    if (!myTodayLog) return null;
    if (myTodayLog.punches && Array.isArray(myTodayLog.punches)) {
      const firstIn = myTodayLog.punches.find((p) => p.type === 'in' && p.location);
      if (firstIn) return firstIn.location;
    }
    if (myTodayLog.punchIn?.location) return myTodayLog.punchIn.location;
    return null;
  }, [myTodayLog]);

  // Live distance from morning punch / home
  const morningDistanceMeters = useMemo(() => {
    if (!gpsData || !morningPunchLoc) return null;
    const dist = calculateDistance(gpsData, morningPunchLoc);
    return dist !== null ? Math.round(dist * 1000) : null;
  }, [gpsData, morningPunchLoc]);

  const isGpsNearMorningStart = useMemo(() => {
    if (morningDistanceMeters === null) return false;
    return morningDistanceMeters < 250;
  }, [morningDistanceMeters]);

  const handleVisitSubmit = (e) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      toast.error('Please enter the client / business name');
      return;
    }

    const now = new Date();
    const liveTimeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const liveOutStr = new Date(now.getTime() + 20 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const checkInTime = (form.checkInTime && form.checkInTime.trim()) || liveTimeStr;
    const checkOutTime = (form.checkOutTime && form.checkOutTime.trim()) || liveOutStr;

    let distanceFromMorningKm = null;
    let isNearHome = false;

    if (gpsData && morningPunchLoc) {
      const dist = calculateDistance(gpsData, morningPunchLoc);
      if (dist !== null) {
        distanceFromMorningKm = dist;
        isNearHome = dist < 0.25;
      }
    }

    if (revisitTarget) {
      // Archive previous visit state into visitHistory array
      const previousLog = {
        visitedAt: revisitTarget.lastVisitedAt || revisitTarget.createdAt || new Date().toISOString(),
        staffName: revisitTarget.lastStaffName || revisitTarget.staffName || user?.displayName || user?.name || 'Staff',
        staffId: revisitTarget.lastStaffId || revisitTarget.staffId || myId || 'staff',
        status: revisitTarget.status || 'Interested',
        discussionNotes: revisitTarget.discussionNotes || '',
        checkInTime: revisitTarget.checkInTime || '',
        checkOutTime: revisitTarget.checkOutTime || '',
        durationMinutes: revisitTarget.durationMinutes || 20,
        followUpDate: revisitTarget.followUpDate || '',
        followUpTime: revisitTarget.followUpTime || '',
        location: revisitTarget.location || null,
        photoUrl: revisitTarget.photoUrl || '',
      };

      const updatedHistory = [...(revisitTarget.visitHistory || []), previousLog];
      const newVisitCount = (revisitTarget.visitCount || updatedHistory.length) + 1;

      editVisitMutation.mutate({
        id: revisitTarget.id,
        data: {
          ...form,
          checkInTime,
          checkOutTime,
          durationMinutes: Number(form.durationMinutes) || 20,
          staffId: myId,
          staffName: user?.displayName || user?.name || 'Staff',
          visitCount: newVisitCount,
          lastVisitedAt: new Date().toISOString(),
          lastStaffName: user?.displayName || user?.name || 'Staff',
          lastStaffId: myId || 'staff',
          visitHistory: updatedHistory,
          location: gpsData || revisitTarget.location || null,
          photoUrl: form.photoUrl || revisitTarget.photoUrl || '',
          morningLocation: morningPunchLoc || revisitTarget.morningLocation || null,
          distanceFromMorningKm: distanceFromMorningKm ?? revisitTarget.distanceFromMorningKm ?? null,
          isNearHome,
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      addVisitMutation.mutate({
        ...form,
        checkInTime,
        checkOutTime,
        durationMinutes: Number(form.durationMinutes) || 20,
        staffId: myId,
        staffName: user?.displayName || user?.name || 'Staff',
        location: gpsData,
        morningLocation: morningPunchLoc || null,
        distanceFromMorningKm,
        isNearHome,
        visitCount: 1,
        visitHistory: [],
        lastVisitedAt: new Date().toISOString(),
      });
    }
  };

  const handleStatusChange = (id, newStatus) => {
    updateStatusMutation.mutate({ id, status: newStatus });
    setStatusDropdownId(null);
  };

  // Calculations for current staff
  const payroll = calculateStaffPayroll(staffData, allVisits);
  const myVisits = allVisits.filter(
    (v) => v.staffId === myId || (v.staffName && v.staffName.toLowerCase() === myName)
  );

  const todayDistanceKm = calculateStaffDailyDistanceKm(
    myId,
    user?.displayName || user?.name || '',
    todayStr,
    allVisits,
    attendanceLogs
  );

  const punches = myTodayLog?.punches || [];
  const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;

  // Determine current duty status
  let isCurrentlyOnDuty = false;
  let isOnBreak = false;
  let currentDutyLabel = 'Duty Not Started';

  if (punches.length > 0) {
    if (lastPunch.type === 'in') {
      isCurrentlyOnDuty = true;
      currentDutyLabel = '🟢 On Duty';
    } else {
      isOnBreak = (lastPunch.note || '').toLowerCase().includes('lunch') || (lastPunch.note || '').toLowerCase().includes('break') || (lastPunch.note || '').toLowerCase().includes('khana');
      currentDutyLabel = isOnBreak ? '🥪 On Lunch / Break' : '⚪ Shift Concluded';
    }
  } else if (myTodayLog?.punchIn) {
    if (!myTodayLog?.punchOut) {
      isCurrentlyOnDuty = true;
      currentDutyLabel = '🟢 On Duty';
    } else {
      currentDutyLabel = '⚪ Shift Concluded';
    }
  }

  const totalActiveMinutes = myTodayLog?.totalActiveMinutes || 0;
  const totalBreakMinutes = myTodayLog?.totalBreakMinutes || 0;

  const myFollowups = myVisits.filter((v) => v.status === 'Follow Up' && v.followUpDate);
  const dueFollowups = myFollowups.filter((v) => v.followUpDate <= todayStr);
  const overdueFollowups = dueFollowups.filter((v) => v.followUpDate < todayStr);

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt || 0);
  };

  // ── Live Follow-up Reminder Engine ─────────────────────────────────────────
  // Requests browser notification permission once on mount, then checks every
  // 60 seconds if a follow-up is due at this exact minute (date + time match).
  const notifiedIds = useRef(new Set());

  useEffect(() => {
    // Ask for browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentHHMM = now.toTimeString().slice(0, 5); // "HH:MM"

      myFollowups.forEach((f) => {
        if (!f.followUpDate || !f.followUpTime) return;
        // Only fire once per visit per session
        if (notifiedIds.current.has(f.id)) return;

        const followHHMM = f.followUpTime.slice(0, 5); // normalise to HH:MM
        if (f.followUpDate === currentDate && followHHMM === currentHHMM) {
          notifiedIds.current.add(f.id);

          // Toast reminder
          toast(
            (t) => (
              <div className="flex flex-col gap-1">
                <p className="font-black text-sm text-amber-900">
                  ⏰ Follow-up Due Now!
                </p>
                <p className="text-xs font-semibold text-slate-800">
                  {f.businessName}
                </p>
                <p className="text-[11px] text-slate-600">
                  {f.ownerName} · {f.phone}
                </p>
                {f.reminderNote && (
                  <p className="text-[11px] italic text-slate-500">📝 {f.reminderNote}</p>
                )}
                <div className="flex gap-2 mt-1">
                  {f.phone && (
                    <a
                      href={`tel:${f.phone}`}
                      className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg"
                      onClick={() => toast.dismiss(t.id)}
                    >
                      📞 Call Now
                    </a>
                  )}
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ),
            {
              duration: 30000,
              style: { background: '#fffbeb', border: '1px solid #fbbf24', maxWidth: '360px' },
              icon: '🔔',
            }
          );

          // Browser push notification (works even if tab is in background)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`⏰ Follow-up: ${f.businessName}`, {
              body: `${f.ownerName} · ${f.followUpTime}${f.reminderNote ? '\n' + f.reminderNote : ''}`,
              icon: '/favicon.ico',
              tag: `followup-${f.id}`,
            });
          }
        }
      });
    };

    checkReminders(); // check immediately on mount / data change
    const interval = setInterval(checkReminders, 60000); // then every 60s
    return () => clearInterval(interval);
  }, [myFollowups]);
  // ────────────────────────────────────────────────────────────────────────────

  if (loadingVisits || loadingAtt) {
    return <LoadingSpinner fullScreen label="Loading your staff workspace..." />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-blue-200">
                {user?.roleLabel || 'Field Marketing Executive'}
              </span>
              <span className="px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full text-xs font-black text-amber-300 flex items-center gap-1.5 shadow-2xs">
                <span>⚡ Today's Visits: {payroll.todayVisits} {payroll.dailyTargetVisits > 0 ? `/ ${payroll.dailyTargetVisits}` : ''}</span>
              </span>
              {payroll.dailyTargetDeals > 0 && (
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-xs font-black text-emerald-300 flex items-center gap-1.5 shadow-2xs">
                  <Target size={13} className="text-emerald-400" />
                  <span>Today's Deals: {payroll.todayDeals} / {payroll.dailyTargetDeals}</span>
                </span>
              )}
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/40 rounded-full text-xs font-black text-blue-300 flex items-center gap-1.5 shadow-2xs">
                <Navigation size={13} className="text-blue-400" />
                <span>Total Logged: {payroll.totalVisits} Visits · {payroll.dealsClosed} Won</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Hello, {user?.displayName || 'Team Member'}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Track your field visits, record on-site GPS verification, and watch your deal commissions grow in real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Log Visit Button */}
            <button
              onClick={() => openVisitModal()}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-600/25 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus size={18} />
              <span>Log Client Visit</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ LIVE ATTENDANCE & MULTI-PUNCH FIELD MOVEMENT TRACKER ═══ */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs ${
                isCurrentlyOnDuty
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                  : isOnBreak
                  ? 'bg-gradient-to-tr from-amber-500 to-orange-500'
                  : 'bg-gradient-to-tr from-slate-700 to-slate-900'
              }`}
            >
              {isCurrentlyOnDuty ? (
                <CheckCircle2 size={24} />
              ) : isOnBreak ? (
                <Utensils size={22} />
              ) : (
                <Clock size={24} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900 text-base">Daily Attendance & Field Route</h3>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    isCurrentlyOnDuty
                      ? 'bg-emerald-100 text-emerald-800'
                      : isOnBreak
                      ? 'bg-amber-100 text-amber-900 animate-pulse'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {currentDutyLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {lastPunch
                  ? `Last punch: ${lastPunch.time} (${lastPunch.note || lastPunch.type})`
                  : 'No punches recorded yet today. Punch in below to start duty.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="px-3.5 py-2 bg-slate-50 rounded-2xl border border-slate-200/80 text-center min-w-[90px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Active Duty</span>
              <span className="text-xs sm:text-sm font-black text-slate-800">
                {formatDurationMinutes(totalActiveMinutes) || (isCurrentlyOnDuty ? 'Active' : '0m')}
              </span>
            </div>
            <div className="px-3.5 py-2 bg-slate-50 rounded-2xl border border-slate-200/80 text-center min-w-[90px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Lunch/Break</span>
              <span className="text-xs sm:text-sm font-black text-amber-700">
                {formatDurationMinutes(totalBreakMinutes) || '0m'}
              </span>
            </div>
            <div className="px-3.5 py-2 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-center min-w-[100px]">
              <span className="text-[10px] text-indigo-500 font-bold uppercase block">Traveled Today</span>
              <span className="text-xs sm:text-sm font-black text-indigo-700">
                🏍️ {todayDistanceKm} KM
              </span>
            </div>
          </div>
        </div>

        {/* Punch Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {!isCurrentlyOnDuty ? (
              <button
                type="button"
                disabled={punchingAction}
                onClick={() =>
                  handlePunch('in', isOnBreak ? 'Resumed Duty (Wapis In)' : 'Duty Started')
                }
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn size={16} />
                <span>
                  {isOnBreak
                    ? '🟢 Wapis In (Resume Duty)'
                    : punches.length > 0
                    ? '🟢 Punch In Again'
                    : '🟢 Punch In (Duty Start)'}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={punchingAction}
                  onClick={() => handlePunch('out', 'Lunch Break (Khana)')}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Out for lunch / food break"
                >
                  <Utensils size={15} />
                  <span>🥪 Khana / Lunch Break</span>
                </button>
                <button
                  type="button"
                  disabled={punchingAction}
                  onClick={() => handlePunch('out', 'Tea / Short Break')}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Coffee size={15} />
                  <span>☕ Short Break</span>
                </button>
                <button
                  type="button"
                  disabled={punchingAction}
                  onClick={() => handlePunch('out', 'Duty Concluded / Day End')}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <LogOut size={15} />
                  <span>🏠 Duty End</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {punches.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPunchHistory((prev) => !prev)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
              >
                <span>{showPunchHistory ? 'Hide Punch Log' : `View ${punches.length} Punches`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Detailed Punches Drawer */}
        {showPunchHistory && punches.length > 0 && (
          <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              Today's In / Out Punch Log ({punches.length} Sessions)
            </h4>
            <div className="space-y-2">
              {punches.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center text-[10px] ${
                        p.type === 'in'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.type === 'in' ? 'IN' : 'OUT'}
                    </span>
                    <span className="font-extrabold text-slate-800">{p.time}</span>
                    <span className="text-slate-600 font-medium">• {p.note}</span>
                  </div>
                  {p.location && (
                    <a
                      href={
                        p.location.mapsUrl ||
                        `https://www.google.com/maps?q=${p.location.latitude},${p.location.longitude}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 text-[11px]"
                    >
                      <MapPin size={10} />
                      <span>GPS ±{p.location.accuracy || 15}m</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Today's Follow-up Reminder Banner */}
      {dueFollowups.length > 0 && (
        <div className={`rounded-2xl border p-5 shadow-sm ${overdueFollowups.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
          {/* Banner Header */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${overdueFollowups.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                <Bell size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className={`font-black text-sm ${overdueFollowups.length > 0 ? 'text-rose-900' : 'text-amber-900'}`}>
                  {overdueFollowups.length > 0
                    ? `🚨 ${overdueFollowups.length} Overdue + ${dueFollowups.length - overdueFollowups.length} Due Today — Act Now!`
                    : `⏰ ${dueFollowups.length} Follow-up${dueFollowups.length > 1 ? 's' : ''} Due Today`}
                </h3>
                <p className={`text-xs mt-0.5 ${overdueFollowups.length > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                  Call or WhatsApp these clients — don't lose the lead!
                </p>
              </div>
            </div>

            {/* Browser Notification Permission Button */}
            {'Notification' in window && Notification.permission !== 'granted' && (
              <button
                onClick={() => Notification.requestPermission().then((p) => {
                  if (p === 'granted') toast.success('🔔 Reminders enabled! You\'ll get notified at the exact follow-up time.');
                })}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-amber-300 text-amber-800 text-[11px] font-bold rounded-xl hover:bg-amber-50 transition cursor-pointer shadow-xs shrink-0"
              >
                <Bell size={12} /> Enable Auto-Alerts
              </button>
            )}
            {('Notification' in window && Notification.permission === 'granted') && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-xl">
                <Bell size={11} /> Auto-Alerts ON ✓
              </span>
            )}
          </div>

          {/* Follow-up Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dueFollowups.map((f) => {
              const isOverdue = f.followUpDate < todayStr;
              return (
                <div
                  key={f.id}
                  className={`bg-white rounded-xl p-4 border shadow-xs flex flex-col justify-between ${isOverdue ? 'border-rose-200 ring-1 ring-rose-100' : 'border-amber-100'}`}
                >
                  <div>
                    {/* Name + date badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-sm truncate">{f.businessName}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{f.ownerName}{f.personMet ? ` · ${f.personMet.split(' ')[0]}` : ''}</p>
                      </div>
                      <div className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 text-center ${isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                        {isOverdue ? '🚨 OVERDUE' : '📅 TODAY'}
                        <div className="text-[9px] font-semibold mt-0.5">
                          {f.followUpDate}{f.followUpTime ? ` @ ${f.followUpTime}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Next Action */}
                    {f.nextActionItem && (
                      <div className="mb-2 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200">
                        🎯 {f.nextActionItem}
                      </div>
                    )}

                    {/* Reminder Note */}
                    {f.reminderNote && (
                      <p className="text-[10px] text-slate-600 mb-2 italic bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                        📝 {f.reminderNote}
                      </p>
                    )}

                    {/* Discussion snippet */}
                    {f.discussionNotes && (
                      <p className="text-[10px] text-slate-500 mb-2 line-clamp-2 border-l-2 border-amber-200 pl-2 italic">
                        "{f.discussionNotes.substring(0, 80)}{f.discussionNotes.length > 80 ? '...' : ''}"
                      </p>
                    )}

                    {/* Contact buttons */}
                    {f.phone && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={`tel:${f.phone}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition border border-blue-200"
                        >
                          <PhoneCall size={11} /> Call
                        </a>
                        <a
                          href={`https://wa.me/91${f.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition border border-emerald-200"
                        >
                          <MessageCircle size={11} /> WhatsApp
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Log follow-up button */}
                  <button
                    onClick={() => openVisitModal(f)}
                    className={`mt-3 w-full py-2 text-white text-[11px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${isOverdue ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                  >
                    <MapPin size={13} /> Log Follow-up Visit
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Salary & Earnings Wallet Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Base Monthly Salary"
          value={formatCurrency(payroll.baseSalary)}
          subtitle="Fixed compensation"
          icon={IndianRupee}
          color="blue"
        />

        <StatCard
          title="Earned Commission"
          value={formatCurrency(payroll.commissionEarned)}
          subtitle={`${payroll.dealsClosed} Deals × ${formatCurrency(payroll.commissionPerDeal)}`}
          icon={Award}
          color="emerald"
          trend={`+${payroll.dealsClosed} Deals`}
          trendPositive={true}
        />

        <StatCard
          title="Estimated Month Payout"
          value={formatCurrency(payroll.totalEstimatedPayout)}
          subtitle="Base Salary + Commission"
          icon={TrendingUp}
          color="indigo"
          trend="Total Earnings"
          trendPositive={true}
        />

        <StatCard
          title="Today's Visits"
          value={`${payroll.todayVisits} ${payroll.dailyTargetVisits > 0 ? `/ ${payroll.dailyTargetVisits}` : ''}`}
          subtitle={payroll.dailyTargetVisits > 0 ? `${payroll.dailyVisitAchievement}% of Daily Visits Goal` : 'Logged Today'}
          icon={Navigation}
          color="amber"
          trend={
            payroll.dailyTargetVisits > 0
              ? payroll.dailyTargetVisits - payroll.todayVisits > 0
                ? `${payroll.dailyTargetVisits - payroll.todayVisits} to go today`
                : 'Daily Target Hit! 🎯'
              : `${payroll.todayVisits} Visits`
          }
          trendPositive={payroll.dailyVisitAchievement >= 100}
        />

        <StatCard
          title="Today's Distance"
          value={`${todayDistanceKm} KM`}
          subtitle="Phone GPS Field Route"
          icon={Compass}
          color="indigo"
          trend={`${punches.length} Punches`}
          trendPositive={true}
        />

        <StatCard
          title="All-Time Visits"
          value={payroll.totalVisits}
          subtitle={`${payroll.dealsClosed} deals closed won`}
          icon={Navigation}
          color="blue"
          trend={`${payroll.dealsClosed} Won`}
          trendPositive={true}
        />
      </div>

      {/* Daily Target Progress Bars */}
      <div className={`grid grid-cols-1 ${payroll.dailyTargetDeals > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {/* Today's Daily Visits Target Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded">
                ⚡ Today
              </span>
              <span>Daily Visits ({payroll.todayVisits} {payroll.dailyTargetVisits > 0 ? `/ ${payroll.dailyTargetVisits}` : ''})</span>
            </span>
            {payroll.dailyTargetVisits > 0 && (
              <span className="font-extrabold text-amber-700">{payroll.dailyVisitAchievement}%</span>
            )}
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, payroll.dailyVisitAchievement || (payroll.todayVisits > 0 ? 100 : 0))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>{payroll.todayVisits} Visits Today</span>
            <span className="font-bold text-slate-700">
              {payroll.dailyTargetVisits > 0
                ? payroll.dailyTargetVisits - payroll.todayVisits > 0
                  ? `${payroll.dailyTargetVisits - payroll.todayVisits} more today ⚡`
                  : 'Daily Target Hit! 🎯'
                : 'Keep logging visits'}
            </span>
          </div>
        </div>

        {/* Today's Daily Deals Target Card (if configured) */}
        {payroll.dailyTargetDeals > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Award size={14} className="text-emerald-600" />
                <span>Today's Deals ({payroll.todayDeals} / {payroll.dailyTargetDeals})</span>
              </span>
              <span className="font-extrabold text-emerald-600">{payroll.dailyDealAchievement}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${payroll.dailyDealAchievement}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>{payroll.todayDeals} Deals Today</span>
              <span className="font-bold text-slate-700">
                {payroll.dailyTargetDeals - payroll.todayDeals > 0
                  ? `${payroll.dailyTargetDeals - payroll.todayDeals} more to close 🏆`
                  : 'Deals Target Hit! 🏆'}
              </span>
            </div>
          </div>
        )}

        {/* All-Time Visits & Performance Summary */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Navigation size={14} className="text-blue-600" />
              <span>All-Time Work Summary</span>
            </span>
            <span className="font-extrabold text-blue-600">{payroll.dealsClosed} Won</span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full"
              style={{ width: '100%' }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>{payroll.totalVisits} Total Visits Logged</span>
            <span className="font-bold text-emerald-700">
              ₹{payroll.commissionEarned.toLocaleString('en-IN')} Commission
            </span>
          </div>
        </div>
      </div>

      {/* Grid: My Recent Visits & Pending Followups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Recent Visits (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">My Field Visits</h2>
              <p className="text-xs text-slate-500 mt-0.5">Visits logged by you with verified GPS</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              Total {myVisits.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Client / Business</th>
                  <th className="px-5 py-3">Owner Contact</th>
                  <th className="px-5 py-3">GPS Location</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myVisits.length > 0 ? (
                  myVisits.slice(0, 6).map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-900">{v.businessName}</p>
                        <span className="text-[10px] text-slate-400">
                          {v.clientType || 'Library'} • {v.city || 'Local'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-700">{v.ownerName}</span>
                        {v.phone && (
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <a href={`tel:${v.phone}`} className="text-blue-600 hover:text-blue-800" title="Call">
                              <PhoneCall size={11} />
                            </a>
                            <a href={`https://wa.me/91${v.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-800" title="WhatsApp">
                              <MessageCircle size={11} />
                            </a>
                            <span className="text-[10px] text-slate-400">{v.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {(() => {
                          const auth = evaluateVisitAuthenticity(v);
                          const dur = getVisitDurationMinutes(v);
                          return (
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border w-fit ${auth.badgeClass}`}>
                                {auth.level === 'verified' && <ShieldCheck size={11} className="text-emerald-600" />}
                                {auth.level === 'distance_alert' && <AlertTriangle size={11} className="text-rose-600" />}
                                {auth.level === 'gps_only' && <MapPin size={11} className="text-blue-600" />}
                                {auth.level === 'photo_only' && <Camera size={11} className="text-amber-600" />}
                                <span>{auth.statusText}</span>
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500 font-medium">
                                <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="On-site visit time">
                                  🚶 Visit: {formatDisplayTime(v.checkInTime, v.createdAt)} ({dur > 0 ? `${formatDurationMinutes(dur)}` : '20m'})
                                </span>
                                <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="Server entry timestamp">
                                  📥 Logged: {formatEntryTimestamp(v.createdAt).time}
                                </span>
                                {v.location && (
                                  <a
                                    href={v.location.mapsUrl || `https://www.google.com/maps?q=${v.location.latitude},${v.location.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-0.5 font-bold"
                                  >
                                    Maps <ExternalLink size={9} />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3.5 text-right relative">
                        <button
                          onClick={() => setStatusDropdownId(statusDropdownId === v.id ? null : v.id)}
                          className="focus:outline-none"
                        >
                          <Badge
                            variant={
                              v.status === 'Deal Closed'
                                ? 'success'
                                : v.status === 'Follow Up'
                                ? 'warning'
                                : 'info'
                            }
                            size="sm"
                          >
                            {v.status}
                          </Badge>
                        </button>
                        {statusDropdownId === v.id && (
                          <div className="absolute right-5 top-10 mt-1 w-36 bg-white border border-slate-200 shadow-lg rounded-xl z-10 py-1 flex flex-col text-left">
                            {VISIT_STATUSES.map(st => (
                              <button
                                key={st}
                                onClick={() => handleStatusChange(v.id, st)}
                                className={`px-4 py-2 text-xs text-left hover:bg-slate-50 transition ${v.status === st ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      You have not logged any visits yet. Click "Log Client Visit" to start!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Follow-ups */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Follow-up Callbacks</h2>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              {myFollowups.length} Due
            </span>
          </div>

          <div className="p-5 flex-1 divide-y divide-slate-100 space-y-3">
            {myFollowups.length > 0 ? (
              myFollowups.slice(0, 5).map((f) => (
                <div key={f.id} className="pt-3 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-xs truncate max-w-[160px]">
                      {f.businessName}
                    </p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.followUpDate < todayStr ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                      {f.followUpDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Phone size={11} /> {f.ownerName} ({f.phone})
                    </p>
                    {f.phone && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openVisitModal(f)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold hover:bg-indigo-100 transition border border-indigo-200 cursor-pointer"
                          title="Log Re-Visit"
                        >
                          <RotateCcw size={10} /> Re-Visit
                        </button>
                        <a href={`tel:${f.phone}`} className="p-1 text-blue-600 hover:text-blue-800" title="Call">
                          <PhoneCall size={12} />
                        </a>
                        <a href={`https://wa.me/91${f.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1 text-emerald-600 hover:text-emerald-800" title="WhatsApp">
                          <MessageCircle size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-400 py-8">
                No pending follow-ups scheduled.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Log Visit Modal for Staff */}
      <Modal
        isOpen={showVisitModal}
        onClose={() => {
          setShowVisitModal(false);
          setRevisitTarget(null);
        }}
        title={revisitTarget ? `Log Re-Visit: ${revisitTarget.businessName}` : 'Log On-Site Client Visit'}
        subtitle={
          revisitTarget
            ? `Visit #${(revisitTarget.visitCount || 1) + 1} — Updating existing record and preserving past history`
            : 'Capture GPS, photo proof, competitor expiry, and smart follow-up schedule'
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleVisitSubmit} className="space-y-4">
          {revisitTarget && (
            <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-indigo-900 flex items-center gap-1.5">
                  <RotateCcw size={13} className="text-indigo-600" />
                  Re-Visiting Existing Client (Visit #{(revisitTarget.visitCount || 1) + 1})
                </span>
                <span className="text-[10px] text-indigo-700 font-bold">
                  Previous Status: {revisitTarget.status}
                </span>
              </div>
              {revisitTarget.discussionNotes && (
                <p className="text-indigo-800 text-[11px] line-clamp-2">
                  <span className="font-bold">Past Note:</span> {revisitTarget.discussionNotes}
                </p>
              )}
            </div>
          )}
          {/* Dual Verification: GPS & Photo Proof */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* GPS Pinpoint */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">GPS Verification</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {gpsData ? `Locked: ±${gpsData.accuracy}m` : 'Required for on-site visit'}
                </p>
              </div>
              <button
                type="button"
                disabled={capturingGps}
                onClick={handleCaptureGPS}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-1 shrink-0 ${
                  gpsData ? 'bg-emerald-600' : 'bg-blue-600'
                }`}
              >
                <Crosshair size={13} className={capturingGps ? 'animate-spin' : ''} />
                <span>{capturingGps ? 'Locking...' : gpsData ? 'GPS Locked' : 'Lock GPS'}</span>
              </button>
            </div>

            {/* Photo Proof */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="Proof" className="w-8 h-8 rounded-lg object-cover border border-emerald-400 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Camera size={16} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">Library Photo</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {form.photoUrl ? '✓ Photo Attached' : 'Board / Reception'}
                  </p>
                </div>
              </div>

              <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1 shrink-0">
                <Camera size={12} />
                <span>{form.photoUrl ? 'Retake' : 'Capture'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Anti-Fraud Live Status: Warn if still at Home/Morning Start, or Celebrate Verified Movement */}
          {gpsData && morningPunchLoc && (
            isGpsNearMorningStart ? (
              <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-black text-rose-800">
                  <ShieldAlert size={16} className="text-rose-600 shrink-0 animate-pulse" />
                  <span>🚨 Warning: You are still at your Morning Start Location ({morningDistanceMeters}m away)</span>
                </div>
                <p className="text-rose-700 text-[11px] leading-relaxed">
                  You are logging a visit without traveling from your morning punch-in location. This entry will be strictly flagged in the Boss Tracker as a <strong>Fake Visit (Did not leave home)</strong>!
                </p>
              </div>
            ) : morningDistanceMeters >= 250 ? (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between text-emerald-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                  <span className="font-bold">
                    Verified Field Movement: {(morningDistanceMeters / 1000).toFixed(1)} KM traveled from morning start point
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-100/80 text-emerald-800 font-black px-2 py-0.5 rounded-full shrink-0">
                  ✓ Validated On-Site
                </span>
              </div>
            ) : null
          )}

          {/* Active Verticals Selector (if more than 1 active) */}
          {activeVerticals.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Software Product
              </label>
              <div className="grid grid-cols-2 gap-2">
                {activeVerticals.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setForm({ ...form, clientType: v.shortName })}
                    className={`p-2 rounded-xl text-xs font-bold border transition text-left ${
                      form.clientType === v.shortName
                        ? 'bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Business Name & Scale */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Client / Library Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Saraswati Library, Apex Study Point"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 font-bold"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Total Seats
                </label>
                <span className="text-[10px] text-blue-600 font-semibold">Type or Pick</span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Type (e.g. 60) or select"
                  value={form.seatCapacity}
                  onChange={(e) => setForm({ ...form, seatCapacity: e.target.value })}
                  className="w-full pl-3 pr-24 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                />
                <select
                  value={SEAT_CAPACITY_OPTIONS.includes(form.seatCapacity) ? form.seatCapacity : ''}
                  onChange={(e) => {
                    if (e.target.value) setForm({ ...form, seatCapacity: e.target.value });
                  }}
                  className="absolute right-1 top-1 bottom-1 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 outline-none cursor-pointer"
                  title="Choose preset range"
                >
                  <option value="">Presets ▾</option>
                  {SEAT_CAPACITY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['< 50', '50-100', '100-150', '150-250', '250+'].map((p) => {
                  const fullVal = p.includes('Seats') ? p : `${p} Seats`;
                  const isSelected = form.seatCapacity === fullVal || form.seatCapacity === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, seatCapacity: fullVal })}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Person Met & Direct Contacts */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kisse Mulakat Hui? (Person Met)</label>
              <div className="flex flex-wrap gap-1.5">
                {PERSON_MET_OPTIONS.map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setForm({ ...form, personMet: pm })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                      form.personMet === pm
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Owner Name</label>
                <input
                  type="text"
                  placeholder="Rakesh Kumar"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[11px] font-bold text-slate-600">Mobile Number</label>
                  {form.phone && form.phone.trim().length >= 5 && (
                    <div className="flex items-center gap-1">
                      <a
                        href={`tel:${form.phone}`}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-bold transition shadow-2xs"
                        title="Direct Call / Dial from Phone"
                      >
                        <PhoneCall size={9} /> Call / Dial
                      </a>
                      <a
                        href={`https://wa.me/91${form.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs"
                        title="Open WhatsApp"
                      >
                        <MessageCircle size={9} /> WA
                      </a>
                    </div>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 font-semibold ${
                      form.phone && form.phone.trim().length >= 5 ? 'pr-16' : ''
                    }`}
                  />
                  {form.phone && form.phone.trim().length >= 5 && (
                    <div className="absolute right-1 flex items-center gap-1">
                      <a
                        href={`tel:${form.phone}`}
                        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-2xs"
                        title="Direct Call / Dial from Phone"
                      >
                        <PhoneCall size={11} />
                      </a>
                      <a
                        href={`https://wa.me/91${form.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs"
                        title="Open WhatsApp"
                      >
                        <MessageCircle size={11} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[11px] font-bold text-slate-600">Alternative No. / WhatsApp</label>
                  <span className="text-[9px] text-slate-400 font-semibold">(Optional)</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="tel"
                    placeholder="Optional - Jo banda dega wo dalein"
                    value={form.secondaryPhone}
                    onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 ${
                      form.secondaryPhone && form.secondaryPhone.trim().length >= 5 ? 'pr-16' : ''
                    }`}
                  />
                  {form.secondaryPhone && form.secondaryPhone.trim().length >= 5 && (
                    <div className="absolute right-1 flex items-center gap-1">
                      <a
                        href={`tel:${form.secondaryPhone}`}
                        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-2xs"
                        title="Direct Call / Dial from Phone"
                      >
                        <PhoneCall size={11} />
                      </a>
                      <a
                        href={`https://wa.me/91${form.secondaryPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs"
                        title="Open WhatsApp"
                      >
                        <MessageCircle size={11} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* State, City, Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                State *
              </label>
              <input
                type="text"
                required
                placeholder="Madhya Pradesh"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                City *
              </label>
              <input
                type="text"
                required
                placeholder="Guna"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Area / Street
              </label>
              <input
                type="text"
                placeholder="Near Station / Market"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Current Software & Competitor Status */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2.5">
            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
              <Layers size={12} className="text-indigo-600" />
              <span>Current Library Management (Competitor Tracking)</span>
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {CURRENT_SOFTWARE_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm({ ...form, currentSoftwareType: c.id })}
                  className={`p-2 rounded-lg text-xs font-bold border transition text-left ${
                    form.currentSoftwareType === c.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {form.currentSoftwareType === 'Competitor Software' && (
              <div className="p-2.5 bg-white border border-indigo-200 rounded-lg space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Competitor Name (e.g. Librex, Reader...)"
                    value={form.competitorName}
                    onChange={(e) => setForm({ ...form, competitorName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold outline-none"
                  />
                  <input
                    type="date"
                    value={form.competitorExpiryDate}
                    onChange={(e) => setForm({ ...form, competitorExpiryDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold outline-none"
                    title="Current subscription expiry date"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-bold">Expiry?</span>
                  {[
                    { label: '15 Din', months: 0.5 },
                    { label: '1 Month', months: 1 },
                    { label: '2 Months', months: 2 },
                    { label: '3 Months', months: 3 },
                    { label: '6 Months', months: 6 },
                  ].map((dur) => (
                    <button
                      key={dur.label}
                      type="button"
                      onClick={() => setCompetitorPreset(dur.months, dur.label)}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer"
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Discussion Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Meeting Discussion Notes *
            </label>
            <textarea
              rows={2}
              required
              placeholder="What was discussed? Owner's reaction, software requirement, demo response..."
              value={form.discussionNotes}
              onChange={(e) => setForm({ ...form, discussionNotes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          {/* Re-Visit & Reminder Section */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
            <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1">
              <BellRing size={12} className="text-amber-600" />
              <span>Re-Visit & Follow-Up Reminder</span>
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Follow-up Date</label>
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Time Slot</label>
                <input
                  type="time"
                  value={form.followUpTime}
                  onChange={(e) => setForm({ ...form, followUpTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-bold outline-none"
                />
              </div>
            </div>

            <input
              type="text"
              placeholder="Re-visit / Reminder Note: e.g. Kal owner milenge, 30 min me aao..."
              value={form.reminderNote}
              onChange={(e) => setForm({ ...form, reminderNote: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 outline-none focus:border-amber-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Lead Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 cursor-pointer font-bold"
              >
                <option value="Interested">Interested (Good Lead)</option>
                <option value="Demo Given">Software Demo Given</option>
                <option value="Follow Up">Follow Up Scheduled</option>
                <option value="Deal Closed">🎉 Deal Closed / Won</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={form.demoGiven}
                  onChange={(e) => setForm({ ...form, demoGiven: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  💻 Live Demo Given
                </span>
              </label>
            </div>
          </div>

          {/* Visit Times & Ground Duration */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Clock size={12} className="text-blue-600" />
                <span>Visit Duration & On-Site Presence</span>
              </span>
              <span className="text-xs font-black text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                ⏱️ {form.durationMinutes || 20} min on site
              </span>
            </div>

            {/* Quick Duration Preset Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 font-bold">Quick Select:</span>
              {[15, 30, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    const newOut = calculateCheckoutTime(form.checkInTime, mins);
                    setForm({ ...form, durationMinutes: mins, checkOutTime: newOut });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                    Number(form.durationMinutes) === mins
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-600 text-[10px] uppercase">Arrival (Check-in)</label>
                  <button
                    type="button"
                    onClick={() => {
                      const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                      const newOut = calculateCheckoutTime(nowStr, form.durationMinutes || 20);
                      setForm({ ...form, checkInTime: nowStr, checkOutTime: newOut });
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Set Now
                  </button>
                </div>
                <input
                  type="text"
                  value={form.checkInTime}
                  onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                  placeholder="e.g. 11:30 AM"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-600 text-[10px] uppercase">Departure (Check-out)</label>
                  <button
                    type="button"
                    onClick={() => {
                      const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                      setForm({ ...form, checkOutTime: nowStr });
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Set Now
                  </button>
                </div>
                <input
                  type="text"
                  value={form.checkOutTime}
                  onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                  placeholder="e.g. 12:00 PM"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowVisitModal(false);
                setRevisitTarget(null);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addVisitMutation.isPending || editVisitMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition"
            >
              <Check size={14} />
              <span>
                {addVisitMutation.isPending || editVisitMutation.isPending
                  ? 'Saving...'
                  : revisitTarget
                  ? 'Update Record with New Re-Visit'
                  : 'Save Visit Record'}
              </span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

