import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStaffUsers } from '../firebase/services/staffService';
import { getLibraryClients } from '../firebase/services/libraryService';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { SearchBar } from '../components/ui/SearchBar';
import { Wallet, Gift, Users, IndianRupee, ChevronDown, ChevronUp, MapPin, Phone } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export const StaffCommissions = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStaff, setExpandedStaff] = useState(null);

  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['staff_commissions'],
    queryFn: getStaffUsers,
  });

  const { data: libraries = [], isLoading: loadingLibs } = useQuery({
    queryKey: ['library_clients_referrals'],
    queryFn: getLibraryClients,
  });

  const filteredStaff = staffList.filter((s) =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.referralCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStaffReferrals = (code) => {
    if (!code) return [];
    return libraries.filter(lib => lib.referredByCode === code || lib.referralCode === code);
  };

  if (loadingStaff || loadingLibs) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Commissions & Referrals"
        description="Track library registrations via staff referral codes and manage commission payouts."
        icon={Wallet}
      />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="w-full sm:max-w-md">
          <SearchBar
            placeholder="Search by staff name or referral code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredStaff.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Staff Found"
            message="No staff members match your search criteria."
          />
        ) : (
          filteredStaff.map((staff) => {
            const referrals = getStaffReferrals(staff.referralCode);
            const activeCount = referrals.filter(r => r.referralStatus === 'Paid' || r.status === 'Active').length;
            const isExpanded = expandedStaff === staff.id;

            return (
              <div key={staff.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200">
                <div 
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50"
                  onClick={() => setExpandedStaff(isExpanded ? null : staff.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-lg shadow-md shrink-0">
                      {(staff.name || 'S').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{staff.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                          <Gift size={12} />
                          {staff.referralCode || 'No Code Assigned'}
                        </span>
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {staff.roleLabel || staff.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap md:flex-nowrap items-center gap-6">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Referrals</p>
                      <p className="text-lg font-black text-slate-700">{referrals.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Deals</p>
                      <p className="text-lg font-black text-emerald-600">{activeCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Commission Wallet</p>
                      <p className="text-xl font-black text-indigo-600">₹{(staff.walletBalance || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Users size={16} className="text-indigo-600" />
                      Referred Libraries ({referrals.length})
                    </h4>
                    
                    {referrals.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 text-center bg-white rounded-xl border border-slate-200 border-dashed">
                        No libraries have registered using this staff member's referral code yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {referrals.map((lib) => (
                          <div key={lib.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h5 className="font-bold text-slate-900 text-sm">{lib.libraryName}</h5>
                                <p className="text-xs text-slate-500">{lib.ownerName}</p>
                              </div>
                              <Badge variant={lib.referralStatus === 'Paid' ? 'success' : 'warning'} size="sm">
                                {lib.referralStatus === 'Paid' ? 'Commission Paid' : 'Pending'}
                              </Badge>
                            </div>
                            
                            <div className="space-y-1.5 mb-3">
                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <Phone size={12} className="shrink-0" />
                                <span>{lib.phone || 'No phone'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <MapPin size={12} className="shrink-0" />
                                <span className="truncate">{lib.address || 'No address'}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                              <span className="text-[10px] font-bold text-slate-400">
                                Registered: {lib.registeredDate}
                              </span>
                              <Badge variant="info" size="sm" className="text-[10px]">
                                Plan: {lib.planName}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
