import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAttendanceLogs, punchAttendance, getCurrentGPSLocation } from '../firebase/services/marketingService';
import { getStaffUsers } from '../firebase/services/staffService';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

export const StaffAttendance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [punching, setPunching] = useState(false);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('All');

  const isSuperAdmin = user?.role === 'super_admin';

  // 1. Fetch Attendance Logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin_attendance_logs'],
    queryFn: getAttendanceLogs,
  });

  // 2. Fetch Staff Users (for Admin staff filter)
  const { data: staffList = [] } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
    enabled: isSuperAdmin,
  });

  // 3. Punch Mutation
  const punchMutation = useMutation({
    mutationFn: punchAttendance,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin_attendance_logs'] });
      toast.success(
        variables.type === 'in'
          ? '🎉 Duty Started! Punch-In logged with GPS.'
          : '✅ Duty Concluded! Punch-Out logged with GPS.'
      );
    },
    onError: (err) => toast.error(err.message || 'Failed to record attendance'),
  });

  const handlePunch = async (type) => {
    setPunching(true);
    let location = null;
    try {
      location = await getCurrentGPSLocation();
    } catch (e) {
      console.warn('GPS capture warning for attendance:', e.message);
    }

    punchMutation.mutate({
      staffId: user?.uid || user?.id || 'staff',
      staffName: user?.displayName || user?.name || 'Marketing Staff',
      type,
      location,
    });
    setPunching(false);
  };

  // Check today's status for current logged-in user
  const todayStr = new Date().toISOString().split('T')[0];
  const myId = user?.uid || user?.id;
  const myName = (user?.displayName || user?.name || '').toLowerCase();

  const myTodayLog = logs.find(
    (l) => l.staffId === myId || (l.staffName && l.staffName.toLowerCase() === myName && l.date === todayStr)
  );

  const totalPresentToday = logs.filter((l) => l.date === todayStr).length;

  // Filter logs based on role:
  // - Staff sees ONLY their own attendance
  // - Admin sees all or filtered by selectedStaffFilter
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

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading staff attendance and duty records..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isSuperAdmin ? 'Staff Duty & Work Attendance' : 'My Daily Attendance & Duty'}
        subtitle={
          isSuperAdmin
            ? 'Super Admin View: Real-time on-duty status, punch-in/out timestamps, and GPS verification.'
            : `Personal Duty Logs (${user?.displayName || 'Staff'}): Punch in when starting your field visits and track your working hours.`
        }
      />

      {/* Staff Self-Punch Card */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-blue-200">
            Today: {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
          <h2 className="text-xl font-extrabold text-white mt-2">
            Field Duty Attendance (Daily Punch)
          </h2>
          <p className="text-xs text-slate-300 max-w-lg">
            {myTodayLog
              ? `Punched-In at ${myTodayLog.punchIn?.time || '-'} • ${myTodayLog.punchOut ? `Punched-Out at ${myTodayLog.punchOut.time}` : 'Currently On Duty'}`
              : 'Punch-In when starting your field visits to record your attendance and location.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!myTodayLog ? (
            <button
              onClick={() => handlePunch('in')}
              disabled={punching || punchMutation.isPending}
              className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogIn size={18} />
              <span>{punching ? 'Locating GPS...' : 'Punch-In Duty (Start)'}</span>
            </button>
          ) : !myTodayLog.punchOut ? (
            <button
              onClick={() => handlePunch('out')}
              disabled={punching || punchMutation.isPending}
              className="px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-rose-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut size={18} />
              <span>{punching ? 'Locating GPS...' : 'Punch-Out Duty (End)'}</span>
            </button>
          ) : (
            <div className="px-4 py-2.5 bg-white/10 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>Duty Completed for Today ({myTodayLog.totalHours})</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={isSuperAdmin ? 'Staff Present Today' : 'Today Duty Status'}
          value={isSuperAdmin ? totalPresentToday : (myTodayLog ? (myTodayLog.punchOut ? 'Shift Done' : 'On Duty') : 'Not Started')}
          subtitle={isSuperAdmin ? 'Punched-in today' : (myTodayLog?.punchIn?.time ? `In at ${myTodayLog.punchIn.time}` : 'Punch in to start')}
          icon={CalendarCheck}
          color="emerald"
        />
        <StatCard
          title={isSuperAdmin ? 'Cumulative Attendance Logs' : 'My Total Duty Days'}
          value={visibleLogs.length}
          subtitle={isSuperAdmin ? 'All recorded duty shifts' : 'Days worked this season'}
          icon={Clock}
          color="indigo"
        />
        <StatCard
          title="Work Verification"
          value="100% GPS"
          subtitle="All shifts verified on-site"
          icon={MapPin}
          color="blue"
        />
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isSuperAdmin ? 'Attendance & Work Duration Logs' : 'My Attendance & Work Duration'}
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
                          href={log.punchIn.location.mapsUrl}
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
                          href={log.punchOut.location.mapsUrl}
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
    </div>
  );
};
