import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, orderBy, query } from 'firebase/firestore';
import { univoDb } from '@/firebase/config';
import { COLLECTIONS } from '@/constants/collections';

type Expense = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
};

const CATEGORIES = ['Marketing', 'Hosting', 'Salaries', 'Office', 'Tools', 'Miscellaneous'];

export const Finances = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: '', description: '', category: CATEGORIES[0], amount: '' });

  // Fetch expenses from Univo Firebase
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const q = query(collection(univoDb, COLLECTIONS.EXPENSES), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    },
  });

  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: async (newExpense: Omit<Expense, 'id'>) => {
      await addDoc(collection(univoDb, COLLECTIONS.EXPENSES), newExpense);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setForm({ date: '', description: '', category: CATEGORIES[0], amount: '' });
      setShowModal(false);
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addExpenseMutation.mutate({
      date: form.date,
      description: form.description,
      category: form.category,
      amount: parseFloat(form.amount),
    });
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0A192F' }}>Expenses</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>Track and manage all company expenses</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'linear-gradient(90deg, #005CE6, #00C853)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 20px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Add Expense
        </button>
      </div>

      {/* Summary Card */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', gap: '32px', alignItems: 'center' }}>
        <div>
          <p style={{ color: '#6B7280', fontSize: '13px' }}>Total Expenses</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#EF4444' }}>₹{totalExpenses.toLocaleString('en-IN')}</p>
        </div>
        <div style={{ width: '1px', background: '#F3F4F6', height: '48px' }} />
        <div>
          <p style={{ color: '#6B7280', fontSize: '13px' }}>Total Records</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#0A192F' }}>{expenses.length}</p>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFF' }}>
              {['Date', 'Description', 'Category', 'Amount'].map(h => (
                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', borderBottom: '1px solid #F3F4F6' }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Loading expenses...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>No expenses found.</td></tr>
            ) : expenses.map((exp, i) => (
              <tr key={exp.id} style={{ borderBottom: i < expenses.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <td style={{ padding: '14px 20px', fontSize: '14px', color: '#374151' }}>{new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td style={{ padding: '14px 20px', fontSize: '14px', color: '#111827', fontWeight: 500 }}>{exp.description}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ background: '#EEF2FF', color: '#4338CA', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
                    {exp.category}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', fontSize: '15px', fontWeight: 700, color: '#EF4444' }}>
                  − ₹{exp.amount.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '440px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0A192F' }}>Add Expense</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '22px', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Date</label>
                <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Description</label>
                <input type="text" required placeholder="e.g. Server Hosting" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white' }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Amount (₹)</label>
                <input type="number" required placeholder="0" min="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none' }} />
              </div>
              <button disabled={addExpenseMutation.isPending} type="submit" style={{ marginTop: '8px', background: 'linear-gradient(90deg, #005CE6, #00C853)', color: 'white', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', opacity: addExpenseMutation.isPending ? 0.7 : 1 }}>
                {addExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
