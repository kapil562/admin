import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPlatformTransactions } from '../firebase/services/libraryService';
import { getExpenses } from '../firebase/services/financeService';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  BarChart3,
  Calendar,
  Download,
  IndianRupee,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  CreditCard,
  MessageCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Reports = () => {
  const [timeRange, setTimeRange] = useState('all'); // 'today', 'month', 'all', 'custom'
  const [streamFilter, setStreamFilter] = useState('all'); // 'all', 'subscription', 'whatsapp', 'expense'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 1. Fetch Transactions
  const { data: transactionData = { all: [] }, isLoading: loadingTx } = useQuery({
    queryKey: ['report_transactions'],
    queryFn: getPlatformTransactions,
  });

  // 2. Fetch Expenses
  const { data: expenses = [], isLoading: loadingExp } = useQuery({
    queryKey: ['report_expenses'],
    queryFn: getExpenses,
  });

  const isLoading = loadingTx || loadingExp;

  // Filter calculations based on range
  const filteredData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Normalize transactions into unified ledger items
    const incomeItems = (transactionData.all || []).map((t) => ({
      id: t.id,
      date: t.date,
      title: t.planName,
      subtitle: t.type,
      stream: t.type === 'Subscription' ? 'subscription' : 'whatsapp',
      type: 'INCOME',
      amount: t.amount,
      refId: t.paymentId,
    }));

    const expenseItems = expenses.map((e) => ({
      id: e.id,
      date: e.date,
      title: e.description,
      subtitle: e.category,
      stream: 'expense',
      type: 'EXPENSE',
      amount: e.amount,
      refId: e.paidBy,
    }));

    let combined = [...incomeItems, ...expenseItems];

    // Filter by TimeRange
    if (timeRange === 'today') {
      combined = combined.filter((item) => (item.date || '').startsWith(todayStr));
    } else if (timeRange === 'month') {
      combined = combined.filter((item) => (item.date || '').startsWith(thisMonthStr));
    } else if (timeRange === 'custom') {
      if (startDate) {
        combined = combined.filter((item) => new Date(item.date) >= new Date(startDate));
      }
      if (endDate) {
        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);
        combined = combined.filter((item) => new Date(item.date) <= endDay);
      }
    }

    // Filter by Stream
    if (streamFilter !== 'all') {
      combined = combined.filter((item) => item.stream === streamFilter);
    }

    // Sort descending by date
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactionData, expenses, timeRange, streamFilter, startDate, endDate]);

  // Aggregate stats
  const totalIncome = filteredData
    .filter((d) => d.type === 'INCOME')
    .reduce((sum, d) => sum + d.amount, 0);

  const totalExpense = filteredData
    .filter((d) => d.type === 'EXPENSE')
    .reduce((sum, d) => sum + d.amount, 0);

  const netBalance = totalIncome - totalExpense;

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      toast.error('No data available to export');
      return;
    }

    const headers = ['Date', 'Title', 'Category / Type', 'Direction', 'Amount (INR)', 'Reference ID'];
    const rows = filteredData.map((d) => [
      formatDate(d.date),
      `"${(d.title || '').replace(/"/g, '""')}"`,
      `"${d.subtitle || ''}"`,
      d.type,
      d.amount,
      `"${d.refId || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Univo_Financial_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Report downloaded');
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Compiling financial reports..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Financial breakdown, revenue trends, expense audits, and CSV ledger export."
        action={
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        }
      />

      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Period Income"
          value={formatCurrency(totalIncome)}
          subtitle="Subscriptions & WhatsApp revenue"
          icon={IndianRupee}
          color="emerald"
        />
        <StatCard
          title="Period Expenses"
          value={formatCurrency(totalExpense)}
          subtitle="Internal expenditures & bills"
          icon={Wallet}
          color="rose"
        />
        <StatCard
          title="Net Cashflow"
          value={formatCurrency(netBalance)}
          subtitle={netBalance >= 0 ? 'Surplus / Profit' : 'Deficit'}
          icon={TrendingUp}
          color={netBalance >= 0 ? 'indigo' : 'rose'}
          trend={netBalance >= 0 ? 'Surplus' : 'Deficit'}
          trendPositive={netBalance >= 0}
        />
      </div>

      {/* Controls & Date Filter */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Time Range Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeRange(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  timeRange === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Stream Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Filter size={14} />
              <span>Stream:</span>
            </span>
            <select
              value={streamFilter}
              onChange={(e) => setStreamFilter(e.target.value)}
              className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer border-none"
            >
              <option value="all">All Transactions & Expenses</option>
              <option value="subscription">Subscriptions Only</option>
              <option value="whatsapp">WhatsApp Packs Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {timeRange === 'custom' && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Financial Ledger Records ({filteredData.length})
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Sorted by Date (Recent first)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Transaction / Title</th>
                <th className="px-5 py-3.5">Category / Channel</th>
                <th className="px-5 py-3.5">Reference ID</th>
                <th className="px-5 py-3.5 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {item.title}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <Badge
                        variant={
                          item.type === 'INCOME'
                            ? item.stream === 'subscription'
                              ? 'warning'
                              : 'success'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {item.subtitle}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                      {item.refId ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded">
                          {String(item.refId).substring(0, 16)}...
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td
                      className={`px-5 py-4 text-right font-black whitespace-nowrap ${
                        item.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {item.type === 'INCOME' ? '+' : '-'}
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8">
                    <EmptyState
                      title="No transactions for this period"
                      description="Try adjusting your date range or filter selection."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
