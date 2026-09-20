import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFeedbacks, updateFeedbackStatus } from '../firebase/services/supportService';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  MessageSquare,
  AlertCircle,
  Clock,
  CheckCircle2,
  Mail,
  User,
  Calendar,
  Building2,
  Tag,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const UserQueries = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedTicket, setSelectedTicket] = useState(null);

  // 1. Fetch Queries
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['admin_user_queries'],
    queryFn: getFeedbacks,
  });

  // 2. Status Mutation
  const statusMutation = useMutation({
    mutationFn: ({ refPath, newStatus }) => updateFeedbackStatus(refPath, newStatus),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin_user_queries'] });
      toast.success(`Ticket marked as ${variables.newStatus}`);
      setSelectedTicket((prev) => (prev ? { ...prev, status: variables.newStatus } : null));
    },
    onError: (e) => toast.error(e.message || 'Failed to update ticket status'),
  });

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.message || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(search.toLowerCase());

      const matchType = filterType === 'All' || t.type === filterType;
      const matchStatus = filterStatus === 'All' || t.status === filterStatus;

      return matchSearch && matchType && matchStatus;
    });
  }, [tickets, search, filterType, filterStatus]);

  const openCount = tickets.filter((t) => t.status === 'Open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'In Progress').length;
  const resolvedCount = tickets.filter((t) => t.status === 'Resolved').length;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getTypeVariant = (type) => {
    if (type === 'Bug') return 'danger';
    if (type === 'Feature') return 'info';
    return 'purple';
  };

  const getStatusVariant = (status) => {
    if (status === 'Resolved') return 'success';
    if (status === 'In Progress') return 'warning';
    return 'danger';
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading support queries & feedbacks..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Queries & Feedback"
        subtitle="Manage tickets, bug reports, and feature requests submitted by library owners."
      />

      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Open Tickets"
          value={openCount}
          subtitle="Require administrator response"
          icon={AlertCircle}
          color="rose"
        />
        <StatCard
          title="In Progress"
          value={inProgressCount}
          subtitle="Currently being investigated"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Resolved"
          value={resolvedCount}
          subtitle="Closed tickets"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by subject, message, or user..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['All', 'Open', 'In Progress', 'Resolved'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  filterStatus === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer border-none"
          >
            <option value="All">All Types</option>
            <option value="Bug">Bugs Only</option>
            <option value="Feature">Feature Requests</option>
            <option value="Support">Support Inquiries</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {filteredTickets.length > 0 ? (
          filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge variant={getTypeVariant(ticket.type)} size="sm">
                    {ticket.type}
                  </Badge>
                  <Badge variant={getStatusVariant(ticket.status)} size="sm" dot>
                    {ticket.status}
                  </Badge>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatDate(ticket.submittedAt)}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {ticket.subject}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-1">
                  {ticket.message}
                </p>

                <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1 font-semibold text-slate-600">
                    <User size={12} />
                    {ticket.name}
                  </span>
                  <span>•</span>
                  <span>{ticket.email}</span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <span>View Details</span>
                  <ArrowRight size={14} />
                </span>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="No support tickets found"
            description="All queries and feedbacks submitted by library owners will appear here."
          />
        )}
      </div>

      {/* Ticket Details & Action Modal */}
      <Modal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket?.subject || 'Ticket Details'}
        subtitle={`Submitted on ${formatDate(selectedTicket?.submittedAt)}`}
        maxWidth="max-w-xl"
      >
        {selectedTicket && (
          <div className="space-y-5">
            {/* Sender Details */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                  Submitted By
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {selectedTicket.name}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                  Email
                </span>
                <span className="font-semibold text-slate-700 truncate block">
                  {selectedTicket.email}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                  Ticket Type
                </span>
                <Badge variant={getTypeVariant(selectedTicket.type)} size="sm">
                  {selectedTicket.type}
                </Badge>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                  Current Status
                </span>
                <Badge variant={getStatusVariant(selectedTicket.status)} size="sm" dot>
                  {selectedTicket.status}
                </Badge>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                User Message / Inquiry Description
              </label>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedTicket.message}
              </div>
            </div>

            {/* Status Change Buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-600">Update Status:</span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={statusMutation.isPending || selectedTicket.status === 'Open'}
                  onClick={() =>
                    statusMutation.mutate({
                      refPath: selectedTicket.refPath,
                      newStatus: 'Open',
                    })
                  }
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer disabled:opacity-40"
                >
                  Mark Open
                </button>

                <button
                  type="button"
                  disabled={statusMutation.isPending || selectedTicket.status === 'In Progress'}
                  onClick={() =>
                    statusMutation.mutate({
                      refPath: selectedTicket.refPath,
                      newStatus: 'In Progress',
                    })
                  }
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition cursor-pointer disabled:opacity-40"
                >
                  In Progress
                </button>

                <button
                  type="button"
                  disabled={statusMutation.isPending || selectedTicket.status === 'Resolved'}
                  onClick={() =>
                    statusMutation.mutate({
                      refPath: selectedTicket.refPath,
                      newStatus: 'Resolved',
                    })
                  }
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-40"
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
