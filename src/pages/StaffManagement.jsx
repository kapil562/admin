import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaffUsers,
  addStaffUser,
  updateStaffUser,
  deleteStaffUser,
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
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Lock,
  User,
  Check,
  X,
  AlertCircle,
  IndianRupee,
  Target,
  Award,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const StaffManagement = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'marketing',
    status: 'active',
    compensation: {
      baseSalary: 15000,
      commissionPerDeal: 500,
      monthlyTargetDeals: 10,
      monthlyTargetVisits: 50,
    },
    permissions: ROLE_PRESETS.marketing.permissions,
  });

  // 1. Fetch Staff
  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
  });

  // Fetch Visits for payroll computation
  const { data: allVisits = [] } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  // 2. Add Mutation
  const addMutation = useMutation({
    mutationFn: addStaffUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_staff_users'] });
      toast.success('Staff account created successfully');
      setShowModal(false);
    },
    onError: (err) => toast.error(err.message || 'Error creating staff'),
  });

  // 3. Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateStaffUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_staff_users'] });
      toast.success('Staff permissions updated');
      setShowModal(false);
    },
    onError: (err) => toast.error(err.message || 'Error updating staff'),
  });

  // 4. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteStaffUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_staff_users'] });
      toast.success('Staff account removed');
    },
    onError: (err) => toast.error(err.message || 'Error deleting staff'),
  });

  const openModal = (staff = null, defaultRole = 'marketing') => {
    if (staff) {
      setEditingStaff(staff);
      setForm({
        name: staff.name || '',
        email: staff.email || '',
        password: staff.password || '',
        phone: staff.phone || '',
        role: staff.role || 'custom',
        status: staff.status || 'active',
        compensation: {
          baseSalary: staff.compensation?.baseSalary ?? (staff.role === 'owner' ? 0 : 15000),
          commissionPerDeal: staff.compensation?.commissionPerDeal ?? (staff.role === 'owner' ? 0 : 500),
          monthlyTargetDeals: staff.compensation?.monthlyTargetDeals ?? 10,
          monthlyTargetVisits: staff.compensation?.monthlyTargetVisits ?? 50,
        },
        permissions: staff.permissions || (ROLE_PRESETS[staff.role]?.permissions || {}),
      });
    } else {
      setEditingStaff(null);
      const isOwner = defaultRole === 'owner';
      setForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: defaultRole,
        status: 'active',
        compensation: {
          baseSalary: isOwner ? 0 : 15000,
          commissionPerDeal: isOwner ? 0 : 500,
          monthlyTargetDeals: isOwner ? 0 : 10,
          monthlyTargetVisits: isOwner ? 0 : 50,
        },
        permissions: ROLE_PRESETS[defaultRole]?.permissions || ROLE_PRESETS.marketing.permissions,
      });
    }
    setShowModal(true);
  };

  const handleRolePresetChange = (newRole) => {
    const preset = ROLE_PRESETS[newRole];
    setForm({
      ...form,
      role: newRole,
      permissions: preset ? preset.permissions : form.permissions,
    });
  };

  const togglePermissionAction = (moduleId, action) => {
    const currentModule = form.permissions[moduleId] || {};
    const updatedModule = {
      ...currentModule,
      [action]: !currentModule[action],
    };

    setForm({
      ...form,
      role: 'custom', // custom when tweaked
      permissions: {
        ...form.permissions,
        [moduleId]: updatedModule,
      },
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and Email are required.');
      return;
    }
    if (!editingStaff && (!form.password || form.password.length < 5)) {
      toast.error('Password must be at least 5 characters.');
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

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading staff accounts and roles..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & Role Permissions"
        subtitle="Create IDs & Passwords for Marketing and Operations staff, define granular View/Edit/Delete rights."
        action={
          hasPermission('staff', 'create') && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => openModal(null, 'owner')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition cursor-pointer"
              >
                <Crown size={16} />
                <span>👑 Add New Owner</span>
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

      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Team Accounts"
          value={staffList.length}
          subtitle="All team accounts registered"
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
          subtitle="Library & Gym field staff"
          icon={ShieldCheck}
          color="emerald"
        />
        <StatCard
          title="Active Accounts"
          value={staffList.filter((s) => s.status === 'active').length}
          subtitle="Can login to the portal"
          icon={Check}
          color="blue"
        />
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Staff Member</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Base Salary</th>
                <th className="px-5 py-3.5">Commission / Deal</th>
                <th className="px-5 py-3.5">Deals & Earned</th>
                <th className="px-5 py-3.5">Est. Total Payout</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {staffList.length > 0 ? (
                staffList.map((staff) => {
                  const payroll = calculateStaffPayroll(staff, allVisits);
                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Contact */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                            {staff.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{staff.name}</span>
                            <span className="text-[11px] text-slate-400 block">{staff.email}</span>
                            {staff.phone && <span className="text-[10px] text-slate-500 block">{staff.phone}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {staff.role === 'owner' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900 border border-amber-300 shadow-2xs">
                            <Crown size={13} className="text-amber-600" />
                            <span>Business Owner</span>
                          </span>
                        ) : (
                          <Badge variant={staff.role === 'manager' ? 'info' : 'purple'} size="sm">
                            {ROLE_PRESETS[staff.role]?.label || staff.roleLabel || staff.role}
                          </Badge>
                        )}
                      </td>

                      {/* Base Salary */}
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-slate-800 text-xs">
                        {staff.role === 'owner' && payroll.baseSalary === 0 ? (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 block w-fit">
                            👑 Full Control / Equity
                          </span>
                        ) : (
                          <>
                            ₹{payroll.baseSalary.toLocaleString('en-IN')}
                            <span className="text-[10px] font-normal text-slate-400 block">per month</span>
                          </>
                        )}
                      </td>

                      {/* Commission Rate */}
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-blue-600 text-xs">
                        ₹{payroll.commissionPerDeal.toLocaleString('en-IN')}
                        <span className="text-[10px] font-normal text-slate-400 block">per deal closed</span>
                      </td>

                      {/* Deals Closed & Commission */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                          <Award size={13} />
                          <span>{payroll.dealsClosed} deals</span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 block">
                          +₹{payroll.commissionEarned.toLocaleString('en-IN')} earned
                        </span>
                      </td>

                      {/* Est. Total Payout */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-xs font-black text-emerald-600">
                          ₹{payroll.totalEstimatedPayout.toLocaleString('en-IN')}
                        </div>
                        <div className="w-20 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${payroll.targetAchievement}%` }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge variant={staff.status === 'active' ? 'success' : 'danger'} dot>
                          {staff.status === 'active' ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal(staff)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Edit Permissions & Salary"
                          >
                            <Edit2 size={15} />
                          </button>
                          {hasPermission('staff', 'delete') && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete staff member "${staff.name}"?`)) {
                                  deleteMutation.mutate(staff.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete"
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
                  <td colSpan={8} className="p-8">
                    <EmptyState
                      icon={UserCog}
                      title="No staff members registered"
                      description="Click 'Add Staff Member' to create logins, set fixed salary, commission per deal, and configure module permissions."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Create & Permission Matrix Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingStaff ? `Edit Staff: ${editingStaff.name}` : 'Add New Staff Member'}
        subtitle="Set authentication credentials and granular module rights"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Login Email / ID *
              </label>
              <input
                type="email"
                required
                placeholder="rahul@univoinfotech.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password *
              </label>
              <input
                type="text"
                required={!editingStaff}
                placeholder="e.g. Pass@123"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 font-mono"
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Account Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="active">Active (Can Sign In)</option>
                <option value="inactive">Disabled (Blocked)</option>
              </select>
            </div>
          </div>

          {/* Salary, Commission & Targets */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <IndianRupee size={15} />
              </div>
              <div>
                <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                  Salary & Commission Compensation
                </h4>
                <p className="text-[11px] text-emerald-700 font-medium">
                  Set fixed monthly salary, commission earned per deal closed, and monthly targets
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Base Salary (₹ / Mo)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
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
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
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

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Deals / Mo
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="10"
                  value={form.compensation?.monthlyTargetDeals ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      compensation: { ...form.compensation, monthlyTargetDeals: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Visits / Mo
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="50"
                  value={form.compensation?.monthlyTargetVisits ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      compensation: { ...form.compensation, monthlyTargetVisits: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Role Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Apply Role Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {Object.entries(ROLE_PRESETS).filter(([key]) => key !== 'custom').map(([key, preset]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleRolePresetChange(key)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer relative overflow-hidden ${
                    form.role === key
                      ? key === 'owner'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-blue-50 border-blue-600 ring-2 ring-blue-600/10'
                      : key === 'owner'
                      ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {key === 'owner' && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[9px] font-black rounded uppercase">
                      Full Access
                    </span>
                  )}
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    {key === 'owner' && <Crown size={13} className="text-amber-600 shrink-0" />}
                    <span className="truncate">{preset.label}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Owner Supreme Authority Banner */}
          {form.role === 'owner' && (
            <div className="p-3 bg-gradient-to-r from-amber-50 via-amber-100/60 to-yellow-50 border border-amber-300 rounded-xl flex items-center gap-3 text-xs text-amber-950 font-bold shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Crown size={16} />
              </div>
              <div>
                <p className="text-xs font-black text-amber-950">👑 Supreme Authority Account</p>
                <p className="text-[11px] text-amber-800 font-medium">
                  Business Owner accounts have 100% full access to all platform modules, settings, staff credentials, and financial ledger.
                </p>
              </div>
            </div>
          )}

          {/* Granular Permission Matrix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Granular Permissions Matrix
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Toggle individual module rights
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr className="text-slate-600 font-bold">
                    <th className="px-4 py-2.5">System Module</th>
                    <th className="px-3 py-2.5 text-center">View</th>
                    <th className="px-3 py-2.5 text-center">Create / Add</th>
                    <th className="px-3 py-2.5 text-center">Edit / Update</th>
                    <th className="px-3 py-2.5 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {PERMISSION_MODULES.map((mod) => {
                    const modPerms = form.permissions[mod.id] || {};
                    return (
                      <tr key={mod.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-bold text-slate-800">
                          {mod.label}
                        </td>
                        {['view', 'create', 'edit', 'delete'].map((action) => {
                          const isSupported = mod.actions.includes(action);
                          const isAllowed = Boolean(modPerms[action]);

                          return (
                            <td key={action} className="px-3 py-2.5 text-center">
                              {isSupported ? (
                                <button
                                  type="button"
                                  onClick={() => togglePermissionAction(mod.id, action)}
                                  className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition cursor-pointer ${
                                    isAllowed
                                      ? 'bg-emerald-500 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                  }`}
                                >
                                  {isAllowed ? <Check size={14} strokeWidth={3} /> : <X size={12} />}
                                </button>
                              ) : (
                                <span className="text-slate-200 text-[11px]">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
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
              disabled={addMutation.isPending || updateMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {addMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Staff Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
