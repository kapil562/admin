import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAttendanceLogs,
  getCurrentGPSLocation,
  getFieldVisits,
} from '../firebase/services/marketingService';
import { getStaffUsers } from '../firebase/services/staffService';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import {
  CalendarCheck,
  Clock,
  MapPin,
  CheckCircle2,
  ExternalLink,
  User,
  Calendar,
  LogIn,
  LogOut,
  Timer,
  Users,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Car,
  Camera,
  Crown,
  Eye,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  buildStaffDailyTimeline,
  evaluateVisitAuthenticity,
  formatDurationMinutes,
  getVisitDurationMinutes,
} from '../services/visitAuditHelper';

export const StaffAttendance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('boss_eye'); // 'boss_eye' | 'timesheet'
  const [trackerDate, setTrackerDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'owner';

  // 1. Fetch Attendance Logs
  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['admin_attendance_logs'],
    queryFn: getAttendanceLogs,
  });

  // 2. Fetch Staff Users
  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
  });

  // 3. Fetch Field Visits
  const { data: visits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  // Check today's status for current logged-in user
  const todayStr = new Date().toISOString().split('T')[0];
  const myId = user?.uid || user?.id;
  const myName = (user?.displayName || user?.name || '').toLowerCase();

  const myTodayLog = logs.find(
    (l) => (l.staffId === myId || (l.staffName && l.staffName.toLowerCase() === myName)) && l.date === todayStr
  );

  const totalPresentToday = logs.filter((l) => l.date === todayStr).length;

  // ── Unified Staff & Admin List ─────────────────────────────────────────────
  const allStaffAndAdmins = useMemo(() => {
    const map = new Map();

    // 1. Current user if admin/owner
    if (user && (user.role === 'super_admin' || user.role === 'owner')) {
      const uId = user.uid || user.id || 'admin_current';
      map.set(uId, {
        id: uId,
        name: user.displayName || user.name || 'Owner / Administrator',
        role: user.role || 'super_admin',
        roleLabel: '👑 Business Owner / Super Admin',
        isAdmin: true,
      });
    }

    // 2. Registered staff users
    staffList.forEach((s) => {
      const isAdm = s.role === 'super_admin' || s.role === 'owner';
      map.set(s.id, {
        id: s.id,
        name: s.name,
        role: s.role,
        roleLabel: s.roleLabel || (isAdm ? '👑 Administrator / Owner' : 'Field Rep'),
        isAdmin: isAdm,
      });
    });

    // 3. Any staff found in visits or attendance logs
    visits.forEach((v) => {
      if (v.staffId && !map.has(v.staffId)) {
        const isAdm = (v.staffName || '').toLowerCase().includes('admin') || (v.staffName || '').toLowerCase().includes('owner');
        map.set(v.staffId, {
          id: v.staffId,
          name: v.staffName || 'Staff Member',
          role: isAdm ? 'owner' : 'marketing',
          roleLabel: isAdm ? '👑 Administrator' : 'Field Rep',
          isAdmin: isAdm,
        });
      }
    });

    logs.forEach((l) => {
      if (l.staffId && !map.has(l.staffId)) {
        map.set(l.staffId, {
          id: l.staffId,
          name: l.staffName || 'Staff Member',
          role: 'marketing',
          roleLabel: 'Field Rep',
          isAdmin: false,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [staffList, visits, logs, user]);

  // ── Filter logs for Tab 2 (Timesheet) ──────────────────────────────────────
  const visibleLogs = useMemo(() => {
    if (isSuperAdmin) {
      if (selectedStaffFilter === 'All') return logs;
      return logs.filter((l) => {
        const staffObj = staffList.find((s) => s.id === selectedStaffFilter);
        return (
          l.staffId === selectedStaffFilter ||
          (staffObj && l.staffName?.toLowerCase() === staffObj.name?.toLowerCase()) ||
          l.staffName?.toLowerCase() === selectedStaffFilter.toLowerCase()
        );
      });
    }
    return logs.filter(
      (l) => l.staffId === myId || (l.staffName && l.staffName.toLowerCase() === myName)
    );
  }, [logs, isSuperAdmin, selectedStaffFilter, myId, myName, staffList]);

  // ── Boss Eye Tracker: Daily Movement & Authenticity Engine ────────────────
  const bossTrackerData = useMemo(() => {
    let targetStaffList = allStaffAndAdmins;

    if (!isSuperAdmin) {
      // Regular staff only sees their own day trail
      targetStaffList = allStaffAndAdmins.filter(
        (s) => s.id === myId || s.name.toLowerCase() === myName
      );
      if (targetStaffList.length === 0) {
        targetStaffList = [
          {
            id: myId || 'staff',
            name: user?.displayName || user?.name || 'Staff Member',
            role: 'marketing',
            isAdmin: false,
          },
        ];
      }
    } else if (selectedStaffFilter !== 'All') {
      targetStaffList = allStaffAndAdmins.filter((s) => s.id === selectedStaffFilter);
    }

    const staffTimelines = targetStaffList.map((s) =>
      buildStaffDailyTimeline(s.id, s.name, trackerDate, visits, logs)
    );

    const totalVisitsOnDate = staffTimelines.reduce((sum, t) => sum + t.totalVisits, 0);
    const totalGroundMinsOnDate = staffTimelines.reduce((sum, t) => sum + t.totalGroundMins, 0);
    const totalVerifiedOnDate = staffTimelines.reduce((sum, t) => sum + t.verifiedCount, 0);
    const totalMissingGpsOnDate = staffTimelines.reduce((sum, t) => sum + t.missingGpsCount, 0);
    const totalMissingPhotoOnDate = staffTimelines.reduce((sum, t) => sum + t.missingPhotoCount, 0);
    const totalRapidOnDate = staffTimelines.reduce((sum, t) => sum + t.rapidVisitsCount, 0);

    const overallTrustScore = totalVisitsOnDate > 0
      ? Math.round((totalVerifiedOnDate / totalVisitsOnDate) * 100)
      : 100;

    return {
      timelines: staffTimelines,
      totalVisits: totalVisitsOnDate,
      totalGroundMins: totalGroundMinsOnDate,
      totalGroundFormatted: formatDurationMinutes(totalGroundMinsOnDate),
      overallTrustScore,
      missingGpsCount: totalMissingGpsOnDate,
      missingPhotoCount: totalMissingPhotoOnDate,
      rapidVisitsCount: totalRapidOnDate,
      activeStaffCount: staffTimelines.filter((t) => t.hasActivity).length,
    };
  }, [allStaffAndAdmins, trackerDate, visits, logs, selectedStaffFilter, isSuperAdmin, myId, myName, user]);

  const handleDateOffset = (offset) => {
    const cur = new Date(trackerDate);
    cur.setDate(cur.getDate() + offset);
    setTrackerDate(cur.toISOString().split('T')[0]);
  };

  const isLoading = loadingLogs || loadingStaff || loadingVisits;

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading staff duty, hours, and ground tracking..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isSuperAdmin ? 'Staff Duty, Hours & Ground Tracking (Boss Eye)' : 'My Duty, Working Hours & Activity'}
        subtitle={
          isSuperAdmin
            ? 'Monitor arrival time, client ground duration, transit gaps, on-site GPS verification, and daily work timesheets.'
            : `Personal Duty Logs (${user?.displayName || 'Staff'}): Track your punch in/out, working hours, and completed library visits.`
        }
      />


      {/* ═══ VIEW TABS: Boss Eye vs Timesheet Logs ═══ */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('boss_eye')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === 'boss_eye'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck size={16} />
          <span>🕵️ Boss Eye: Staff Day Movement & Ground Tracking</span>
        </button>

        <button
          onClick={() => setActiveTab('timesheet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === 'timesheet'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CalendarCheck size={16} />
          <span>📋 Daily Punch Attendance Timesheet</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: BOSS EYE MOVEMENT & GROUND TRACKING                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'boss_eye' && (
        <div className="space-y-6">
          {/* Controls Bar: Date Switcher & Staff Filter */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500">Tracking Date:</span>
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  onClick={() => handleDateOffset(-1)}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-900 rounded-lg font-bold text-xs hover:bg-white transition cursor-pointer flex items-center gap-1"
                  title="Previous Day"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                <button
                  onClick={() => setTrackerDate(new Date().toISOString().split('T')[0])}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                    trackerDate === todayStr ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => handleDateOffset(1)}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-900 rounded-lg font-bold text-xs hover:bg-white transition cursor-pointer flex items-center gap-1"
                  title="Next Day"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              <input
                type="date"
                value={trackerDate}
                onChange={(e) => setTrackerDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
              />

              {trackerDate === todayStr && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live Today
                </span>
              )}
            </div>

            {/* Staff Filter (Super Admin only) */}
            {isSuperAdmin && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter Staff:</span>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer w-full md:w-auto"
                >
                  <option value="All">All Staff Members & Admins ({allStaffAndAdmins.length})</option>
                  {allStaffAndAdmins.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.isAdmin ? '👑 ' : ''}{s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Boss Top Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Boss Authenticity Score"
              value={`${bossTrackerData.overallTrustScore}%`}
              subtitle={`${bossTrackerData.totalVisits} visits checked on ${trackerDate}`}
              icon={ShieldCheck}
              color={bossTrackerData.overallTrustScore >= 80 ? 'emerald' : bossTrackerData.overallTrustScore >= 50 ? 'amber' : 'rose'}
            />
            <StatCard
              title="Ground Time with Clients"
              value={bossTrackerData.totalGroundFormatted}
              subtitle="Total minutes spent inside libraries"
              icon={Clock}
              color="blue"
            />
            <StatCard
              title="Libraries Visited"
              value={bossTrackerData.totalVisits}
              subtitle={`Logged across ${bossTrackerData.activeStaffCount} active staff`}
              icon={Building2}
              color="indigo"
            />
            <StatCard
              title="Risk & Fraud Alerts"
              value={bossTrackerData.missingGpsCount + bossTrackerData.missingPhotoCount + bossTrackerData.rapidVisitsCount}
              subtitle={`${bossTrackerData.missingGpsCount} no GPS • ${bossTrackerData.missingPhotoCount} no photo • ${bossTrackerData.rapidVisitsCount} <5m`}
              icon={AlertTriangle}
              color={bossTrackerData.missingGpsCount > 0 ? 'rose' : 'neutral'}
            />
          </div>

          {/* Staff Daily Movement Trail & Activity Cards */}
          <div className="space-y-6">
            {bossTrackerData.timelines.map((timeline) => {
              const staffObj = allStaffAndAdmins.find((s) => s.id === timeline.staffId);
              const isOwnerOrAdmin = staffObj?.isAdmin || staffObj?.role === 'owner';

              return (
                <div
                  key={timeline.staffId}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
                >
                  {/* Staff Day Header */}
                  <div
                    className={`p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isOwnerOrAdmin ? 'bg-amber-50/40 border-amber-200/80' : 'bg-slate-50/70 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 shadow-xs ${
                          isOwnerOrAdmin
                            ? 'bg-gradient-to-tr from-amber-600 to-yellow-500 text-white border border-amber-300'
                            : 'bg-gradient-to-tr from-slate-900 to-blue-700 text-white'
                        }`}
                      >
                        {isOwnerOrAdmin ? <Crown size={18} /> : (timeline.staffName || 'S').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-slate-900 text-base">{timeline.staffName}</h4>
                          {isOwnerOrAdmin && (
                            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">
                              👑 Business Owner / Admin
                            </span>
                          )}
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                            {timeline.liveStatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Tracking Date: <span className="font-bold text-slate-700">{timeline.date}</span>
                          {timeline.attLog?.punchIn && (
                            <span className="ml-2 font-medium text-blue-700">
                              • Shift In: {timeline.attLog.punchIn.time}
                              {timeline.attLog.punchOut ? ` | Out: ${timeline.attLog.punchOut.time}` : ' (Ongoing)'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                      <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Shift Hours</span>
                        <span className="text-xs font-black text-slate-800">
                          {timeline.attLog?.totalHours || (timeline.attLog?.punchIn ? 'In Progress' : 'No Punch')}
                        </span>
                      </div>
                      <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Ground Time</span>
                        <span className="text-xs font-black text-blue-600">
                          {formatDurationMinutes(timeline.totalGroundMins)}
                        </span>
                      </div>
                      <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Libraries</span>
                        <span className="text-xs font-black text-slate-800">
                          {timeline.totalVisits}
                        </span>
                      </div>
                      <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Trust Score</span>
                        <span
                          className={`text-xs font-black ${
                            timeline.trustScore >= 80
                              ? 'text-emerald-700'
                              : timeline.trustScore >= 50
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {timeline.trustScore}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chronological Timeline Trail */}
                  <div className="p-5 sm:p-6">
                    {timeline.timelineItems.length > 0 ? (
                      <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                        {timeline.timelineItems.map((item) => {
                          if (item.type === 'punch_in') {
                            return (
                              <div key={item.id} className="relative group">
                                <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-white shadow-xs">
                                  <LogIn size={12} />
                                </div>
                                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                                      Duty Shift Started
                                    </span>
                                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">
                                      Punch-In at {item.time}
                                    </h5>
                                  </div>
                                  {item.location && (
                                    <a
                                      href={item.location.mapsUrl || `https://www.google.com/maps?q=${item.location.latitude},${item.location.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100/60 px-2.5 py-1 rounded-lg transition"
                                    >
                                      <MapPin size={11} />
                                      <span>GPS Locked (±{item.location.accuracy || 15}m)</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (item.type === 'gap') {
                            return (
                              <div key={item.id} className="relative py-1">
                                <div className="absolute -left-6 sm:-left-8 top-2.5 w-6 h-6 rounded-full bg-slate-100 text-slate-500 border border-slate-300 flex items-center justify-center ring-4 ring-white">
                                  <Car size={11} />
                                </div>
                                <div
                                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border inline-flex items-center gap-2 ${
                                    item.isLongGap
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  <span>{item.title}</span>
                                  {item.isLongGap && (
                                    <span className="text-[10px] font-bold bg-amber-200/80 px-1.5 py-0.2 rounded">
                                      Check on staff
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (item.type === 'visit') {
                            const v = item.visit;
                            return (
                              <div key={item.id} className="relative group">
                                <div className="absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center ring-4 ring-white shadow-xs">
                                  <Building2 size={12} />
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-blue-300 transition space-y-3">
                                  {/* Visit Header: Times & Authenticity Badge */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* PRIMARY: Exact Real Time Staff Made The Entry (Untamperable System Timestamp) */}
                                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl shadow-xs" title="Untamperable exact time when the staff submitted this entry to the system">
                                        <Clock size={14} className="text-blue-200" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Entry Made At:</span>
                                        <span className="text-xs font-black tracking-tight">
                                          {item.entryReceived?.time || (v.createdAt ? formatDisplayTime(v.createdAt) : 'Live')}
                                        </span>
                                        <span className="text-[10px] text-blue-200 font-medium">
                                          ({item.entryReceived?.date || 'Today'})
                                        </span>
                                      </div>

                                      {/* Duration on site */}
                                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        ⏱️ {formatDurationMinutes(item.durationMins)} on site
                                      </span>

                                      {/* If staff typed a manual visit time that differs from actual entry time */}
                                      {(() => {
                                        const sync = item.syncStatus;
                                        if (sync && !sync.isLive) {
                                          return (
                                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300" title="Manual check-in time typed by staff differs from actual entry submission time">
                                              ⚠️ Manual Claimed Time: {item.startTime} ({sync.label})
                                            </span>
                                          );
                                        }
                                        return (
                                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            ⚡ Live Real-Time Submission
                                          </span>
                                        );
                                      })()}

                                      {item.isRapid && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                          ⚠️ Rapid (&lt;5m)
                                        </span>
                                      )}
                                    </div>

                                    {/* Boss Authenticity Badge */}
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${item.auth.badgeClass}`}
                                    >
                                      {item.auth.level === 'verified' && <ShieldCheck size={13} className="text-emerald-600" />}
                                      {item.auth.level === 'distance_alert' && <AlertTriangle size={13} className="text-rose-600" />}
                                      {item.auth.level === 'gps_only' && <MapPin size={13} className="text-blue-600" />}
                                      {item.auth.level === 'photo_only' && <Camera size={13} className="text-amber-600" />}
                                      <span>{item.auth.statusText}</span>
                                    </span>
                                  </div>

                                  {/* Place & Owner Details */}
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div>
                                      <h5 className="font-extrabold text-slate-900 text-sm">
                                        {v.businessName || 'Unnamed Library'}
                                      </h5>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        Owner: <strong className="text-slate-700">{v.ownerName || 'N/A'}</strong>
                                        {v.phone && <span className="ml-1 text-slate-600">({v.phone})</span>}
                                        {v.city && <span className="ml-1 text-slate-400">• {v.city}</span>}
                                      </p>
                                      {v.discussionNotes && (
                                        <p className="text-xs text-slate-600 mt-1 italic line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                          "{v.discussionNotes}"
                                        </p>
                                      )}
                                    </div>

                                    {/* Photo Thumbnail if available */}
                                    {v.photoUrl && (
                                      <div className="shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewPhotoUrl(v.photoUrl)}
                                          className="relative group/pic rounded-xl overflow-hidden border border-slate-200 block shadow-xs"
                                        >
                                          <img
                                            src={v.photoUrl}
                                            alt={v.businessName}
                                            className="w-20 h-16 object-cover group-hover/pic:scale-105 transition"
                                          />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/pic:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                                            <Eye size={12} className="mr-0.5" /> View
                                          </div>
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Ground Verification Proof Line */}
                                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 flex-wrap gap-2">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      {v.location ? (
                                        <a
                                          href={v.location.mapsUrl || `https://www.google.com/maps?q=${v.location.latitude},${v.location.longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 text-[11px]"
                                        >
                                          <MapPin size={11} />
                                          <span>Staff GPS (±{v.location.accuracy || 15}m)</span>
                                          <ExternalLink size={9} />
                                        </a>
                                      ) : (
                                        <span className="text-rose-600 font-bold text-[11px]">
                                          ❌ No Device GPS Recorded
                                        </span>
                                      )}

                                      {item.auth.distanceToPlace != null && (
                                        <span
                                          className={`text-[11px] font-bold ${
                                            item.auth.level === 'distance_alert' ? 'text-rose-700 font-black' : 'text-slate-600'
                                          }`}
                                        >
                                          📍 {item.auth.distanceToPlace}m from library
                                        </span>
                                      )}
                                    </div>

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
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          if (item.type === 'punch_out') {
                            return (
                              <div key={item.id} className="relative group">
                                <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center ring-4 ring-white shadow-xs">
                                  <LogOut size={12} />
                                </div>
                                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                                      Duty Shift Concluded
                                    </span>
                                    <h5 className="font-bold text-slate-800 text-xs sm:text-sm">
                                      Punch-Out at {item.time} • Total Duty: {item.totalHours || 'Recorded'}
                                    </h5>
                                  </div>
                                  {item.location && (
                                    <a
                                      href={item.location.mapsUrl || `https://www.google.com/maps?q=${item.location.latitude},${item.location.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition"
                                    >
                                      <MapPin size={11} />
                                      <span>Departure GPS</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <CalendarCheck size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-600">No duty punches or visits recorded on {timeline.date}.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Staff has not logged shift activity for this date yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: PUNCH ATTENDANCE TIMESHEET TABLE                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'timesheet' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isSuperAdmin ? 'Daily Punch Attendance & Work Duration Logs' : 'My Attendance & Work Duration'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {isSuperAdmin ? 'View team daily hours and GPS coordinates' : 'Your personal duty timeline'}
              </p>
            </div>

            {/* Admin Staff Selector */}
            {isSuperAdmin && staffList.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Users size={16} className="text-slate-400 shrink-0" />
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="All">All Staff Members ({logs.length} logs)</option>
                  {staffList.map((s) => {
                    const sCount = logs.filter(
                      (l) => l.staffId === s.id || l.staffName?.toLowerCase() === s.name.toLowerCase()
                    ).length;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({sCount} logs)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Staff Name</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Punch-In (Start)</th>
                  <th className="px-5 py-3.5">Punch-Out (End)</th>
                  <th className="px-5 py-3.5">Total Duration</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {visibleLogs.length > 0 ? (
                  visibleLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">
                            {log.staffName?.substring(0, 2).toUpperCase() || 'ST'}
                          </div>
                          <span className="font-bold text-slate-900">{log.staffName}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                        {log.date}
                      </td>

                      {/* Punch In */}
                      <td className="px-5 py-4 text-xs whitespace-nowrap">
                        <div className="font-bold text-slate-800">{log.punchIn?.time || '-'}</div>
                        {log.punchIn?.location && (
                          <a
                            href={log.punchIn.location.mapsUrl || `https://www.google.com/maps?q=${log.punchIn.location.latitude},${log.punchIn.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold hover:underline mt-0.5"
                          >
                            <MapPin size={10} />
                            <span>View GPS Location</span>
                          </a>
                        )}
                      </td>

                      {/* Punch Out */}
                      <td className="px-5 py-4 text-xs whitespace-nowrap">
                        <div className="font-bold text-slate-800">{log.punchOut?.time || '-'}</div>
                        {log.punchOut?.location && (
                          <a
                            href={log.punchOut.location.mapsUrl || `https://www.google.com/maps?q=${log.punchOut.location.latitude},${log.punchOut.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold hover:underline mt-0.5"
                          >
                            <MapPin size={10} />
                            <span>View GPS Location</span>
                          </a>
                        )}
                      </td>

                      {/* Total Duration */}
                      <td className="px-5 py-4 font-extrabold text-slate-800 text-xs whitespace-nowrap">
                        {log.totalHours || '-'}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <Badge variant={log.punchOut ? 'success' : 'warning'} dot>
                          {log.punchOut ? 'Shift Done' : 'On Duty'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8">
                      <EmptyState
                        icon={CalendarCheck}
                        title="No attendance records found"
                        description="Staff members can click 'Punch-In Duty' to log their daily presence with GPS location."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Full Photo Preview Modal ═══ */}
      {previewPhotoUrl && (
        <Modal
          isOpen={!!previewPhotoUrl}
          onClose={() => setPreviewPhotoUrl(null)}
          title="On-Site Ground Photo Proof"
          subtitle="Verified capture uploaded from client premises"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
              <img
                src={previewPhotoUrl}
                alt="On-Site Proof"
                className="w-full max-h-[70vh] object-contain mx-auto"
              />
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
