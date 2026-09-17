import { useState } from 'react';
import { SubscriptionPlans } from './SubscriptionPlans';
import { WhatsappPlans } from './WhatsappPlans';

export const Plans = () => {
  const [activeTab, setActiveTab] = useState<'subscription' | 'whatsapp'>('subscription');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0A192F' }}>Plans & Packages</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>Create and manage Subscription plans and WhatsApp message packs.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', background: '#F3F4F6', padding: '6px', borderRadius: '12px', width: 'fit-content', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('subscription')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: activeTab === 'subscription' ? 'white' : 'transparent',
            color: activeTab === 'subscription' ? '#005CE6' : '#6B7280',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: activeTab === 'subscription' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20h20M5 20V4l14 4v12" />
          </svg>
          Subscription Plans
        </button>
        <button
          onClick={() => setActiveTab('whatsapp')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: activeTab === 'whatsapp' ? 'white' : 'transparent',
            color: activeTab === 'whatsapp' ? '#10B981' : '#6B7280',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: activeTab === 'whatsapp' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          WhatsApp Setup
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'subscription' ? <SubscriptionPlans /> : <WhatsappPlans />}
    </div>
  );
};

