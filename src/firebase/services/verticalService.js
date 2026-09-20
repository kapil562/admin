import { collection, doc, getDocs, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { univoDb } from '../config';

export const DEFAULT_VERTICALS = [
  {
    id: 'library',
    name: 'Study Library Software',
    shortName: 'Library',
    icon: 'Building2',
    isActive: true, // Currently ACTIVE!
    description: 'Seat layout management, admissions, shifts, attendance, and fee receipts.',
    color: 'blue',
  },
  {
    id: 'gym',
    name: 'Gym & Fitness Software',
    shortName: 'Gym',
    icon: 'Dumbbell',
    isActive: false, // In development, can be toggled on!
    description: 'Gym memberships, biometric access, workout batches, and trainer assignments.',
    color: 'emerald',
  },
  {
    id: 'coaching',
    name: 'Coaching & Institutes',
    shortName: 'Coaching',
    icon: 'GraduationCap',
    isActive: false,
    description: 'Student batches, course installments, fee cards, and attendance.',
    color: 'purple',
  },
];

/**
 * Fetch all software products/verticals from Firestore, or initialize defaults
 */
export const getSoftwareVerticals = async () => {
  try {
    const snap = await getDocs(collection(univoDb, 'software_verticals'));
    if (snap.empty) {
      // Initialize defaults in Firestore
      for (const v of DEFAULT_VERTICALS) {
        await setDoc(doc(univoDb, 'software_verticals', v.id), v);
      }
      return DEFAULT_VERTICALS;
    }

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (err) {
    console.warn('Fallback software verticals:', err);
    return DEFAULT_VERTICALS;
  }
};

/**
 * Toggle active state of a software vertical
 */
export const toggleSoftwareVertical = async (id, isActive) => {
  const ref = doc(univoDb, 'software_verticals', id);
  await updateDoc(ref, {
    isActive,
    updatedAt: new Date().toISOString(),
  });
  return { id, isActive };
};
