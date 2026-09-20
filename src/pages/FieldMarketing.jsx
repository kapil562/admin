import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFieldVisits, logFieldVisit, deleteFieldVisit, getCurrentGPSLocation } from '../firebase/services/marketingService';
import { getStaffUsers } from '../firebase/services/staffService';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Navigation,
  MapPin,
  Building2,
  Dumbbell,
  GraduationCap,
  Store,
  Phone,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
  Trash2,
  Crosshair,
  Timer,
  Check,
  Users,
  UserCheck,
  Filter,
  Award,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

const VISIT_STATUSES = [
  { id: 'Interested', label: 'Interested (Good Lead)', variant: 'info' },
  { id: 'Demo Given', label: 'Software Demo Given', variant: 'purple' },
  { id: 'Follow Up', label: 'Follow Up Scheduled', variant: 'warning' },
  { id: 'Deal Closed', label: '🎉 Deal Closed / Subscribed', variant: 'success' },
  { id: 'Not Interested', label: 'Not Interested', variant: 'danger' },
];

export const FieldMarketing = () => {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);

  const isSuperAdmin = user?.role === 'super_admin';

  // 1. Fetch Staff Users (for Admin filter & performance cards)
  const { data: staffList = [] } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
    enabled: isSuperAdmin,
  });

  // GPS State
  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsData, setGpsData] = useState(null);

  // Form State - Focused 100% on Library
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

  // 2. Fetch Visits
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  // 3. Add Mutation
  const addMutation = useMutation({
    mutationFn: logFieldVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Field visit log recorded with GPS!');
      setShowModal(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save visit record');
    },
  });

  // 4. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteFieldVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Visit record removed');
    },
  });

  const resetForm = () => {
    setForm({
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
    setGpsData(null);
  };

  const handleCaptureGPS = async () => {
    setCapturingGps(true);
    try {
      const loc = await getCurrentGPSLocation();
      setGpsData(loc);
      toast.success(`GPS Acquired: Accurate to ±${loc.accuracy}m`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCapturingGps(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      toast.error('Business Name is required.');
      return;
    }

    addMutation.mutate({
      ...form,
      staffId: user?.uid || user?.id || 'staff',
      staffName: user?.displayName || user?.name || 'Marketing Staff',
      location: gpsData,
    });
  };

  // Base visits filtered by role:
  // - If staff member: strictly their own visits!
  // - If super admin: filtered by selectedStaffFilter (or all)
  const baseVisits = useMemo(() => {
    if (isSuperAdmin) {
      if (selectedStaffFilter === 'All') return visits;
      return visits.filter((v) => {
        const staffObj = staffList.find((s) => s.id === selectedStaffFilter);
        return (
          v.staffId === selectedStaffFilter ||
          (staffObj && v.staffName?.toLowerCase() === staffObj.name?.toLowerCase()) ||
          v.staffName?.toLowerCase() === selectedStaffFilter.toLowerCase()
        );
      });
    }
    // Staff Member: strictly their own visits!
    const myId = user?.uid || user?.id;
    const myName = (user?.displayName || user?.name || '').toLowerCase();
    return visits.filter(
      (v) => v.staffId === myId || (v.staffName && v.staffName.toLowerCase() === myName)
    );
  }, [visits, isSuperAdmin, selectedStaffFilter, user, staffList]);

  // Filter logic on top of baseVisits
  const filteredVisits = useMemo(() => {
    return baseVisits.filter((v) => {
      const matchSearch =
        (v.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.phone || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.staffName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.city || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.discussionNotes || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || v.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [baseVisits, search, statusFilter]);

  // Aggregated Stats
  const totalVisitsCount = baseVisits.length;
  const demosGivenCount = baseVisits.filter((v) => v.demoGiven).length;
  const dealsClosedCount = baseVisits.filter((v) => v.status === 'Deal Closed').length;
  const followUpsCount = baseVisits.filter((v) => v.status === 'Follow Up').length;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeVariant = (st) => {
    const found = VISIT_STATUSES.find((s) => s.id === st);
    return found ? found.variant : 'neutral';
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading library marketing visits and GPS locations..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isSuperAdmin ? 'Field Marketing & Staff Oversight' : 'My Field Marketing & Library Visits'}
        subtitle={
          isSuperAdmin
            ? 'Super Admin View: Monitor all marketing reps, on-site visits, live GPS locations, and closed deals.'
            : `Personal Field Workspace (${user?.displayName || 'Staff'}): Record your on-site library visits with GPS and track your closed deals.`
        }
        action={
          hasPermission('marketing', 'create') && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus size={16} />
              <span>Log Library Visit</span>
            </button>
          )
        }
      />

      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={isSuperAdmin ? (selectedStaffFilter === 'All' ? 'Total Field Visits' : 'Staff Visits') : 'My Total Visits'}
          value={totalVisitsCount}
          subtitle={isSuperAdmin ? 'All on-site library meetings' : 'Recorded in your workspace'}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title={isSuperAdmin ? 'Software Demos Given' : 'My Demos Given'}
          value={demosGivenCount}
          subtitle="Library owners shown demo"
          icon={Navigation}
          color="purple"
        />
        <StatCard
          title={isSuperAdmin ? 'Follow-ups Pending' : 'My Follow-ups Pending'}
          value={followUpsCount}
          subtitle="Libraries needing callback"
          icon={AlertCircle}
          color="amber"
        />
        <StatCard
          title={isSuperAdmin ? 'Deals Closed / Won' : 'My Deals Won'}
          value={dealsClosedCount}
          subtitle="Subscribed library clients"
          icon={CheckCircle2}
          color="emerald"
          trend={`${dealsClosedCount} Won`}
          trendPositive={true}
        />
      </div>

      {/* Super Admin: Team Field Performance Summary */}
      {isSuperAdmin && staffList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Users size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Marketing Staff Performance & Work Breakdown
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select a team member to filter their individual visits, GPS tracking, and discussions
                </p>
              </div>
            </div>

            {selectedStaffFilter !== 'All' && (
              <button
                onClick={() => setSelectedStaffFilter('All')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                Showing Single Staff • Clear Filter (Show All)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {staffList.map((staff) => {
              const staffVisits = visits.filter(
                (v) => v.staffId === staff.id || v.staffName?.toLowerCase() === staff.name.toLowerCase()
              );
              const staffDemos = staffVisits.filter((v) => v.demoGiven).length;
              const staffDeals = staffVisits.filter((v) => v.status === 'Deal Closed').length;
              const isSelected = selectedStaffFilter === staff.id;

              return (
                <div
                  key={staff.id}
                  onClick={() => setSelectedStaffFilter(isSelected ? 'All' : staff.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{staff.name}</p>
                      <p className="text-[10px] text-slate-500">{staff.roleLabel || 'Marketing Rep'}</p>
                    </div>
                    <Badge variant={isSelected ? 'primary' : 'neutral'} size="sm">
                      {staffVisits.length} visits
                    </Badge>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">
                      <strong>{staffDemos}</strong> Demos
                    </span>
                    <span className="font-bold text-emerald-700">
                      🎉 {staffDeals} Won
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
          <div className="w-full sm:w-80">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by library, owner, phone, city, notes..."
            />
          </div>

          {/* Admin Staff Filter Dropdown */}
          {isSuperAdmin && staffList.length > 0 && (
            <div className="w-full sm:w-auto">
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="All">All Staff Members ({visits.length} visits)</option>
                {staffList.map((s) => {
                  const sCount = visits.filter(
                    (v) => v.staffId === s.id || v.staffName?.toLowerCase() === s.name.toLowerCase()
                  ).length;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} ({sCount} visits)
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Lead Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          {['All', 'Interested', 'Demo Given', 'Follow Up', 'Deal Closed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
              {st === 'All' && ` (${baseVisits.length})`}
              {st === 'Interested' && ` (${baseVisits.filter((v) => v.status === 'Interested').length})`}
              {st === 'Deal Closed' && ` (${dealsClosedCount})`}
            </button>
          ))}
        </div>
      </div>


      {/* Visits Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Client & Target</th>
                <th className="px-5 py-3.5">Owner & Contact</th>
                <th className="px-5 py-3.5">Marketing Staff</th>
                <th className="px-5 py-3.5">Discussion & Demo</th>
                <th className="px-5 py-3.5">GPS Location Verification</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredVisits.length > 0 ? (
                filteredVisits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Business Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            visit.clientType === 'Gym'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              : visit.clientType === 'Library'
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : 'bg-purple-50 text-purple-600 border border-purple-100'
                          }`}
                        >
                          {visit.clientType === 'Gym' ? <Dumbbell size={16} /> : <Building2 size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-xs">
                            {visit.businessName}
                          </p>
                          <span className="text-[11px] text-slate-400 font-semibold block">
                            {visit.clientType} • {visit.city || 'City'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Owner & Phone */}
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <div className="font-semibold text-slate-800">{visit.ownerName}</div>
                      {visit.phone && (
                        <div className="flex items-center gap-1 text-slate-500 font-medium mt-0.5">
                          <Phone size={11} className="text-slate-400" />
                          <span>{visit.phone}</span>
                        </div>
                      )}
                    </td>

                    {/* Staff Name & Date */}
                    <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                      <div className="font-bold text-slate-800">{visit.staffName}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {formatDate(visit.createdAt)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {visit.checkInTime} - {visit.checkOutTime} ({visit.durationMinutes || 15}m)
                      </div>
                    </td>

                    {/* Discussion & Demo */}
                    <td className="px-5 py-4 max-w-xs text-xs">
                      <p className="text-slate-700 line-clamp-2 leading-relaxed">
                        {visit.discussionNotes || 'No notes provided.'}
                      </p>
                      {visit.demoGiven && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          <Check size={10} /> Demo Given
                        </span>
                      )}
                      {visit.followUpDate && (
                        <span className="block text-[10px] text-amber-600 font-semibold mt-0.5">
                          Follow-up: {visit.followUpDate}
                        </span>
                      )}
                    </td>

                    {/* GPS Location Proof */}
                    <td className="px-5 py-4 whitespace-nowrap text-xs">
                      {visit.location ? (
                        <div className="space-y-1">
                          <a
                            href={visit.location.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold hover:bg-blue-100 transition"
                          >
                            <MapPin size={12} className="text-blue-600" />
                            <span>View on Google Map</span>
                            <ExternalLink size={10} />
                          </a>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Accuracy: ±{visit.location.accuracy || 10}m
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No GPS logged</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <Badge variant={getStatusBadgeVariant(visit.status)} size="sm">
                        {visit.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedVisit(visit)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          Inspect
                        </button>
                        {hasPermission('marketing', 'delete') && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete visit record for "${visit.businessName}"?`)) {
                                deleteMutation.mutate(visit.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8">
                    <EmptyState
                      icon={Navigation}
                      title="No marketing visits logged"
                      description="Staff can click 'Log Client Visit' to record on-site library and gym visits with live GPS proof."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Visit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Log On-Site Library Visit"
        subtitle="Capture live GPS location, library details, and meeting discussion notes"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* GPS Capture Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  gpsData ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-blue-50 text-blue-600'
                }`}
              >
                <Crosshair size={20} className={capturingGps ? 'animate-spin' : ''} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Live Device GPS Pinpoint</p>
                <p className="text-[11px] text-slate-500">
                  {gpsData
                    ? `GPS Locked: ${gpsData.latitude.toFixed(5)}, ${gpsData.longitude.toFixed(5)} (±${gpsData.accuracy}m)`
                    : 'Click button to verify you are physically at the library location'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={capturingGps}
              onClick={handleCaptureGPS}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                gpsData
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
              }`}
            >
              <MapPin size={14} />
              <span>{capturingGps ? 'Locking GPS...' : gpsData ? 'Re-Capture GPS' : 'Capture GPS Now'}</span>
            </button>
          </div>

          {/* Business Name & Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Study Library Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Saraswati Library, Apex Study Point"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Library Owner Name
              </label>
              <input
                type="text"
                placeholder="e.g. Rakesh Kumar"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>


          {/* Contact Mobile */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Contact Mobile Number
            </label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          {/* State, City, and Location - 3 Separate Fields */}
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                City (शहर) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Jaipur, Lucknow, Kota"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Meeting Discussion Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Discussion Summary (Kya baat hui?) *
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Met owner. They currently use register for attendance. Interested in 100-seat plan. Liked the WhatsApp reminder feature. Asked to call on Monday."
              value={form.discussionNotes}
              onChange={(e) => setForm({ ...form, discussionNotes: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          {/* Times & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Check-in Time
              </label>
              <input
                type="text"
                placeholder="11:30 AM"
                value={form.checkInTime}
                onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Check-out Time
              </label>
              <input
                type="text"
                placeholder="12:00 PM"
                value={form.checkOutTime}
                onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Lead Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
              >
                {VISIT_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Demo Given & Follow-up */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="demoCheck"
                checked={form.demoGiven}
                onChange={(e) => setForm({ ...form, demoGiven: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
              <label htmlFor="demoCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                Live Software Demo was given to owner
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Follow-up Callback Date
              </label>
              <input
                type="date"
                value={form.followUpDate}
                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {addMutation.isPending ? 'Logging Visit...' : 'Save Visit Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Visit Inspection Modal */}
      <Modal
        isOpen={!!selectedVisit}
        onClose={() => setSelectedVisit(null)}
        title={selectedVisit?.businessName || 'Visit Details'}
        subtitle={`Logged by ${selectedVisit?.staffName} on ${formatDate(selectedVisit?.createdAt)}`}
      >
        {selectedVisit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Target Type</span>
                <span className="font-bold text-slate-800">{selectedVisit.clientType}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Lead Status</span>
                <Badge variant={getStatusBadgeVariant(selectedVisit.status)} size="sm">
                  {selectedVisit.status}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Owner Contact</span>
                <span className="font-semibold text-slate-800">
                  {selectedVisit.ownerName} ({selectedVisit.phone || 'N/A'})
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">State & City</span>
                <span className="font-semibold text-slate-800">
                  {selectedVisit.city || 'N/A'}{selectedVisit.state ? `, ${selectedVisit.state}` : ''}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Location / Area</span>
                <span className="font-semibold text-slate-800">{selectedVisit.address || 'N/A'}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Meeting Discussion
              </span>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedVisit.discussionNotes}
              </div>
            </div>

            {selectedVisit.location && (
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-900">GPS On-Site Verification</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Coordinates: {selectedVisit.location.latitude}, {selectedVisit.location.longitude}
                  </p>
                </div>
                <a
                  href={selectedVisit.location.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition"
                >
                  <MapPin size={12} />
                  <span>Google Maps</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
