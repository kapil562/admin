import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getFieldVisits, logFieldVisit, getCurrentGPSLocation, getAttendanceLogs, punchAttendance } from '../firebase/services/marketingService';
import { calculateStaffPayroll, getStaffUsers } from '../firebase/services/staffService';
import { getSoftwareVerticals } from '../firebase/services/verticalService';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

export const StaffDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [punching, setPunching] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsData, setGpsData] = useState(null);

  // Form State for logging visit
  const [form, setForm] = useState({
    clientType: 'Library',
    businessName: '',
    ownerName: '',
    phone: '',
    state: '',
    city: '',
    address: '',
    discussionNotes: '',
    demoGiven: false,
    status: 'Interested',
    followUpDate: '',
    checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    durationMinutes: 20,
  });

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

  const resetVisitForm = () => {
    setForm({
      clientType: activeVerticals.length === 1 ? activeVerticals[0].shortName : 'Library',
      businessName: '',
      ownerName: '',
      phone: '',
      state: '',
      city: '',
      address: '',
      discussionNotes: '',
      demoGiven: false,
      status: 'Interested',
      followUpDate: '',
      checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      durationMinutes: 20,
    });
    setGpsData(null);
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
              onClick={() => {
                resetVisitForm();
                setShowVisitModal(true);
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/25 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>Log Client Visit</span>
            </button>
          </div>
        </div>
      </div>

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
                        <span className="block text-slate-400 text-[10px]">{v.phone}</span>
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
                      <td className="px-5 py-3.5 text-right">
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
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      {f.followUpDate}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Phone size={11} /> {f.ownerName} ({f.phone})
                  </p>
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
        subtitle="GPS position will verify you are physically at the client location"
      >
        <form onSubmit={handleVisitSubmit} className="space-y-4">
          {/* GPS Pinpoint */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-900">GPS On-Site Verification</p>
              <p className="text-[11px] text-slate-500">
                {gpsData ? `Locked: ±${gpsData.accuracy}m` : 'Required for verified visit'}
              </p>
            </div>
            <button
              type="button"
              disabled={capturingGps}
              onClick={handleCaptureGPS}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-1 ${
                gpsData ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
            >
              <Crosshair size={13} className={capturingGps ? 'animate-spin' : ''} />
              <span>{capturingGps ? 'Locking...' : gpsData ? 'GPS Verified' : 'Lock GPS'}</span>
            </button>
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

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Client Business / Center Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Saraswati Library, Apex Study Point"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Owner Name
              </label>
              <input
                type="text"
                placeholder="Rakesh Kumar"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* State, City, Location 3 Separate Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                State (राज्य) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rajasthan, UP, Delhi"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                City (शहर) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Jaipur, Kota, Lucknow"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Location / Area (क्षेत्र / पता)
              </label>
              <input
                type="text"
                placeholder="e.g. Mansarovar, Main Market"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Meeting Discussion Notes *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Kya baat hui? Owner ka reaction, software requirement, demo response..."
              value={form.discussionNotes}
              onChange={(e) => setForm({ ...form, discussionNotes: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Lead Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="Interested">Interested (Good Lead)</option>
                <option value="Demo Given">Software Demo Given</option>
                <option value="Follow Up">Follow Up Scheduled</option>
                <option value="Deal Closed">🎉 Deal Closed / Won</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Follow-up Callback Date
              </label>
              <input
                type="date"
                value={form.followUpDate}
                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="staffDemo"
              checked={form.demoGiven}
              onChange={(e) => setForm({ ...form, demoGiven: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="staffDemo" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Software demo presented to client
            </label>
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              {addVisitMutation.isPending ? 'Saving...' : 'Save Visit Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
