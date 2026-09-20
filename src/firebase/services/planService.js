import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { libraryDb } from '../config';

export const AVAILABLE_MODULES = [
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
  'Feedback',
];

// ── SaaS Subscription Plans ───────────────────────────────────────────────────

export const getSubscriptionPlans = async () => {
  const snap = await getDocs(collection(libraryDb, 'plans'));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
};

export const saveSubscriptionPlan = async (planData) => {
  const { id, ...data } = planData;
  const cleaned = {
    name: data.name || 'Custom Plan',
    durationLabel: data.durationLabel || '/mo',
    durationDays: Number(data.durationDays) || 30,
    originalPrice: Number(data.originalPrice) || 0,
    offerPrice: Number(data.offerPrice) || 0,
    discountText: data.discountText || '',
    maxStudents: Number(data.maxStudents) || 100,
    modules: Array.isArray(data.modules) ? data.modules : ['Dashboard', 'Settings'],
    features: Array.isArray(data.features) ? data.features : [],
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
  };

  if (id) {
    await updateDoc(doc(libraryDb, 'plans', id), cleaned);
    return { id, ...cleaned };
  } else {
    const ref = await addDoc(collection(libraryDb, 'plans'), cleaned);
    return { id: ref.id, ...cleaned };
  }
};

export const deleteSubscriptionPlan = async (id) => {
  return await deleteDoc(doc(libraryDb, 'plans', id));
};

// ── WhatsApp Message Packs ───────────────────────────────────────────────────

export const getWhatsAppPlans = async () => {
  const snap = await getDocs(collection(libraryDb, 'whatsapp_plans'));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
};

export const saveWhatsAppPlan = async (planData) => {
  const { id, ...data } = planData;
  const cleaned = {
    name: data.name || 'Pack',
    originalPrice: Number(data.originalPrice) || 0,
    offerPrice: Number(data.offerPrice) || 0,
    discountText: data.discountText || '',
    numberOfMessages: Number(data.numberOfMessages) || 1000,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
  };

  if (id) {
    await updateDoc(doc(libraryDb, 'whatsapp_plans', id), cleaned);
    return { id, ...cleaned };
  } else {
    const ref = await addDoc(collection(libraryDb, 'whatsapp_plans'), cleaned);
    return { id: ref.id, ...cleaned };
  }
};

export const deleteWhatsAppPlan = async (id) => {
  return await deleteDoc(doc(libraryDb, 'whatsapp_plans', id));
};
