import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { univoDb } from '../config';

export const PERMISSION_MODULES = [
  { id: 'dashboard', label: 'Platform Dashboard', category: 'Overview', actions: ['view'] },
  { id: 'reports', label: 'Reports & Analytics', category: 'Overview', actions: ['view'] },
  { id: 'marketing', label: 'Field Marketing & GPS Visits', category: 'Field & Marketing', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'attendance', label: 'Work Attendance & Duty', category: 'Field & Marketing', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'clients', label: 'Library Clients Directory', category: 'Clients & Support', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'queries', label: 'User Queries & Support Tickets', category: 'Clients & Support', actions: ['view', 'edit'] },
  { id: 'finances', label: 'Company Finances & Expenses', category: 'Finance & Settings', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'plans', label: 'Plans & Pricing Management', category: 'Finance & Settings', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'coupons', label: 'Coupons & Promos Management', category: 'Finance & Settings', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'staff', label: 'Staff & Role Management', category: 'Finance & Settings', actions: ['view', 'create', 'edit', 'delete'] },
];

export const ROLE_PRESETS = {
  owner: {
    label: '👑 Business Owner / Super Admin',
    description: 'Supreme control. Full View, Create, Edit, and Delete access across all platform modules, settings, finances & staff.',
    permissions: {
      dashboard: { view: true },
      reports: { view: true },
      marketing: { view: true, create: true, edit: true, delete: true },
      attendance: { view: true, create: true, edit: true, delete: true },
      clients: { view: true, create: true, edit: true, delete: true },
      queries: { view: true, edit: true },
      finances: { view: true, create: true, edit: true, delete: true },
      plans: { view: true, create: true, edit: true, delete: true },
      coupons: { view: true, create: true, edit: true, delete: true },
      staff: { view: true, create: true, edit: true, delete: true },
    },
  },
  manager: {
    label: '👔 Operations & Branch Manager',
    description: 'Can manage client accounts, oversee marketing visits, view staff attendance, manage plans, and handle queries.',
    permissions: {
      dashboard: { view: true },
      reports: { view: true },
      marketing: { view: true, create: true, edit: true, delete: true },
      attendance: { view: true, create: true, edit: true, delete: false },
      clients: { view: true, create: true, edit: true, delete: false },
      queries: { view: true, edit: true },
      finances: { view: true, create: true, edit: false, delete: false },
      plans: { view: true, create: false, edit: false, delete: false },
      coupons: { view: true, create: true, edit: false, delete: false },
      staff: { view: true, create: false, edit: false, delete: false },
    },
  },
  marketing: {
    label: '🚶 Field Marketing Executive',
    description: 'Can log on-site visits (Libraries/Gyms) with GPS, view leads, and punch daily attendance.',
    permissions: {
      dashboard: { view: true },
      reports: { view: false },
      marketing: { view: true, create: true, edit: true, delete: false },
      attendance: { view: true, create: true, edit: false, delete: false },
      clients: { view: true, create: false, edit: false, delete: false },
      queries: { view: false, edit: false },
      finances: { view: false, create: false, edit: false, delete: false },
      plans: { view: true, create: false, edit: false, delete: false },
      coupons: { view: false, create: false, edit: false, delete: false },
      staff: { view: false, create: false, edit: false, delete: false },
    },
  },
  support: {
    label: '🎧 Customer Support Executive',
    description: 'Can answer user queries, manage support tickets, and check library client records.',
    permissions: {
      dashboard: { view: true },
      reports: { view: false },
      marketing: { view: false, create: false, edit: false, delete: false },
      attendance: { view: true, create: true, edit: false, delete: false },
      clients: { view: true, create: false, edit: true, delete: false },
      queries: { view: true, edit: true },
      finances: { view: false, create: false, edit: false, delete: false },
      plans: { view: true, create: false, edit: false, delete: false },
      coupons: { view: false, create: false, edit: false, delete: false },
      staff: { view: false, create: false, edit: false, delete: false },
    },
  },
  custom: {
    label: '⚙️ Custom Configured Role',
    description: 'Manually defined permissions matrix.',
    permissions: {},
  },
};

/**
 * Fetch all staff users
 */
export const getStaffUsers = async () => {
  const processDocs = async (docs) => {
    const staffList = [];
    for (const d of docs) {
      const data = d.data();
      let referralCode = data.referralCode;
      
      if (!referralCode) {
        referralCode = `UNIVO-${(data.name || 'STAFF').substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        try {
          await updateDoc(doc(univoDb, 'staff_users', d.id), {
            referralCode,
            walletBalance: data.walletBalance || 0
          });
        } catch(e) { console.warn('Could not auto-heal referralCode', e); }
      }
      
      staffList.push({
        id: d.id,
        ...data,
        referralCode,
        walletBalance: data.walletBalance || 0
      });
    }
    return staffList;
  };

  try {
    const q = query(collection(univoDb, 'staff_users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return await processDocs(snap.docs);
  } catch (err) {
    console.warn('Fallback staff fetch:', err);
    try {
      const snap = await getDocs(collection(univoDb, 'staff_users'));
      return await processDocs(snap.docs);
    } catch (e) {
      console.error('Error fetching staff users:', e);
      return [];
    }
  }
};

/**
 * Add a new staff user
 */
export const addStaffUser = async (staffData) => {
  const isOwner = staffData.role === 'owner';
  const cleaned = {
    name: (staffData.name || '').trim(),
    email: (staffData.email || '').trim().toLowerCase(),
    password: (staffData.password || '').trim(),
    phone: (staffData.phone || '').trim(),
    role: staffData.role || 'marketing',
    roleLabel: staffData.roleLabel || ROLE_PRESETS[staffData.role]?.label || (isOwner ? '👑 Business Owner / Super Admin' : 'Staff Member'),
    status: staffData.status || 'active',
    compensation: {
      baseSalary: Number(staffData.compensation?.baseSalary) || 0,
      commissionPerDeal: Number(staffData.compensation?.commissionPerDeal) || 0,
      dailyTargetVisits: isOwner ? 0 : Number(staffData.compensation?.dailyTargetVisits) || 0,
      dailyTargetDeals: isOwner ? 0 : Number(staffData.compensation?.dailyTargetDeals) || 0,
    },
    permissions: staffData.permissions || ROLE_PRESETS[staffData.role]?.permissions || {},
    referralCode: staffData.referralCode || `UNIVO-${(staffData.name || 'STAFF').substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    walletBalance: 0,
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(univoDb, 'staff_users'), cleaned);
  return { id: ref.id, ...cleaned };
};

/**
 * Update staff user
 */
export const updateStaffUser = async (id, staffData) => {
  const ref = doc(univoDb, 'staff_users', id);
  const isOwner = staffData.role === 'owner';
  const dailyVisits = isOwner ? 0 : Number(staffData.compensation?.dailyTargetVisits) || 0;
  const dailyDeals = isOwner ? 0 : Number(staffData.compensation?.dailyTargetDeals) || 0;

  const updatePayload = {
    name: (staffData.name || '').trim(),
    email: (staffData.email || '').trim().toLowerCase(),
    phone: (staffData.phone || '').trim(),
    role: staffData.role || 'custom',
    roleLabel: staffData.roleLabel || ROLE_PRESETS[staffData.role]?.label || (isOwner ? '👑 Business Owner / Super Admin' : 'Staff Member'),
    status: staffData.status || 'active',
    compensation: {
      baseSalary: Number(staffData.compensation?.baseSalary) || 0,
      commissionPerDeal: Number(staffData.compensation?.commissionPerDeal) || 0,
      dailyTargetVisits: dailyVisits,
      dailyTargetDeals: dailyDeals,
    },
    permissions: staffData.permissions || ROLE_PRESETS[staffData.role]?.permissions || {},
    updatedAt: new Date().toISOString(),
  };

  // Only update password if an explicit new password is provided
  if (staffData.password && String(staffData.password).trim().length > 0) {
    updatePayload.password = String(staffData.password).trim();
  }

  await updateDoc(ref, updatePayload);
  return { id, ...updatePayload };
};

/**
 * Toggle staff active/inactive status quickly
 */
export const toggleStaffStatus = async (id, currentStatus) => {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const ref = doc(univoDb, 'staff_users', id);
  await updateDoc(ref, {
    status: newStatus,
    updatedAt: new Date().toISOString(),
  });
  return newStatus;
};

/**
 * Delete staff user
 */
export const deleteStaffUser = async (id) => {
  return await deleteDoc(doc(univoDb, 'staff_users', id));
};

/**
 * Calculate staff performance, deal commissions, targets and monthly payroll
 */
export const calculateStaffPayroll = (staff, visitsList = []) => {
  const staffId = staff?.id || staff?.uid;
  const staffName = (staff?.name || staff?.displayName || '').trim().toLowerCase();

  const staffVisits = (visitsList || []).filter(
    (v) => (staffId && v.staffId === staffId) || (staffName && v.staffName?.trim().toLowerCase() === staffName)
  );

  const baseSalary = Number(staff?.compensation?.baseSalary) || 0;
  const commissionPerDeal = Number(staff?.compensation?.commissionPerDeal) || 0;

  const dealsClosed = staffVisits.filter((v) => v.status === 'Deal Closed').length;
  const totalVisits = staffVisits.length;
  const demosGiven = staffVisits.filter((v) => v.demoGiven).length;

  // Daily targets and achievements (today's live stats)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayVisitsList = staffVisits.filter((v) => (v.createdAt || '').startsWith(todayStr));
  const todayVisits = todayVisitsList.length;
  const todayDeals = todayVisitsList.filter((v) => v.status === 'Deal Closed').length;

  // Direct Daily Targets configured by Admin
  const dailyTargetVisits = Number(staff?.compensation?.dailyTargetVisits) || 0;
  const dailyTargetDeals = Number(staff?.compensation?.dailyTargetDeals) || 0;

  const dailyVisitAchievement = dailyTargetVisits > 0 ? Math.min(100, Math.round((todayVisits / dailyTargetVisits) * 100)) : (todayVisits > 0 ? 100 : 0);
  const dailyDealAchievement = dailyTargetDeals > 0 ? Math.min(100, Math.round((todayDeals / dailyTargetDeals) * 100)) : (todayDeals > 0 ? 100 : 0);

  const commissionEarned = dealsClosed * commissionPerDeal;
  const totalEstimatedPayout = baseSalary + commissionEarned;

  return {
    baseSalary,
    commissionPerDeal,
    dailyTargetVisits,
    dailyTargetDeals,
    todayVisits,
    todayDeals,
    dailyVisitAchievement,
    dailyDealAchievement,
    dealsClosed,
    totalVisits,
    demosGiven,
    commissionEarned,
    totalEstimatedPayout,
  };
};

