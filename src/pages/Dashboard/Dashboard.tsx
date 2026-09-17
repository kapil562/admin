
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { univoDb, libraryDb } from '@/firebase/config';

export const Dashboard = () => {
  // Fetch Expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['dashboard_expenses'],
    queryFn: async () => {
      const snap = await getDocs(collection(univoDb, 'expenses'));
      return snap.docs.map(doc => ({ amount: doc.data().amount || 0 }));
    }
  });

  // Fetch Libraries (Active Subscriptions roughly)
  const { data: libraryStats = { total: 0, revenue: 0 } } = useQuery({
    queryKey: ['dashboard_libraries'],
    queryFn: async () => {
      // 1. Get total libraries count
      const libSnap = await getDocs(collection(libraryDb, 'libraries'));
      const totalLibraries = libSnap.docs.length;
      
      let totalRevenue = 0;
      
      // 2. Sum up Subscription Transactions
      try {
        const transSnap = await getDocs(collection(libraryDb, 'transactions'));
        transSnap.docs.forEach(doc => {
          const d = doc.data();
          const amount = d.amountPaid || d.amount || 0;
          totalRevenue += Number(amount);
        });
      } catch (e) {
        console.error("Error fetching transactions:", e);
      }
      
      // 3. Sum up WhatsApp Purchases
      try {
        const wpSnap = await getDocs(collection(libraryDb, 'whatsapp_purchases'));
        wpSnap.docs.forEach(doc => {
          const d = doc.data();
          const amount = d.amountPaid || d.amount || 0;
          totalRevenue += Number(amount);
        });
      } catch (e) {
        console.error("Error fetching whatsapp_purchases:", e);
      }
      
      return { total: totalLibraries, revenue: totalRevenue };
    }
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalRevenue = libraryStats.revenue;
  
  // Standard Razorpay Charges (2% fee + 18% GST on the fee = 2.36%)
  const razorpayFees = totalRevenue * 0.0236; 
  
  const netProfit = totalRevenue - totalExpenses - razorpayFees;

  const stats = [
    { label: 'Total Revenue (Gross)', value: `₹${totalRevenue.toLocaleString('en-IN')}`, trend: '+12.5%', color: '#005CE6', bg: '#EEF2FF' },
    { label: 'Library Clients', value: libraryStats.total.toString(), trend: '+4.2%', color: '#10B981', bg: '#D1FAE5' },
    { label: 'Expenses & PG Fees', value: `₹${Math.round(totalExpenses + razorpayFees).toLocaleString('en-IN')}`, trend: '-2.4%', color: '#EF4444', bg: '#FEE2E2' },
    { label: 'Net Profit (After PG)', value: `₹${Math.round(netProfit).toLocaleString('en-IN')}`, trend: '+8.1%', color: '#F59E0B', bg: '#FEF3C7' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0A192F' }}>Dashboard Overview</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>Here's what's happening across your company today.</p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {stats.map((stat, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                  {i === 0 && <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>}
                  {i === 1 && <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>}
                  {i === 2 && <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>}
                  {i === 3 && <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>}
                </svg>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: stat.trend.startsWith('+') ? '#10B981' : '#EF4444', background: stat.trend.startsWith('+') ? '#D1FAE5' : '#FEE2E2', padding: '4px 8px', borderRadius: '20px' }}>
                {stat.trend}
              </span>
            </div>
            <p style={{ color: '#6B7280', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{stat.label}</p>
            <p style={{ color: '#0A192F', fontSize: '28px', fontWeight: 800 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Placeholder Chart */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0A192F', marginBottom: '24px' }}>Revenue vs Expenses (Mocked UI)</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '240px', paddingBottom: '20px', borderBottom: '1px solid #F3F4F6' }}>
            {[40, 70, 45, 90, 65, 100, 85].map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '4px', height: '100%' }}>
                <div style={{ width: '100%', height: `${h}%`, background: '#005CE6', borderRadius: '4px 4px 0 0', opacity: 0.9 }} />
                <div style={{ width: '100%', height: `${h * 0.4}%`, background: '#EF4444', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', color: '#6B7280', fontSize: '12px', fontWeight: 500 }}>
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0A192F', marginBottom: '24px' }}>Database Status</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', background: '#F8FAFF', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Univo Firebase</span>
              </div>
              <p style={{ fontSize: '12px', color: '#6B7280' }}>Connected to {expenses.length} records</p>
            </div>
            <div style={{ padding: '16px', background: '#F8FAFF', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Library Firebase</span>
              </div>
              <p style={{ fontSize: '12px', color: '#6B7280' }}>Connected to {libraryStats.total} active libraries</p>
            </div>
            <div style={{ padding: '16px', background: '#F8FAFF', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Razorpay Deductions</span>
              </div>
              <p style={{ fontSize: '12px', color: '#6B7280' }}>Estimated fees: ₹{Math.round(razorpayFees).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
