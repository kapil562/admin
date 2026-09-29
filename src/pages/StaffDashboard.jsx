import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getFieldVisits, logFieldVisit, getCurrentGPSLocation, getAttendanceLogs, punchAttendance, updateVisitStatus } from '../firebase/services/marketingService';
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
  BellRing
} from 'lucide-react';
import toast from 'react-hot-toast';

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

  const [punching, setPunching] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsData, setGpsData] = useState(null);
  const [statusDropdownId, setStatusDropdownId] = useState(null);

  // Form State for logging visit
  const [form, setForm] = useState(initialStaffVisitForm);

  // 1. Fetch Staff info for compensation details
  const { data: staffList = [] } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
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

  // 5. Punch Mutation
  const punchMutation = useMutation({
    mutationFn: punchAttendance,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin_attendance_logs'] });
      toast.success(variables.type === 'in' ? 'Duty Started with GPS!' : 'Duty Ended with GPS!');
    },
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

  // 7. Update Visit Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: updateVisitStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Status updated successfully');
    },
  });

  const resetVisitForm = (prefill = null) => {
    if (prefill) {
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
        placeId: prefill.placeId || '',
        placeName: prefill.placeName || '',
        placeAddress: prefill.placeAddress || '',
      });
    } else {
      setForm({
        ...initialStaffVisitForm,
        clientType: activeVerticals.length === 1 ? activeVerticals[0].shortName : 'Library',
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

  const handlePunch = async (type) => {
    setPunching(true);
    let location = null;
    try {
      location = await getCurrentGPSLocation();
    } catch (e) {}

    punchMutation.mutate({
      staffId: myId,
      staffName: user?.displayName || user?.name,
      type,
      location,
    });
    setPunching(false);
  };

  const handleVisitSubmit = (e) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      toast.error('Please enter the client / business name');
      return;
    }

    addVisitMutation.mutate({
      ...form,
      staffId: myId,
      staffName: user?.displayName || user?.name,
      location: gpsData,
    });
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

  const todayStr = new Date().toISOString().split('T')[0];
  const myTodayLog = attendanceLogs.find(
    (l) => (l.staffId === myId || (l.staffName && l.staffName.toLowerCase() === myName)) && l.date === todayStr
  );

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

  if (loadingVisits || loadingAtt) {
    return <LoadingSpinner fullScreen label="Loading your staff workspace..." />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-blue-200">
              {user?.roleLabel || 'Field Marketing Executive'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Hello, {user?.displayName || 'Team Member'}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Track your field visits, record on-site GPS verification, and watch your deal commissions grow in real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick GPS Duty Punch */}
            {!myTodayLog ? (
              <button
                onClick={() => handlePunch('in')}
                disabled={punching}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn size={16} />
                <span>{punching ? 'Locating...' : 'Punch-In Duty'}</span>
              </button>
            ) : !myTodayLog.punchOut ? (
              <button
                onClick={() => handlePunch('out')}
                disabled={punching}
                className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogOut size={16} />
                <span>{punching ? 'Locating...' : 'Punch-Out Duty'}</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 bg-white/10 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Duty Done
              </span>
            )}

            {/* Log Visit Button */}
            <button
              onClick={() => openVisitModal()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/25 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>Log Client Visit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Today's Follow-up Alert Banner */}
      {dueFollowups.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-sm">
                📞 You have {dueFollowups.length} follow-up callbacks due ({overdueFollowups.length} overdue)
              </h3>
              <p className="text-xs text-amber-700">Please reach out to these clients today.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dueFollowups.map((f) => (
              <div key={f.id} className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-800 text-sm truncate">{f.businessName}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${f.followUpDate < todayStr ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                      {f.followUpDate} {f.followUpTime ? `@ ${f.followUpTime}` : ''}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 font-medium flex items-center justify-between">
                    <span>{f.ownerName}</span>
                    {f.personMet && <span className="text-[10px] text-slate-400">({f.personMet})</span>}
                  </div>

                  {f.nextActionItem && (
                    <div className="mt-2 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                      🎯 {f.nextActionItem}
                    </div>
                  )}

                  {f.reminderNote && (
                    <p className="text-[10px] text-slate-600 mt-1 italic">
                      📝 {f.reminderNote}
                    </p>
                  )}

                  {f.phone && (
                    <div className="flex items-center gap-2 mt-2">
                      <a href={`tel:${f.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
                        <PhoneCall size={12} /> Call
                      </a>
                      <a href={`https://wa.me/91${f.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition">
                        <MessageCircle size={12} /> WhatsApp
                      </a>
                    </div>
                  )}

                  {f.discussionNotes && (
                    <p className="text-[11px] text-slate-500 mt-3 line-clamp-2 italic border-l-2 border-amber-200 pl-2">
                      "{f.discussionNotes.substring(0, 80)}{f.discussionNotes.length > 80 ? '...' : ''}"
                    </p>
                  )}
                </div>
                <button
                  onClick={() => openVisitModal(f)}
                  className="mt-4 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MapPin size={14} /> Log Follow-up Visit (Nayi Entry)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Salary & Earnings Wallet Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title="Monthly Target"
          value={`${payroll.dealsClosed} / ${payroll.targetDeals}`}
          subtitle={`${payroll.targetAchievement}% of Target Reached`}
          icon={Navigation}
          color="amber"
        />
      </div>

      {/* Target Progress Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800">Monthly Target Achievement</span>
          <span className="font-extrabold text-blue-600">{payroll.targetAchievement}%</span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${payroll.targetAchievement}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>{payroll.totalVisits} Field Visits Completed</span>
          <span>{payroll.targetDeals - payroll.dealsClosed > 0 ? `${payroll.targetDeals - payroll.dealsClosed} more deals to target` : 'Target Achieved! 🎯'}</span>
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
                          <div className="flex items-center gap-1.5 mt-0.5">
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
                        {v.location ? (
                          <a
                            href={v.location.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"
                          >
                            <MapPin size={11} />
                            <span>Verified GPS</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
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
                        <a href={`tel:${f.phone}`} className="text-blue-600 hover:text-blue-800" title="Call">
                          <PhoneCall size={12} />
                        </a>
                        <a href={`https://wa.me/91${f.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-800" title="WhatsApp">
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
        onClose={() => setShowVisitModal(false)}
        title="Log On-Site Client Visit"
        subtitle="Capture GPS, photo proof, competitor expiry, and smart follow-up schedule"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleVisitSubmit} className="space-y-4">
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
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Total Seats
              </label>
              <select
                value={form.seatCapacity}
                onChange={(e) => setForm({ ...form, seatCapacity: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 font-semibold"
              >
                <option value="">-- Seats --</option>
                {SEAT_CAPACITY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Mobile Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 font-semibold"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[11px] font-bold text-slate-600">Alternative No. / WhatsApp</label>
                  <span className="text-[9px] text-slate-400 font-semibold">(Optional)</span>
                </div>
                <input
                  type="tel"
                  placeholder="Optional - Jo banda dega wo dalein"
                  value={form.secondaryPhone}
                  onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* State, City, Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                State (राज्य) *
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
                City (शहर) *
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
              <span>Abhi Kaise Manage Ho Rahi Hai? (Competitor Tracking)</span>
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
                  <span className="text-[10px] text-slate-500 font-bold">Kab Khatam?</span>
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
              placeholder="Kya baat hui? Owner ka reaction, software requirement, demo response..."
              value={form.discussionNotes}
              onChange={(e) => setForm({ ...form, discussionNotes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          {/* Re-Visit & Reminder Section */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
            <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1">
              <BellRing size={12} className="text-amber-600" />
              <span>Re-Visit & Follow-Up (Kab Milna Hai / Kya Kaam Hai)</span>
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowVisitModal(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addVisitMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>{addVisitMutation.isPending ? 'Saving...' : 'Save Visit Record'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

