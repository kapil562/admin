import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSubscriptionPlans,
  saveSubscriptionPlan,
  deleteSubscriptionPlan,
  getWhatsAppPlans,
  saveWhatsAppPlan,
  deleteWhatsAppPlan,
  AVAILABLE_MODULES,
  getReferralSettings,
  saveReferralSettings,
} from '../firebase/services/planService';
import {
  getSoftwareVerticals,
  toggleSoftwareVertical,
} from '../firebase/services/verticalService';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Crown,
  MessageCircle,
  Plus,
  Edit2,
  Trash2,
  Check,
  Building2,
  Calendar,
  Users,
  ShieldCheck,
  Zap,
  Layers,
  Dumbbell,
  GraduationCap,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Gift,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const PlansManagement = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('subscription');

  // Subscription Modal State
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingSubPlan, setEditingSubPlan] = useState(null);
  const [subForm, setSubForm] = useState({
    name: '',
    durationLabel: '/mo',
    durationDays: 30,
    originalPrice: '',
    offerPrice: '',
    discountText: '',
    maxStudents: 100,
    purchaseLimit: 0,
    purchasedCount: 0,
    modules: ['Dashboard', 'Settings'],
    features: ['Unlimited Seats', 'Standard Support'],
    isActive: true,
  });

  // WhatsApp Modal State
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [editingWaPlan, setEditingWaPlan] = useState(null);
  const [waForm, setWaForm] = useState({
    name: '',
    numberOfMessages: 1000,
    originalPrice: '',
    offerPrice: '',
    discountText: '',
    isActive: true,
  });

  const [referralForm, setReferralForm] = useState({
    refereeDiscountType: 'percentage',
    refereeDiscountValue: 10,
    referrerRewardType: 'flat',
    referrerRewardValue: 500,
    isActive: true,
  });

  // 1. Queries
  const { data: subPlans = [], isLoading: loadingSub } = useQuery({
    queryKey: ['admin_sub_plans'],
    queryFn: getSubscriptionPlans,
  });

  const { data: waPlans = [], isLoading: loadingWa } = useQuery({
    queryKey: ['admin_wa_plans'],
    queryFn: getWhatsAppPlans,
  });

  const { data: verticals = [], isLoading: loadingVert } = useQuery({
    queryKey: ['software_verticals'],
    queryFn: getSoftwareVerticals,
  });

  const { data: referralConfig, isLoading: loadingReferral } = useQuery({
    queryKey: ['referral_config'],
    queryFn: getReferralSettings,
  });

  const referralMutation = useMutation({
    mutationFn: saveReferralSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral_config'] });
      toast.success('Referral settings updated successfully');
    },
    onError: (err) => toast.error(err.message || 'Failed to update referral settings'),
  });

  const toggleVerticalMutation = useMutation({
    mutationFn: ({ id, isActive }) => toggleSoftwareVertical(id, isActive),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['software_verticals'] });
      toast.success(`Software vertical ${vars.isActive ? 'activated' : 'deactivated'} successfully!`);
    },
    onError: (err) => toast.error(err.message || 'Failed to update software vertical'),
  });

  // 2. Mutations
  const subSaveMutation = useMutation({
    mutationFn: saveSubscriptionPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_sub_plans'] });
      toast.success('Subscription plan saved successfully');
      setSubModalOpen(false);
    },
    onError: (e) => toast.error(e.message || 'Error saving plan'),
  });

  const subDeleteMutation = useMutation({
    mutationFn: deleteSubscriptionPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_sub_plans'] });
      toast.success('Subscription plan deleted');
    },
    onError: (e) => toast.error(e.message || 'Error deleting plan'),
  });

  const waSaveMutation = useMutation({
    mutationFn: saveWhatsAppPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_wa_plans'] });
      toast.success('WhatsApp recharge pack saved');
      setWaModalOpen(false);
    },
    onError: (e) => toast.error(e.message || 'Error saving pack'),
  });

  const waDeleteMutation = useMutation({
    mutationFn: deleteWhatsAppPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_wa_plans'] });
      toast.success('WhatsApp pack deleted');
    },
    onError: (e) => toast.error(e.message || 'Error deleting pack'),
  });

  // Effect for referral settings
  useEffect(() => {
    if (referralConfig) {
      setReferralForm({
        refereeDiscountType: referralConfig.refereeDiscountType || 'percentage',
        refereeDiscountValue: referralConfig.refereeDiscountValue || 10,
        referrerRewardType: referralConfig.referrerRewardType || 'flat',
        referrerRewardValue: referralConfig.referrerRewardValue || 500,
        isActive: referralConfig.isActive !== undefined ? referralConfig.isActive : true,
      });
    }
  }, [referralConfig]);

  // Handlers for Subscription
  const openSubModal = (plan = null) => {
    if (plan) {
      setEditingSubPlan(plan);
      setSubForm({
        name: plan.name || '',
        durationLabel: plan.durationLabel || '/mo',
        durationDays: plan.durationDays ?? 30,
        originalPrice: plan.originalPrice || '',
        offerPrice: plan.offerPrice || '',
        discountText: plan.discountText || '',
        maxStudents: plan.maxStudents ?? 0,
        purchaseLimit: plan.purchaseLimit ?? 0,
        purchasedCount: plan.purchasedCount ?? 0,
        modules: plan.modules || ['Dashboard', 'Settings'],
        features: plan.features || ['Unlimited Seats'],
        isActive: plan.isActive !== undefined ? plan.isActive : true,
      });
    } else {
      setEditingSubPlan(null);
      setSubForm({
        name: '',
        durationLabel: '/mo',
        durationDays: 30,
        originalPrice: '',
        offerPrice: '',
        discountText: '',
        maxStudents: 0,
        purchaseLimit: 0,
        purchasedCount: 0,
        modules: ['Dashboard', 'Settings'],
        features: ['Unlimited Seats', 'Standard Support'],
        isActive: true,
      });
    }
    setSubModalOpen(true);
  };

  const handleSubSubmit = (e) => {
    e.preventDefault();
    if (!subForm.name.trim()) return toast.error('Plan name is required');
    subSaveMutation.mutate({
      ...subForm,
      id: editingSubPlan?.id,
      originalPrice: Number(subForm.originalPrice) || 0,
      offerPrice: Number(subForm.offerPrice) || 0,
      durationDays: Number(subForm.durationDays) || 0,
      maxStudents: Number(subForm.maxStudents) || 0,
      purchaseLimit: Number(subForm.purchaseLimit) || 0,
      purchasedCount: subForm.purchasedCount || 0,
      features: subForm.features.map(f => f.trim()).filter(Boolean),
    });
  };

  // Handlers for WhatsApp
  const openWaModal = (pack = null) => {
    if (pack) {
      setEditingWaPlan(pack);
      setWaForm({
        name: pack.name || '',
        numberOfMessages: pack.numberOfMessages || 1000,
        originalPrice: pack.originalPrice || '',
        offerPrice: pack.offerPrice || '',
        discountText: pack.discountText || '',
        isActive: pack.isActive !== undefined ? pack.isActive : true,
      });
    } else {
      setEditingWaPlan(null);
      setWaForm({
        name: '',
        numberOfMessages: 1000,
        originalPrice: '',
        offerPrice: '',
        discountText: '',
        isActive: true,
      });
    }
    setWaModalOpen(true);
  };

  const handleWaSubmit = (e) => {
    e.preventDefault();
    if (!waForm.name.trim()) return toast.error('Pack name is required');
    waSaveMutation.mutate({
      ...waForm,
      id: editingWaPlan?.id,
      originalPrice: Number(waForm.originalPrice) || 0,
      offerPrice: Number(waForm.offerPrice) || 0,
      numberOfMessages: Number(waForm.numberOfMessages) || 1000,
    });
  };

  const toggleModule = (mod) => {
    if (subForm.modules.includes(mod)) {
      setSubForm({ ...subForm, modules: subForm.modules.filter((m) => m !== mod) });
    } else {
      setSubForm({ ...subForm, modules: [...subForm.modules, mod] });
    }
  };

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt || 0);
  };

  if (loadingSub || loadingWa) {
    return <LoadingSpinner fullScreen label="Loading package definitions..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans & Packages"
        subtitle="Manage SaaS pricing tiers, feature gates, and WhatsApp automated recharge packs."
        action={
          activeTab !== 'verticals' && (
            <button
              onClick={() => (activeTab === 'subscription' ? openSubModal() : openWaModal())}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus size={16} />
              <span>
                {activeTab === 'subscription' ? 'Create SaaS Plan' : 'Create WhatsApp Pack'}
              </span>
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('subscription')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex-1 sm:flex-none justify-center ${
            activeTab === 'subscription'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Crown size={16} />
          <span>SaaS Subscriptions ({subPlans.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex-1 sm:flex-none justify-center ${
            activeTab === 'whatsapp'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageCircle size={16} />
          <span>WhatsApp Packs ({waPlans.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('verticals')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex-1 sm:flex-none justify-center ${
            activeTab === 'verticals'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={16} />
          <span>Software Verticals ({verticals.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('referrals')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex-1 sm:flex-none justify-center ${
            activeTab === 'referrals'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gift size={16} />
          <span>Referral Config</span>
        </button>
      </div>

      {/* Tab 1: SaaS Subscription Plans */}
      {activeTab === 'subscription' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subPlans.length > 0 ? (
            subPlans.map((plan) => {
              const isSoldOut = plan.purchaseLimit > 0 && (plan.purchasedCount || 0) >= plan.purchaseLimit;
              const displayActive = plan.isActive && !isSoldOut;
              
              return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between relative overflow-hidden ${isSoldOut ? 'opacity-80 grayscale-[20%]' : ''}`}
              >
                {/* Active Indicator Top Bar */}
                <div
                  className={`absolute top-0 inset-x-0 h-1.5 ${
                    displayActive ? 'bg-blue-600' : isSoldOut ? 'bg-rose-500' : 'bg-slate-300'
                  }`}
                />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-lg font-extrabold text-slate-900 truncate">
                      {plan.name}
                    </h3>
                    <Badge variant={displayActive ? 'success' : isSoldOut ? 'danger' : 'neutral'} size="sm">
                      {isSoldOut ? 'Sold Out' : plan.isActive ? 'Active' : 'Draft'}
                    </Badge>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-900">
                        {formatCurrency(plan.offerPrice)}
                      </span>
                      {plan.originalPrice > plan.offerPrice && (
                        <span className="text-sm text-slate-400 line-through">
                          {formatCurrency(plan.originalPrice)}
                        </span>
                      )}
                      {plan.durationDays > 0 && (
                        <span className="text-xs text-slate-500 font-semibold">
                          {plan.durationLabel || `/${plan.durationDays}d`}
                        </span>
                      )}
                    </div>
                    {plan.discountText && (
                      <span className="inline-block mt-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        {plan.discountText}
                      </span>
                    )}
                  </div>

                  {/* Plan Specs */}
                  <div className="space-y-2 py-3 border-y border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Student Capacity:</span>
                      <span className="font-bold text-slate-800">
                        {plan.maxStudents ? `${plan.maxStudents} Students` : 'Unlimited'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Validity Duration:</span>
                      <span className="font-bold text-slate-800">
                        {plan.durationDays > 0 ? `${plan.durationDays} Days` : 'Lifetime'}
                      </span>
                    </div>
                    {plan.purchaseLimit > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Purchase Limit:</span>
                        <span className="font-bold text-rose-600">
                          {plan.purchasedCount || 0} / {plan.purchaseLimit} Sold
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Marketing Features */}
                  {(plan.features && plan.features.length > 0) && (
                    <div className="mt-4">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Marketing Features
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {plan.features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700 font-medium">
                            <Check size={14} className="text-blue-500 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Allowed Modules */}
                  <div className="mt-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Included Modules ({plan.modules?.length || 0})
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {(plan.modules || []).map((mod) => (
                        <span
                          key={mod}
                          className="px-2 py-1 bg-slate-50 border border-slate-200/80 rounded-md text-[11px] font-semibold text-slate-700 flex items-center gap-1"
                        >
                          <Check size={11} className="text-emerald-500" />
                          <span>{mod}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-slate-100">
                  <button
                    onClick={() => openSubModal(plan)}
                    className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                    title="Edit Plan"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete plan "${plan.name}"?`)) {
                        subDeleteMutation.mutate(plan.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Delete Plan"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              );
            })
          ) : (
            <div className="col-span-full">
              <EmptyState
                icon={Crown}
                title="No Subscription Plans"
                description="Create subscription tiers so libraries can purchase subscriptions."
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 2: WhatsApp Recharge Packs */}
      {activeTab === 'whatsapp' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {waPlans.length > 0 ? (
            waPlans.map((pack) => (
              <div
                key={pack.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 inset-x-0 h-1.5 ${
                    pack.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-lg font-extrabold text-slate-900 truncate">
                      {pack.name}
                    </h3>
                    <Badge variant={pack.isActive ? 'success' : 'neutral'} size="sm">
                      {pack.isActive ? 'Active' : 'Draft'}
                    </Badge>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-900">
                        {formatCurrency(pack.offerPrice)}
                      </span>
                      {pack.originalPrice > pack.offerPrice && (
                        <span className="text-sm text-slate-400 line-through">
                          {formatCurrency(pack.originalPrice)}
                        </span>
                      )}
                    </div>
                    {pack.discountText && (
                      <span className="inline-block mt-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        {pack.discountText}
                      </span>
                    )}
                  </div>

                  <div className="py-4 px-4 bg-emerald-50/60 rounded-xl border border-emerald-100/80 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800">
                        Message Quota
                      </span>
                      <span className="text-base font-extrabold text-emerald-700">
                        {pack.numberOfMessages?.toLocaleString()} MSGs
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-5 border-t border-slate-100">
                  <button
                    onClick={() => openWaModal(pack)}
                    className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                    title="Edit Pack"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete WhatsApp pack "${pack.name}"?`)) {
                        waDeleteMutation.mutate(pack.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Delete Pack"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState
                icon={MessageCircle}
                title="No WhatsApp Packs"
                description="Configure message recharge packs for libraries to buy credits."
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Software Verticals & Products */}
      {activeTab === 'verticals' && (
        <div className="space-y-6">
          <div className="p-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Multi-Vertical SaaS Expansion System</h3>
                <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                  Currently, <strong className="text-blue-700 font-bold">Study Library Software</strong> is active. 
                  When you are ready to expand field marketing visits and client onboarding to Gyms or Coaching institutes, 
                  simply switch the toggle to <span className="font-bold text-emerald-700">Active</span>. The field marketing modules and tracking will immediately adapt without changing any code!
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {verticals.map((vert) => {
              const isLibrary = vert.id === 'library';
              const isGym = vert.id === 'gym';
              const IconComponent = isLibrary ? Building2 : isGym ? Dumbbell : GraduationCap;
              const colorClasses = isLibrary
                ? { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
                : isGym
                ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
                : { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };

              return (
                <div
                  key={vert.id}
                  className={`bg-white rounded-2xl border ${
                    vert.isActive ? 'border-slate-300 ring-2 ring-blue-600/10' : 'border-slate-200/80 opacity-85'
                  } shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between relative overflow-hidden`}
                >
                  <div
                    className={`absolute top-0 inset-x-0 h-1.5 ${
                      vert.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />

                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div
                        className={`w-12 h-12 rounded-2xl ${colorClasses.bg} ${colorClasses.border} border ${colorClasses.text} flex items-center justify-center shrink-0`}
                      >
                        <IconComponent size={24} />
                      </div>
                      <Badge variant={vert.isActive ? 'success' : 'neutral'} dot>
                        {vert.isActive ? 'Active Software' : 'In Pipeline'}
                      </Badge>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 mb-1">{vert.name}</h3>
                    <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                      {vert.description}
                    </p>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-6">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        System Status
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        {vert.isActive ? (
                          <span className="text-emerald-700 flex items-center gap-1.5">
                            <Check size={14} strokeWidth={3} />
                            Active for Field Marketing & Client Directory
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Hidden from marketing reps until toggled ON
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Product Status
                    </span>
                    <button
                      type="button"
                      disabled={toggleVerticalMutation.isPending}
                      onClick={() =>
                        toggleVerticalMutation.mutate({
                          id: vert.id,
                          isActive: !vert.isActive,
                        })
                      }
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        vert.isActive
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {vert.isActive ? (
                        <>
                          <ToggleRight size={18} className="text-emerald-600" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={18} className="text-slate-400" />
                          <span>Inactive</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal 1: SaaS Subscription Plan */}
      {/* Tab 4: Referral Config */}
      {activeTab === 'referrals' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Gift size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Referral Program Settings</h3>
                <p className="text-sm text-slate-500 font-medium">Control the rewards for new signups and referrers</p>
              </div>
            </div>

            {loadingReferral ? (
              <div className="py-10 flex justify-center"><LoadingSpinner /></div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  referralMutation.mutate(referralForm);
                }}
                className="space-y-6"
              >
                {/* Referee Config */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-800 mb-4">New User Discount (Referee)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Discount Type</label>
                      <select
                        value={referralForm.refereeDiscountType}
                        onChange={e => setReferralForm(prev => ({ ...prev, refereeDiscountType: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat Amount (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Discount Value</label>
                      <input
                        type="number"
                        required
                        value={referralForm.refereeDiscountValue}
                        onChange={e => setReferralForm(prev => ({ ...prev, refereeDiscountValue: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-600"
                        placeholder="e.g. 10"
                      />
                    </div>
                  </div>
                </div>

                {/* Referrer Config */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-800 mb-4">Referrer Reward (Existing Owner)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Reward Type</label>
                      <select
                        value={referralForm.referrerRewardType}
                        onChange={e => setReferralForm(prev => ({ ...prev, referrerRewardType: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat Amount (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Reward Value</label>
                      <input
                        type="number"
                        required
                        value={referralForm.referrerRewardValue}
                        onChange={e => setReferralForm(prev => ({ ...prev, referrerRewardValue: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-emerald-600 outline-none focus:border-blue-600"
                        placeholder="e.g. 500"
                      />
                    </div>
                  </div>
                </div>

                {/* Status & Submit */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setReferralForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                        referralForm.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          referralForm.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-slate-700">
                      Referral System is {referralForm.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={referralMutation.isPending}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {referralMutation.isPending ? 'Saving...' : 'Save Referral Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <Modal
        isOpen={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        title={editingSubPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
        subtitle="Configure duration, pricing, and allowed library modules"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Plan Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Starter Monthly, Pro Yearly"
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Duration Label
              </label>
              <input
                type="text"
                placeholder="e.g. /month, /year, /3 months"
                value={subForm.durationLabel}
                onChange={(e) => setSubForm({ ...subForm, durationLabel: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Duration Days (0 = Lifetime)
              </label>
              <input
                type="number"
                required
                placeholder="0 for Lifetime"
                value={subForm.durationDays}
                onChange={(e) => setSubForm({ ...subForm, durationDays: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Original Price (₹)
              </label>
              <input
                type="number"
                placeholder="0"
                value={subForm.originalPrice}
                onChange={(e) => setSubForm({ ...subForm, originalPrice: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Offer Price (₹)
              </label>
              <input
                type="number"
                required
                placeholder="0"
                value={subForm.offerPrice}
                onChange={(e) => setSubForm({ ...subForm, offerPrice: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 font-bold text-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Student Limit (0 = Unltd)
              </label>
              <input
                type="number"
                placeholder="0 for Unlimited"
                value={subForm.maxStudents}
                onChange={(e) => setSubForm({ ...subForm, maxStudents: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1" title="Plan will auto-disable after these many sales">
                Purchase Limit (0 = Unltd)
              </label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={subForm.purchaseLimit}
                onChange={(e) => setSubForm({ ...subForm, purchaseLimit: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Discount Tag
              </label>
              <input
                type="text"
                placeholder="e.g. Save 20%"
                value={subForm.discountText}
                onChange={(e) => setSubForm({ ...subForm, discountText: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Custom Marketing Features (One per line)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. 24/7 Support&#10;Premium Analytics"
              value={subForm.features.join('\n')}
              onChange={(e) => setSubForm({ ...subForm, features: e.target.value.split('\n') })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 resize-y"
            />
          </div>

          {/* Module Toggles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Accessible Features & Modules
              </label>
              <button
                type="button"
                onClick={() => {
                  if (subForm.modules.length === AVAILABLE_MODULES.length) {
                    setSubForm({ ...subForm, modules: [] });
                  } else {
                    setSubForm({ ...subForm, modules: [...AVAILABLE_MODULES] });
                  }
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
              >
                {subForm.modules.length === AVAILABLE_MODULES.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80 max-h-48 overflow-y-auto">
              {AVAILABLE_MODULES.map((mod) => {
                const isSelected = subForm.modules.includes(mod);
                return (
                  <button
                    type="button"
                    key={mod}
                    onClick={() => toggleModule(mod)}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white text-blue-600' : 'border border-slate-300'
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="truncate">{mod}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="subActive"
              checked={subForm.isActive}
              onChange={(e) => setSubForm({ ...subForm, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="subActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active plan visible to library owners for purchase
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSubModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={subSaveMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {subSaveMutation.isPending ? 'Saving...' : 'Save Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: WhatsApp Recharge Pack */}
      <Modal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        title={editingWaPlan ? 'Edit WhatsApp Pack' : 'Create WhatsApp Pack'}
        subtitle="Set message quota and purchase price for automated messages"
      >
        <form onSubmit={handleWaSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Pack Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1,000 Messages Pack"
              value={waForm.name}
              onChange={(e) => setWaForm({ ...waForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Number of Messages
              </label>
              <input
                type="number"
                required
                placeholder="1000"
                value={waForm.numberOfMessages}
                onChange={(e) => setWaForm({ ...waForm, numberOfMessages: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Offer Price (₹)
              </label>
              <input
                type="number"
                required
                placeholder="299"
                value={waForm.offerPrice}
                onChange={(e) => setWaForm({ ...waForm, offerPrice: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 font-bold text-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Original Price (₹)
              </label>
              <input
                type="number"
                placeholder="499"
                value={waForm.originalPrice}
                onChange={(e) => setWaForm({ ...waForm, originalPrice: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Discount Tag
              </label>
              <input
                type="text"
                placeholder="e.g. 40% OFF"
                value={waForm.discountText}
                onChange={(e) => setWaForm({ ...waForm, discountText: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="waActive"
              checked={waForm.isActive}
              onChange={(e) => setWaForm({ ...waForm, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="waActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active pack available for recharge in library app
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setWaModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={waSaveMutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {waSaveMutation.isPending ? 'Saving...' : 'Save WhatsApp Pack'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
