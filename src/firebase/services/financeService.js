import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { univoDb } from '../config';

export const EXPENSE_CATEGORIES = [
  'All',
  'Marketing',
  'Hosting',
  'Salaries',
  'Office',
  'Tools',
  'Legal & Accounting',
  'Miscellaneous',
];

/**
 * Fetch all expenses from Univo Firebase database
 */
export const getExpenses = async () => {
  try {
    const q = query(collection(univoDb, 'expenses'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: data.date || new Date().toISOString().split('T')[0],
        description: data.description || data.title || 'Expense',
        category: data.category || 'Miscellaneous',
        amount: Number(data.amount) || 0,
        paidBy: data.paidBy || 'Company Account',
        createdAt: data.createdAt || null,
      };
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    // Fallback if index missing
    try {
      const snap = await getDocs(collection(univoDb, 'expenses'));
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          date: data.date || new Date().toISOString().split('T')[0],
          description: data.description || data.title || 'Expense',
          category: data.category || 'Miscellaneous',
          amount: Number(data.amount) || 0,
          paidBy: data.paidBy || 'Company Account',
        };
      }).sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.error('Fallback expenses fetch error:', e);
      return [];
    }
  }
};

/**
 * Add a new expense
 */
export const addExpense = async (expenseData) => {
  return await addDoc(collection(univoDb, 'expenses'), {
    ...expenseData,
    amount: parseFloat(expenseData.amount) || 0,
    createdAt: new Date().toISOString(),
  });
};

/**
 * Delete an expense
 */
export const deleteExpense = async (id) => {
  return await deleteDoc(doc(univoDb, 'expenses', id));
};
