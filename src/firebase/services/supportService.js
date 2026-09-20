import { collection, collectionGroup, getDocs, doc, updateDoc } from 'firebase/firestore';
import { libraryDb } from '../config';

/**
 * Fetch all feedbacks / user queries across library accounts
 */
export const getFeedbacks = async () => {
  try {
    let docs = [];
    try {
      // First attempt collectionGroup
      const snapshot = await getDocs(collectionGroup(libraryDb, 'feedbacks'));
      docs = snapshot.docs;
    } catch (e) {
      console.warn('CollectionGroup feedbacks error, falling back to root:', e);
      try {
        const rootSnap = await getDocs(collection(libraryDb, 'feedbacks'));
        docs = rootSnap.docs;
      } catch (err) {
        console.warn('Root feedbacks error:', err);
      }
    }

    return docs.map((docSnap) => {
      const data = docSnap.data() || {};

      // Normalize type (Bug, Feature, Support)
      let rawType = data.type || data.category || 'Support';
      if (typeof rawType === 'string') {
        const lower = rawType.toLowerCase();
        if (lower.includes('bug') || lower.includes('issue') || lower.includes('error')) rawType = 'Bug';
        else if (lower.includes('feature') || lower.includes('request')) rawType = 'Feature';
        else rawType = 'Support';
      } else {
        rawType = 'Support';
      }

      // Normalize status
      let rawStatus = data.status || 'Open';
      if (typeof rawStatus === 'string') {
        const lower = rawStatus.toLowerCase();
        if (lower === 'new' || lower === 'pending') rawStatus = 'Open';
        else if (lower === 'in-progress' || lower === 'progress') rawStatus = 'In Progress';
        else if (lower === 'resolved' || lower === 'closed' || lower === 'done') rawStatus = 'Resolved';
        else rawStatus = 'Open';
      }

      // Name & email
      let name = data.userName || data.name || '';
      const email = data.submittedBy || data.userEmail || data.email || 'N/A';
      if (!name && email !== 'N/A') {
        name = email.split('@')[0];
      }

      let dateStr = new Date().toISOString();
      if (data.createdAt?.seconds) {
        dateStr = new Date(data.createdAt.seconds * 1000).toISOString();
      } else if (data.createdAt) {
        dateStr = String(data.createdAt);
      }

      return {
        id: docSnap.id,
        refPath: docSnap.ref.path,
        name: name || 'Library User',
        email,
        type: rawType,
        subject: data.subject || data.title || 'Inquiry / Feedback',
        message: data.message || data.description || data.text || '',
        submittedAt: dateStr,
        status: rawStatus,
        libraryName: data.libraryName || data.studyPointName || 'Univo Study Point',
      };
    }).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    return [];
  }
};

/**
 * Update the status of a feedback item
 */
export const updateFeedbackStatus = async (refPath, newStatus) => {
  const queryRef = doc(libraryDb, refPath);
  await updateDoc(queryRef, {
    status: newStatus,
    updatedAt: new Date().toISOString(),
  });
};
