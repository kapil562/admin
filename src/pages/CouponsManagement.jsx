import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCoupons, saveCoupon, deleteCoupon } from '../firebase/services/couponService';
import { getLibraryClients } from '../firebase/services/libraryService';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Ticket, Plus, Edit2, Trash2, Users, User, Hash, Search, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export const CouponsManagement = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [libSearch, setLibSearch] = useState('');
  const [showLibDropdown, setShowLibDropdown] = useState(false);
  
  const { data: libraries = [] } = useQuery({
    queryKey: ['admin_libraries_for_coupons'],
    queryFn: getLibraryClients,
  });
  
  const [form, setForm] = useState({
    code: '',
    type: 'percentage',
    value: 10,
    targetType: 'all', // 'all', 'specific', 'limited'
    assignedTo: '',
    maxUses: 10,
    isActive: true,
  });

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin_coupons'],
    queryFn: getCoupons,
  });

  const saveMutation = useMutation({
    mutationFn: saveCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_coupons'] });
      toast.success('Coupon saved successfully');
      setModalOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Error saving coupon'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_coupons'] });
      toast.success('Coupon deleted');
    },
    onError: (err) => toast.error(err.message || 'Error deleting coupon'),
  });

  const openModal = (coupon = null) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setForm({
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        targetType: coupon.targetType,
        assignedTo: coupon.assignedTo || '',
        maxUses: coupon.maxUses || 10,
        isActive: coupon.isActive,
      });
      setLibSearch(coupon.assignedTo || '');
      setShowLibDropdown(false);
    } else {
      setEditingCoupon(null);
      setForm({
        code: '',
        type: 'percentage',
        value: 10,
        targetType: 'all',
        assignedTo: '',
        maxUses: 10,
        isActive: true,
      });
      setLibSearch('');
      setShowLibDropdown(false);
    }
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error('Coupon code is required');
    
    saveMutation.mutate({
      ...form,
      id: editingCoupon?.id,
      usedCount: editingCoupon?.usedCount || 0,
    });
  };

  const getTargetLabel = (coupon) => {
    switch (coupon.targetType) {
      case 'all': return 'All Users';
      case 'specific': return 'Specific User';
      case 'limited': return 'Limited Uses';
      default: return 'All Users';
    }
  };

  const getTargetIcon = (coupon) => {
    switch (coupon.targetType) {
      case 'all': return <Users size={14} />;
      case 'specific': return <User size={14} />;
      case 'limited': return <Hash size={14} />;
      default: return <Users size={14} />;
    }
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons & Promos"
        subtitle="Manage discount codes, vouchers, and their usage limits"
        icon={Ticket}
        action={
          hasPermission('coupons', 'create') && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-xs cursor-pointer"
            >
              <Plus size={16} />
              <span>Create Coupon</span>
            </button>
          )
        }
      />

      {coupons.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No Coupons Found"
          description="Create your first promo code to boost sales."
          action={
            hasPermission('coupons', 'create') && (
              <button
                onClick={() => openModal()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-xs cursor-pointer"
              >
                Create Coupon
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coupons.map((coupon) => {
            const isSoldOut = coupon.targetType === 'limited' && coupon.usedCount >= coupon.maxUses;
            const displayActive = coupon.isActive && !isSoldOut;

            return (
              <div
                key={coupon.id}
                className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between relative overflow-hidden ${isSoldOut ? 'opacity-80 grayscale-[20%]' : ''}`}
              >
                <div
                  className={`absolute top-0 inset-x-0 h-1.5 ${
                    displayActive ? 'bg-blue-600' : isSoldOut ? 'bg-rose-500' : 'bg-slate-300'
                  }`}
                />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-lg font-black text-slate-900 tracking-wider truncate">
                      {coupon.code}
                    </h3>
                    <Badge variant={displayActive ? 'success' : isSoldOut ? 'danger' : 'neutral'} size="sm">
                      {isSoldOut ? 'Fully Used' : coupon.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-blue-600">
                        {coupon.type === 'flat' ? `₹${coupon.value}` : `${coupon.value}%`}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                        Discount
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 py-3 border-y border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Target Audience:</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        {getTargetIcon(coupon)}
                        {getTargetLabel(coupon)}
                      </span>
                    </div>
                    {coupon.targetType === 'specific' && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Assigned Library ID:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[120px]" title={coupon.assignedTo}>
                          {coupon.assignedTo}
                        </span>
                      </div>
                    )}
                    {coupon.targetType === 'limited' && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Usage Limit:</span>
                        <span className="font-bold text-rose-600">
                          {coupon.usedCount} / {coupon.maxUses} Used
                        </span>
                      </div>
                    )}
                    {coupon.targetType !== 'limited' && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Total Uses:</span>
                        <span className="font-bold text-slate-800">
                          {coupon.usedCount} Times
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-slate-100">
                  {hasPermission('coupons', 'edit') && (
                    <button
                      onClick={() => openModal(coupon)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      title="Edit Coupon"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {hasPermission('coupons', 'delete') && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete coupon "${coupon.code}"?`)) {
                          deleteMutation.mutate(coupon.id);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Delete Coupon"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingCoupon ? "Edit Coupon" : "Create Coupon"}>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Coupon Code
            </label>
            <input
              type="text"
              required
              value={form.code}
              onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. SUMMER50"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600 uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Discount Type
              </label>
              <select
                value={form.type}
                onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Discount Value
              </label>
              <input
                type="number"
                required
                min="0"
                value={form.value}
                onChange={e => setForm(prev => ({ ...prev, value: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Who can use this?
            </label>
            <select
              value={form.targetType}
              onChange={e => setForm(prev => ({ ...prev, targetType: e.target.value }))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600"
            >
              <option value="all">Any User (Unlimited Usage)</option>
              <option value="limited">Limited Quantity (First X Users)</option>
              <option value="specific">Specific Library (Only 1 User)</option>
            </select>
          </div>

          {form.targetType === 'limited' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Maximum Allowed Uses
              </label>
              <input
                type="number"
                required
                min="1"
                value={form.maxUses}
                onChange={e => setForm(prev => ({ ...prev, maxUses: e.target.value }))}
                placeholder="e.g. 50"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          )}

          {form.targetType === 'specific' && (
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Specific Library
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  required={!form.assignedTo}
                  placeholder="Search by library name or ID..."
                  value={libSearch}
                  onChange={e => {
                    setLibSearch(e.target.value);
                    setShowLibDropdown(true);
                  }}
                  onFocus={() => setShowLibDropdown(true)}
                  onBlur={() => setTimeout(() => setShowLibDropdown(false), 200)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-blue-600"
                />
              </div>
              
              {showLibDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {libraries
                    .filter(lib => 
                      (lib.libraryName || '').toLowerCase().includes(libSearch.toLowerCase()) || 
                      (lib.id || '').toLowerCase().includes(libSearch.toLowerCase())
                    )
                    .map(lib => (
                      <div 
                        key={lib.id}
                        className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                        onClick={() => {
                          setForm(prev => ({ ...prev, assignedTo: lib.id }));
                          setLibSearch(lib.libraryName || lib.id);
                          setShowLibDropdown(false);
                        }}
                      >
                        <div className="font-bold text-sm text-slate-900">{lib.libraryName || 'Unnamed Library'}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">ID: {lib.id}</div>
                      </div>
                    ))}
                  {libraries.filter(lib => 
                    (lib.libraryName || '').toLowerCase().includes(libSearch.toLowerCase()) || 
                    (lib.id || '').toLowerCase().includes(libSearch.toLowerCase())
                  ).length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">No libraries found</div>
                  )}
                </div>
              )}
              {form.assignedTo && (
                <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Check size={14} /> Selected ID: {form.assignedTo}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className="text-sm font-bold text-slate-700">Coupon Status</span>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                form.isActive ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : (editingCoupon ? 'Update Coupon' : 'Create Coupon')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
