import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collectionGroup, getDocs, doc, getDoc } from 'firebase/firestore';
import { libraryDb } from '@/firebase/config';

// Make fields optional or with fallbacks in case Firebase schema differs
type Owner = {
  id: string;
  name: string;
  libraryName: string;
  city: string;
  phone: string;
  plan: string;
  subscriptionEnd: string;
  status: string;
};

const StatusBadge = ({ status }: { status: string }) => {
  const defaultStatus = { bg: '#F3F4F6', color: '#374151', dot: '#6B7280' };
  const cfg = {
    Active: { bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
    Expired: { bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
    Trial: { bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  }[status] || defaultStatus;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: cfg.bg, color: cfg.color, borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {status || 'Unknown'}
    </span>
  );
};

const PlanBadge = ({ plan }: { plan: string }) => {
  let cfg = { bg: '#EEF2FF', color: '#4338CA' }; // Default blue
  if (plan.toLowerCase().includes('pro')) cfg = { bg: '#F0FDF4', color: '#166534' };
  if (plan.toLowerCase().includes('enterprise')) cfg = { bg: '#FFF7ED', color: '#9A3412' };
  if (plan.toLowerCase().includes('trial')) cfg = { bg: '#FEF3C7', color: '#92400E' };

  return (
    <span style={{ padding: '4px 10px', background: cfg.bg, color: cfg.color, borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: `1px solid ${cfg.color}30` }}>
      {plan}
    </span>
  );
};

export const Softwares = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Expired' | 'Trial'>('All');

  // Fetch owners from Library Firebase
  const { data: owners = [], isLoading } = useQuery({
    queryKey: ['libraryOwners'],
    queryFn: async () => {
      // Use collectionGroup because parent 'libraries' docs might not exist
      const settingsSnapshot = await getDocs(collectionGroup(libraryDb, 'settings'));
      
      const ownerProfiles = settingsSnapshot.docs.filter(d => d.id === 'ownerProfile');
      
      const ownerPromises = ownerProfiles.map(async (ownerDoc) => {
        // The path is libraries/{libId}/settings/ownerProfile
        // So parent is settings, parent's parent is the library doc
        const libRef = ownerDoc.ref.parent.parent;
        if (!libRef) return null;
        
        const libId = libRef.id;
        const ownerData = ownerDoc.data();
        let subData: any = {};
        
        try {
          // Fetch Current Subscription for this library
          const subRef = doc(libraryDb, `libraries/${libId}/subscriptions/current`);
          const subDoc = await getDoc(subRef);
          if (subDoc.exists()) {
            subData = subDoc.data();
          }
        } catch (err) {
          console.error("Error fetching subscriptions for", libId, err);
        }

        return {
          id: libId,
          name: ownerData.ownerName || ownerData.name || 'Unknown Owner',
          libraryName: ownerData.studyPointName || ownerData.libraryName || ownerData.name || 'Unknown Library',
          city: ownerData.address || ownerData.city || 'Unknown',
          phone: ownerData.phone || ownerData.phoneNumber || 'N/A',
          plan: subData.planName || subData.plan || 'Basic',
          subscriptionEnd: subData.expiryDate || subData.endDate || new Date().toISOString(),
          status: subData.status ? (subData.status.charAt(0).toUpperCase() + subData.status.slice(1)) : (subData.isActive ? 'Active' : 'Expired')

        } as Owner;
      });

      const results = await Promise.all(ownerPromises);
      return results.filter(Boolean) as Owner[];
    },
  });

  const filtered = owners.filter(o => {
    const matchSearch = (o.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.libraryName || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.city || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || o.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = { 
    Active: owners.filter(o => o.status === 'Active').length, 
    Expired: owners.filter(o => o.status === 'Expired').length, 
    Trial: owners.filter(o => o.status === 'Trial').length 
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0A192F' }}>Library Owners</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>All registered library owners and their subscription status</p>
      </div>

      {/* Summary Badges */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#EEF2FF', borderRadius: '10px', padding: '10px', color: '#4338CA' }}>
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6B7280' }}>Total Owners</p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#0A192F' }}>{owners.length}</p>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#D1FAE5', borderRadius: '10px', padding: '10px', color: '#065F46' }}>
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6B7280' }}>Active</p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#065F46' }}>{counts.Active}</p>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#FEE2E2', borderRadius: '10px', padding: '10px', color: '#991B1B' }}>
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6B7280' }}>Expired</p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#991B1B' }}>{counts.Expired}</p>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#FEF3C7', borderRadius: '10px', padding: '10px', color: '#92400E' }}>
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6B7280' }}>Trial</p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#92400E' }}>{counts.Trial}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by name, library or city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['All', 'Active', 'Expired', 'Trial'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1.5px solid',
                borderColor: filter === f ? '#005CE6' : '#E5E7EB',
                background: filter === f ? '#005CE6' : 'white',
                color: filter === f ? 'white' : '#374151',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFF' }}>
              {['Owner', 'Library Name', 'City', 'Phone', 'Plan', 'Subscription End', 'Status'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', borderBottom: '1px solid #F3F4F6' }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '14px' }}>Loading library owners from Firebase...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '14px' }}>No owners found in database</td></tr>
            ) : filtered.map((owner, i) => (
              <tr key={owner.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #005CE6, #00C853)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                      {owner.name.charAt(0)}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{owner.name}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '14px', color: '#374151' }}>{owner.libraryName}</td>
                <td style={{ padding: '14px 16px', fontSize: '14px', color: '#6B7280' }}>{owner.city}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280' }}>{owner.phone}</td>
                <td style={{ padding: '14px 16px' }}><PlanBadge plan={owner.plan} /></td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>
                  {owner.subscriptionEnd ? new Date(owner.subscriptionEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                </td>
                <td style={{ padding: '14px 16px' }}><StatusBadge status={owner.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
