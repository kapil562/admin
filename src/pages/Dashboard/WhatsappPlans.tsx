import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { libraryDb } from '@/firebase/config';

type WhatsappPlanType = {
  id: string;
  name: string;
  originalPrice: number;
  offerPrice: number;
  discountText: string;
  numberOfMessages: number;
  isActive: boolean;
};

export const WhatsappPlans = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WhatsappPlanType | null>(null);

  const [formData, setFormData] = useState<Omit<WhatsappPlanType, 'id'>>({
    name: '',
    originalPrice: 0,
    offerPrice: 0,
    discountText: '',
    numberOfMessages: 1000,
    isActive: true,
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['whatsapp_plans'],
    queryFn: async () => {
      const snap = await getDocs(collection(libraryDb, 'whatsapp_plans'));
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WhatsappPlanType[];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (planData: Omit<WhatsappPlanType, 'id'> & { id?: string }) => {
      if (planData.id) {
        const { id, ...rest } = planData;
        await updateDoc(doc(libraryDb, 'whatsapp_plans', id), rest as any);
      } else {
        await addDoc(collection(libraryDb, 'whatsapp_plans'), planData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_plans'] });
      closeModal();
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if(window.confirm('Are you sure you want to delete this WhatsApp plan?')) {
        await deleteDoc(doc(libraryDb, 'whatsapp_plans', id));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_plans'] });
    }
  });

  const openModal = (plan?: WhatsappPlanType) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        originalPrice: plan.originalPrice || 0,
        offerPrice: plan.offerPrice || 0,
        discountText: plan.discountText || '',
        numberOfMessages: plan.numberOfMessages || 1000,
        isActive: plan.isActive,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        originalPrice: 0,
        offerPrice: 0,
        discountText: '',
        numberOfMessages: 1000,
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlan(null);
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
          style={{ padding: '10px 20px', background: '#10B981', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
        >
          + Create WhatsApp Pack
        </button>
      </div>

      {/* Plans Grid */}
      {isLoading ? (
        <div style={{ color: '#6B7280' }}>Loading plans...</div>
      ) : plans.length === 0 ? (
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', color: '#6B7280' }}>
          No WhatsApp plans found. Create one to get started!
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
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#0A192F', letterSpacing: '-1px' }}>
                    ₹{plan.offerPrice}
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

              <div style={{ padding: '12px', background: '#F0FDF4', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', color: '#065F46', fontWeight: 700 }}>
                <span style={{ marginRight: '6px' }}>💬</span> {plan.numberOfMessages.toLocaleString('en-IN')} Messages
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
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
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 700, color: '#0A192F' }}>
              {editingPlan ? 'Edit WhatsApp Pack' : 'Create WhatsApp Pack'}
            </h2>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Pack Name (e.g. 5K Message Pack)</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Original Price (₹)</label>
                  <input required type="number" min="0" value={formData.originalPrice} onChange={e => setFormData({...formData, originalPrice: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Offer Price (₹)</label>
                  <input required type="number" min="0" value={formData.offerPrice} onChange={e => setFormData({...formData, offerPrice: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Discount Text (Optional)</label>
                <input type="text" placeholder="e.g. Save 20%" value={formData.discountText} onChange={e => setFormData({...formData, discountText: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Number of Messages</label>
                <input required type="number" min="1" value={formData.numberOfMessages} onChange={e => setFormData({...formData, numberOfMessages: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '16px', background: '#F8FAFF', borderRadius: '8px' }}>
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: '#10B981' }} />
                <label htmlFor="isActive" style={{ fontSize: '14px', fontWeight: 600, color: '#0A192F', cursor: 'pointer' }}>Pack is Active (Visible to libraries)</label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} style={{ padding: '10px 20px', background: 'white', border: '1px solid #E5E7EB', color: '#374151', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} style={{ padding: '10px 20px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  {saveMutation.isPending ? 'Saving...' : 'Save Pack'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

