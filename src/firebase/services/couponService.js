import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { libraryDb } from '../config';

export const getCoupons = async () => {
  const snap = await getDocs(collection(libraryDb, 'coupons'));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
};

export const saveCoupon = async (couponData) => {
  const { id, ...data } = couponData;
  const cleaned = {
    code: (data.code || '').toUpperCase().trim(),
    type: data.type || 'percentage',
    value: Number(data.value) || 0,
    targetType: data.targetType || 'all', // 'all', 'specific', 'limited'
    assignedTo: data.targetType === 'specific' ? data.assignedTo : '', // Library ID
    maxUses: data.targetType === 'limited' ? (Number(data.maxUses) || 1) : 0, // 0 = unlimited
    usedCount: Number(data.usedCount) || 0,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    createdAt: data.createdAt || new Date().toISOString(),
  };

  if (id) {
    await updateDoc(doc(libraryDb, 'coupons', id), cleaned);
    return { id, ...cleaned };
  } else {
    const ref = await addDoc(collection(libraryDb, 'coupons'), cleaned);
    return { id: ref.id, ...cleaned };
  }
};

export const deleteCoupon = async (id) => {
  return await deleteDoc(doc(libraryDb, 'coupons', id));
};
