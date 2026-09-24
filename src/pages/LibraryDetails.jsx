import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getLibraryDetails } from '../firebase/services/libraryService';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { 
  ArrowLeft, 
  Users, 
  MapPin, 
  Phone, 
  Mail, 
  Building2, 
  CalendarDays, 
  BookOpen,
  IdCard,
  Crown
} from 'lucide-react';
import toast from 'react-hot-toast';

export const LibraryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('students'); // 'students', 'sections', 'memberships'

  const { data, isLoading, error } = useQuery({
    queryKey: ['library_details', id],
    queryFn: () => getLibraryDetails(id),
    retry: 1
  });

  if (isLoading) {
    return <div className="p-12 flex justify-center"><LoadingSpinner /></div>;
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <div className="text-rose-500 font-bold mb-4">Error loading library details.</div>
        <button onClick={() => navigate(-1)} className="text-blue-600 underline font-medium">Go Back</button>
      </div>
    );
  }

  const { library, subscription, students, sections, memberships } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs cursor-pointer"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <PageHeader 
          title={library.studyPointName || library.libraryName || 'Library Details'}
          subtitle={`Tenant ID: ${library.id}`}
        />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 lg:col-span-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-lg">
              {(library.studyPointName || library.libraryName || 'L').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">{library.ownerName || 'Unknown Owner'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={library.status === 'Active' ? 'success' : 'danger'} size="sm">
                  {library.status || 'Unknown'}
                </Badge>
                <span className="text-xs font-bold text-slate-400">• Registered on {new Date(library.createdAt || library.updatedAt || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                <Phone size={14} />
              </div>
              <span className="font-semibold text-slate-700">{library.phone || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                <Mail size={14} />
              </div>
              <span className="font-semibold text-slate-700 truncate">{library.email || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                <MapPin size={14} />
              </div>
              <span className="font-semibold text-slate-700 truncate">{library.address || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                <Building2 size={14} />
              </div>
              <span className="font-semibold text-slate-700">Total Seats: {library.totalSeats || 0}</span>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 shadow-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Crown size={80} />
          </div>
          <h3 className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Active Plan</h3>
          <div className="text-2xl font-black text-white mb-1">
            {subscription?.planName || subscription?.plan || 'Free Trial'}
          </div>
          <div className="text-emerald-400 text-sm font-bold flex items-center gap-1.5 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {subscription?.status || 'Active'}
          </div>
          
          <div className="space-y-3 pt-4 border-t border-slate-700/50">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Expires On</span>
              <span className="text-white font-semibold">
                {subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString() : 'Lifetime'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Plan Value</span>
              <span className="text-white font-semibold">
                ₹{subscription?.price || subscription?.amount || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition whitespace-nowrap ${
              activeTab === 'students' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Users size={16} />
            <span>Students ({students.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('memberships')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition whitespace-nowrap ${
              activeTab === 'memberships' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <IdCard size={16} />
            <span>Memberships ({memberships.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition whitespace-nowrap ${
              activeTab === 'sections' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <BookOpen size={16} />
            <span>Sections / Zones ({sections.length})</span>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'students' && (
            <div className="overflow-x-auto">
              {students.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-medium">No students registered yet.</div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 font-bold">Student Name</th>
                      <th className="py-3 px-4 font-bold">Phone</th>
                      <th className="py-3 px-4 font-bold">Seat</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Joined On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {students.slice(0, 100).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{s.name || s.studentName || 'Unknown'}</td>
                        <td className="py-3 px-4 text-slate-600">{s.phone || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-xs">{s.seatNumber || s.seatId || '-'}</td>
                        <td className="py-3 px-4">
                          <Badge variant={s.status === 'Active' ? 'success' : 'neutral'} size="sm">{s.status || 'Active'}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {students.length > 100 && <div className="text-center text-xs text-slate-400 mt-4">Showing first 100 students</div>}
            </div>
          )}

          {activeTab === 'memberships' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {memberships.length === 0 ? (
                <div className="col-span-full text-center py-12 text-slate-500 font-medium">No membership plans created.</div>
              ) : (
                memberships.map(m => (
                  <div key={m.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <h4 className="font-bold text-slate-900 mb-1">{m.name || m.planName}</h4>
                    <div className="text-xl font-black text-blue-600 mb-2">₹{m.price || m.amount}</div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {m.duration} Days Validity
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'sections' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sections.length === 0 ? (
                <div className="col-span-full text-center py-12 text-slate-500 font-medium">No sections or zones created.</div>
              ) : (
                sections.map(s => (
                  <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{s.name || s.sectionName}</h4>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{s.type || 'Standard Zone'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-slate-700 shadow-sm">
                      {s.totalSeats || 0}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
