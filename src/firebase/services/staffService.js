import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { univoDb } from '../config';

export const PERMISSION_MODULES = [
  { id: 'dashboard', label: 'Platform Dashboard', actions: ['view'] },
  { id: 'marketing', label: 'Field Marketing & GPS Visits', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'attendance', label: 'Work Attendance & Duty', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'clients', label: 'Library Clients Directory', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'finances', label: 'Company Finances & Expenses', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'plans', label: 'Plans & Pricing Management', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'queries', label: 'User Queries & Support', actions: ['view', 'edit'] },
  { id: 'reports', label: 'Financial Reports & Ledger', actions: ['view'] },
  { id: 'staff', label: 'Staff & Role Management', actions: ['view', 'create', 'edit', 'delete'] },
];

export const ROLE_PRESETS = {
  marketing: {
    label: '🚶 Field Marketing Executive',
    description: 'Can log on-site visits (Libraries/Gyms) with GPS, view leads, and punch daily attendance.',
    permissions: {
      dashboard: { view: true },
      marketing: { view: true, create: true, edit: true, delete: false },
      attendance: { view: true, create: true, edit: false, delete: false },
      clients: { view: true, create: false, edit: false, delete: false },
      finances: { view: false, create: false, edit: false, delete: false },
      plans: { view: true, create: false, edit: false, delete: false },
      queries: { view: false, edit: false },
      reports: { view: false },
      staff: { view: false, create: false, edit: false, delete: false },
    },
  },
  manager: {
    label: '👔 Operations & Branch Manager',
    description: 'Can manage client accounts, oversee marketing visits, view staff attendance, and handle queries.',
    permissions: {
      dashboard: { view: true },
      marketing: { view: true, create: true, edit: true, delete: true },
      attendance: { view: true, create: true, edit: true, delete: false },
      clients: { view: true, create: true, edit: true, delete: false },
      finances: { view: true, create: true, edit: false, delete: false },
      plans: { view: true, create: false, edit: false, delete: false },
      queries: { view: true, edit: true },
      reports: { view: true },
      staff: { view: true, create: false, edit: false, delete: false },
    },
  },
  support: {
    label: '🎧 Customer Support Executive',
    description: 'Can answer user queries, manage support tickets, and check library client records.',
    permissions: {
      dashboard: { view: true },
      marketing: { view: false, create: false, edit: false, delete: false },
      attendance: { view: true, create: true, edit: false, delete: false },
      clients: { view: true, create: false, edit: true, delete: false },
      finances: { view: false, create: false, edit: false, delete: false },
      plans: { view: true, create: false, edit: false, delete: false },
      queries: { view: true, edit: true },
      reports: { view: false },
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
  try {
    const q = query(collection(univoDb, 'staff_users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (err) {
    console.warn('Fallback staff fetch:', err);
    try {
      const snap = await getDocs(collection(univoDb, 'staff_users'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  const cleaned = {
    name: staffData.name.trim(),
    email: staffData.email.trim().toLowerCase(),
    password: staffData.password.trim(),
    phone: staffData.phone ? staffData.phone.trim() : '',
    role: staffData.role || 'marketing',
    roleLabel: staffData.roleLabel || ROLE_PRESETS[staffData.role]?.label || 'Staff Member',
    status: staffData.status || 'active',
    compensation: {
      baseSalary: Number(staffData.compensation?.baseSalary) || 0,
      commissionPerDeal: Number(staffData.compensation?.commissionPerDeal) || 0,
      monthlyTargetDeals: Number(staffData.compensation?.monthlyTargetDeals) || 10,
      monthlyTargetVisits: Number(staffData.compensation?.monthlyTargetVisits) || 50,
    },
    permissions: staffData.permissions || ROLE_PRESETS[staffData.role]?.permissions || {},
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
  const updatePayload = {
    ...staffData,
    compensation: {
      baseSalary: Number(staffData.compensation?.baseSalary) || 0,
      commissionPerDeal: Number(staffData.compensation?.commissionPerDeal) || 0,
      monthlyTargetDeals: Number(staffData.compensation?.monthlyTargetDeals) || 10,
      monthlyTargetVisits: Number(staffData.compensation?.monthlyTargetVisits) || 50,
    },
    updatedAt: new Date().toISOString(),
  };
  await updateDoc(ref, updatePayload);
  return { id, ...updatePayload };
};

/**
 * Delete staff user
 */
export const deleteStaffUser = async (id) => {
  return await deleteDoc(doc(univoDb, 'staff_users', id));
};

/**
 * Calculate staff performance, deal commissions, and monthly payroll
 */
export const calculateStaffPayroll = (staff, visitsList = []) => {
  const staffVisits = visitsList.filter(
    (v) => v.staffId === staff.id || v.staffName?.toLowerCase() === staff.name?.toLowerCase()
  );

  const baseSalary = Number(staff.compensation?.baseSalary) || 0;
  const commissionPerDeal = Number(staff.compensation?.commissionPerDeal) || 0;
  const targetDeals = Number(staff.compensation?.monthlyTargetDeals) || 10;
  const targetVisits = Number(staff.compensation?.monthlyTargetVisits) || 50;

  const dealsClosed = staffVisits.filter((v) => v.status === 'Deal Closed').length;
  const totalVisits = staffVisits.length;
  const demosGiven = staffVisits.filter((v) => v.demoGiven).length;

  const commissionEarned = dealsClosed * commissionPerDeal;
  const totalEstimatedPayout = baseSalary + commissionEarned;
  const targetAchievement = targetDeals > 0 ? Math.min(100, Math.round((dealsClosed / targetDeals) * 100)) : 100;

  return {
    baseSalary,
    commissionPerDeal,
    targetDeals,
    targetVisits,
    dealsClosed,
    totalVisits,
    demosGiven,
    commissionEarned,
    totalEstimatedPayout,
    targetAchievement,
  };
};

