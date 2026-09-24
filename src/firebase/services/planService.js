import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
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
    durationDays: Number(data.durationDays) || 0,
    originalPrice: Number(data.originalPrice) || 0,
    offerPrice: Number(data.offerPrice) || 0,
    discountText: data.discountText || '',
    maxStudents: Number(data.maxStudents) || 0,
    purchaseLimit: Number(data.purchaseLimit) || 0,
    purchasedCount: Number(data.purchasedCount) || 0,
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

// ── Referral Settings ───────────────────────────────────────────────────

export const getReferralSettings = async () => {
  const ref = doc(libraryDb, 'admin_settings', 'referral_config');
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data();
  }
  return {
    refereeDiscountType: 'percentage', // 'percentage' or 'flat'
    refereeDiscountValue: 10,
    referrerRewardType: 'flat', // 'percentage' or 'flat'
    referrerRewardValue: 500,
    isActive: true
  };
};

export const saveReferralSettings = async (data) => {
  const ref = doc(libraryDb, 'admin_settings', 'referral_config');
  await setDoc(ref, {
    refereeDiscountType: data.refereeDiscountType || 'percentage',
    refereeDiscountValue: Number(data.refereeDiscountValue) || 0,
    referrerRewardType: data.referrerRewardType || 'flat',
    referrerRewardValue: Number(data.referrerRewardValue) || 0,
    isActive: Boolean(data.isActive)
  });
  return data;
};
