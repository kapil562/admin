import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { libraryDb } from '@/firebase/config';

type PlanType = {
  id: string;
  name: string;
  durationLabel: string; // e.g. "/mo", "/year", "for 3 months"
  durationDays: number; // e.g. 30, 90, 365, or 15 for trial
  originalPrice: number;
  offerPrice: number;
  discountText: string;
  maxStudents: number;
  modules: string[];
  features: string[]; // Custom bullet points for marketing
  isActive: boolean;
};

const AVAILABLE_MODULES = [
  'Dashboard',
  'Members',
  'Seat Layout',
  'Attendance',
  'Fees Management',
  'Expenses',
  'SMS & Notifications',
  'Reports',
  'Settings',
  'Memberships & Plans',
  'Staff',
  'Role & Permission',
  'Customization',
  'Subscription',
  'Feedback'
];

export const SubscriptionPlans = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanType | null>(null);

  const [formData, setFormData] = useState<Omit<PlanType, 'id'>>({
    name: '',
    durationLabel: '/mo',
    durationDays: 30,
    originalPrice: 0,
    offerPrice: 0,
    discountText: '',
    maxStudents: 100,
    modules: ['Dashboard', 'Settings'],
    features: ['Unlimited Students & Seats', 'Standard Support'],
    isActive: true,
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['library_plans'],
    queryFn: async () => {
      const snap = await getDocs(collection(libraryDb, 'plans'));
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlanType[];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (planData: Omit<PlanType, 'id'> & { id?: string }) => {
      if (planData.id) {
        const { id, ...rest } = planData;
        await updateDoc(doc(libraryDb, 'plans', id), rest as any);
      } else {
        await addDoc(collection(libraryDb, 'plans'), planData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library_plans'] });
      closeModal();
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if(window.confirm('Are you sure you want to delete this plan?')) {
        await deleteDoc(doc(libraryDb, 'plans', id));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library_plans'] });
    }
  });

  const openModal = (plan?: PlanType) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        durationLabel: plan.durationLabel || '/mo',
        durationDays: plan.durationDays || 30,
        originalPrice: plan.originalPrice || 0,
        offerPrice: plan.offerPrice || 0,
        discountText: plan.discountText || '',
        maxStudents: plan.maxStudents,
        modules: plan.modules || [],
        features: plan.features || [],
        isActive: plan.isActive,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        durationLabel: '/mo',
        durationDays: 30,
        originalPrice: 0,
        offerPrice: 0,
        discountText: '',
        maxStudents: 100,
        modules: ['Dashboard', 'Settings'],
        features: ['Unlimited Students & Seats', 'Standard Support'],
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlan(null);
  };

  const toggleModule = (mod: string) => {
    setFormData(prev => ({
      ...prev,
      modules: prev.modules.includes(mod)
        ? prev.modules.filter(m => m !== mod)
        : [...prev.modules, mod]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(editingPlan ? { id: editingPlan.id, ...formData } : formData);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <button 
          onClick={() => openModal()}
          style={{ padding: '10px 20px', background: '#005CE6', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 92, 230, 0.2)' }}
        >
          + Create New Plan
        </button>
      </div>

      {/* Plans Grid */}
      {isLoading ? (
        <div style={{ color: '#6B7280' }}>Loading plans...</div>
      ) : plans.length === 0 ? (
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', color: '#6B7280' }}>
          No plans found. Create one to get started!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {plans.map(plan => (
            <div key={plan.id} style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0A192F', margin: 0 }}>{plan.name}</h3>
                <span style={{ background: plan.isActive ? '#D1FAE5' : '#FEE2E2', color: plan.isActive ? '#065F46' : '#991B1B', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: plan.offerPrice === 0 ? '#00C853' : '#0A192F', letterSpacing: '-1px' }}>
                    {plan.offerPrice === 0 ? 'FREE' : `₹${plan.offerPrice}`}
                    <span style={{ fontSize: '16px', color: '#6B7280', fontWeight: 500, letterSpacing: '0', marginLeft: '4px' }}>
                      {plan.durationLabel}
                    </span>
                  </div>
                  {plan.originalPrice > plan.offerPrice && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '14px', color: '#9CA3AF', textDecoration: 'line-through' }}>₹{plan.originalPrice}</span>
                      {plan.discountText && (
                        <span style={{ background: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                          {plan.discountText}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '12px', background: '#F8FAFF', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#374151', fontWeight: 600 }}>
                <div style={{ marginBottom: '6px' }}><span style={{ color: '#005CE6', marginRight: '6px' }}>👥</span> Maximum Students: {plan.maxStudents}</div>
                <div><span style={{ color: '#005CE6', marginRight: '6px' }}>⏳</span> Exact Duration: {plan.durationDays} Days</div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {plan.features?.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ background: '#EFF6FF', color: '#3B82F6', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                <button onClick={() => openModal(plan)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Edit Plan</button>
                <button onClick={() => deleteMutation.mutate(plan.id)} style={{ padding: '8px 12px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 700, color: '#0A192F' }}>
              {editingPlan ? 'Edit Plan' : 'Create New Plan'}
            </h2>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Plan Name</label>
                  <input required type="text" placeholder="e.g. Free Trial" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Duration Label</label>
                  <input required type="text" placeholder="e.g. /15 days" value={formData.durationLabel} onChange={e => setFormData({...formData, durationLabel: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Exact Days</label>
                  <input required type="number" min="1" placeholder="15" value={formData.durationDays} onChange={e => setFormData({...formData, durationDays: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Original Price (₹)</label>
                  <input required type="number" min="0" value={formData.originalPrice} onChange={e => setFormData({...formData, originalPrice: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Offer Price (0 = Free)</label>
                  <input required type="number" min="0" value={formData.offerPrice} onChange={e => setFormData({...formData, offerPrice: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Discount Text</label>
                  <input type="text" placeholder="e.g. Save 20%" value={formData.discountText} onChange={e => setFormData({...formData, discountText: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Custom Marketing Features (One per line)</label>
                <textarea 
                  rows={4}
                  value={formData.features.join('\n')} 
                  onChange={e => setFormData({...formData, features: e.target.value.split('\n').filter(Boolean)})} 
                  placeholder="Unlimited Students & Seats&#10;Automated SMS Alerts&#10;Advanced Reports"
                  style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Maximum Students Allowed</label>
                <input required type="number" min="1" value={formData.maxStudents} onChange={e => setFormData({...formData, maxStudents: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>Included Internal Modules (For backend access control)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {AVAILABLE_MODULES.map(mod => (
                    <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4B5563', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formData.modules.includes(mod)} onChange={() => toggleModule(mod)} style={{ width: '16px', height: '16px', accentColor: '#005CE6' }} />
                      {mod}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '16px', background: '#F8FAFF', borderRadius: '8px' }}>
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: '#00C853' }} />
                <label htmlFor="isActive" style={{ fontSize: '14px', fontWeight: 600, color: '#0A192F', cursor: 'pointer' }}>Plan is Active (Visible to libraries)</label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} style={{ padding: '10px 20px', background: 'white', border: '1px solid #E5E7EB', color: '#374151', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} style={{ padding: '10px 20px', background: '#005CE6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  {saveMutation.isPending ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

