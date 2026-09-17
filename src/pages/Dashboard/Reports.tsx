import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { univoDb, libraryDb } from '@/firebase/config';

type Tab = 'Daily' | 'Monthly' | 'Custom';
type Source = 'Univo Infotech' | 'Library';

export const Reports = () => {
  const [activeTab, setActiveTab] = useState<Tab>('Daily');
  const [source, setSource] = useState<Source>('Univo Infotech');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Fetch Univo Data (Expenses)
  const { data: univoData = [], isLoading: isLoadingUnivo } = useQuery({
    queryKey: ['report_univo_list'],
    queryFn: async () => {
      const snap = await getDocs(collection(univoDb, 'expenses'));
      return snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title || d.description || 'Expense',
          subtitle: d.category || 'General',
          extraInfo: d.paidBy || d.paymentMethod || '-',
          amount: d.amount || 0,
          date: d.date || new Date().toISOString()
        };
      });
    },
    enabled: source === 'Univo Infotech'
  });

  // Fetch Library Data
  const { data: libraryData = [], isLoading: isLoadingLibrary } = useQuery({
    queryKey: ['report_library_list'],
    queryFn: async () => {
      // Fetch all libraries to map tenantId to library name
      const libsSnap = await getDocs(collection(libraryDb, 'libraries'));
      const libMap: Record<string, string> = {};
      libsSnap.docs.forEach(d => {
        const data = d.data();
        libMap[d.id] = data.studyPointName || data.libraryName || 'Unknown Library';
      });

      // 1. Fetch transactions (subscriptions)
      const transSnap = await getDocs(collection(libraryDb, 'transactions'));
      const transData = transSnap.docs.map(doc => {
        const d = doc.data();
        const libName = libMap[d.tenantId] || 'Unknown Library';
        return {
          id: doc.id,
          title: libName,
          subtitle: `Subscription: ${d.planName || 'Unknown Plan'}`,
          extraInfo: `${d.purchasedAt ? new Date(d.purchasedAt).toLocaleDateString('en-IN') : '-'} • ${d.razorpayPaymentId || '-'}`,
          amount: Number(d.amountPaid || d.amount || 0),
          date: d.purchasedAt || new Date().toISOString()
        };
      });

      // 2. Fetch whatsapp_purchases
      const wpSnap = await getDocs(collection(libraryDb, 'whatsapp_purchases'));
      const wpData = wpSnap.docs.map(doc => {
        const d = doc.data();
        const libName = libMap[d.tenantId] || 'Unknown Library';
        return {
          id: doc.id,
          title: libName,
          subtitle: `WhatsApp Pack: ${d.planName || '-'}`,
          extraInfo: `${d.purchasedAt ? new Date(d.purchasedAt).toLocaleDateString('en-IN') : '-'} • ${d.razorpayPaymentId || '-'}`,
          amount: Number(d.amountPaid || d.amount || 0),
          date: d.purchasedAt || new Date().toISOString()
        };
      });

      // Combine and sort by date descending
      const combined = [...transData, ...wpData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return combined;
    },
    enabled: source === 'Library'
  });

  const displayList = source === 'Univo Infotech' ? univoData : libraryData;
  const isLoading = source === 'Univo Infotech' ? isLoadingUnivo : isLoadingLibrary;

  const showCount = displayList.length;
  const showTotal = displayList.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0A192F' }}>Reports & Analytics</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>View financial and operational reports across your databases</p>
      </div>

      {/* Database Source Toggle */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {(['Univo Infotech', 'Library'] as Source[]).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              background: source === s ? 'linear-gradient(90deg, #005CE6, #00C853)' : 'white',
              color: source === s ? 'white' : '#374151',
              fontWeight: 600,
              fontSize: '14px',
              border: source === s ? 'none' : '1px solid #E5E7EB',
              boxShadow: source === s ? '0 4px 12px rgba(0, 92, 230, 0.2)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {s} Database
          </button>
        ))}
      </div>

      {/* Main Card */}
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', background: '#F8FAFF' }}>
          {(['Daily', 'Monthly', 'Custom'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '16px 24px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === t ? '2px solid #005CE6' : '2px solid transparent',
                color: activeTab === t ? '#005CE6' : '#6B7280',
                fontWeight: activeTab === t ? 700 : 500,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {t} Report
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {/* Custom Date Picker */}
          {activeTab === 'Custom' && (
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Start Date</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>End Date</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
              </div>
              <button style={{ padding: '9px 16px', background: '#005CE6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                Filter
              </button>
            </div>
          )}

          {/* Dynamic Content based on Tab & Source */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
             <div style={{ padding: '20px', background: '#F8FAFF', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                <p style={{ color: '#6B7280', fontSize: '13px', fontWeight: 500 }}>Total Records</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#0A192F', marginTop: '4px' }}>
                  {showCount}
                </p>
             </div>
             <div style={{ padding: '20px', background: '#F8FAFF', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                <p style={{ color: '#6B7280', fontSize: '13px', fontWeight: 500 }}>Total Value (₹)</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#00C853', marginTop: '4px' }}>
                  ₹{showTotal.toLocaleString('en-IN')}
                </p>
             </div>
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: '#F8FAFF' }}>
                <tr>
                  <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB', width: '140px' }}>Record ID</th>
                  <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>{source === 'Library' ? 'Library Name & Owner' : 'Expense Details'}</th>
                  <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>{source === 'Library' ? 'City & Subscription' : 'Category / Info'}</th>
                  <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>Loading records...</td></tr>
                ) : displayList.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>No records found for this period.</td></tr>
                ) : (
                  displayList.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6B7280', fontFamily: 'monospace' }}>
                        {item.id.slice(0, 8)}...
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: '14px', color: '#0A192F', fontWeight: 600 }}>{item.title}</div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{item.subtitle}</div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#4B5563' }}>
                        {item.extraInfo}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#00C853', fontWeight: 700 }}>
                        ₹{item.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

