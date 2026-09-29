import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFieldVisits } from '../firebase/services/marketingService';
import { getStaffUsers, calculateStaffPayroll } from '../firebase/services/staffService';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { SearchBar } from '../components/ui/SearchBar';
import {
  ClipboardList,
  MapPin,
  Calendar,
  Clock,
  User,
  Users,
  Award,
  CheckCircle2,
  AlertCircle,
  Camera,
  Phone,
  MessageCircle,
  Download,
  Filter,
  Eye,
  Flame,
  Zap,
  Building2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const FieldReports = () => {
  const { user } = useAuth();
  const isSuperAdmin = !user?.role || user.role === 'super_admin' || user.role === 'owner';

  const [dateRange, setDateRange] = useState('all'); // all, today, yesterday, week, month, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // 1. Fetch Visits
  const { data: visits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  // 2. Fetch Staff
  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
  });

  // ── Date Formatting Helpers ────────────────────────────────────────────────
  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: '-', time: '' };
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  // ── Filter Visits by Date, Staff, Status, Search ───────────────────────────
  const filteredVisits = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    return visits.filter((v) => {
      // 1. Non-admin visibility restriction
      if (!isSuperAdmin) {
        const myId = user?.uid || user?.id;
        const myName = (user?.displayName || user?.name || '').toLowerCase();
        const isMine = v.staffId === myId || (v.staffName && v.staffName.toLowerCase() === myName);
        if (!isMine) return false;
      }

      // 2. Staff filter
      if (selectedStaff !== 'All') {
        const staffObj = staffList.find((s) => s.id === selectedStaff);
        const matchStaff =
          v.staffId === selectedStaff ||
          (staffObj && (v.staffName || '').toLowerCase() === (staffObj.name || '').toLowerCase()) ||
          (v.staffName || '').toLowerCase() === selectedStaff.toLowerCase();
        if (!matchStaff) return false;
      }

      // 3. Status filter
      if (statusFilter !== 'All' && v.status !== statusFilter) {
        return false;
      }

      // 4. Date range filter
      if (dateRange === 'today') {
        if (!(v.createdAt || '').startsWith(todayStr)) return false;
      } else if (dateRange === 'yesterday') {
        if (!(v.createdAt || '').startsWith(yesterdayStr)) return false;
      } else if (dateRange === 'week') {
        if ((v.createdAt || '') < weekAgo) return false;
      } else if (dateRange === 'month') {
        if ((v.createdAt || '') < monthStart) return false;
      } else if (dateRange === 'custom') {
        if (customStartDate && (v.createdAt || '').substring(0, 10) < customStartDate) return false;
        if (customEndDate && (v.createdAt || '').substring(0, 10) > customEndDate) return false;
      }

      // 5. Search text filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (v.businessName || '').toLowerCase().includes(q) ||
          (v.ownerName || '').toLowerCase().includes(q) ||
          (v.staffName || '').toLowerCase().includes(q) ||
          (v.city || '').toLowerCase().includes(q) ||
          (v.phone || '').toLowerCase().includes(q) ||
          (v.discussionNotes || '').toLowerCase().includes(q) ||
          (v.status || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [visits, isSuperAdmin, selectedStaff, statusFilter, dateRange, customStartDate, customEndDate, search, user, staffList]);

  // ── High-Level Report Statistics ───────────────────────────────────────────
  const reportStats = useMemo(() => {
    const totalVisits = filteredVisits.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayVisits = filteredVisits.filter((v) => (v.createdAt || '').startsWith(todayStr)).length;
    const dealsClosed = filteredVisits.filter((v) => v.status === 'Deal Closed').length;
    const demosGiven = filteredVisits.filter((v) => v.demoGiven).length;
    const followUps = filteredVisits.filter((v) => v.status === 'Follow Up').length;
    const withGps = filteredVisits.filter((v) => v.location && v.location.latitude).length;
    const withPhoto = filteredVisits.filter((v) => v.photoUrl).length;

    // Distinct staff active in filtered set
    const activeStaffSet = new Set(filteredVisits.map((v) => v.staffName || v.staffId).filter(Boolean));

    return {
      totalVisits,
      todayVisits,
      dealsClosed,
      demosGiven,
      followUps,
      withGps,
      gpsRate: totalVisits ? Math.round((withGps / totalVisits) * 100) : 0,
      withPhoto,
      photoRate: totalVisits ? Math.round((withPhoto / totalVisits) * 100) : 0,
      activeStaffCount: activeStaffSet.size,
      conversionRate: totalVisits ? Math.round((dealsClosed / totalVisits) * 100) : 0,
    };
  }, [filteredVisits]);

  // ── Staff Breakdown (Kisne kitni entry kari aur kab) ──────────────────────
  const staffBreakdown = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // Map all registered staff + any unregistered staff found in visits
    const staffMap = new Map();

    staffList.forEach((s) => {
      staffMap.set(s.id, {
        id: s.id,
        name: s.name,
        role: s.role,
        roleLabel: s.roleLabel || 'Staff Member',
        phone: s.phone || '',
        email: s.email || '',
        totalVisits: 0,
        todayVisits: 0,
        weekVisits: 0,
        monthVisits: 0,
        demos: 0,
        deals: 0,
        photos: 0,
        gpsCount: 0,
        lastVisit: null,
        payroll: calculateStaffPayroll(s, visits),
      });
    });

    visits.forEach((v) => {
      let key = v.staffId;
      // Match by name if staffId not matched
      if (!staffMap.has(key)) {
        const found = staffList.find((s) => (s.name || '').toLowerCase() === (v.staffName || '').toLowerCase());
        if (found) {
          key = found.id;
        } else {
          // Unregistered staff record
          const unregKey = `unreg_${v.staffName || 'Unknown'}`;
          if (!staffMap.has(unregKey)) {
            staffMap.set(unregKey, {
              id: unregKey,
              name: v.staffName || 'Unknown Staff',
              role: 'marketing',
              roleLabel: 'Field Rep',
              phone: '',
              email: '',
              totalVisits: 0,
              todayVisits: 0,
              weekVisits: 0,
              monthVisits: 0,
              demos: 0,
              deals: 0,
              photos: 0,
              gpsCount: 0,
              lastVisit: null,
              payroll: { baseSalary: 0, commissionEarned: 0, dealsClosed: 0 },
            });
          }
          key = unregKey;
        }
      }

      const entry = staffMap.get(key);
      if (entry) {
        entry.totalVisits += 1;
        if ((v.createdAt || '').startsWith(todayStr)) entry.todayVisits += 1;
        if ((v.createdAt || '') >= weekAgo) entry.weekVisits += 1;
        if ((v.createdAt || '') >= monthStart) entry.monthVisits += 1;
        if (v.demoGiven) entry.demos += 1;
        if (v.status === 'Deal Closed') entry.deals += 1;
        if (v.photoUrl) entry.photos += 1;
        if (v.location?.latitude) entry.gpsCount += 1;

        if (!entry.lastVisit || new Date(v.createdAt) > new Date(entry.lastVisit.createdAt)) {
          entry.lastVisit = v;
        }
      }
    });

    return Array.from(staffMap.values()).sort((a, b) => b.totalVisits - a.totalVisits);
  }, [staffList, visits]);

  // ── CSV Export Function ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (filteredVisits.length === 0) {
      toast.error('No records to export in the selected filter.');
      return;
    }

    const headers = [
      'Visit Date',
      'Visit Time',
      'Staff Name',
      'Business / Library Name',
      'Category',
      'Owner / Met Person',
      'Phone Number',
      'Alt WhatsApp',
      'City',
      'State',
      'Address',
      'Lead Status',
      'Priority',
      'Live Demo Given',
      'Current Software',
      'Follow-Up Date',
      'Follow-Up Time',
      'Next Agenda',
      'Discussion Notes',
      'GPS Lat',
      'GPS Lng',
      'Google Maps Link',
      'Photo Attached',
    ];

    const rows = filteredVisits.map((v) => {
      const dt = formatDateTime(v.createdAt);
      return [
        `"${dt.date}"`,
        `"${dt.time}"`,
        `"${v.staffName || ''}"`,
        `"${(v.businessName || '').replace(/"/g, '""')}"`,
        `"${v.clientType || 'Library'}"`,
        `"${v.ownerName || v.contactPersonName || ''}"`,
        `"${v.phone || ''}"`,
        `"${v.secondaryPhone || ''}"`,
        `"${v.city || ''}"`,
        `"${v.state || ''}"`,
        `"${(v.address || '').replace(/"/g, '""')}"`,
        `"${v.status || ''}"`,
        `"${v.leadPriority || ''}"`,
        `"${v.demoGiven ? 'Yes' : 'No'}"`,
        `"${v.currentSoftwareType || ''}"`,
        `"${v.followUpDate || ''}"`,
        `"${v.followUpTime || ''}"`,
        `"${(v.nextActionItem || '').replace(/"/g, '""')}"`,
        `"${(v.discussionNotes || '').replace(/"/g, '""')}"`,
        `"${v.location?.latitude || ''}"`,
        `"${v.location?.longitude || ''}"`,
        `"${v.location?.mapsUrl || ''}"`,
        `"${v.photoUrl ? 'Yes' : 'No'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `field_marketing_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Field Report CSV exported successfully!');
  };

  const getStatusBadgeVariant = (st) => {
    switch (st) {
      case 'Deal Closed':
        return 'success';
      case 'Demo Given':
        return 'info';
      case 'Follow Up':
        return 'warning';
      case 'Interested':
        return 'purple';
      case 'Not Interested':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  if (loadingVisits || loadingStaff) {
    return <LoadingSpinner fullScreen label="Compiling Field Marketing Reports..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Sales & Visits Reports"
        subtitle="Complete on-ground tracking: kisne entry kari, kitni visits kari, exact date-time, GPS verification aur daily logs."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Download size={15} />
              <span>Export Report (CSV)</span>
            </button>
          </div>
        }
      />

      {/* ═══ Top Key KPI Stat Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Field Visits"
          value={reportStats.totalVisits}
          subtitle={`${reportStats.todayVisits} logged today`}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Active Field Reps"
          value={reportStats.activeStaffCount}
          subtitle="Staff logging on-site visits"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="GPS Verification Rate"
          value={`${reportStats.gpsRate}%`}
          subtitle={`${reportStats.withGps} visits GPS locked`}
          icon={MapPin}
          color="emerald"
        />
        <StatCard
          title="Deals Won / Closed"
          value={reportStats.dealsClosed}
          subtitle={`${reportStats.conversionRate}% overall conversion`}
          icon={CheckCircle2}
          color="amber"
          trend={`${reportStats.demosGiven} Demos Given`}
          trendPositive={true}
        />
      </div>

      {/* ═══ SECTION 1: Staff-wise Performance Leaderboard ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Staff-Wise Performance & Entry Summary
              </h3>
              <p className="text-[11px] text-slate-500">
                Pata chale kis staff ne kitni visits kari hain, kab last active tha, aur kitne deals close kiye
              </p>
            </div>
          </div>
          {selectedStaff !== 'All' && (
            <button
              onClick={() => setSelectedStaff('All')}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition self-start sm:self-auto cursor-pointer"
            >
              Showing: {staffBreakdown.find((s) => s.id === selectedStaff)?.name || selectedStaff} (Clear Filter)
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-5 py-3.5">Staff Rep</th>
                <th className="px-4 py-3.5 text-center">Total Visits</th>
                <th className="px-4 py-3.5 text-center">Today</th>
                <th className="px-4 py-3.5 text-center">This Week</th>
                <th className="px-4 py-3.5 text-center">This Month</th>
                <th className="px-4 py-3.5 text-center">Deals Won</th>
                <th className="px-4 py-3.5 text-center">GPS %</th>
                <th className="px-4 py-3.5 text-center">Photos</th>
                <th className="px-5 py-3.5">Last Visit Entry Logged</th>
                <th className="px-4 py-3.5 text-right">Filter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {staffBreakdown.length > 0 ? (
                staffBreakdown.map((s) => {
                  const isSelected = selectedStaff === s.id;
                  const gpsRate = s.totalVisits ? Math.round((s.gpsCount / s.totalVisits) * 100) : 0;
                  const lastDt = s.lastVisit ? formatDateTime(s.lastVisit.createdAt) : null;

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-5 py-3.5 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-blue-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {s.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{s.name}</span>
                            <span className="text-[10px] text-slate-400 block">{s.roleLabel}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="font-black text-slate-900 text-sm">{s.totalVisits}</span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${s.todayVisits > 0 ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400'}`}>
                          {s.todayVisits}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                        {s.weekVisits}
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                        {s.monthVisits}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`font-black ${s.deals > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {s.deals > 0 ? `🎉 ${s.deals}` : '0'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`font-bold text-[11px] ${gpsRate >= 80 ? 'text-emerald-700' : gpsRate >= 50 ? 'text-amber-700' : 'text-slate-400'}`}>
                          {gpsRate}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center font-medium text-slate-600">
                        {s.photos} 📷
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        {lastDt ? (
                          <div>
                            <p className="font-bold text-slate-800 text-[11px] truncate max-w-[180px]">
                              {s.lastVisit.businessName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {lastDt.date} at {lastDt.time}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No visits yet</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedStaff(isSelected ? 'All' : s.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'View Logs'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    No staff records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ SECTION 2: Comprehensive Visits Audit Log & Timeline ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600" />
              <span>Full Field Visits Activity Log ({filteredVisits.length} Records)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Kab kis library me visit hui, kis staff ne ki, exact date-time, GPS coordinates, aur meeting discussion
            </p>
          </div>

          {/* Quick Date Range Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom' },
            ].map((dr) => (
              <button
                key={dr.id}
                onClick={() => setDateRange(dr.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  dateRange === dr.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex-wrap">
            <span className="text-xs font-bold text-slate-700">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
            />
            <span className="text-xs font-bold text-slate-700">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
            />
          </div>
        )}

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search library, staff, city, phone..."
            />
          </div>

          <div>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="All">All Staff Reps ({visits.length} visits)</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.roleLabel || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="All">All Lead Statuses</option>
              <option value="Interested">Interested</option>
              <option value="Demo Given">Demo Given</option>
              <option value="Follow Up">Follow Up</option>
              <option value="Deal Closed">Deal Closed / Won</option>
              <option value="Not Interested">Not Interested</option>
            </select>
          </div>

          <div className="flex items-center justify-end text-xs font-bold text-slate-500">
            Showing <strong className="text-slate-900 mx-1">{filteredVisits.length}</strong> of {visits.length} records
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-4 py-3.5">Logged By (Staff)</th>
                <th className="px-4 py-3.5">Date & Exact Time</th>
                <th className="px-5 py-3.5">Library / Business</th>
                <th className="px-4 py-3.5">Contact Person</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Proof & GPS</th>
                <th className="px-5 py-3.5">Discussion Summary</th>
                <th className="px-4 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredVisits.length > 0 ? (
                filteredVisits.map((v) => {
                  const dt = formatDateTime(v.createdAt);
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition">
                      {/* Logged By */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-extrabold text-xs flex items-center justify-center shrink-0">
                            {(v.staffName || 'S').substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{v.staffName || 'Staff Member'}</span>
                            <span className="text-[10px] text-slate-400 block">{v.clientType || 'Library'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Date & Exact Time */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{dt.date}</span>
                        </div>
                        {dt.time && (
                          <div className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 mt-0.5">
                            <Clock size={11} />
                            <span>{dt.time}</span>
                          </div>
                        )}
                        {v.checkInTime && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            In: {v.checkInTime} {v.checkOutTime ? `- Out: ${v.checkOutTime}` : ''}
                          </span>
                        )}
                      </td>

                      {/* Business & City */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-xs">{v.businessName}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {v.city ? `${v.city}, ` : ''}{v.state || ''}
                          {v.seatCapacity && <span className="ml-1 text-[10px] bg-slate-100 px-1 py-0.2 rounded font-semibold text-slate-600">🪑 {v.seatCapacity}</span>}
                        </div>
                      </td>

                      {/* Contact & Met Person */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800 text-xs">
                          {v.ownerName || v.contactPersonName || 'Owner'}
                          {v.personMet && <span className="ml-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold">({v.personMet.split(' ')[0]})</span>}
                        </div>
                        {v.phone && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 text-[11px]">
                            <a href={`tel:${v.phone}`} className="text-blue-600 hover:text-blue-800">
                              <Phone size={11} />
                            </a>
                            <a href={`https://wa.me/91${v.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-800">
                              <MessageCircle size={11} />
                            </a>
                            <span>{v.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge variant={getStatusBadgeVariant(v.status)} size="sm">
                          {v.status}
                        </Badge>
                        {v.leadPriority && (
                          <span className={`block text-[10px] font-bold mt-1 ${v.leadPriority === 'Hot' ? 'text-rose-600' : v.leadPriority === 'Warm' ? 'text-amber-600' : 'text-blue-600'}`}>
                            {v.leadPriority === 'Hot' ? '🔥 Hot' : v.leadPriority === 'Warm' ? '⚡ Warm' : '❄️ Cold'}
                          </span>
                        )}
                      </td>

                      {/* Proof & GPS */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {v.photoUrl ? (
                            <button
                              onClick={() => setPreviewPhoto(v.photoUrl)}
                              className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-500 transition cursor-pointer shrink-0"
                              title="Click to view live photo proof"
                            >
                              <img src={v.photoUrl} alt="Visit proof" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">No photo</span>
                          )}

                          <div>
                            {v.location ? (
                              <a
                                href={v.location.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800"
                              >
                                <MapPin size={10} /> GPS (±{v.location.accuracy || 10}m)
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 block">No GPS</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Discussion & Reminder */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <p className="text-slate-700 line-clamp-2 text-xs leading-relaxed">
                          {v.discussionNotes || <span className="italic text-slate-400">No notes</span>}
                        </p>
                        {v.reminderNote && (
                          <p className="text-[10px] text-amber-800 font-semibold mt-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 line-clamp-1">
                            🔔 {v.reminderNote}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedVisit(v)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8">
                    <EmptyState
                      icon={ClipboardList}
                      title="No visit entries match your filters"
                      description="Try clearing search or selecting 'All Time' to view previous marketing visits."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Inspection Modal: Full Visit Report ═══ */}
      {selectedVisit && (
        <Modal
          isOpen={!!selectedVisit}
          onClose={() => setSelectedVisit(null)}
          title={`Field Visit Report: ${selectedVisit.businessName}`}
          subtitle={`Logged by ${selectedVisit.staffName || 'Staff Member'} on ${formatDateTime(selectedVisit.createdAt).date}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            {/* Top Photo Proof Banner if available */}
            {selectedVisit.photoUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-h-64 bg-slate-900 group">
                <img
                  src={selectedVisit.photoUrl}
                  alt="On-Site Proof"
                  className="w-full h-full object-cover max-h-64 mx-auto"
                />
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(selectedVisit.photoUrl)}
                  className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 hover:bg-black text-white text-xs font-bold rounded-lg backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <ExternalLink size={13} />
                  <span>Full Screen Photo</span>
                </button>
              </div>
            )}

            {/* Core Visit Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Logged By</span>
                <span className="font-bold text-slate-900 block mt-0.5">{selectedVisit.staffName || 'Staff Member'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Date & Time</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {formatDateTime(selectedVisit.createdAt).date} @ {formatDateTime(selectedVisit.createdAt).time}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Status</span>
                <Badge variant={getStatusBadgeVariant(selectedVisit.status)} size="sm" className="mt-1">
                  {selectedVisit.status}
                </Badge>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lead Heat</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {selectedVisit.leadPriority || 'Warm'}
                </span>
              </div>
            </div>

            {/* Client & Contact Details */}
            <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-950 text-sm">{selectedVisit.businessName}</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                  {selectedVisit.clientType || 'Library'}
                </span>
              </div>
              <p className="text-slate-600">
                {selectedVisit.address ? `${selectedVisit.address}, ` : ''}{selectedVisit.city}, {selectedVisit.state}
              </p>
              <div className="flex items-center gap-4 pt-1 font-medium text-slate-700">
                <span>Owner: <strong>{selectedVisit.ownerName || 'N/A'}</strong></span>
                {selectedVisit.personMet && <span>Met: <strong>{selectedVisit.personMet}</strong></span>}
                {selectedVisit.phone && (
                  <span className="flex items-center gap-1.5">
                    📞 <a href={`tel:${selectedVisit.phone}`} className="text-blue-600 font-bold hover:underline">{selectedVisit.phone}</a>
                  </span>
                )}
                {selectedVisit.secondaryPhone && (
                  <span className="text-slate-500">Alt: {selectedVisit.secondaryPhone}</span>
                )}
              </div>
            </div>

            {/* Competitor / Current Software */}
            {selectedVisit.currentSoftwareType && (
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block">Current Management</span>
                  <span className="font-bold text-indigo-950 text-xs mt-0.5 block">
                    {selectedVisit.currentSoftwareType} {selectedVisit.competitorName ? `(${selectedVisit.competitorName})` : ''}
                  </span>
                </div>
                {selectedVisit.competitorExpiryDate && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    Expiry: {selectedVisit.competitorExpiryDate}
                  </span>
                )}
              </div>
            )}

            {/* Re-Visit / Follow-Up Box */}
            {(selectedVisit.reminderNote || selectedVisit.followUpDate) && (
              <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs space-y-1.5">
                <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wider block">
                  Re-Visit & Follow-Up Callback
                </span>
                {selectedVisit.followUpDate && (
                  <p className="text-xs font-black text-amber-950">
                    📅 Date: {selectedVisit.followUpDate} {selectedVisit.followUpTime ? `@ ${selectedVisit.followUpTime}` : ''}
                  </p>
                )}
                {selectedVisit.reminderNote && (
                  <p className="text-xs font-medium text-amber-900 bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                    📝 {selectedVisit.reminderNote}
                  </p>
                )}
              </div>
            )}

            {/* Discussion Notes */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Meeting Discussion Notes
              </span>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedVisit.discussionNotes || 'No discussion notes logged.'}
              </div>
            </div>

            {/* GPS Verification */}
            {selectedVisit.location && (
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-emerald-950 flex items-center gap-1">
                    <MapPin size={13} className="text-emerald-600" />
                    <span>GPS On-Site Verification Confirmed</span>
                  </p>
                  <p className="text-[10px] text-emerald-700 mt-0.5">
                    Lat: {selectedVisit.location.latitude}, Lng: {selectedVisit.location.longitude} (±{selectedVisit.location.accuracy || 10}m)
                  </p>
                </div>
                <a
                  href={selectedVisit.location.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1"
                >
                  <ExternalLink size={12} />
                  <span>Open in Maps</span>
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ═══ Photo Lightbox Modal ═══ */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden border border-white/20 shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewPhoto}
              alt="Live visit proof"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded-2xl"
            />
            <div className="flex items-center justify-between p-3 bg-slate-950/80 text-white text-xs">
              <span className="font-bold">📷 On-Site Live Photo Proof</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
