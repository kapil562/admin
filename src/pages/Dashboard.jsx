import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getLibraryClients, getPlatformTransactions } from '../firebase/services/libraryService';
import { getExpenses } from '../firebase/services/financeService';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { StaffDashboard } from './StaffDashboard';
import { getStaffUsers, calculateStaffPayroll } from '../firebase/services/staffService';
import { getFieldVisits } from '../firebase/services/marketingService';
import { getSoftwareVerticals } from '../firebase/services/verticalService';
import {
  IndianRupee,
  Users,
  CreditCard,
  TrendingUp,
  Wallet,
  MessageCircle,
  Crown,
  ArrowRight,
  Building2,
  Calendar,
  ExternalLink,
  Award,
  ShieldCheck, CheckCircle2,
  Zap,
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();

  // If logged in as staff member, automatically show Staff Dashboard!
  if (user && user.role !== 'super_admin') {
    return <StaffDashboard />;
  }

  // 1. Fetch Libraries
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['dashboard_clients'],
    queryFn: getLibraryClients,
  });

  // 2. Fetch Transactions & Revenue
  const { data: transactionData = { all: [], grandTotal: 0, subscriptionTotal: 0, whatsappTotal: 0 }, isLoading: loadingTx } = useQuery({
    queryKey: ['dashboard_transactions'],
    queryFn: getPlatformTransactions,
  });

  // 3. Fetch Company Expenses
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['dashboard_expenses'],
    queryFn: getExpenses,
  });

  // 4. Fetch Staff & Field Visits for Commission Overview
  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
  });

  const { data: allVisits = [] } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ['software_verticals'],
    queryFn: getSoftwareVerticals,
  });

  const isLoading = loadingClients || loadingTx || loadingExpenses || loadingStaff;

  // Computations
  const totalRevenue = transactionData.grandTotal || 0;
  const subscriptionRevenue = transactionData.subscriptionTotal || 0;
  const whatsappRevenue = transactionData.whatsappTotal || 0;

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const razorpayCharges = Math.round(totalRevenue * 0.0236); // standard ~2% + GST
  const netProfit = totalRevenue - razorpayCharges - totalExpenses;

  const activeLibraries = clients.filter((c) => c.status === 'Active').length;
  const totalLibraries = clients.length;

  const recentTransactions = transactionData.all.slice(0, 7);
  const recentClients = clients.slice(0, 5);

  const formatCurrency = (amount) => {

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
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

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Calculating live platform analytics..." />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Platform Overview"
        subtitle="Real-time revenue, SaaS subscriptions, and client libraries statistics."
        action={
          <div className="flex items-center gap-3">
            <Link
              to="/plans"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition"
            >
              <Crown className="w-4 h-4" />
              <span>Manage Plans</span>
            </Link>
          </div>
        }
      />

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Platform Revenue"
          value={formatCurrency(totalRevenue)}
          subtitle={`${transactionData.all.length} total orders`}
          icon={IndianRupee}
          color="indigo"
          trend="Live Gross"
          trendPositive={true}
        />
        <StatCard
          title="Estimated Net Profit"
          value={formatCurrency(netProfit)}
          subtitle="After 2.36% Gateway & Expenses"
          icon={TrendingUp}
          color={netProfit >= 0 ? 'emerald' : 'rose'}
          trend={netProfit >= 0 ? 'Positive Margin' : 'Negative'}
          trendPositive={netProfit >= 0}
        />
        <StatCard
          title="Total Operating Expenses"
          value={formatCurrency(totalExpenses)}
          subtitle={`${expenses.length} expense entries`}
          icon={Wallet}
          color="rose"
        />
        <StatCard
          title="Registered Libraries"
          value={totalLibraries}
          subtitle={`${activeLibraries} Active subscriptions`}
          icon={Building2}
          color="blue"
        />
      </div>

      {/* Revenue Breakdown Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Crown size={120} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-xs">
              SaaS Subscriptions
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black">{formatCurrency(subscriptionRevenue)}</p>
            <p className="text-xs text-amber-100 font-semibold">
              From recurring monthly & yearly plans ({transactionData.subscriptions.length} sales)
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <MessageCircle size={120} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-xs">
              WhatsApp Message Packs
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black">{formatCurrency(whatsappRevenue)}</p>
            <p className="text-xs text-emerald-100 font-semibold">
              From automated SMS & WhatsApp recharges ({transactionData.whatsappPacks.length} packs sold)
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Transactions & Recent Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Recent Transactions Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Revenue & Transactions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest SaaS and WhatsApp package purchases</p>
            </div>
            <Link
              to="/reports"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Plan / Item</th>
                  <th className="px-5 py-3">Payment ID</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-600 font-medium whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge
                          variant={tx.type === 'Subscription' ? 'warning' : 'success'}
                          size="sm"
                        >
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                        {tx.planName}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-500 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-0.5 rounded">
                          {tx.paymentId?.substring(0, 14)}...
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-emerald-600 whitespace-nowrap">
                        +{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-500">
                      No transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Registered Libraries Widget (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Clients</h2>
              <p className="text-xs text-slate-500 mt-0.5">Newly joined libraries</p>
            </div>
            <Link
              to="/clients"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>See All</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="p-5 flex-1 divide-y divide-slate-100 space-y-3.5">
            {recentClients.length > 0 ? (
              recentClients.map((client) => (
                <div key={client.id} className="pt-3.5 first:pt-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {client.libraryName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {client.ownerName} • {client.address}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge
                        variant={client.status === 'Active' ? 'success' : 'danger'}
                        size="sm"
                        dot
                      >
                        {client.status}
                      </Badge>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {client.planName}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                    {client.registeredDate}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-500 py-6">
                No libraries found in database.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Staff Performance & Commission Payout Overview */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <span>Staff Performance & Commission Payouts</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live calculation of Monthly Base Salary + Deal Commissions for marketing team
            </p>
          </div>
          <Link
            to="/staff"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Manage Staff & Pay</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Staff Member</th>
                <th className="px-5 py-3.5">Field Visits</th>
                <th className="px-5 py-3.5">Deals Closed</th>
                <th className="px-5 py-3.5">Base Monthly Salary</th>
                <th className="px-5 py-3.5">Earned Commission</th>
                <th className="px-5 py-3.5 text-right">Total Month Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.length > 0 ? (
                staffList.map((staff) => {
                  const pay = calculateStaffPayroll(staff, allVisits);
                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-900 text-sm">{staff.name}</p>
                        <span className="text-[10px] text-slate-400">
                          {staff.roleLabel || staff.role} • {staff.email}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 font-bold text-slate-700">
                        {pay.totalVisits} visits
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} /> {pay.dealsClosed} Won
                        </span>
                      </td>

                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {formatCurrency(pay.baseSalary)}
                      </td>

                      <td className="px-5 py-3.5 font-black text-emerald-600">
                        +{formatCurrency(pay.commissionEarned)}
                        <span className="block text-[10px] font-normal text-slate-400">
                          ({formatCurrency(pay.commissionPerDeal)} / deal)
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <span className="font-black text-sm text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 inline-block">
                          {formatCurrency(pay.totalEstimatedPayout)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No staff members registered yet. Click "Manage Staff" to add marketing executives.
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

