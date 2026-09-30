import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExpenses, addExpense, deleteExpense, EXPENSE_CATEGORIES } from '../firebase/services/financeService';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Wallet,
  Plus,
  Calendar,
  Tag,
  Trash2,
  DollarSign,
  TrendingDown,
  Layers,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Finances = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Marketing',
    amount: '',
    paidBy: 'Company Account',
  });

  // 1. Fetch Expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['admin_expenses'],
    queryFn: getExpenses,
  });

  // 2. Add Mutation
  const addMutation = useMutation({
    mutationFn: addExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_expenses'] });
      toast.success('Expense recorded successfully');
      setForm({
        date: new Date().toISOString().split('T')[0],
        description: '',
        category: 'Marketing',
        amount: '',
        paidBy: 'Company Account',
      });
      setShowModal(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to record expense');
    },
  });

  // 3. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_expenses'] });
      toast.success('Expense removed');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to remove expense');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!form.description.trim()) {
      toast.error('Please enter a description');
      return;
    }
    addMutation.mutate(form);
  };

  const handleDelete = (id, desc) => {
    if (window.confirm(`Are you sure you want to delete "${desc}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchSearch =
        exp.description.toLowerCase().includes(search.toLowerCase()) ||
        exp.category.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === 'All' || exp.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [expenses, search, selectedCategory]);

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt || 0);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading expense records..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses & Finances"
        subtitle="Track Univo Infotech operational costs, server infrastructure, marketing, and salaries."
        action={
          hasPermission('finances', 'create') && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Expense</span>
            </button>
          )
        }
      />

      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Operating Expenses"
          value={formatCurrency(totalExpenses)}
          subtitle="Cumulative company expenditures"
          icon={Wallet}
          color="rose"
        />
        <StatCard
          title="Filtered Subtotal"
          value={formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
          subtitle={`${filteredExpenses.length} entries shown`}
          icon={Tag}
          color="indigo"
        />
        <StatCard
          title="Categories Active"
          value={EXPENSE_CATEGORIES.length - 1}
          subtitle="Marketing, Hosting, Salaries, Tools"
          icon={Layers}
          color="emerald"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by description or category..."
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Paid Via</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {exp.description}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <Badge variant="purple" size="sm">
                        {exp.category}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {exp.paidBy}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-rose-600 whitespace-nowrap">
                      -{formatCurrency(exp.amount)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {hasPermission('finances', 'delete') && (
                        <button
                          onClick={() => handleDelete(exp.id, exp.description)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete expense"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8">
                    <EmptyState
                      title="No expenses found"
                      description="Click 'Add Expense' above to log a new expenditure."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Record New Expense"
        subtitle="Log operational overheads or vendor bills"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description / Vendor
            </label>
            <input
              type="text"
              required
              placeholder="e.g. AWS Hosting, Google Workspace, Freelancer payment"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
              >
                {EXPENSE_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Method
            </label>
            <input
              type="text"
              placeholder="Bank Transfer, Corporate Card, UPI"
              value={form.paidBy}
              onChange={(e) => setForm({ ...form, paidBy: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {addMutation.isPending ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
