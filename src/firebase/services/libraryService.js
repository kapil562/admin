import { collection, getDocs, doc, getDoc, deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { libraryDb } from '../config';

/**
 * Fetch all registered libraries with their real-time subscription status from root 'subscriptions' collection.
 */
export const getLibraryClients = async () => {
  try {
    const libsSnap = await getDocs(collection(libraryDb, 'libraries'));
    
    // Fetch all root subscriptions in parallel or map them
    const clients = await Promise.all(
      libsSnap.docs.map(async (libDoc) => {
        const libId = libDoc.id;
        const data = libDoc.data() || {};
        
        // Correct path: /subscriptions/{tenantId}
        let subData = null;
        try {
          const subDoc = await getDoc(doc(libraryDb, 'subscriptions', libId));
          if (subDoc.exists()) {
            subData = subDoc.data();
          }
        } catch (e) {
          console.warn(`Could not load subscription for ${libId}:`, e);
        }

        // Determine plan and expiry
        const planName = subData?.planName || subData?.plan || 'Free / Trial';
        let expiryDate = subData?.expiryDate;
        if (expiryDate?.toDate) {
          expiryDate = expiryDate.toDate().toISOString();
        } else if (expiryDate && typeof expiryDate === 'object' && expiryDate.seconds) {
          expiryDate = new Date(expiryDate.seconds * 1000).toISOString();
        }

        let isExpired = false;
        if (expiryDate) {
          isExpired = new Date() > new Date(expiryDate);
        }

        let status = 'Active';
        if (isExpired) {
          status = 'Expired';
        } else if (subData?.status) {
          status = subData.status.charAt(0).toUpperCase() + subData.status.slice(1);
        }

        // Formatted registration date
        let registeredDate = 'Recent';
        if (data.createdAt?.seconds) {
          registeredDate = new Date(data.createdAt.seconds * 1000).toLocaleDateString('en-IN');
        } else if (data.createdAt) {
          registeredDate = new Date(data.createdAt).toLocaleDateString('en-IN');
        }

        return {
          id: libId,
          ownerName: data.ownerName || data.name || 'Library Owner',
          libraryName: data.studyPointName || data.libraryName || 'Study Point',
          email: data.email || 'N/A',
          phone: data.phone || data.phoneNumber || data.mobile || 'N/A',
          address: data.address || data.city || data.location || 'India',
          messageBalance: data.messageBalance || 0,
          planName,
          status,
          expiryDate: expiryDate || null,
          registeredDate,
          rawSub: subData,
        };
      })
    );

    return clients;
  } catch (error) {
    console.error('Error fetching library clients:', error);
    throw error;
  }
};

/**
 * Fetch all platform income transactions (SaaS Subscriptions + WhatsApp Recharge Packs)
 */
export const getPlatformTransactions = async () => {
  try {
    // 1. Fetch Subscription Transactions
    let subscriptions = [];
    try {
      const transSnap = await getDocs(collection(libraryDb, 'transactions'));
      subscriptions = transSnap.docs.map((docSnap) => {
        const d = docSnap.data() || {};
        const amt = Number(d.amountPaid || d.offerPrice || d.amount || 0);
        const dateVal = d.date || d.purchasedAt || d.createdAt || new Date().toISOString();
        return {
          id: docSnap.id,
          type: 'Subscription',
          tenantId: d.tenantId || 'N/A',
          planName: d.planName || d.name || 'SaaS Plan',
          amount: amt,
          paymentId: d.razorpayPaymentId || d.razorpay_payment_id || docSnap.id,
          date: typeof dateVal === 'object' && dateVal.seconds ? new Date(dateVal.seconds * 1000).toISOString() : String(dateVal),
          raw: d,
        };
      });
    } catch (e) {
      console.warn('Error reading root transactions:', e);
    }

    // 2. Fetch WhatsApp Purchases
    let whatsappPacks = [];
    try {
      const wpSnap = await getDocs(collection(libraryDb, 'whatsapp_purchases'));
      whatsappPacks = wpSnap.docs.map((docSnap) => {
        const d = docSnap.data() || {};
        const amt = Number(d.amountPaid || d.amount || 0);
        const dateVal = d.purchasedAt || d.date || d.createdAt || new Date().toISOString();
        return {
          id: docSnap.id,
          type: 'WhatsApp Pack',
          tenantId: d.tenantId || 'N/A',
          planName: d.planName || `${d.numberOfMessages || 0} Messages`,
          numberOfMessages: d.numberOfMessages || 0,
          amount: amt,
          paymentId: d.razorpayPaymentId || d.razorpay_payment_id || docSnap.id,
          date: typeof dateVal === 'object' && dateVal.seconds ? new Date(dateVal.seconds * 1000).toISOString() : String(dateVal),
          raw: d,
        };
      });
    } catch (e) {
      console.warn('Error reading whatsapp_purchases:', e);
    }

    // Combine and sort descending by date
    const all = [...subscriptions, ...whatsappPacks].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const subscriptionTotal = subscriptions.reduce((sum, s) => sum + s.amount, 0);
    const whatsappTotal = whatsappPacks.reduce((sum, w) => sum + w.amount, 0);

    return {
      all,
      subscriptions,
      whatsappPacks,
      subscriptionTotal,
      whatsappTotal,
      grandTotal: subscriptionTotal + whatsappTotal,
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return {
      all: [],
      subscriptions: [],
      whatsappPacks: [],
      subscriptionTotal: 0,
      whatsappTotal: 0,
      grandTotal: 0,
    };
  }
};

export const TENANT_SUBCOLLECTIONS = [
  'students',
  'seats',
  'sections',
  'fees',
  'expenses',
  'membershipPlans',
  'visitors',
  'addonPricing',
  'settings',
  'staffUsers',
  'staffMembers',
  'rolePresets',
  'feedbacks',
];

/**
 * Clean / Reset only internal data of a library client to make the account brand new.
 * Wipes students, seats, fees, expenses, receipts, visitors, staff members.
 * PRESERVES the library profile, owner email, and active subscription so the client can continue using their account.
 */
export const cleanLibraryTenantData = async (tenantId) => {
  if (!tenantId) throw new Error('Valid Tenant ID is required to clean data');

  const report = {
    tenantId,
    deletedDocsCount: 0,
  };

  // 1. Delete all documents in each tenant subcollection
  for (const collName of TENANT_SUBCOLLECTIONS) {
    try {
      const snap = await getDocs(collection(libraryDb, 'libraries', tenantId, collName));
      if (!snap.empty) {
        for (const docSnap of snap.docs) {
          await deleteDoc(docSnap.ref);
          report.deletedDocsCount++;
        }
      }
    } catch (err) {
      console.warn(`Could not clear subcollection ${collName} for tenant ${tenantId}:`, err);
    }
  }

  // 2. Reset counters in the library document to fresh Day-1 state
  try {
    const libRef = doc(libraryDb, 'libraries', tenantId);
    await setDoc(
      libRef,
      {
        activeStudents: 0,
        totalSeats: 0,
        totalFees: 0,
        totalExpenses: 0,
        lastDataCleanedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn(`Could not update stats for tenant ${tenantId}:`, err);
  }

  return report;
};

/**
 * Permanently purge all Firestore documents and subcollections for an inactive or abandoned library tenant.
 * Deletes:
 * 1. Subcollections under /libraries/{tenantId}/{subcollection} (students, seats, fees, expenses, receipts, etc.)
 * 2. Root subscription document /subscriptions/{tenantId}
 * 3. Root library document /libraries/{tenantId}
 */
export const purgeLibraryTenantData = async (tenantId) => {
  if (!tenantId) throw new Error('Valid Tenant ID is required to purge data');

  const report = {
    tenantId,
    deletedDocsCount: 0,
  };

  // 1. Delete all documents in each tenant subcollection
  for (const collName of TENANT_SUBCOLLECTIONS) {
    try {
      const snap = await getDocs(collection(libraryDb, 'libraries', tenantId, collName));
      if (!snap.empty) {
        for (const docSnap of snap.docs) {
          await deleteDoc(docSnap.ref);
          report.deletedDocsCount++;
        }
      }
    } catch (err) {
      console.warn(`Could not clear subcollection ${collName} for tenant ${tenantId}:`, err);
    }
  }

  // 2. Delete root subscription document
  try {
    const subRef = doc(libraryDb, 'subscriptions', tenantId);
    await deleteDoc(subRef);
    report.deletedDocsCount++;
  } catch (err) {
    console.warn(`Could not delete subscription for ${tenantId}:`, err);
  }

  // 3. Delete root library document
  try {
    const libRef = doc(libraryDb, 'libraries', tenantId);
    await deleteDoc(libRef);
    report.deletedDocsCount++;
  } catch (err) {
    console.warn(`Could not delete library doc for ${tenantId}:`, err);
  }

  return report;
};

/**
 * Restore or create a Library Client account by email.
 * Reconnects Firestore documents /libraries/{tenantId} and /subscriptions/{tenantId}.
 */
export const restoreOrCreateLibraryClient = async ({
  tenantId,
  email,
  libraryName,
  ownerName,
  phone,
  address,
  planName = 'Trial',
}) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Valid email address is required');

  let resolvedId = tenantId ? tenantId.trim() : null;

  if (!resolvedId) {
    // Check if library already exists with this email
    const libsSnap = await getDocs(collection(libraryDb, 'libraries'));
    for (const d of libsSnap.docs) {
      if ((d.data().email || '').toLowerCase().trim() === cleanEmail) {
        resolvedId = d.id;
        break;
      }
    }
  }

  if (!resolvedId) {
    const safePrefix = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
    resolvedId = `client_${safePrefix}`;
  }

  const libData = {
    email: cleanEmail,
    studyPointName: libraryName || 'Study Point Library',
    ownerName: ownerName || 'Library Owner',
    phone: phone || '',
    address: address || '',
    status: 'Active',
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(libraryDb, 'libraries', resolvedId), libData, { merge: true });

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);

  await setDoc(
    doc(libraryDb, 'subscriptions', resolvedId),
    {
      tenantId: resolvedId,
      planName: planName || 'Trial',
      plan: planName || 'Trial',
      status: 'Active',
      expiryDate: expiry.toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return { tenantId: resolvedId, ...libData };
};


/**
 * Fetch comprehensive details for a specific library tenant.
 * Includes library doc, subscription doc, students count, membership plans, and sections.
 */
export const getLibraryDetails = async (tenantId) => {
  if (!tenantId) throw new Error('Tenant ID required');

  const libDoc = await getDoc(doc(libraryDb, 'libraries', tenantId));
  const subDoc = await getDoc(doc(libraryDb, 'subscriptions', tenantId));

  const libraryData = libDoc.exists() ? { id: libDoc.id, ...libDoc.data() } : null;
  const subscriptionData = subDoc.exists() ? { id: subDoc.id, ...subDoc.data() } : null;

  if (!libraryData) throw new Error('Library not found');

  // Fetch sections
  const sectionsSnap = await getDocs(collection(libraryDb, 'libraries', tenantId, 'sections'));
  const sections = sectionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Fetch memberships
  const membershipsSnap = await getDocs(collection(libraryDb, 'libraries', tenantId, 'membershipPlans'));
  const memberships = membershipsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Fetch students
  const studentsSnap = await getDocs(collection(libraryDb, 'libraries', tenantId, 'students'));
  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return {
    library: libraryData,
    subscription: subscriptionData,
    sections,
    memberships,
    students,
  };
};
