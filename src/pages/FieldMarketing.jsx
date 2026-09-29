import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFieldVisits, logFieldVisit, updateFieldVisit, updateVisitStatus, deleteFieldVisit, getCurrentGPSLocation } from '../firebase/services/marketingService';
import { getStaffUsers } from '../firebase/services/staffService';
import { searchNearbyLibraries, searchLibrariesByText, formatDistance, getNavigationUrl, getPlaceMapUrl, geocodeAddress, reverseGeocode, parseAddressDetails, getPlaceDetails } from '../services/googleMapsService';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Navigation,
  MapPin,
  Building2,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
  Trash2,
  Crosshair,
  Check,
  Users,
  Compass,
  Search,
  Star,
  MessageCircle,
  PhoneCall,
  ChevronDown,
  Edit3,
  RotateCcw,
  Download,
  Clock,
  AlertTriangle,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const VISIT_STATUSES = [
  { id: 'Interested', label: 'Interested (Good Lead)', variant: 'info' },
  { id: 'Demo Given', label: 'Software Demo Given', variant: 'purple' },
  { id: 'Follow Up', label: 'Follow Up Scheduled', variant: 'warning' },
  { id: 'Deal Closed', label: '🎉 Deal Closed / Subscribed', variant: 'success' },
  { id: 'Not Interested', label: 'Not Interested', variant: 'danger' },
];

const RADIUS_OPTIONS = [
  { value: 0, label: '🌐 Any Distance (No km limit)' },
  { value: 5000, label: '5 km Radius' },
  { value: 10000, label: '10 km Radius' },
  { value: 20000, label: '20 km Radius' },
  { value: 30000, label: '30 km Radius' },
  { value: 40000, label: '40 km Radius' },
  { value: 50000, label: '50 km Radius' },
  { value: 60000, label: '60 km Radius' },
  { value: 70000, label: '70 km Radius' },
  { value: 80000, label: '80 km Radius' },
  { value: 100000, label: '100 km Radius' },
  { value: 150000, label: '150 km Radius' },
  { value: 200000, label: '200 km Radius' },
  { value: 300000, label: '300 km Radius' },
];

const LIMIT_OPTIONS = [
  { value: 0, label: '♾️ All Places (No limit)' },
  { value: 5, label: '5 Places' },
  { value: 10, label: '10 Places' },
  { value: 20, label: '20 Places' },
  { value: 30, label: '30 Places' },
  { value: 50, label: '50 Places' },
  { value: 75, label: '75 Places' },
  { value: 100, label: '100 Places' },
  { value: 150, label: '150 Places' },
  { value: 200, label: '200 Places' },
  { value: 300, label: '300 Places' },
];

const DATE_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

export const FieldMarketing = () => {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Core state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [statusDropdownId, setStatusDropdownId] = useState(null);

  // Nearby discovery state
  const [myLocation, setMyLocation] = useState(null);
  const [currentLocationName, setCurrentLocationName] = useState('Detecting your GPS location...');
  const [activeCategory, setActiveCategory] = useState('library'); // 'library' | 'gym'
  const [nearbyLibraries, setNearbyLibraries] = useState([]);
  const [searchingNearby, setSearchingNearby] = useState(false);
  const [nearbySearchDone, setNearbySearchDone] = useState(false);
  const [searchRadius, setSearchRadius] = useState(20000);
  const [customRadiusMode, setCustomRadiusMode] = useState(false);
  const [searchLimit, setSearchLimit] = useState(40);
  const [customLimitMode, setCustomLimitMode] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [showDiscovery, setShowDiscovery] = useState(true);

  const isSuperAdmin = user?.role === 'super_admin';

  // GPS state
  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsData, setGpsData] = useState(null);

  // Form state
  const [form, setForm] = useState({
    clientType: 'Library',
    businessName: '',
    ownerName: '',
    phone: '',
    state: '',
    city: '',
    address: '',
    discussionNotes: '',
    demoGiven: false,
    status: 'Interested',
    followUpDate: '',
    checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    durationMinutes: 20,
    placeId: null,
    placeName: '',
    placeAddress: '',
    placeRating: null,
    placeLat: null,
    placeLng: null,
  });

  // Fetch staff users (admin only)
  const { data: staffList = [] } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
    enabled: isSuperAdmin,
  });

  // Fetch visits
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: logFieldVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Field visit logged with GPS! ✅');
      setShowModal(false);
      setEditingVisit(null);
      resetForm();
    },
    onError: (err) => toast.error(err.message || 'Failed to save visit'),
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: ({ id, data }) => updateFieldVisit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Visit updated! ✅');
      setShowModal(false);
      setEditingVisit(null);
      resetForm();
    },
    onError: (err) => toast.error(err.message || 'Failed to update visit'),
  });

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateVisitStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Status updated!');
      setStatusDropdownId(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteFieldVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      toast.success('Visit record removed');
    },
  });

  // Default coordinates: Guna, MP (Madhya Pradesh)
  const DEFAULT_GUNA_COORDS = { latitude: 24.6465, longitude: 77.3188, accuracy: 100, isFallback: true };

  // ── Auto Search Runner ────────────────────────────────────────────────────
  const performSearch = useCallback(async (loc, category = activeCategory, customQuery = '', radius = searchRadius, limit = searchLimit) => {
    const targetLoc = loc || myLocation || DEFAULT_GUNA_COORDS;
    setSearchingNearby(true);
    try {
      let query = (customQuery != null ? customQuery : manualSearchQuery).trim();
      if (!query) {
        query = category === 'gym' ? 'gym fitness center' : 'study library reading room';
      }
      const res = await searchLibrariesByText(query, targetLoc.latitude, targetLoc.longitude, radius, limit);
      setNearbyLibraries(res || []);
      setNearbySearchDone(true);
    } catch (err) {
      console.error('Search error:', err);
      toast.error(err.message || 'Failed to find nearest places');
    } finally {
      setSearchingNearby(false);
    }
  }, [activeCategory, myLocation, manualSearchQuery, searchRadius, searchLimit]);

  // ── Auto Detect Live Location on Mount (Location detection only, NO auto-search) ──────
  const loadDeviceGPS = useCallback(async (isManual = false) => {
    try {
      const loc = await getCurrentGPSLocation();
      setMyLocation(loc);
      const rev = await reverseGeocode(loc.latitude, loc.longitude);
      const locName = rev.cityName || rev.formattedAddress || 'Your Live Location';
      setCurrentLocationName(locName);
      if (isManual) {
        toast.success(`GPS Connected: ${locName}`);
      }
    } catch (err) {
      console.warn('GPS unavailable (HTTP or permission denied), using Guna, MP fallback:', err);
      const fallbackLoc = DEFAULT_GUNA_COORDS;
      setMyLocation(fallbackLoc);
      setCurrentLocationName('Guna, MP (Default Location)');
      if (isManual) {
        toast('GPS not available on insecure HTTP. Using Guna, MP as location.', { icon: '📍' });
      }
    }
  }, []);

  // Run ONCE on mount — detects location only, does not auto-search places
  useEffect(() => {
    loadDeviceGPS(false);
  }, [loadDeviceGPS]);

  const handleCategorySwitch = (cat) => {
    setActiveCategory(cat);
    setManualSearchQuery('');
    setNearbyLibraries([]);
    setNearbySearchDone(false);
  };

  const handleManualSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!manualSearchQuery.trim()) {
      toast(`Type a ${activeCategory === 'gym' ? 'gym' : 'library'} name or area to search`, { icon: '🔍' });
      return;
    }
    const loc = myLocation || DEFAULT_GUNA_COORDS;
    performSearch(loc, activeCategory, manualSearchQuery, searchRadius, searchLimit);
  };

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({
      clientType: 'Library',
      businessName: '',
      ownerName: '',
      phone: '',
      state: '',
      city: '',
      address: '',
      discussionNotes: '',
      demoGiven: false,
      status: 'Interested',
      followUpDate: '',
      checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      durationMinutes: 20,
      placeId: null,
      placeName: '',
      placeAddress: '',
      placeRating: null,
      placeLat: null,
      placeLng: null,
    });
    setGpsData(null);
  };

  const openLogVisitFromPlace = async (place) => {
    setEditingVisit(null);

    // 1. Immediately parse city, state, and area from place.address
    const parsed = parseAddressDetails(place.address || '');

    setForm({
      clientType: activeCategory === 'gym' ? 'Gym' : 'Library',
      businessName: place.name || '',
      ownerName: '',
      phone: place.phone || '',
      state: parsed.state || '',
      city: parsed.city || '',
      address: parsed.area || place.address || '',
      discussionNotes: '',
      demoGiven: false,
      status: 'Interested',
      followUpDate: '',
      checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      durationMinutes: 20,
      placeId: place.placeId,
      placeName: place.name || '',
      placeAddress: place.address || '',
      placeRating: place.rating,
      placeLat: place.lat,
      placeLng: place.lng,
    });
    setShowModal(true);

    // 2. Auto GPS lock
    getCurrentGPSLocation().then((loc) => {
      setGpsData(loc);
    }).catch(() => {});

    // 3. Fetch phone number and detailed components from Google Places
    if (place.placeId) {
      getPlaceDetails(place.placeId)
        .then((details) => {
          if (details) {
            setForm((prev) => ({
              ...prev,
              phone: prev.phone || details.phone || '',
              city: prev.city || details.city || '',
              state: prev.state || details.state || '',
            }));
            if (details.phone) {
              toast.success(`Contact phone auto-filled: ${details.phone}`, { icon: '📞' });
            }
          }
        })
        .catch(() => {});
    }
  };

  const openReVisit = (visit) => {
    setEditingVisit(null);
    setForm({
      clientType: visit.clientType || 'Library',
      businessName: visit.businessName || '',
      ownerName: visit.ownerName || '',
      phone: visit.phone || '',
      state: visit.state || '',
      city: visit.city || '',
      address: visit.address || '',
      discussionNotes: '',
      demoGiven: false,
      status: 'Follow Up',
      followUpDate: '',
      checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      durationMinutes: 20,
      placeId: visit.placeId || null,
      placeName: visit.placeName || visit.businessName || '',
      placeAddress: visit.placeAddress || visit.address || '',
      placeRating: visit.placeRating || null,
      placeLat: visit.placeLat || null,
      placeLng: visit.placeLng || null,
    });
    setShowModal(true);
    getCurrentGPSLocation().then((loc) => {
      setGpsData(loc);
      toast.success(`GPS Auto-locked (±${loc.accuracy}m)`);
    }).catch(() => {});
  };

  const openEditVisit = (visit) => {
    setEditingVisit(visit);
    setForm({
      clientType: visit.clientType || 'Library',
      businessName: visit.businessName || '',
      ownerName: visit.ownerName || '',
      phone: visit.phone || '',
      state: visit.state || '',
      city: visit.city || '',
      address: visit.address || '',
      discussionNotes: visit.discussionNotes || '',
      demoGiven: visit.demoGiven || false,
      status: visit.status || 'Interested',
      followUpDate: visit.followUpDate || '',
      checkInTime: visit.checkInTime || '',
      checkOutTime: visit.checkOutTime || '',
      durationMinutes: visit.durationMinutes || 20,
      placeId: visit.placeId || null,
      placeName: visit.placeName || '',
      placeAddress: visit.placeAddress || '',
      placeRating: visit.placeRating || null,
      placeLat: visit.placeLat || null,
      placeLng: visit.placeLng || null,
    });
    setGpsData(visit.location || null);
    setShowModal(true);
  };

  const handleCaptureGPS = async () => {
    setCapturingGps(true);
    try {
      const loc = await getCurrentGPSLocation();
      setGpsData(loc);
      toast.success(`GPS Acquired: ±${loc.accuracy}m`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCapturingGps(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      toast.error('Business Name is required.');
      return;
    }

    if (editingVisit) {
      editMutation.mutate({ id: editingVisit.id, data: { ...form, location: gpsData } });
    } else {
      addMutation.mutate({
        ...form,
        staffId: user?.uid || user?.id || 'staff',
        staffName: user?.displayName || user?.name || 'Marketing Staff',
        location: gpsData,
      });
    }
  };

  // ── Filtering logic ────────────────────────────────────────────────────────
  const baseVisits = useMemo(() => {
    if (isSuperAdmin) {
      if (selectedStaffFilter === 'All') return visits;
      return visits.filter((v) => {
        const staffObj = staffList.find((s) => s.id === selectedStaffFilter);
        return (
          v.staffId === selectedStaffFilter ||
          (staffObj && v.staffName?.toLowerCase() === staffObj.name?.toLowerCase()) ||
          v.staffName?.toLowerCase() === selectedStaffFilter.toLowerCase()
        );
      });
    }
    const myId = user?.uid || user?.id;
    const myName = (user?.displayName || user?.name || '').toLowerCase();
    return visits.filter(
      (v) => v.staffId === myId || (v.staffName && v.staffName.toLowerCase() === myName)
    );
  }, [visits, isSuperAdmin, selectedStaffFilter, user, staffList]);

  const filteredVisits = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    return baseVisits.filter((v) => {
      const matchSearch =
        (v.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.phone || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.staffName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.city || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.discussionNotes || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || v.status === statusFilter;

      let matchDate = true;
      if (dateFilter === 'today') {
        matchDate = (v.createdAt || '').startsWith(todayStr);
      } else if (dateFilter === 'week') {
        matchDate = v.createdAt >= weekAgo;
      } else if (dateFilter === 'month') {
        matchDate = v.createdAt >= monthStart;
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [baseVisits, search, statusFilter, dateFilter]);

  // Stats
  const totalVisitsCount = baseVisits.length;
  const demosGivenCount = baseVisits.filter((v) => v.demoGiven).length;
  const dealsClosedCount = baseVisits.filter((v) => v.status === 'Deal Closed').length;
  const followUpsCount = baseVisits.filter((v) => v.status === 'Follow Up').length;

  // Today's follow-ups + overdue
  const todayStr = new Date().toISOString().split('T')[0];
  const dueFollowUps = useMemo(() => {
    return baseVisits.filter(
      (v) => v.status === 'Follow Up' && v.followUpDate && v.followUpDate <= todayStr
    );
  }, [baseVisits, todayStr]);
  const overdueCount = dueFollowUps.filter((v) => v.followUpDate < todayStr).length;

  // Get visit history for a place
  const getPlaceVisitHistory = useCallback(
    (placeId) => {
      if (!placeId) return [];
      return visits.filter((v) => v.placeId === placeId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    [visits]
  );

  // Visit count per place
  const getVisitNumber = useCallback(
    (visit) => {
      if (!visit.placeId) return null;
      const placeVisits = visits
        .filter((v) => v.placeId === visit.placeId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const idx = placeVisits.findIndex((v) => v.id === visit.id);
      return idx >= 0 ? idx + 1 : null;
    },
    [visits]
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeVariant = (st) => {
    const found = VISIT_STATUSES.find((s) => s.id === st);
    return found ? found.variant : 'neutral';
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Date', 'Business', 'Owner', 'Phone', 'City', 'State', 'Staff', 'Status', 'Demo', 'Discussion', 'GPS Link', 'Follow-up'];
    const rows = filteredVisits.map((v) => [
      formatDate(v.createdAt),
      v.businessName || '',
      v.ownerName || '',
      v.phone || '',
      v.city || '',
      v.state || '',
      v.staffName || '',
      v.status || '',
      v.demoGiven ? 'Yes' : 'No',
      (v.discussionNotes || '').replace(/"/g, '""'),
      v.location?.mapsUrl || '',
      v.followUpDate || '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((f) => `"${f}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Field_Visits_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  };

  // Close status dropdown on outside click
  useEffect(() => {
    const handleClick = () => setStatusDropdownId(null);
    if (statusDropdownId) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [statusDropdownId]);

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading field marketing data..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isSuperAdmin ? 'Field Marketing & Staff Oversight' : 'My Field Marketing & Library Visits'}
        subtitle={
          isSuperAdmin
            ? 'Discover nearby libraries, track visits, GPS verification, and monitor team performance.'
            : `Personal Field Workspace (${user?.displayName || 'Staff'}): Discover, visit, and track libraries with GPS.`
        }
        action={
          <div className="flex items-center gap-2">
            {hasPermission('marketing', 'create') && (
              <button
                onClick={() => {
                  resetForm();
                  setEditingVisit(null);
                  setShowModal(true);
                  getCurrentGPSLocation().then((loc) => {
                    setGpsData(loc);
                    toast.success(`GPS Auto-locked (±${loc.accuracy}m)`);
                  }).catch(() => {});
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus size={16} />
                <span>Log Visit</span>
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              title="Export CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        }
      />

      {/* ═══ SECTION A: Auto-Find Nearest Libraries & Gyms ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
              <Compass size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                🔍 Nearest {activeCategory === 'gym' ? 'Gyms & Fitness Centers' : 'Study Libraries'}
              </h3>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <MapPin size={12} className="text-blue-600 shrink-0" />
                <span className="font-bold text-slate-700">{currentLocationName}</span>
                <button
                  type="button"
                  onClick={() => loadDeviceGPS(true)}
                  title="Re-detect Live GPS"
                  className="text-blue-600 hover:text-blue-800 text-[10px] font-bold underline ml-1 cursor-pointer flex items-center gap-0.5"
                >
                  <Crosshair size={10} /> Auto-Detect GPS
                </button>
              </p>
            </div>
          </div>

          {/* Simple 2-Way Category Switcher: Libraries vs Gyms */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl self-start sm:self-auto border border-slate-200">
            <button
              type="button"
              onClick={() => handleCategorySwitch('library')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'library'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📚 Study Libraries</span>
            </button>
            <button
              type="button"
              onClick={() => handleCategorySwitch('gym')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'gym'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🏋️ Gyms</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Search Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder={activeCategory === 'gym' ? "Search gym name or city (e.g. Gold Gym, Guna)..." : "Search library name or city (e.g. Study point, Guna)..."}
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch(e)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Radius Control: Dropdown with 5-300km OR Type Custom km */}
              {customRadiusMode ? (
                <div className="flex items-center bg-slate-50 border border-blue-500 rounded-xl px-2.5 py-1.5 shadow-xs">
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={searchRadius / 1000}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(300, Number(e.target.value) || 1));
                      setSearchRadius(val * 1000);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch(e)}
                    className="w-14 text-xs font-black text-blue-700 outline-none bg-transparent"
                    placeholder="km"
                    autoFocus
                  />
                  <span className="text-[11px] font-bold text-slate-500 mr-1.5">km</span>
                  <button
                    type="button"
                    onClick={() => setCustomRadiusMode(false)}
                    className="text-slate-400 hover:text-slate-700 text-xs font-bold px-1 py-0.5 rounded cursor-pointer"
                    title="Switch to dropdown list"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  value={RADIUS_OPTIONS.some((r) => r.value === searchRadius) ? searchRadius : 'custom'}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setCustomRadiusMode(true);
                    } else {
                      const r = Number(e.target.value);
                      setSearchRadius(r);
                      if (manualSearchQuery.trim()) {
                        performSearch(myLocation, activeCategory, manualSearchQuery, r, searchLimit);
                      }
                    }
                  }}
                  className="flex-1 sm:flex-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  title="Search Radius (5 km to 300 km)"
                >
                  {RADIUS_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                  <option value="custom">✏️ Type Custom km...</option>
                </select>
              )}

              {/* No. of Results Limit Control: Dropdown with 5-100 places OR Type Custom count */}
              {customLimitMode ? (
                <div className="flex items-center bg-slate-50 border border-blue-500 rounded-xl px-2.5 py-1.5 shadow-xs">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={searchLimit || ''}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(500, Number(e.target.value) || 1));
                      setSearchLimit(val);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch(e)}
                    className="w-14 text-xs font-black text-blue-700 outline-none bg-transparent"
                    placeholder="qty"
                    autoFocus
                  />
                  <span className="text-[11px] font-bold text-slate-500 mr-1.5">places</span>
                  <button
                    type="button"
                    onClick={() => setCustomLimitMode(false)}
                    className="text-slate-400 hover:text-slate-700 text-xs font-bold px-1 py-0.5 rounded cursor-pointer"
                    title="Switch to dropdown list"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  value={LIMIT_OPTIONS.some((l) => l.value === searchLimit) ? searchLimit : 'custom'}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setCustomLimitMode(true);
                    } else {
                      const l = Number(e.target.value);
                      setSearchLimit(l);
                      if (manualSearchQuery.trim()) {
                        performSearch(myLocation, activeCategory, manualSearchQuery, searchRadius, l);
                      }
                    }
                  }}
                  className="flex-1 sm:flex-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  title="Maximum number of results (5 to 100)"
                >
                  {LIMIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="custom">✏️ Type Custom count...</option>
                </select>
              )}

              <button
                onClick={handleManualSearch}
                disabled={searchingNearby}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                {searchingNearby ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                <span>{searchingNearby ? 'Searching...' : 'Find Nearest'}</span>
              </button>
            </div>
          </div>

            {/* Results Grid */}
            {nearbySearchDone && (
              <div>
                <p className="text-xs font-bold text-slate-500 mb-3">
                  {nearbyLibraries.length} {activeCategory === 'gym' ? 'gyms' : 'libraries'} found
                  {searchRadius > 0 ? ` within ${searchRadius / 1000} km` : ''}
                  {searchLimit > 0 ? ` (top ${searchLimit})` : ''}
                  {' '}• Sorted by distance (nearest first)
                </p>
                {nearbyLibraries.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
                    {nearbyLibraries.map((place) => {
                      const placeHistory = getPlaceVisitHistory(place.placeId);
                      const lastVisit = placeHistory[0];

                      return (
                        <div
                          key={place.placeId}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:shadow-md transition-all space-y-3"
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-sm truncate">{place.name}</p>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{place.address}</p>
                            </div>
                            <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg whitespace-nowrap border border-blue-100 flex items-center gap-1">
                              <span>{place.distanceFormatted}</span>
                              {place.durationFormatted && (
                                <span className="text-[10px] text-blue-500 font-medium">({place.durationFormatted})</span>
                              )}
                            </span>
                          </div>

                          {/* Rating + Open */}
                          <div className="flex items-center gap-3 text-[11px]">
                            {place.rating && (
                              <span className="flex items-center gap-1 font-bold text-amber-700">
                                <Star size={11} className="fill-amber-400 text-amber-400" />
                                {place.rating} ({place.totalRatings})
                              </span>
                            )}
                            {place.isOpen !== null && (
                              <span className={`font-bold ${place.isOpen ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {place.isOpen ? '● Open' : '● Closed'}
                              </span>
                            )}
                          </div>

                          {/* Visit History Badge */}
                          {lastVisit ? (
                            <div className="p-2 bg-emerald-50/80 rounded-lg border border-emerald-200/60 text-[11px]">
                              <span className="font-bold text-emerald-800">
                                ✅ Visited {placeHistory.length}x • Last by {lastVisit.staffName}
                              </span>
                              <p className="text-emerald-700 mt-0.5 truncate">
                                {lastVisit.status} — "{(lastVisit.discussionNotes || '').slice(0, 60)}"
                              </p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">Not visited yet</p>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            {myLocation && (
                              <a
                                href={getNavigationUrl(myLocation.latitude, myLocation.longitude, place.lat, place.lng)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition"
                              >
                                <Compass size={13} />
                                Navigate
                              </a>
                            )}
                            {hasPermission('marketing', 'create') && (
                              <button
                                onClick={() => openLogVisitFromPlace(place)}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                <Plus size={13} />
                                Log Visit
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-slate-400">
                    No libraries found. Try a different search or increase radius.
                  </div>
                )}
              </div>
            )}

            {!nearbySearchDone && !searchingNearby && (
              <div className="text-center py-8 text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                <Search size={22} className="text-slate-300 mb-1" />
                <p className="font-semibold text-slate-600">
                  Type a {activeCategory === 'gym' ? 'gym' : 'library'} name or city above and click "Find Nearest"
                </p>
                <p className="text-[11px] text-slate-400">
                  Search box me type karne ke baad hi nearest results dikhenge.
                </p>
              </div>
            )}
          </div>
        </div>

      {/* ═══ SECTION B: Today's Follow-up Alerts ═══ */}
      {dueFollowUps.length > 0 && (
        <div className="bg-amber-50/80 rounded-2xl border border-amber-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                  📞 {dueFollowUps.length} Follow-up Callbacks Due {overdueCount > 0 && `(${overdueCount} Overdue!)`}
                </h3>
                <p className="text-[11px] text-amber-700">Call these library owners today — don't lose the lead!</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {dueFollowUps.slice(0, 6).map((v) => (
              <div
                key={v.id}
                className={`p-3 rounded-xl border bg-white/80 space-y-2 ${
                  v.followUpDate < todayStr ? 'border-rose-300 ring-1 ring-rose-200' : 'border-amber-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-xs truncate">{v.businessName}</p>
                    <p className="text-[10px] text-slate-500">{v.ownerName}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      v.followUpDate < todayStr
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {v.followUpDate < todayStr ? 'OVERDUE' : 'TODAY'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 line-clamp-1">
                  "{(v.discussionNotes || '').slice(0, 80)}"
                </p>

                <div className="flex items-center justify-between gap-2">
                  {v.phone && (
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${v.phone}`}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition"
                      >
                        <PhoneCall size={10} /> Call
                      </a>
                      <a
                        href={`https://wa.me/91${v.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200 hover:bg-emerald-100 transition"
                      >
                        <MessageCircle size={10} /> WhatsApp
                      </a>
                    </div>
                  )}
                  <button
                    onClick={() => openReVisit(v)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    <RotateCcw size={10} /> Re-Visit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Stat Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={isSuperAdmin ? 'Total Field Visits' : 'My Total Visits'}
          value={totalVisitsCount}
          subtitle="All on-site library meetings"
          icon={Building2}
          color="blue"
        />
        <StatCard
          title={isSuperAdmin ? 'Demos Given' : 'My Demos'}
          value={demosGivenCount}
          subtitle="Software demo shown"
          icon={Navigation}
          color="purple"
        />
        <StatCard
          title="Follow-ups Pending"
          value={followUpsCount}
          subtitle="Libraries needing callback"
          icon={AlertCircle}
          color="amber"
        />
        <StatCard
          title="Deals Closed"
          value={dealsClosedCount}
          subtitle="Subscribed clients"
          icon={CheckCircle2}
          color="emerald"
          trend={`${dealsClosedCount} Won`}
          trendPositive={true}
        />
      </div>

      {/* ═══ Admin Staff Performance Panel ═══ */}
      {isSuperAdmin && staffList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Users size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Marketing Staff Performance</h3>
                <p className="text-[11px] text-slate-500">Click a staff member to filter their visits</p>
              </div>
            </div>
            {selectedStaffFilter !== 'All' && (
              <button
                onClick={() => setSelectedStaffFilter('All')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                Clear Filter (Show All)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {staffList.map((staff) => {
              const staffVisits = visits.filter(
                (v) => v.staffId === staff.id || v.staffName?.toLowerCase() === staff.name.toLowerCase()
              );
              const staffDemos = staffVisits.filter((v) => v.demoGiven).length;
              const staffDeals = staffVisits.filter((v) => v.status === 'Deal Closed').length;
              const isSelected = selectedStaffFilter === staff.id;

              return (
                <div
                  key={staff.id}
                  onClick={() => setSelectedStaffFilter(isSelected ? 'All' : staff.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{staff.name}</p>
                      <p className="text-[10px] text-slate-500">{staff.roleLabel || 'Marketing Rep'}</p>
                    </div>
                    <Badge variant={isSelected ? 'info' : 'neutral'} size="sm">
                      {staffVisits.length} visits
                    </Badge>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600"><strong>{staffDemos}</strong> Demos</span>
                    <span className="font-bold text-emerald-700">🎉 {staffDeals} Won</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Search, Filters & Controls ═══ */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
          <div className="w-full sm:w-80">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by library, owner, phone, city, notes..."
            />
          </div>

          {isSuperAdmin && staffList.length > 0 && (
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="All">All Staff ({visits.length})</option>
              {staffList.map((s) => {
                const sCount = visits.filter(
                  (v) => v.staffId === s.id || v.staffName?.toLowerCase() === s.name.toLowerCase()
                ).length;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({sCount})
                  </option>
                );
              })}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 flex-wrap">
          {/* Date filter */}
          {DATE_FILTERS.map((df) => (
            <button
              key={df.id}
              onClick={() => setDateFilter(df.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                dateFilter === df.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {df.label}
            </button>
          ))}
          <span className="text-slate-300 mx-1">|</span>
          {/* Status filter */}
          {['All', 'Interested', 'Demo Given', 'Follow Up', 'Deal Closed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
              {st === 'All' && ` (${baseVisits.length})`}
              {st === 'Deal Closed' && ` (${dealsClosedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ SECTION C: Visits Table ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Client & Target</th>
                <th className="px-5 py-3.5">Owner & Contact</th>
                <th className="px-5 py-3.5">Staff & Date</th>
                <th className="px-5 py-3.5">Discussion & Demo</th>
                <th className="px-5 py-3.5">GPS Verification</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredVisits.length > 0 ? (
                filteredVisits.map((visit) => {
                  const visitNum = getVisitNumber(visit);
                  return (
                    <tr key={visit.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Business Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0">
                            <Building2 size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate max-w-xs">
                              {visit.businessName}
                            </p>
                            <span className="text-[11px] text-slate-400 font-semibold block">
                              {visit.clientType} • {visit.city || 'City'}
                              {visitNum && visitNum > 1 && (
                                <span className="ml-1 text-blue-600 font-bold">• Visit #{visitNum}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Owner & Contact */}
                      <td className="px-5 py-4 text-xs text-slate-600">
                        <div className="font-semibold text-slate-800">{visit.ownerName}</div>
                        {visit.phone && (
                          <div className="flex items-center gap-2 mt-1">
                            <a href={`tel:${visit.phone}`} className="text-blue-600 hover:text-blue-800" title="Call">
                              <PhoneCall size={12} />
                            </a>
                            <a
                              href={`https://wa.me/91${visit.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-800"
                              title="WhatsApp"
                            >
                              <MessageCircle size={12} />
                            </a>
                            <span className="text-slate-500 text-[11px]">{visit.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Staff & Date */}
                      <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{visit.staffName}</div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                          {formatDate(visit.createdAt)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {visit.checkInTime} - {visit.checkOutTime}
                        </div>
                      </td>

                      {/* Discussion & Demo */}
                      <td className="px-5 py-4 max-w-xs text-xs">
                        <p className="text-slate-700 line-clamp-2 leading-relaxed">
                          {visit.discussionNotes || 'No notes.'}
                        </p>
                        {visit.demoGiven && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Check size={10} /> Demo Given
                          </span>
                        )}
                        {visit.followUpDate && (
                          <span className="block text-[10px] text-amber-600 font-semibold mt-0.5">
                            Follow-up: {visit.followUpDate}
                          </span>
                        )}
                      </td>

                      {/* GPS */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {visit.location ? (
                          <div className="space-y-1">
                            <a
                              href={visit.location.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold hover:bg-blue-100 transition"
                            >
                              <MapPin size={12} className="text-blue-600" />
                              <span>Google Map</span>
                              <ExternalLink size={10} />
                            </a>
                            <p className="text-[10px] text-slate-400 font-medium">±{visit.location.accuracy || 10}m</p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No GPS</span>
                        )}
                      </td>

                      {/* Status (Inline Changeable) */}
                      <td className="px-5 py-4 whitespace-nowrap relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusDropdownId(statusDropdownId === visit.id ? null : visit.id);
                          }}
                          className="cursor-pointer flex items-center gap-1"
                        >
                          <Badge variant={getStatusBadgeVariant(visit.status)} size="sm">
                            {visit.status}
                          </Badge>
                          <ChevronDown size={12} className="text-slate-400" />
                        </button>

                        {statusDropdownId === visit.id && (
                          <div
                            className="absolute z-20 top-full left-2 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 w-48"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {VISIT_STATUSES.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => statusMutation.mutate({ id: visit.id, status: s.id })}
                                className={`w-full text-left px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                  visit.status === s.id
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedVisit(visit)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                            title="Inspect"
                          >
                            Inspect
                          </button>
                          {hasPermission('marketing', 'create') && (
                            <button
                              onClick={() => openEditVisit(visit)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 size={13} />
                            </button>
                          )}
                          {hasPermission('marketing', 'create') && (
                            <button
                              onClick={() => openReVisit(visit)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Re-Visit"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                          {hasPermission('marketing', 'delete') && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete visit record for "${visit.businessName}"?`)) {
                                  deleteMutation.mutate(visit.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8">
                    <EmptyState
                      icon={Navigation}
                      title="No visits found"
                      description="Try adjusting your filters, or click 'Log Visit' to record an on-site visit."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Log / Edit Visit Modal ═══ */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingVisit(null); }}
        title={editingVisit ? 'Edit Visit Record' : 'Log On-Site Library Visit'}
        subtitle={
          editingVisit
            ? `Editing visit to ${editingVisit.businessName}`
            : form.placeName
            ? `📍 ${form.placeName} — ${form.placeAddress}`
            : 'Capture GPS location, library details, and meeting notes'
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* GPS Capture Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  gpsData ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-blue-50 text-blue-600'
                }`}
              >
                <Crosshair size={20} className={capturingGps ? 'animate-spin' : ''} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Live GPS Pinpoint</p>
                <p className="text-[11px] text-slate-500">
                  {gpsData
                    ? `GPS Locked: ${gpsData.latitude.toFixed(5)}, ${gpsData.longitude.toFixed(5)} (±${gpsData.accuracy}m)`
                    : 'Click to capture or wait for auto-lock'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={capturingGps}
              onClick={handleCaptureGPS}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                gpsData
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
              }`}
            >
              <MapPin size={14} />
              <span>{capturingGps ? 'Locking...' : gpsData ? 'Re-Capture' : 'Capture GPS'}</span>
            </button>
          </div>

          {/* Business Name & Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Library Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Saraswati Library, Apex Study Point"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Owner Name</label>
              <input
                type="text"
                placeholder="e.g. Rakesh Kumar"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Contact Mobile</label>
              {form.phone && <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">✓ Auto-filled from Google</span>}
            </div>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 font-medium"
            />
          </div>

          {/* State, City, Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">State (राज्य) *</label>
                {form.state && <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">✓ Auto</span>}
              </div>
              <input
                type="text"
                required
                placeholder="e.g. Madhya Pradesh"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 font-medium"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">City (शहर) *</label>
                {form.city && <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">✓ Auto</span>}
              </div>
              <input
                type="text"
                required
                placeholder="e.g. Guna"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 font-medium"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Area / Location</label>
                {form.address && <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">✓ Auto</span>}
              </div>
              <input
                type="text"
                placeholder="e.g. Gaushala Mahaveerpura"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 font-medium"
              />
            </div>
          </div>

          {/* Discussion Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Discussion Summary (Kya baat hui?) *</label>
            <textarea
              rows={3}
              required
              placeholder="Met owner. Interested in 100-seat plan. Liked WhatsApp feature. Will call Monday."
              value={form.discussionNotes}
              onChange={(e) => setForm({ ...form, discussionNotes: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          {/* Times & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Check-in Time</label>
              <input
                type="text"
                placeholder="11:30 AM"
                value={form.checkInTime}
                onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Check-out Time</label>
              <input
                type="text"
                placeholder="12:00 PM"
                value={form.checkOutTime}
                onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Lead Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
              >
                {VISIT_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Demo & Follow-up */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="demoCheck"
                checked={form.demoGiven}
                onChange={(e) => setForm({ ...form, demoGiven: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
              <label htmlFor="demoCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                Live Software Demo was given
              </label>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Follow-up Date</label>
              <input
                type="date"
                value={form.followUpDate}
                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setShowModal(false); setEditingVisit(null); }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || editMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {addMutation.isPending || editMutation.isPending
                ? 'Saving...'
                : editingVisit
                ? 'Update Visit'
                : 'Save Visit Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══ Inspection Modal ═══ */}
      <Modal
        isOpen={!!selectedVisit}
        onClose={() => setSelectedVisit(null)}
        title={selectedVisit?.businessName || 'Visit Details'}
        subtitle={`Logged by ${selectedVisit?.staffName} on ${formatDate(selectedVisit?.createdAt)}`}
      >
        {selectedVisit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Target Type</span>
                <span className="font-bold text-slate-800">{selectedVisit.clientType}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Lead Status</span>
                <Badge variant={getStatusBadgeVariant(selectedVisit.status)} size="sm">{selectedVisit.status}</Badge>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Owner Contact</span>
                <span className="font-semibold text-slate-800">
                  {selectedVisit.ownerName} ({selectedVisit.phone || 'N/A'})
                </span>
                {selectedVisit.phone && (
                  <div className="flex items-center gap-2 mt-1">
                    <a href={`tel:${selectedVisit.phone}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200">
                      <PhoneCall size={10} /> Call
                    </a>
                    <a
                      href={`https://wa.me/91${selectedVisit.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200"
                    >
                      <MessageCircle size={10} /> WhatsApp
                    </a>
                  </div>
                )}
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">State & City</span>
                <span className="font-semibold text-slate-800">
                  {selectedVisit.city || 'N/A'}{selectedVisit.state ? `, ${selectedVisit.state}` : ''}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Location / Area</span>
                <span className="font-semibold text-slate-800">{selectedVisit.address || 'N/A'}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Meeting Discussion</span>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedVisit.discussionNotes}
              </div>
            </div>

            {/* Visit History for same place */}
            {selectedVisit.placeId && getPlaceVisitHistory(selectedVisit.placeId).length > 1 && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  📜 All Visits to this Library ({getPlaceVisitHistory(selectedVisit.placeId).length})
                </span>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {getPlaceVisitHistory(selectedVisit.placeId).map((hv, idx) => (
                    <div key={hv.id} className={`p-2.5 rounded-lg border text-xs ${hv.id === selectedVisit.id ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{hv.staffName} — {formatDate(hv.createdAt)}</span>
                        <Badge variant={getStatusBadgeVariant(hv.status)} size="sm">{hv.status}</Badge>
                      </div>
                      <p className="text-slate-600 mt-1 line-clamp-1">{hv.discussionNotes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedVisit.location && (
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-900">GPS On-Site Verification</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Coords: {selectedVisit.location.latitude}, {selectedVisit.location.longitude}
                  </p>
                </div>
                <a
                  href={selectedVisit.location.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition"
                >
                  <MapPin size={12} /> Google Maps <ExternalLink size={10} />
                </a>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              {hasPermission('marketing', 'create') && (
                <>
                  <button
                    onClick={() => { setSelectedVisit(null); openEditVisit(selectedVisit); }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => { setSelectedVisit(null); openReVisit(selectedVisit); }}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <RotateCcw size={12} /> Log Re-Visit
                  </button>
                </>
              )}
              {selectedVisit.placeLat && myLocation && (
                <a
                  href={getNavigationUrl(myLocation.latitude, myLocation.longitude, selectedVisit.placeLat, selectedVisit.placeLng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                >
                  <Compass size={12} /> Navigate
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
