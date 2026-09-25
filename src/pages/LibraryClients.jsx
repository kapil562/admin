import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLibraryClients,
  cleanLibraryTenantData,
  purgeLibraryTenantData,
  restoreOrCreateLibraryClient,
} from '../firebase/services/libraryService';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Building2,
  Users,
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  MessageCircle,
  ShieldCheck,
  Clock,
  Eye,
  Trash2,
  HardDrive,
  AlertTriangle,
  Check,
  ShieldAlert,
  UserPlus,
  RotateCcw,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const LibraryClients = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [membershipFilter, setMembershipFilter] = useState('All'); // 'All', 'Paid', 'Free Trial'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'name_asc', 'name_desc'
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Clean Data Modal States
  const [cleanTarget, setCleanTarget] = useState(null);
  const [cleanMode, setCleanMode] = useState('data_only'); // 'data_only' | 'full_purge'
  const [cleanConfirmChecked, setCleanConfirmChecked] = useState(false);

  // Restore / Add Client Modal States
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreForm, setRestoreForm] = useState({
    email: '',
    libraryName: '',
    ownerName: '',
    phone: '',
    address: '',
    planName: 'Trial',
    tenantId: '',
  });

  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ['admin_library_clients'],
    queryFn: getLibraryClients,
  });

  const cleanMutation = useMutation({
    mutationFn: ({ tenantId, mode }) => {
      if (mode === 'full_purge') {
        return purgeLibraryTenantData(tenantId);
      }
      return cleanLibraryTenantData(tenantId);
    },
    onSuccess: (report, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin_library_clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_clients'] });
      if (variables.mode === 'full_purge') {
        toast.success(`Client account completely wiped (${report.deletedDocsCount} docs).`);
      } else {
        toast.success(
          `Data cleaned! Removed ${report.deletedDocsCount} student/seat records. Account & login remain active.`
        );
      }
      setCleanTarget(null);
      setCleanConfirmChecked(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to clean client data');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (formData) => restoreOrCreateLibraryClient(formData),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin_library_clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_clients'] });
      toast.success(`Library account for "${res.email}" restored successfully!`);
      setShowRestoreModal(false);
      setRestoreForm({
        email: '',
        libraryName: '',
        ownerName: '',
        phone: '',
        address: '',
        planName: 'Trial',
        tenantId: '',
      });
    },
    onError: (err) => toast.error(err.message || 'Failed to restore account'),
  });

  const filteredClients = useMemo(() => {
    let result = clients.filter((c) => {
      const matchSearch =
        (c.libraryName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.address || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || c.status === statusFilter;
      
      const isFreeTrial = (c.planName || '').toLowerCase().includes('trial') || (c.planName || '').toLowerCase().includes('free');
      const matchMembership = membershipFilter === 'All' 
        ? true 
        : membershipFilter === 'Free Trial' 
          ? isFreeTrial 
          : !isFreeTrial;

      return matchSearch && matchStatus && matchMembership;
    });

    result.sort((a, b) => {
      const getMs = (val) => {
        if (!val) return 0;
        if (typeof val === 'object' && val.seconds !== undefined) return val.seconds * 1000;
        if (typeof val === 'object' && typeof val.toMillis === 'function') return val.toMillis();
        return new Date(val).getTime() || 0;
      };

      if (sortOrder === 'newest') return getMs(b.createdAt) - getMs(a.createdAt);
      if (sortOrder === 'oldest') return getMs(a.createdAt) - getMs(b.createdAt);
      if (sortOrder === 'name_asc') return (a.libraryName || '').localeCompare(b.libraryName || '');
      if (sortOrder === 'name_desc') return (b.libraryName || '').localeCompare(a.libraryName || '');
      return 0;
    });

    return result;
  }, [clients, search, statusFilter, membershipFilter, sortOrder]);

  const activeCount = clients.filter((c) => c.status === 'Active').length;
  const expiredCount = clients.filter((c) => c.status === 'Expired').length;

  const formatDateTime = (val) => {
    if (!val) return 'No Date';
    try {
      let dateObj;
      if (typeof val === 'object' && val.seconds !== undefined) {
        dateObj = new Date(val.seconds * 1000);
      } else if (typeof val === 'object' && typeof val.toDate === 'function') {
        dateObj = val.toDate();
      } else {
        dateObj = new Date(val);
      }
      
      if (isNaN(dateObj.getTime())) return String(val);
      
      return dateObj.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return String(val);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading registered libraries..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Library Clients"
          subtitle="Manage all registered libraries, study points, and active SaaS memberships."
        />
        <button
          type="button"
          onClick={() => setShowRestoreModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <UserPlus size={15} />
          <span>+ Restore / Add Client Account</span>
        </button>
      </div>

      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Registered Libraries"
          value={clients.length}
          subtitle="All onboarded study centers"
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Active Subscriptions"
          value={activeCount}
          subtitle="Paying or active trial accounts"
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Expired / Due"
          value={expiredCount}
          subtitle="Require renewal or plan upgrade"
          icon={AlertCircle}
          color="rose"
        />
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-80">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, owner, city, phone..."
            />
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['All', 'Active', 'Expired'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === filter
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter}
                {filter === 'All' && ` (${clients.length})`}
                {filter === 'Active' && ` (${activeCount})`}
                {filter === 'Expired' && ` (${expiredCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Membership</span>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {['All', 'Free Trial', 'Paid'].map(type => (
                <button
                  key={type}
                  onClick={() => setMembershipFilter(type)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${membershipFilter === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort By</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-slate-100 border-none text-xs font-bold text-slate-700 py-1.5 px-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="newest">Newest Joined</option>
              <option value="oldest">Oldest Joined</option>
              <option value="name_asc">Library Name (A-Z)</option>
              <option value="name_desc">Library Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Responsive Clients Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Library & Owner</th>
                <th className="px-5 py-3.5">Contact Details</th>
                <th className="px-5 py-3.5">Location</th>
                <th className="px-5 py-3.5">Current Plan</th>
                <th className="px-5 py-3.5">Registered On</th>
                <th className="px-5 py-3.5">Subscription Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr 
                    key={client.id} 
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                          {client.libraryName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-xs">
                            {client.libraryName}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {client.ownerName}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-600">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Phone size={12} className="text-slate-400" />
                          <span>{client.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 truncate max-w-[200px]">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate max-w-[150px]">{client.address}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div>
                        <Badge variant="info" size="sm">
                          {client.planName}
                        </Badge>
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock size={11} />
                          <span>Expires: {formatDateTime(client.expiryDate)}</span>
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">
                      {formatDateTime(client.createdAt)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <Badge
                        variant={client.status === 'Active' ? 'success' : 'danger'}
                        dot
                      >
                        {client.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                          title="Inspect Details"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>

                        <button
                          onClick={() => {
                            setCleanTarget(client);
                            setCleanMode('data_only');
                            setCleanConfirmChecked(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-lg transition cursor-pointer"
                          title="Clean data (reset students, seats, fees)"
                        >
                          <Trash2 size={13} />
                          <span>Clean Data</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8">
                    <EmptyState
                      title="No matching libraries"
                      description="Try changing the search query or status filter."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Detail Modal */}
      <Modal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title={selectedClient?.libraryName || 'Library Details'}
        subtitle={`Tenant ID: ${selectedClient?.id}`}
        maxWidth="max-w-xl"
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Owner Name
                </span>
                <span className="text-slate-900 font-bold text-sm">
                  {selectedClient.ownerName}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Status
                </span>
                <Badge
                  variant={selectedClient.status === 'Active' ? 'success' : 'danger'}
                  dot
                >
                  {selectedClient.status}
                </Badge>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Phone
                </span>
                <span className="text-slate-800 font-semibold">{selectedClient.phone}</span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Email
                </span>
                <span className="text-slate-800 font-semibold">{selectedClient.email}</span>
              </div>
              <div className="col-span-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Location / Address
                </span>
                <span className="text-slate-800 font-medium">{selectedClient.address}</span>
              </div>
            </div>

            {/* Plan Info Card */}
            <div className="border border-blue-100 bg-blue-50/50 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CreditCard size={14} className="text-blue-600" />
                <span>Subscription Plan Information</span>
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Plan:</span>
                  <p className="font-bold text-slate-800 text-sm">{selectedClient.planName}</p>
                </div>
                <div>
                  <span className="text-slate-500">Expiry Date:</span>
                  <p className="font-bold text-slate-800 text-sm">
                    {formatDateTime(selectedClient.expiryDate)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">WhatsApp Credits:</span>
                  <p className="font-bold text-emerald-600 text-sm">
                    {selectedClient.messageBalance || 0} messages
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Registered On:</span>
                  <p className="font-bold text-slate-800 text-sm">
                    {selectedClient.registeredDate}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Clean Tenant Data Modal (Data Only vs Full Purge) */}
      <Modal
        isOpen={!!cleanTarget}
        onClose={() => {
          if (!cleanMutation.isPending) {
            setCleanTarget(null);
            setCleanConfirmChecked(false);
          }
        }}
        title="✨ Make Account Brand New (Data Clean)"
        subtitle="Client ka pura operational data reset karke unka account bilkul naya banayein — Login & Plan active rahenge!"
        maxWidth="max-w-xl"
      >
        {cleanTarget && (
          <div className="space-y-4">
            {/* Target Client Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-400 uppercase">Library Name</span>
                <span className="font-black text-slate-900 text-sm">{cleanTarget.libraryName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-400 uppercase">Owner Email</span>
                <span className="font-semibold text-slate-800">{cleanTarget.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-400 uppercase">Tenant UID</span>
                <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {cleanTarget.id}
                </span>
              </div>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Action Mode:
              </label>

              {/* Option 1: Data Only (Recommended - Brand New Account) */}
              <div
                onClick={() => setCleanMode('data_only')}
                className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${
                  cleanMode === 'data_only'
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="mt-0.5">
                  <input
                    type="radio"
                    checked={cleanMode === 'data_only'}
                    onChange={() => setCleanMode('data_only')}
                    className="w-4 h-4 text-emerald-600 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-black text-slate-900">
                      🧹 Reset Data to Brand New (Bilkul Naya Account) - Recommended
                    </h5>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      Account Safe
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Client ka <strong>Login, Password aur Active Subscription bilkul safe rahega</strong>. 
                    Sirf andar ka sara data (Students, Seats, Fees, Receipts, Expenses) 0 ho jayega aur dashboard Day-1 ki tarah bilkul fresh khulega!
                  </p>
                </div>
              </div>

              {/* Option 2: Full Wipe */}
              <div
                onClick={() => setCleanMode('full_purge')}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                  cleanMode === 'full_purge'
                    ? 'border-rose-500 bg-rose-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-white opacity-70'
                }`}
              >
                <div className="mt-0.5">
                  <input
                    type="radio"
                    checked={cleanMode === 'full_purge'}
                    onChange={() => setCleanMode('full_purge')}
                    className="w-4 h-4 text-rose-600 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-rose-900">
                      ⚠️ Complete Permanent Delete (Total Wipe)
                    </h5>
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">
                      Deletes Account
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Account profile aur subscription bhi delete ho jayegi.
                  </p>
                </div>
              </div>
            </div>

            {/* Scope of Cleanup */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-1">Data being reset to 0:</span>
              <div className="grid grid-cols-2 gap-1.5 text-slate-600 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Check size={12} className="text-emerald-600" /> All Students & Admissions (0)
                </span>
                <span className="flex items-center gap-1.5">
                  <Check size={12} className="text-emerald-600" /> All Seats & Sections (0)
                </span>
                <span className="flex items-center gap-1.5">
                  <Check size={12} className="text-emerald-600" /> All Fee Records & Receipts (0)
                </span>
                <span className="flex items-center gap-1.5">
                  <Check size={12} className="text-emerald-600" /> All Expenses & Visitor Logs (0)
                </span>
              </div>
            </div>

            {/* Safeguard Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="cleanConfirm"
                checked={cleanConfirmChecked}
                onChange={(e) => setCleanConfirmChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 cursor-pointer"
              />
              <label htmlFor="cleanConfirm" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                {cleanMode === 'data_only'
                  ? `Haan, main confirm karta hoon ki "${cleanTarget.libraryName}" ka data reset karke unka account bilkul brand new kar diya jaye (Login & Plan safe rahenge).`
                  : `I understand this will permanently delete the entire account and data for "${cleanTarget.libraryName}".`}
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={cleanMutation.isPending}
                onClick={() => {
                  setCleanTarget(null);
                  setCleanConfirmChecked(false);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!cleanConfirmChecked || cleanMutation.isPending}
                onClick={() => cleanMutation.mutate({ tenantId: cleanTarget.id, mode: cleanMode })}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 ${
                  cleanMode === 'data_only' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <Sparkles size={14} />
                <span>
                  {cleanMutation.isPending
                    ? 'Resetting Data...'
                    : cleanMode === 'data_only'
                    ? '✨ Clean Data & Make Brand New'
                    : 'Permanently Delete Account'}
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Restore or Add Client Modal */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => {
          if (!restoreMutation.isPending) setShowRestoreModal(false);
        }}
        title="Restore or Add Library Client Account"
        subtitle="Reconnect a deleted account or manually register a client on their email"
        maxWidth="max-w-lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            restoreMutation.mutate(restoreForm);
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 leading-relaxed">
            Agar kisi client ka account delete ho gaya tha ya wo usi email par login nahi kar pa rahe, yaha unka email daal kar turant unka <strong>Library Profile & Active Subscription</strong> restore karein.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Client Registered Email *
            </label>
            <input
              type="email"
              required
              value={restoreForm.email}
              onChange={(e) => setRestoreForm({ ...restoreForm, email: e.target.value })}
              placeholder="client@gmail.com"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Library / Center Name
              </label>
              <input
                type="text"
                value={restoreForm.libraryName}
                onChange={(e) => setRestoreForm({ ...restoreForm, libraryName: e.target.value })}
                placeholder="e.g. Saraswati Study Point"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Owner Full Name
              </label>
              <input
                type="text"
                value={restoreForm.ownerName}
                onChange={(e) => setRestoreForm({ ...restoreForm, ownerName: e.target.value })}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={restoreForm.phone}
                onChange={(e) => setRestoreForm({ ...restoreForm, phone: e.target.value })}
                placeholder="9876543210"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Subscription Plan
              </label>
              <select
                value={restoreForm.planName}
                onChange={(e) => setRestoreForm({ ...restoreForm, planName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              >
                <option value="Free Trial">Free Trial (30 Days)</option>
                <option value="Monthly Starter">Monthly Starter</option>
                <option value="Quarterly Growth">Quarterly Growth</option>
                <option value="Yearly Pro">Yearly Pro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Address / City
            </label>
            <input
              type="text"
              value={restoreForm.address}
              onChange={(e) => setRestoreForm({ ...restoreForm, address: e.target.value })}
              placeholder="e.g. Civil Lines, Jaipur"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Firebase UID (Optional)
            </label>
            <input
              type="text"
              value={restoreForm.tenantId}
              onChange={(e) => setRestoreForm({ ...restoreForm, tenantId: e.target.value })}
              placeholder="Leave blank to auto-detect"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white font-mono text-[11px]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowRestoreModal(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={restoreMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={14} />
              <span>{restoreMutation.isPending ? 'Restoring Profile...' : 'Restore / Create Account'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
