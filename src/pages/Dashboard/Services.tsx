import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionGroup, getDocs, doc, updateDoc } from 'firebase/firestore';
import { libraryDb } from '@/firebase/config';

type QueryType = {
  id: string;
  name: string;
  email: string;
  type: 'Bug' | 'Feature' | 'Support';
  subject: string;
  message: string;
  submittedAt: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  refPath: string; // To update the document later
};

const typeCfg = {
  Bug: { bg: '#FEE2E2', color: '#991B1B' },
  Feature: { bg: '#DBEAFE', color: '#1E40AF' },
  Support: { bg: '#F3E8FF', color: '#6B21A8' },
};

const statusCfg = {
  Open: { bg: '#FEE2E2', color: '#991B1B', next: 'In Progress' as const },
  'In Progress': { bg: '#FEF3C7', color: '#92400E', next: 'Resolved' as const },
  Resolved: { bg: '#D1FAE5', color: '#065F46', next: null },
};

export const Services = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<QueryType | null>(null);
  const [filterType, setFilterType] = useState<'All' | 'Bug' | 'Feature' | 'Support'>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Open' | 'In Progress' | 'Resolved'>('All');

  // Fetch queries from Library Firebase
  const { data: queries = [], isLoading } = useQuery({
    queryKey: ['queries'],
    queryFn: async () => {
      const snapshot = await getDocs(collectionGroup(libraryDb, 'feedbacks'));
      return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        
        // Normalize type
        let rawType = data.type || data.category || 'Support';
        rawType = typeof rawType === 'string' ? (rawType.charAt(0).toUpperCase() + rawType.slice(1)) : 'Support';
        if (!['Bug', 'Feature', 'Support'].includes(rawType)) rawType = 'Support';

        // Normalize status
        let rawStatus = data.status || 'Open';
        if (typeof rawStatus === 'string') {
          rawStatus = rawStatus.toLowerCase();
          if (rawStatus === 'new') rawStatus = 'Open';
          else if (rawStatus === 'in-progress' || rawStatus === 'in progress') rawStatus = 'In Progress';
          else if (rawStatus === 'resolved' || rawStatus === 'done' || rawStatus === 'completed') rawStatus = 'Resolved';
          else rawStatus = 'Open';
        }

        // Derive name from email if missing
        let name = data.userName || data.name || '';
        const email = data.submittedBy || data.userEmail || data.email || 'N/A';
        if (!name && email !== 'N/A') {
          name = email.split('@')[0]; // Extract name from email
        }

        return {
          id: docSnap.id,
          refPath: docSnap.ref.path,
          name: name || 'Library User',
          email: email,
          type: rawType,
          subject: data.subject || data.title || 'Feedback',
          message: data.message || data.description || '',
          submittedAt: data.createdAt ? new Date(data.createdAt.seconds * 1000).toISOString() : new Date().toISOString(),
          status: rawStatus
        } as QueryType;
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ refPath, status }: { refPath: string, status: QueryType['status'] }) => {
      const queryRef = doc(libraryDb, refPath);
      await updateDoc(queryRef, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
    },
  });

  const updateStatus = (queryObj: QueryType, status: QueryType['status']) => {
    updateStatusMutation.mutate({ refPath: queryObj.refPath, status });
    setSelected(prev => prev && prev.id === queryObj.id ? { ...prev, status } : prev);
  };

  const filtered = queries.filter(q => {
    return (filterType === 'All' || q.type === filterType) &&
      (filterStatus === 'All' || q.status === filterStatus);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0A192F' }}>User Queries</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>Bug reports and feature suggestions from your software users</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total', count: queries.length, color: '#005CE6', bg: '#EEF2FF' },
          { label: 'Open', count: queries.filter(q => q.status === 'Open').length, color: '#EF4444', bg: '#FEE2E2' },
          { label: 'In Progress', count: queries.filter(q => q.status === 'In Progress').length, color: '#F59E0B', bg: '#FEF3C7' },
          { label: 'Resolved', count: queries.filter(q => q.status === 'Resolved').length, color: '#10B981', bg: '#D1FAE5' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '16px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.count}</span>
            </div>
            <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '14px 20px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginRight: '4px' }}>TYPE:</span>
          {(['All', 'Bug', 'Feature', 'Support'] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1.5px solid', borderColor: filterType === f ? '#005CE6' : '#E5E7EB', background: filterType === f ? '#005CE6' : 'white', color: filterType === f ? 'white' : '#374151', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ width: '1px', background: '#E5E7EB', height: '24px' }} />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginRight: '4px' }}>STATUS:</span>
          {(['All', 'Open', 'In Progress', 'Resolved'] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1.5px solid', borderColor: filterStatus === f ? '#005CE6' : '#E5E7EB', background: filterStatus === f ? '#005CE6' : 'white', color: filterStatus === f ? 'white' : '#374151', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Query Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF', fontSize: '15px', background: 'white', borderRadius: '16px' }}>Loading queries from Firebase...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF', fontSize: '15px', background: 'white', borderRadius: '16px' }}>No queries found</div>
        ) : filtered.map(query => {
          const sc = statusCfg[query.status as keyof typeof statusCfg] || statusCfg['Open'];
          const tc = typeCfg[query.type as keyof typeof typeCfg] || typeCfg['Support'];
          return (
            <div
              key={query.id}
              onClick={() => setSelected(query)}
              style={{ background: 'white', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer', borderLeft: `4px solid ${tc.color}`, transition: 'box-shadow 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ background: tc.bg, color: tc.color, borderRadius: '6px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>{query.type}</span>
                    <span style={{ fontWeight: 700, color: '#0A192F', fontSize: '15px' }}>{query.subject}</span>
                  </div>
                  <p style={{ color: '#6B7280', fontSize: '13px', lineHeight: '1.5' }}>{query.message.substring(0, 100)}...</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>👤 {query.name}</span>
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>📧 {query.email}</span>
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>📅 {new Date(query.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                  <span style={{ background: sc.bg, color: sc.color, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{query.status}</span>
                  {sc.next && (
                    <button onClick={e => { e.stopPropagation(); updateStatus(query, sc.next!); }} style={{ fontSize: '11px', background: '#F3F4F6', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap', opacity: updateStatusMutation.isPending ? 0.7 : 1 }}>
                      {updateStatusMutation.isPending ? 'Updating...' : `Mark as ${sc.next} →`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '520px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ background: (typeCfg[selected.type as keyof typeof typeCfg] || typeCfg['Support']).bg, color: (typeCfg[selected.type as keyof typeof typeCfg] || typeCfg['Support']).color, borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>{selected.type}</span>
                <span style={{ background: (statusCfg[selected.status as keyof typeof statusCfg] || statusCfg['Open']).bg, color: (statusCfg[selected.status as keyof typeof statusCfg] || statusCfg['Open']).color, borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: 600 }}>{selected.status}</span>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6B7280' }}>×</button>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0A192F', marginBottom: '16px' }}>{selected.subject}</h2>
            <p style={{ color: '#374151', fontSize: '14px', lineHeight: '1.7', marginBottom: '20px' }}>{selected.message}</p>
            <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', fontSize: '13px' }}><span style={{ color: '#9CA3AF', width: '80px' }}>From</span><span style={{ fontWeight: 600, color: '#374151' }}>{selected.name}</span></div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '13px' }}><span style={{ color: '#9CA3AF', width: '80px' }}>Email</span><span style={{ fontWeight: 600, color: '#005CE6' }}>{selected.email}</span></div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '13px' }}><span style={{ color: '#9CA3AF', width: '80px' }}>Date</span><span style={{ fontWeight: 600, color: '#374151' }}>{new Date(selected.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
            </div>
            {statusCfg[selected.status as keyof typeof statusCfg]?.next && (
              <button disabled={updateStatusMutation.isPending} onClick={() => updateStatus(selected, statusCfg[selected.status as keyof typeof statusCfg].next!)} style={{ marginTop: '20px', width: '100%', padding: '12px', background: 'linear-gradient(90deg, #005CE6, #00C853)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', opacity: updateStatusMutation.isPending ? 0.7 : 1 }}>
                {updateStatusMutation.isPending ? 'Updating...' : `Move to ${statusCfg[selected.status as keyof typeof statusCfg].next}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
