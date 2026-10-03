import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaffUsers,
  addStaffUser,
  updateStaffUser,
  deleteStaffUser,
  toggleStaffStatus,
  ROLE_PRESETS,
  PERMISSION_MODULES,
  calculateStaffPayroll,
} from '../firebase/services/staffService';
import { getFieldVisits } from '../firebase/services/marketingService';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Crown,
  UserCog,
  ShieldCheck,
  Navigation,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Check,
  X,
  AlertCircle,
  IndianRupee,
  Target,
  Award,
  Wallet,
  Search,
  CheckCircle2,
  XCircle,
  Shield,
  Briefcase,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  Settings,
  HelpCircle,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const StaffManagement = () => {
  const queryClient = useQueryClient();
  const { user: currentUser, updateCurrentUser, hasPermission } = useAuth();

  // Modal and Tab states
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [modalTab, setModalTab] = useState('profile'); // 'profile' | 'role' | 'permissions'
  const [showPassword, setShowPassword] = useState(false);

  // Search & Filter states
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form State
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'marketing',
    roleLabel: '🚶 Field Marketing Executive',
    status: 'active',
    compensation: {
      baseSalary: 15000,
      commissionPerDeal: 500,
      dailyTargetVisits: 0,
      dailyTargetDeals: 0,
    },
    permissions: ROLE_PRESETS.marketing.permissions,
  });

  // 1. Fetch Staff List
  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
  });

  // Fetch Visits for payroll calculation
  const { data: allVisits = [] } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  // 2. Add Mutation
  const addMutation = useMutation({
    mutationFn: addStaffUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_staff_users'] });
      toast.success('Staff account created successfully!');
      setShowModal(false);
    },
    onError: (err) => toast.error(err.message || 'Error creating staff'),
  });

  // 3. Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateStaffUser(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin_staff_users'] });
      toast.success('Staff role and permissions updated!');
      // If updating current user's profile, update active session state
      if (currentUser?.id === updated.id || currentUser?.uid === updated.id) {
        updateCurrentUser({
          name: updated.name,
          email: updated.email,
          role: updated.role === 'owner' ? 'super_admin' : updated.role,
          originalRole: updated.role,
          roleLabel: updated.roleLabel,
          permissions: updated.permissions,
          phone: updated.phone,
          compensation: updated.compensation,
        });
      }
      setShowModal(false);
    },
    onError: (err) => toast.error(err.message || 'Error updating staff'),
  });

  // 4. Quick Status Toggle Mutation
  const statusToggleMutation = useMutation({
    mutationFn: ({ id, currentStatus }) => toggleStaffStatus(id, currentStatus),
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['admin_staff_users'] });
      toast.success(`Account marked as ${newStatus === 'active' ? 'Active' : 'Disabled'}`);
    },
    onError: (err) => toast.error(err.message || 'Failed to update account status'),
  });

  // 5. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteStaffUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_staff_users'] });
      toast.success('Staff account removed successfully');
    },
    onError: (err) => toast.error(err.message || 'Error deleting staff'),
  });

  // Modal Opener
  const openModal = (staff = null, defaultRole = 'marketing') => {
    setModalTab('profile');
    setShowPassword(false);

    if (staff) {
      setEditingStaff(staff);
      setForm({
        name: staff.name || '',
        email: staff.email || '',
        password: '', // Blank initially for edit: keep existing unless changed
        phone: staff.phone || '',
        role: staff.role || 'custom',
        roleLabel: staff.roleLabel || ROLE_PRESETS[staff.role]?.label || (staff.role === 'owner' ? '👑 Business Owner / Super Admin' : 'Staff Member'),
        status: staff.status || 'active',
        compensation: {
          baseSalary: staff.compensation?.baseSalary ?? (staff.role === 'owner' ? 0 : 15000),
          commissionPerDeal: staff.compensation?.commissionPerDeal ?? (staff.role === 'owner' ? 0 : 500),
          dailyTargetVisits: staff.role === 'owner' ? 0 : (staff.compensation?.dailyTargetVisits ?? 0),
          dailyTargetDeals: staff.role === 'owner' ? 0 : (staff.compensation?.dailyTargetDeals ?? 0),
        },
        permissions: staff.permissions || (ROLE_PRESETS[staff.role]?.permissions || {}),
      });
    } else {
      setEditingStaff(null);
      const isOwner = defaultRole === 'owner';
      const preset = ROLE_PRESETS[defaultRole] || ROLE_PRESETS.marketing;
      setForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: defaultRole,
        roleLabel: preset.label,
        status: 'active',
        compensation: {
          baseSalary: isOwner ? 0 : 15000,
          commissionPerDeal: isOwner ? 0 : 500,
          dailyTargetVisits: isOwner ? 0 : 0,
          dailyTargetDeals: isOwner ? 0 : 0,
        },
        permissions: preset.permissions || {},
      });
    }
    setShowModal(true);
  };

  // Change Role Preset
  const handleRolePresetChange = (newRole) => {
    const preset = ROLE_PRESETS[newRole];
    setForm((prev) => ({
      ...prev,
      role: newRole,
      roleLabel: preset?.label || prev.roleLabel,
      permissions: preset?.permissions ? JSON.parse(JSON.stringify(preset.permissions)) : prev.permissions,
      compensation: {
        ...prev.compensation,
        baseSalary: newRole === 'owner' ? 0 : prev.compensation.baseSalary || 15000,
        commissionPerDeal: newRole === 'owner' ? 0 : prev.compensation.commissionPerDeal || 500,
        dailyTargetVisits: newRole === 'owner' ? 0 : prev.compensation.dailyTargetVisits || 0,
        dailyTargetDeals: newRole === 'owner' ? 0 : prev.compensation.dailyTargetDeals || 0,
      },
    }));
    toast.success(`Applied ${preset?.label || newRole} permissions template`);
  };

  // Toggle single action permission
  const togglePermissionAction = (moduleId, action) => {
    const currentModule = form.permissions[moduleId] || {};
    const updatedModule = {
      ...currentModule,
      [action]: !currentModule[action],
    };

    setForm((prev) => ({
      ...prev,
      role: prev.role === 'owner' ? 'owner' : 'custom',
      roleLabel: prev.role === 'owner' ? prev.roleLabel : '⚙️ Custom Configured Role',
      permissions: {
        ...prev.permissions,
        [moduleId]: updatedModule,
      },
    }));
  };

  // Toggle entire module (Master Switch for row)
  const toggleEntireModule = (moduleId) => {
    const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
    if (!mod) return;

    const currentMod = form.permissions[moduleId] || {};
    const allActive = mod.actions.every((act) => currentMod[act]);

    const newModulePerms = {};
    mod.actions.forEach((act) => {
      newModulePerms[act] = !allActive;
    });

    setForm((prev) => ({
      ...prev,
      role: prev.role === 'owner' ? 'owner' : 'custom',
      roleLabel: prev.role === 'owner' ? prev.roleLabel : '⚙️ Custom Configured Role',
      permissions: {
        ...prev.permissions,
        [moduleId]: newModulePerms,
      },
    }));
  };

  // Bulk Quick Action: Grant All
  const handleGrantAll = () => {
    const fullPerms = {};
    PERMISSION_MODULES.forEach((mod) => {
      fullPerms[mod.id] = {};
      mod.actions.forEach((act) => {
        fullPerms[mod.id][act] = true;
      });
    });

    setForm((prev) => ({
      ...prev,
      permissions: fullPerms,
    }));
    toast.success('Granted all permissions across all modules');
  };

  // Bulk Quick Action: Read-Only
  const handleReadOnlyAll = () => {
    const readOnlyPerms = {};
    PERMISSION_MODULES.forEach((mod) => {
      readOnlyPerms[mod.id] = { view: true };
      mod.actions.forEach((act) => {
        if (act !== 'view') {
          readOnlyPerms[mod.id][act] = false;
        }
      });
    });

    setForm((prev) => ({
      ...prev,
      role: 'custom',
      roleLabel: '⚙️ Custom Configured Role',
      permissions: readOnlyPerms,
    }));
    toast.success('Set all modules to Read-Only access');
  };

  // Bulk Quick Action: Revoke All
  const handleRevokeAll = () => {
    const emptyPerms = {};
    PERMISSION_MODULES.forEach((mod) => {
      emptyPerms[mod.id] = {};
      mod.actions.forEach((act) => {
        emptyPerms[mod.id][act] = false;
      });
    });

    setForm((prev) => ({
      ...prev,
      role: 'custom',
      roleLabel: '⚙️ Custom Configured Role',
      permissions: emptyPerms,
    }));
    toast.success('Revoked all module permissions');
  };

  // Form Submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Full Name and Login Email are required.');
      return;
    }
    if (!editingStaff && (!form.password || form.password.length < 5)) {
      toast.error('Password must be at least 5 characters for new accounts.');
      return;
    }

    if (editingStaff) {
      updateMutation.mutate({
        id: editingStaff.id,
        data: form,
      });
    } else {
      addMutation.mutate(form);
    }
  };

  // Filtered staff list
  const filteredStaffList = useMemo(() => {
    return staffList.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.roleLabel && s.roleLabel.toLowerCase().includes(q));

      const matchRole =
        roleFilter === 'all' ||
        (roleFilter === 'owner' && s.role === 'owner') ||
        (roleFilter === 'marketing' && s.role === 'marketing') ||
        (roleFilter === 'manager' && s.role === 'manager') ||
        (roleFilter === 'support' && s.role === 'support') ||
        (roleFilter === 'custom' && s.role === 'custom');

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && s.status === 'active') ||
        (statusFilter === 'inactive' && s.status === 'inactive');

      return matchSearch && matchRole && matchStatus;
    });
  }, [staffList, search, roleFilter, statusFilter]);

  // Total active rights count for current form
  const formActiveRightsCount = useMemo(() => {
    let count = 0;
    PERMISSION_MODULES.forEach((mod) => {
      mod.actions.forEach((act) => {
        if (form.permissions?.[mod.id]?.[act]) count++;
      });
    });
    return count;
  }, [form.permissions]);

  const totalPossibleRightsCount = useMemo(() => {
    return PERMISSION_MODULES.reduce((acc, m) => acc + m.actions.length, 0);
  }, []);

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading staff accounts and permissions matrix..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & Role Permissions"
        subtitle="Create IDs & Passwords for Marketing, Operations, and Management staff. Define granular View, Create, Edit & Delete access rights."
        action={
          hasPermission('staff', 'create') && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => openModal(null, 'owner')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Crown size={16} />
                <span>👑 Add Business Owner</span>
              </button>
              <button
                onClick={() => openModal(null, 'marketing')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Staff Member</span>
              </button>
            </div>
          )
        }
      />

      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Team Accounts"
          value={staffList.length}
          subtitle="All team members registered"
          icon={UserCog}
          color="indigo"
        />
        <StatCard
          title="👑 Business Owners"
          value={staffList.filter((s) => s.role === 'owner').length}
          subtitle="Full unrestricted authority"
          icon={Crown}
          color="amber"
        />
        <StatCard
          title="Field Marketing Reps"
          value={staffList.filter((s) => s.role === 'marketing').length}
          subtitle="Library & Gym field agents"
          icon={ShieldCheck}
          color="emerald"
        />
        <StatCard
          title="Active Accounts"
          value={staffList.filter((s) => s.status === 'active').length}
          subtitle="Can currently sign in"
          icon={CheckCircle2}
          color="blue"
        />
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by staff name, email, phone or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">Status:</span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All ({staffList.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                Active ({staffList.filter((s) => s.status === 'active').length})
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'inactive'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-rose-700'
                }`}
              >
                Disabled ({staffList.filter((s) => s.status === 'inactive').length})
              </button>
            </div>
          </div>
        </div>

        {/* Role Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Roles:
          </span>
          {[
            { id: 'all', label: 'All Roles', count: staffList.length },
            { id: 'owner', label: '👑 Owners', count: staffList.filter((s) => s.role === 'owner').length },
            { id: 'marketing', label: '🚶 Field Reps', count: staffList.filter((s) => s.role === 'marketing').length },
            { id: 'manager', label: '👔 Managers', count: staffList.filter((s) => s.role === 'manager').length },
            { id: 'support', label: '🎧 Support', count: staffList.filter((s) => s.role === 'support').length },
            { id: 'custom', label: '⚙️ Custom', count: staffList.filter((s) => s.role === 'custom').length },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setRoleFilter(chip.id)}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                roleFilter === chip.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{chip.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  roleFilter === chip.id ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {chip.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Staff Member</th>
                <th className="px-5 py-3.5">Role & Access</th>
                <th className="px-5 py-3.5">Compensation</th>
                <th className="px-5 py-3.5">Daily Targets & Work Logged</th>
                <th className="px-5 py-3.5">Est. Total Payout</th>
                <th className="px-5 py-3.5 text-center">Login Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStaffList.length > 0 ? (
                filteredStaffList.map((staff) => {
                  const payroll = calculateStaffPayroll(staff, allVisits);
                  const isCurrent = currentUser?.id === staff.id || currentUser?.uid === staff.id;
                  const activeModulesCount = staff.role === 'owner'
                    ? PERMISSION_MODULES.length
                    : PERMISSION_MODULES.filter((m) => staff.permissions?.[m.id]?.view).length;

                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Contact */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${
                              staff.role === 'owner'
                                ? 'bg-gradient-to-tr from-amber-400 to-yellow-500 text-amber-950 border border-amber-300'
                                : 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white border border-blue-400'
                            }`}
                          >
                            {staff.role === 'owner' ? <Crown size={16} /> : staff.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 block truncate">{staff.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block truncate flex items-center gap-1 mt-0.5">
                              <Mail size={11} className="shrink-0" />
                              <span>{staff.email}</span>
                            </span>
                            {staff.phone && (
                              <a
                                href={`tel:${staff.phone}`}
                                className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-0.5 transition"
                              >
                                <Phone size={10} className="shrink-0" />
                                <span>{staff.phone}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role & Access Summary */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {staff.role === 'owner' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900 border border-amber-300 shadow-2xs">
                              <Crown size={13} className="text-amber-600" />
                              <span>Business Owner</span>
                            </span>
                          ) : (
                            <Badge
                              variant={
                                staff.role === 'manager'
                                  ? 'info'
                                  : staff.role === 'marketing'
                                  ? 'purple'
                                  : staff.role === 'support'
                                  ? 'emerald'
                                  : 'default'
                              }
                              size="sm"
                            >
                              {ROLE_PRESETS[staff.role]?.label || staff.roleLabel || staff.role}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                            <Shield size={11} className="text-slate-400" />
                            <span>
                              {staff.role === 'owner' ? (
                                <span className="text-amber-700 font-bold">Full Access (All Modules)</span>
                              ) : (
                                <span>{activeModulesCount} of {PERMISSION_MODULES.length} modules enabled</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Compensation */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {staff.role === 'owner' && payroll.baseSalary === 0 ? (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 block w-fit">
                            👑 Full Control / Equity
                          </span>
                        ) : (
                          <>
                            <div className="font-bold text-slate-800">
                              ₹{payroll.baseSalary.toLocaleString('en-IN')}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">/ mo</span>
                            </div>
                            <div className="text-[11px] font-medium text-blue-600 mt-0.5">
                              +₹{payroll.commissionPerDeal.toLocaleString('en-IN')}{' '}
                              <span className="text-[10px] text-slate-400">/ deal</span>
                            </div>
                          </>
                        )}
                      </td>

                      {/* Daily Targets & Work Logged */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {/* Daily Visits Goal */}
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded shadow-2xs">
                            ⚡ Today Visits
                          </span>
                          <span>
                            {payroll.todayVisits} {payroll.dailyTargetVisits > 0 ? `/ ${payroll.dailyTargetVisits}` : ''} Visits
                          </span>
                          {payroll.dailyTargetVisits > 0 ? (
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                                payroll.dailyVisitAchievement >= 100
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {payroll.dailyVisitAchievement}%
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Logged</span>
                          )}
                        </div>

                        {/* Daily Deals Goal */}
                        {payroll.dailyTargetDeals > 0 && (
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 mt-1">
                            <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded shadow-2xs">
                              🎯 Today Deals
                            </span>
                            <span>{payroll.todayDeals} / {payroll.dailyTargetDeals} Deals</span>
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                                payroll.dailyDealAchievement >= 100
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {payroll.dailyDealAchievement}%
                            </span>
                          </div>
                        )}

                        {/* Total Logged Overview */}
                        <div className="flex items-center gap-1.5 text-slate-600 font-semibold mt-1.5 pt-1 border-t border-slate-100 text-[11px]">
                          <Navigation size={11} className="text-blue-600 shrink-0" />
                          <span>{payroll.totalVisits} Total Visits Logged</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-emerald-600 font-bold">{payroll.dealsClosed} Deals Won</span>
                        </div>

                        <div className="text-[10px] text-slate-400 mt-0.5">
                          +₹{payroll.commissionEarned.toLocaleString('en-IN')} commission earned
                        </div>
                      </td>

                      {/* Est. Total Payout */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-sm font-black text-emerald-600">
                          ₹{payroll.totalEstimatedPayout.toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-slate-400 block">Est. Monthly Total</span>
                      </td>

                      {/* Quick Login Status Switch */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => {
                            statusToggleMutation.mutate({
                              id: staff.id,
                              currentStatus: staff.status || 'active',
                            });
                          }}
                          disabled={statusToggleMutation.isPending || isCurrent}
                          title={isCurrent ? 'Cannot disable your own active account' : 'Click to toggle status'}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed ${
                            staff.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              staff.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                            }`}
                          />
                          <span>{staff.status === 'active' ? 'Active' : 'Disabled'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openModal(staff)}
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer border border-transparent hover:border-blue-200"
                            title="Edit Role, Salary & Permissions"
                          >
                            <Edit2 size={15} />
                          </button>
                          {hasPermission('staff', 'delete') && (
                            <button
                              onClick={() => {
                                if (isCurrent) {
                                  toast.error('You cannot delete your own logged-in account.');
                                  return;
                                }
                                if (
                                  window.confirm(
                                    `Are you sure you want to delete staff account "${staff.name}" (${staff.email})?`
                                  )
                                ) {
                                  deleteMutation.mutate(staff.id);
                                }
                              }}
                              disabled={isCurrent}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-200"
                              title={isCurrent ? 'Cannot delete current account' : 'Delete account'}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8">
                    <EmptyState
                      icon={UserCog}
                      title="No team accounts found"
                      description={
                        search || roleFilter !== 'all' || statusFilter !== 'all'
                          ? 'No staff accounts match your search/filter criteria. Try clearing filters.'
                          : "Click 'Add Staff Member' or 'Add Business Owner' to create team logins and configure granular access."
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Create / Edit Staff & Granular Permissions Matrix Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          <div className="flex items-center gap-2.5">
            <span>{editingStaff ? `Edit: ${editingStaff.name}` : 'Create New Team Member'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
              {form.role === 'owner' ? '👑 Owner Account' : form.roleLabel || 'Staff Member'}
            </span>
          </div>
        }
        subtitle="Manage login credentials, role presets, salary compensation, and granular View/Edit/Delete access rights"
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Modal Tab Selector */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-2 overflow-x-auto">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalTab('profile')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'profile'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <User size={14} />
                <span>1. Profile & Login</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('role')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'role'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Briefcase size={14} />
                <span>2. Role & Salary</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('permissions')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'permissions'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck size={14} />
                <span>3. Granular Permissions</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500 text-white">
                  {formActiveRightsCount}
                </span>
              </button>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-bold text-slate-400">
                Active Rights: {formActiveRightsCount} / {totalPossibleRightsCount}
              </span>
            </div>
          </div>

          {/* TAB 1: PROFILE & CREDENTIALS */}
          {modalTab === 'profile' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Login Email / User ID *
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. rahul@univoinfotech.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {editingStaff ? 'New Password' : 'Password *'}
                    </label>
                    {editingStaff && (
                      <span className="text-[10px] text-slate-400 font-medium">Leave blank to keep current</span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingStaff}
                      placeholder={editingStaff ? '••••••••' : 'Minimum 5 characters'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white font-mono transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mobile Phone
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Login Account Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white font-medium cursor-pointer"
                  >
                    <option value="active">Active (Can Login)</option>
                    <option value="inactive">Disabled (Login Blocked)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setModalTab('role')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  <span>Next: Role & Salary</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ROLE PRESET & COMPENSATION */}
          {modalTab === 'role' && (
            <div className="space-y-5 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Role Preset (Sets Recommended Permissions)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(ROLE_PRESETS)
                    .filter(([key]) => key !== 'custom')
                    .map(([key, preset]) => {
                      const isSelected = form.role === key;
                      const isOwner = key === 'owner';

                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => handleRolePresetChange(key)}
                          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer relative flex flex-col justify-between ${
                            isSelected
                              ? isOwner
                                ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                                : 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-600/20 shadow-sm'
                              : isOwner
                              ? 'bg-amber-50/30 border-amber-200/80 hover:bg-amber-50/70'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {isSelected && (
                            <span
                              className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                                isOwner ? 'bg-amber-600' : 'bg-blue-600'
                              }`}
                            >
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}

                          <div>
                            <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 pr-6">
                              {isOwner && <Crown size={14} className="text-amber-600 shrink-0" />}
                              <span>{preset.label}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
                              {preset.description}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                            <span className={isSelected ? 'text-blue-700 font-extrabold' : 'text-slate-400'}>
                              {isSelected ? '✓ Active Template' : 'Click to Apply'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Owner Notice */}
              {form.role === 'owner' ? (
                <div className="p-4 bg-gradient-to-r from-amber-50 via-amber-100/70 to-yellow-50 border border-amber-300 rounded-2xl flex items-center gap-3.5 text-xs text-amber-950 font-bold shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Crown size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-950">👑 Supreme Authority Account</p>
                    <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                      Business Owner accounts automatically enjoy 100% full View, Create, Edit, and Delete access across all modules, client subscriptions, financial ledgers, and staff security settings.
                    </p>
                  </div>
                </div>
              ) : (
                /* Salary & Commission Box */
                <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                      <IndianRupee size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                        Salary & Performance Compensation
                      </h4>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Set fixed monthly base salary, deal closing commission, and monthly targets
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Row 1: Salary & Commission */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Base Salary (₹ / Mo)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="15000"
                            value={form.compensation?.baseSalary ?? ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                compensation: { ...form.compensation, baseSalary: Number(e.target.value) },
                              })
                            }
                            className="w-full pl-7 pr-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Commission (₹ / Deal)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="500"
                            value={form.compensation?.commissionPerDeal ?? ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                compensation: { ...form.compensation, commissionPerDeal: Number(e.target.value) },
                              })
                            }
                            className="w-full pl-7 pr-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Daily Performance Targets */}
                    <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-2xs">
                          <Zap size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                            ⚡ Daily Performance Targets
                          </h4>
                          <p className="text-[11px] text-amber-800 font-medium">
                            Set the expected daily visits & deals required from this staff member
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-amber-950 uppercase tracking-wider mb-1">
                            Daily Target Visits (Visits / Day)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="e.g. 15"
                            value={form.compensation?.dailyTargetVisits ?? ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                compensation: { ...form.compensation, dailyTargetVisits: Number(e.target.value) },
                              })
                            }
                            className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-amber-600 shadow-2xs"
                          />
                          <p className="text-[11px] text-amber-700 font-medium mt-1">
                            Required client visits per day (Tracked live in Field Reports & Staff Dashboard)
                          </p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-amber-950 uppercase tracking-wider mb-1">
                            Daily Target Deals (Deals / Day)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="e.g. 2"
                            value={form.compensation?.dailyTargetDeals ?? ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                compensation: { ...form.compensation, dailyTargetDeals: Number(e.target.value) },
                              })
                            }
                            className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-amber-600 shadow-2xs"
                          />
                          <p className="text-[11px] text-amber-700 font-medium mt-1">
                            Required deals to close per day
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setModalTab('profile')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('permissions')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  <span>Next: Granular Permissions</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: GRANULAR PERMISSIONS MATRIX */}
          {modalTab === 'permissions' && (
            <div className="space-y-4 pt-1">
              {/* Quick Actions Toolbar */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Quick Templates:</span>
                  <button
                    type="button"
                    onClick={handleGrantAll}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    🌟 Grant All (Full Access)
                  </button>
                  <button
                    type="button"
                    onClick={handleReadOnlyAll}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    👁️ Read-Only All
                  </button>
                  <button
                    type="button"
                    onClick={handleRevokeAll}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    🚫 Revoke All
                  </button>
                </div>

                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Active Permissions:</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black">
                    {formActiveRightsCount} / {totalPossibleRightsCount}
                  </span>
                </div>
              </div>

              {/* Categorized Permissions Grid */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200 max-h-96 overflow-y-auto">
                {['Overview', 'Field & Marketing', 'Clients & Support', 'Finance & Settings'].map((cat) => {
                  const catModules = PERMISSION_MODULES.filter((m) => m.category === cat);
                  if (catModules.length === 0) return null;

                  return (
                    <div key={cat} className="p-3 bg-white space-y-2">
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-2">
                        {cat}
                      </div>

                      <div className="space-y-1.5">
                        {catModules.map((mod) => {
                          const modPerms = form.permissions[mod.id] || {};
                          const allActive = mod.actions.every((act) => modPerms[act]);
                          const anyActive = mod.actions.some((act) => modPerms[act]);

                          return (
                            <div
                              key={mod.id}
                              className={`p-2.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                allActive
                                  ? 'bg-emerald-50/30 border-emerald-200/80'
                                  : anyActive
                                  ? 'bg-blue-50/20 border-blue-200/60'
                                  : 'bg-slate-50/40 border-slate-200'
                              }`}
                            >
                              {/* Module Title & Master Toggle */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleEntireModule(mod.id)}
                                  className={`p-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
                                    allActive
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : anyActive
                                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                                      : 'bg-white text-slate-300 border-slate-300 hover:text-slate-500'
                                  }`}
                                  title={allActive ? 'Disable entire module' : 'Enable entire module'}
                                >
                                  {allActive ? (
                                    <Check size={14} strokeWidth={3} />
                                  ) : anyActive ? (
                                    <Sparkles size={14} />
                                  ) : (
                                    <X size={14} />
                                  )}
                                </button>
                                <div>
                                  <span className="text-xs font-bold text-slate-900 block truncate">
                                    {mod.label}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    {allActive ? 'Full Access' : anyActive ? 'Custom Rights' : 'No Access'}
                                  </span>
                                </div>
                              </div>

                              {/* Action Toggles */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {['view', 'create', 'edit', 'delete'].map((action) => {
                                  const isSupported = mod.actions.includes(action);
                                  const isAllowed = Boolean(modPerms[action]);

                                  if (!isSupported) return null;

                                  return (
                                    <button
                                      type="button"
                                      key={action}
                                      onClick={() => togglePermissionAction(mod.id, action)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 border ${
                                        isAllowed
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      {isAllowed ? <Check size={11} strokeWidth={3} /> : <X size={10} />}
                                      <span className="capitalize">{action}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setModalTab('role')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Role</span>
                </button>

                <div className="text-xs font-bold text-slate-500">
                  Role will be saved as: <strong className="text-slate-900">{form.roleLabel}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || updateMutation.isPending}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {addMutation.isPending || updateMutation.isPending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Staff Account...</span>
                </>
              ) : (
                <>
                  <Check size={14} strokeWidth={3} />
                  <span>{editingStaff ? 'Update Staff & Permissions' : 'Create Staff Account'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
