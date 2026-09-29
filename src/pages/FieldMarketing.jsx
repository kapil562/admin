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
  Camera,
  Image as ImageIcon,
  Flame,
  Zap,
  Shield,
  FileCheck,
  Layers,
  HelpCircle,
  BellRing,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

const VISIT_STATUSES = [
  { id: 'Interested', label: 'Interested (Good Lead)', variant: 'info' },
  { id: 'Demo Given', label: 'Software Demo Given', variant: 'purple' },
  { id: 'Follow Up', label: 'Follow Up Scheduled', variant: 'warning' },
  { id: 'Deal Closed', label: '🎉 Deal Closed / Subscribed', variant: 'success' },
  { id: 'Not Interested', label: 'Not Interested', variant: 'danger' },
];

const PERSON_MET_OPTIONS = [
  'Owner / Director',
  'Manager / In-Charge',
  'Receptionist / Staff',
  'Partner / Co-Founder',
  'Other',
];

const SEAT_CAPACITY_OPTIONS = [
  '< 50 Seats',
  '50 - 100 Seats',
  '100 - 150 Seats',
  '150 - 250 Seats',
  '250+ Seats',
];

const CURRENT_SOFTWARE_OPTIONS = [
  { id: 'Manual Register', label: '📒 Manual Register / Diary', desc: 'No software yet (High conversion!)' },
  { id: 'Excel / Spreadsheets', label: '📊 Excel / Google Sheets', desc: 'Basic computer records' },
  { id: 'Competitor Software', label: '💻 Competitor Software', desc: 'Active other subscription' },
  { id: 'New Library', label: '🆕 New Library Setup', desc: 'Opening soon' },
];

const LEAD_PRIORITY_OPTIONS = [
  { id: 'Hot', label: '🔥 Hot (Closing in 1-3 Days)', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'Warm', label: '⚡ Warm (Interested, Needs Follow-up)', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'Cold', label: '❄️ Cold (Long Term / Competitor Locked)', color: 'text-blue-600 bg-blue-50 border-blue-200' },
];

const NEXT_ACTION_TAGS = [
  '💻 Give Full Software Demo',
  '🤝 Meet Owner Directly (Kal Owner Milenge)',
  '💰 Price Negotiation / Final Discount',
  '📝 Collect Payment / Cheque',
  '🔄 Excel / Data Migration Assistance',
  '📞 Call back to confirm decision',
  '📱 Send WhatsApp Proposal & Videos',
];

const COMPETITOR_SUGGESTIONS = ['Librex', 'ReaderDesk', 'LibraryDesk', 'StudyHub', 'Custom App'];

/**
 * Client-side lightweight image compression for instant Firestore storage (~50-80KB)
 */
const compressImage = (file, maxWidth = 1000, maxHeight = 1000, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const initialFormState = {
  clientType: 'Library',
  businessName: '',
  ownerName: '',
  phone: '',
  secondaryPhone: '',
  state: '',
  city: '',
  address: '',
  discussionNotes: '',
  demoGiven: false,
  status: 'Interested',
  leadPriority: 'Warm',
  // Person Met & Profile
  personMet: 'Owner / Director',
  contactPersonName: '',
  seatCapacity: '',
  // Current System & Competitor
  currentSoftwareType: 'Manual Register',
  competitorName: '',
  competitorExpiryDate: '',
  competitorDuration: '',
  switchingReason: '',
  // Follow-up & Reminders
  followUpDate: '',
  followUpTime: '',
  followUpType: 'In-Person Re-Visit',
  nextActionItem: '',
  reminderNote: '',
  // Photo
  photoUrl: null,
  // Times & Location
  checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  durationMinutes: 20,
  placeId: null,
  placeName: '',
  placeAddress: '',
  placeRating: null,
  placeLat: null,
  placeLng: null,
};

const RADIUS_OPTIONS = [
  { value: '', label: '-- Select Radius (km) --' },
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
  { value: '', label: '-- Select Places (Count) --' },
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
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  // Nearby discovery state
  const [myLocation, setMyLocation] = useState(null);
  const [currentLocationName, setCurrentLocationName] = useState('Detecting your GPS location...');
  const [activeCategory, setActiveCategory] = useState('library'); // 'library' | 'gym'
  const [nearbyLibraries, setNearbyLibraries] = useState([]);
  const [searchingNearby, setSearchingNearby] = useState(false);
  const [nearbySearchDone, setNearbySearchDone] = useState(false);
  const [searchRadius, setSearchRadius] = useState('');
  const [customRadiusMode, setCustomRadiusMode] = useState(false);
  const [searchLimit, setSearchLimit] = useState('');
  const [customLimitMode, setCustomLimitMode] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [showDiscovery, setShowDiscovery] = useState(true);

  const isSuperAdmin = user?.role === 'super_admin';

  // GPS state
  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsData, setGpsData] = useState(null);

  // Form state
  const [form, setForm] = useState(initialFormState);

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
    setSearchRadius('');
    setSearchLimit('');
    setCustomRadiusMode(false);
    setCustomLimitMode(false);
  };

  const handleManualSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!manualSearchQuery.trim()) {
      toast(`Type a ${activeCategory === 'gym' ? 'gym' : 'library'} name or area to search`, { icon: '🔍' });
      return;
    }

    const hasRadius = searchRadius !== '' && Number(searchRadius) > 0;
    const hasLimit = searchLimit !== '' && Number(searchLimit) > 0;

    if (!hasRadius && !hasLimit) {
      toast.error('Radius (km) ya Number of Places me se kisi ek me entry hona zaroori hai!');
      return;
    }

    const loc = myLocation || DEFAULT_GUNA_COORDS;
    const radiusVal = hasRadius ? Number(searchRadius) : null;
    const limitVal = hasLimit ? Number(searchLimit) : null;
    performSearch(loc, activeCategory, manualSearchQuery, radiusVal, limitVal);
  };

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm(initialFormState);
    setGpsData(null);
  };

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading('Processing & compressing photo...', { id: 'photo-upload' });
      const compressed = await compressImage(file);
      setForm((prev) => ({ ...prev, photoUrl: compressed }));
      toast.success('Library photo attached! 📷', { id: 'photo-upload' });
    } catch (err) {
      console.error('Failed to compress image:', err);
      toast.error('Failed to process image. Please try again.', { id: 'photo-upload' });
    }
  };

  const setQuickFollowUp = (type) => {
    const now = new Date();
    let targetDate = new Date();
    let timeStr = '14:00';

    if (type === '30min') {
      targetDate = new Date(now.getTime() + 30 * 60 * 1000);
      const hrs = String(targetDate.getHours()).padStart(2, '0');
      const mins = String(targetDate.getMinutes()).padStart(2, '0');
      timeStr = `${hrs}:${mins}`;
    } else if (type === '1hr') {
      targetDate = new Date(now.getTime() + 60 * 60 * 1000);
      const hrs = String(targetDate.getHours()).padStart(2, '0');
      const mins = String(targetDate.getMinutes()).padStart(2, '0');
      timeStr = `${hrs}:${mins}`;
    } else if (type === '2hr') {
      targetDate = new Date(now.getTime() + 120 * 60 * 1000);
      const hrs = String(targetDate.getHours()).padStart(2, '0');
      const mins = String(targetDate.getMinutes()).padStart(2, '0');
      timeStr = `${hrs}:${mins}`;
    } else if (type === 'today_evening') {
      timeStr = '17:00';
    } else if (type === 'tomorrow_11am') {
      targetDate.setDate(targetDate.getDate() + 1);
      timeStr = '11:00';
    } else if (type === 'tomorrow_2pm') {
      targetDate.setDate(targetDate.getDate() + 1);
      timeStr = '14:00';
    } else if (type === '2days') {
      targetDate.setDate(targetDate.getDate() + 2);
      timeStr = '12:00';
    } else if (type === '7days') {
      targetDate.setDate(targetDate.getDate() + 7);
      timeStr = '12:00';
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    setForm((prev) => ({
      ...prev,
      status: 'Follow Up',
      followUpDate: dateStr,
      followUpTime: timeStr,
    }));
    toast.success(`Follow-up set: ${dateStr} at ${timeStr}`);
  };

  const setCompetitorPreset = (months, label) => {
    const target = new Date();
    target.setMonth(target.getMonth() + months);
    const expiryStr = target.toISOString().split('T')[0];

    // Set follow-up reminder 10 days before expiry!
    const reminderDate = new Date(target);
    reminderDate.setDate(reminderDate.getDate() - 10);
    const reminderStr = reminderDate.toISOString().split('T')[0];

    setForm((prev) => ({
      ...prev,
      currentSoftwareType: 'Competitor Software',
      competitorDuration: label,
      competitorExpiryDate: expiryStr,
      followUpDate: reminderStr,
      followUpTime: '11:00',
      status: 'Follow Up',
      nextActionItem: `Competitor (${prev.competitorName || 'Software'}) expiring soon - Offer Migration & Special Price`,
      reminderNote: `Current software expires on ${expiryStr}. Follow up 10 days before to close deal!`,
    }));
    toast.success(`Competitor expiry set to ${expiryStr}. Follow-up reminder set 10 days before!`);
  };

  const openLogVisitFromPlace = async (place) => {
    setEditingVisit(null);
    const parsed = parseAddressDetails(place.address || '');

    setForm({
      ...initialFormState,
      clientType: activeCategory === 'gym' ? 'Gym' : 'Library',
      businessName: place.name || '',
      phone: place.phone || '',
      state: parsed.state || '',
      city: parsed.city || '',
      address: parsed.area || place.address || '',
      placeId: place.placeId,
      placeName: place.name || '',
      placeAddress: place.address || '',
      placeRating: place.rating,
      placeLat: place.lat,
      placeLng: place.lng,
      checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    });
    setShowModal(true);

    getCurrentGPSLocation().then((loc) => {
      setGpsData(loc);
    }).catch(() => {});

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
      ...initialFormState,
      clientType: visit.clientType || 'Library',
      businessName: visit.businessName || '',
      ownerName: visit.ownerName || '',
      phone: visit.phone || '',
      secondaryPhone: visit.secondaryPhone || '',
      state: visit.state || '',
      city: visit.city || '',
      address: visit.address || '',
      personMet: visit.personMet || 'Owner / Director',
      contactPersonName: visit.contactPersonName || '',
      seatCapacity: visit.seatCapacity || '',
      currentSoftwareType: visit.currentSoftwareType || 'Manual Register',
      competitorName: visit.competitorName || '',
      competitorExpiryDate: visit.competitorExpiryDate || '',
      competitorDuration: visit.competitorDuration || '',
      switchingReason: visit.switchingReason || '',
      leadPriority: visit.leadPriority || 'Warm',
      status: 'Follow Up',
      placeId: visit.placeId || null,
      placeName: visit.placeName || visit.businessName || '',
      placeAddress: visit.placeAddress || visit.address || '',
      placeRating: visit.placeRating || null,
      placeLat: visit.placeLat || null,
      placeLng: visit.placeLng || null,
      checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      checkOutTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
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
      secondaryPhone: visit.secondaryPhone || '',
      state: visit.state || '',
      city: visit.city || '',
      address: visit.address || '',
      discussionNotes: visit.discussionNotes || '',
      demoGiven: visit.demoGiven || false,
      status: visit.status || 'Interested',
      leadPriority: visit.leadPriority || 'Warm',
      personMet: visit.personMet || 'Owner / Director',
      contactPersonName: visit.contactPersonName || '',
      seatCapacity: visit.seatCapacity || '',
      currentSoftwareType: visit.currentSoftwareType || 'Manual Register',
      competitorName: visit.competitorName || '',
      competitorExpiryDate: visit.competitorExpiryDate || '',
      competitorDuration: visit.competitorDuration || '',
      switchingReason: visit.switchingReason || '',
      followUpDate: visit.followUpDate || '',
      followUpTime: visit.followUpTime || '',
      followUpType: visit.followUpType || 'In-Person Re-Visit',
      nextActionItem: visit.nextActionItem || '',
      reminderNote: visit.reminderNote || '',
      photoUrl: visit.photoUrl || null,
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

  // Get visit history for a place or business name
  const getPlaceVisitHistory = useCallback(
    (placeId, businessName) => {
      const bName = (businessName || '').trim().toLowerCase();
      if (!placeId && !bName) return [];
      return visits
        .filter((v) => (placeId && v.placeId === placeId) || (bName && (v.businessName || '').trim().toLowerCase() === bName))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    [visits]
  );

  // Visit count per place or business name (Visit #1, Visit #2, etc.)
  const getVisitNumber = useCallback(
    (visit) => {
      const bName = (visit.businessName || '').trim().toLowerCase();
      const placeVisits = visits
        .filter((v) => (visit.placeId && v.placeId === visit.placeId) || (bName && (v.businessName || '').trim().toLowerCase() === bName))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const idx = placeVisits.findIndex((v) => v.id === visit.id);
      return idx >= 0 ? idx + 1 : 1;
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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: '-', time: '' };
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      };
    } catch {
      return { date: dateStr, time: '' };
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
                    value={searchRadius ? searchRadius / 1000 : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setSearchRadius('');
                      } else {
                        const val = Math.max(1, Math.min(300, Number(raw) || 1));
                        setSearchRadius(val * 1000);
                      }
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
                      const r = e.target.value === '' ? '' : Number(e.target.value);
                      setSearchRadius(r);
                      if (nearbySearchDone && manualSearchQuery.trim()) {
                        const hasR = r !== '' && Number(r) > 0;
                        const hasL = searchLimit !== '' && Number(searchLimit) > 0;
                        if (hasR || hasL) {
                          performSearch(myLocation, activeCategory, manualSearchQuery, hasR ? Number(r) : null, hasL ? Number(searchLimit) : null);
                        }
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
                      const raw = e.target.value;
                      if (raw === '') {
                        setSearchLimit('');
                      } else {
                        const val = Math.max(1, Math.min(500, Number(raw) || 1));
                        setSearchLimit(val);
                      }
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
                      const l = e.target.value === '' ? '' : Number(e.target.value);
                      setSearchLimit(l);
                      if (nearbySearchDone && manualSearchQuery.trim()) {
                        const hasR = searchRadius !== '' && Number(searchRadius) > 0;
                        const hasL = l !== '' && Number(l) > 0;
                        if (hasR || hasL) {
                          performSearch(myLocation, activeCategory, manualSearchQuery, hasR ? Number(searchRadius) : null, hasL ? Number(l) : null);
                        }
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
              const todayVisits = staffVisits.filter((v) => (v.createdAt || '').startsWith(todayStr)).length;
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
                    <div className="text-right">
                      <Badge variant={isSelected ? 'info' : 'neutral'} size="sm">
                        {staffVisits.length} visits
                      </Badge>
                      {todayVisits > 0 && (
                        <span className="block text-[9px] font-bold text-emerald-700 mt-0.5">
                          ⚡ {todayVisits} today
                        </span>
                      )}
                    </div>
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
                <th className="px-5 py-3.5">Client & Scale</th>
                <th className="px-5 py-3.5">Contact & Met</th>
                <th className="px-5 py-3.5">Current Software</th>
                <th className="px-5 py-3.5">Discussion & Next Action</th>
                <th className="px-5 py-3.5">Staff & GPS</th>
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
                      {/* Business Name & Scale */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {visit.photoUrl ? (
                            <div
                              onClick={() => setPreviewPhotoUrl(visit.photoUrl)}
                              className="relative w-10 h-10 rounded-xl overflow-hidden border border-slate-200 cursor-pointer shrink-0 group shadow-2xs"
                              title="Click to view library photo"
                            >
                              <img src={visit.photoUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition duration-200" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                <Camera size={14} className="text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0">
                              <Building2 size={16} />
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-900 truncate max-w-xs">
                                {visit.businessName}
                              </p>
                              {visit.leadPriority === 'Hot' && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-md">
                                  🔥 Hot
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                              <span>{visit.clientType} • {visit.city || 'City'}</span>
                              {visit.seatCapacity && (
                                <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                                  🪑 {visit.seatCapacity}
                                </span>
                              )}
                              {visitNum && visitNum > 1 && (
                                <span className="text-blue-600 font-bold">• #{visitNum}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Owner & Person Met */}
                      <td className="px-5 py-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{visit.ownerName || 'Owner'}</span>
                          {visit.personMet && (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {visit.personMet.split(' ')[0]}
                            </span>
                          )}
                        </div>

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
                        {visit.secondaryPhone && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Alt: {visit.secondaryPhone}
                          </span>
                        )}
                      </td>

                      {/* Current Software & Competitor */}
                      <td className="px-5 py-4 text-xs whitespace-nowrap">
                        {visit.currentSoftwareType === 'Competitor Software' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                              💻 {visit.competitorName || 'Competitor App'}
                            </span>
                            {(visit.competitorExpiryDate || visit.competitorDuration) && (
                              <p className="text-[10px] text-amber-700 font-semibold">
                                Exp: {visit.competitorExpiryDate || visit.competitorDuration}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] font-medium">
                            {visit.currentSoftwareType || '📒 Manual Register'}
                          </span>
                        )}
                      </td>

                      {/* Discussion, Follow-up & Reminder */}
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
                          <div className="mt-1.5 p-1.5 bg-amber-50/90 rounded-lg border border-amber-200/80">
                            <p className="text-[10px] font-bold text-amber-900">
                              ⏰ {visit.followUpDate} {visit.followUpTime ? `@ ${visit.followUpTime}` : ''}
                            </p>
                            {visit.nextActionItem && (
                              <p className="text-[10px] text-amber-800 font-semibold line-clamp-1">
                                🎯 {visit.nextActionItem}
                              </p>
                            )}
                            {visit.reminderNote && (
                              <p className="text-[9px] text-slate-600 italic line-clamp-1">
                                📝 {visit.reminderNote}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Staff & Exact Timestamp */}
                      <td className="px-5 py-4 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {(visit.staffName || 'S').substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{visit.staffName || 'Marketing Rep'}</div>
                            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                              <span>📅 {formatDateTime(visit.createdAt).date}</span>
                              {formatDateTime(visit.createdAt).time && (
                                <span className="text-blue-600 font-bold">• 🕒 {formatDateTime(visit.createdAt).time}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {visit.checkInTime && (
                          <div className="text-[10px] text-slate-500 mt-1 pl-9">
                            ⏱️ In: <span className="font-semibold text-slate-700">{visit.checkInTime}</span>
                            {visit.checkOutTime ? <> - Out: <span className="font-semibold text-slate-700">{visit.checkOutTime}</span></> : ''}
                          </div>
                        )}

                        <div className="pl-9 mt-1">
                          {visit.location ? (
                            <a
                              href={visit.location.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                            >
                              <MapPin size={10} /> GPS Verified (±{visit.location.accuracy || 10}m)
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic block">No GPS</span>
                          )}
                        </div>
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
        title={editingVisit ? 'Edit Field Visit Record' : 'Log On-Site Field Visit'}
        subtitle={
          editingVisit
            ? `Editing visit to ${editingVisit.businessName}`
            : form.placeName
            ? `📍 ${form.placeName} — ${form.placeAddress}`
            : 'Capture on-ground photo proof, client details, competitor status & follow-up'
        }
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SECTION 1: Dual Verification - GPS & Live Camera Photo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* GPS Verification Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    gpsData ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  <Crosshair size={18} className={capturingGps ? 'animate-spin' : ''} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">Live GPS Location</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {gpsData
                      ? `Locked: ${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)} (±${gpsData.accuracy}m)`
                      : 'Auto-detecting...'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={capturingGps}
                onClick={handleCaptureGPS}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                  gpsData
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <MapPin size={12} />
                <span>{capturingGps ? 'Locking...' : gpsData ? 'Re-lock' : 'Get GPS'}</span>
              </button>
            </div>

            {/* Photo Proof Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {form.photoUrl ? (
                  <div
                    onClick={() => setPreviewPhotoUrl(form.photoUrl)}
                    className="relative w-9 h-9 rounded-xl overflow-hidden border border-emerald-400 cursor-pointer shrink-0 group"
                    title="Click to view full photo"
                  >
                    <img src={form.photoUrl} alt="Library Proof" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Camera size={12} className="text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                    <Camera size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <span>Library Board / Photo</span>
                    {form.photoUrl && <span className="text-[10px] text-emerald-600 font-bold">✓ Attached</span>}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {form.photoUrl ? 'Click thumbnail to inspect' : 'Live camera or upload proof'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold cursor-pointer transition flex items-center gap-1 shadow-xs">
                  <Camera size={12} />
                  <span>{form.photoUrl ? 'Retake' : 'Take Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                </label>
                {form.photoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, photoUrl: null }))}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                    title="Remove Photo"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: Basic Library Details & Capacity */}
          <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={13} className="text-blue-600" />
              <span>Library Identity & Scale</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Library / Center Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saraswati Study Library, Apex Point"
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Seat Capacity (Total Seats)
                </label>
                <select
                  value={form.seatCapacity}
                  onChange={(e) => setForm({ ...form, seatCapacity: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="">-- Select Total Seats --</option>
                  {SEAT_CAPACITY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">State (राज्य) *</label>
                <input
                  type="text"
                  required
                  placeholder="Madhya Pradesh"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">City (शहर) *</label>
                <input
                  type="text"
                  required
                  placeholder="Guna"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Area / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Mahaveerpura near Station"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Person Met & Contact Details */}
          <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={13} className="text-emerald-600" />
              <span>Person Met & Direct Contacts</span>
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Kisse Mulakat Hui? (Person Met)</label>
              <div className="flex flex-wrap gap-2">
                {PERSON_MET_OPTIONS.map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setForm({ ...form, personMet: pm })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      form.personMet === pm
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Owner / Decision Maker Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rakesh Sharma"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Mobile (Calling)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 font-semibold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Alternative Mobile / WhatsApp
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">(Optional)</span>
                </div>
                <input
                  type="tel"
                  placeholder="Optional - Jo banda on-site dega wo number yahan dalein"
                  value={form.secondaryPhone}
                  onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {form.personMet !== 'Owner / Director' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Met Person Name & Note (Agar Owner nahi mile)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Manager Suresh Kumar (Owner will come at 2:00 PM)"
                  value={form.contactPersonName}
                  onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>

          {/* SECTION 4: Current Software & Competitor Tracking (User Requirement!) */}
          <div className="p-3.5 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl space-y-3">
            <h4 className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-600" />
                <span>Current Management & Competitor Subscription Status</span>
              </span>
              <span className="text-[10px] text-indigo-600 font-semibold lowercase">
                (dusra software kab khatam hoga?)
              </span>
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Abhi Library Kaise Manage Ho Rahi Hai?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CURRENT_SOFTWARE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm({ ...form, currentSoftwareType: opt.id })}
                    className={`p-2 rounded-xl text-left transition cursor-pointer border ${
                      form.currentSoftwareType === opt.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <p className="text-xs font-bold truncate">{opt.label}</p>
                    <p className={`text-[10px] truncate mt-0.5 ${form.currentSoftwareType === opt.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {form.currentSoftwareType === 'Competitor Software' && (
              <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Competitor Software Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Librex, ReaderDesk, Custom..."
                      value={form.competitorName}
                      onChange={(e) => setForm({ ...form, competitorName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:border-indigo-600"
                    />
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400">Suggestions:</span>
                      {COMPETITOR_SUGGESTIONS.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setForm({ ...form, competitorName: sug })}
                          className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded hover:bg-indigo-100 cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Current Subscription Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.competitorExpiryDate}
                      onChange={(e) => setForm({ ...form, competitorExpiryDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* Quick Expiry Duration Chips */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kab Khatam Hoga? (Quick Duration Preset)
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: '⚡ 15 Din Baad', months: 0.5 },
                      { label: '🗓️ 1 Mahine Baad', months: 1 },
                      { label: '🗓️ 2 Mahine Baad', months: 2 },
                      { label: '🗓️ 3 Mahine Baad', months: 3 },
                      { label: '🗓️ 6 Mahine Baad', months: 6 },
                      { label: '🗓️ 1 Saal Baad', months: 12 },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setCompetitorPreset(item.months, item.label)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          form.competitorDuration === item.label
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-indigo-700 font-medium mt-1.5">
                    💡 <em>Clicking any duration auto-sets expiry date & creates a follow-up reminder 10 days before expiry!</em>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Current Software Me Kya Problem Hai? (Why switch?)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mehnga hai, WhatsApp auto messages nahi hain, support bekar hai..."
                    value={form.switchingReason}
                    onChange={(e) => setForm({ ...form, switchingReason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: Meeting Notes, Lead Temperature & Status */}
          <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck size={13} className="text-amber-600" />
              <span>Meeting Discussion & Lead Qualification</span>
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Discussion Summary (Kya baat hui?) *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Met owner. Interested in 100-seat plan. Liked WhatsApp feature. Will call Monday."
                value={form.discussionNotes}
                onChange={(e) => setForm({ ...form, discussionNotes: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lead Temperature
                </label>
                <div className="flex gap-1.5">
                  {LEAD_PRIORITY_OPTIONS.map((lp) => (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => setForm({ ...form, leadPriority: lp.id })}
                      className={`flex-1 py-1.5 text-center text-xs font-bold rounded-xl border transition cursor-pointer ${
                        form.leadPriority === lp.id
                          ? lp.color + ' ring-1'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {lp.id}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lead Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
                >
                  {VISIT_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 sm:pt-5">
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border border-slate-200 rounded-xl">
                  <input
                    type="checkbox"
                    checked={form.demoGiven}
                    onChange={(e) => setForm({ ...form, demoGiven: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    💻 Live Demo Given
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 6: Follow-Up & Reminder Scheduler */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <BellRing size={13} className="text-amber-600" />
                <span>Re-Visit & Follow-Up Reminder (Kab Milna Hai / Kya Kaam Hai)</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Follow-up Callback Date
                </label>
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Exact Time Slot
                </label>
                <input
                  type="time"
                  value={form.followUpTime}
                  onChange={(e) => setForm({ ...form, followUpTime: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Meeting Mode
                </label>
                <select
                  value={form.followUpType}
                  onChange={(e) => setForm({ ...form, followUpType: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-600 cursor-pointer"
                >
                  <option value="In-Person Re-Visit">🏢 Physical Re-Visit</option>
                  <option value="Phone Call">📞 Phone Call</option>
                  <option value="Online Demo">💻 Online Demo / AnyDesk</option>
                  <option value="WhatsApp Proposal">📱 WhatsApp Proposal</option>
                </select>
              </div>
            </div>

            {/* Re-visit / Reminder Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Re-Visit & Follow-Up Note (Kya Baat Hui / Kya Karna Hai)
              </label>
              <input
                type="text"
                placeholder="e.g. 30 min me aao, Kal dopahar 2 baje milo, Agle hafte owner aayenge..."
                value={form.reminderNote}
                onChange={(e) => setForm({ ...form, reminderNote: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-amber-600 font-medium"
              />
            </div>
          </div>

          {/* SECTION 7: Visit Times */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Check-in Time</label>
              <input
                type="text"
                value={form.checkInTime}
                onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Check-out Time</label>
              <input
                type="text"
                value={form.checkOutTime}
                onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 size={15} />
              <span>
                {addMutation.isPending || editMutation.isPending
                  ? 'Saving...'
                  : editingVisit
                  ? 'Update Visit Record'
                  : 'Save Field Visit Record'}
              </span>
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
        maxWidth="max-w-2xl"
      >
        {selectedVisit && (
          <div className="space-y-4">
            {/* Top Photo & Status Banner */}
            {selectedVisit.photoUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs max-h-56 bg-slate-900 group">
                <img
                  src={selectedVisit.photoUrl}
                  alt={selectedVisit.businessName}
                  className="w-full h-56 object-cover object-center group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-3.5">
                  <span className="text-white text-xs font-bold flex items-center gap-1.5">
                    <Camera size={14} className="text-emerald-400" />
                    <span>On-Site Photo Proof</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewPhotoUrl(selectedVisit.photoUrl)}
                    className="px-2.5 py-1 bg-white/90 hover:bg-white text-slate-900 text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>View Full Size</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl text-xs border border-slate-200/80">
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Target Type</span>
                <span className="font-bold text-slate-800">{selectedVisit.clientType}</span>
                {selectedVisit.seatCapacity && (
                  <span className="block text-[11px] text-blue-600 font-bold mt-0.5">
                    🪑 {selectedVisit.seatCapacity}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Lead Status & Priority</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={getStatusBadgeVariant(selectedVisit.status)} size="sm">{selectedVisit.status}</Badge>
                  {selectedVisit.leadPriority && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      {selectedVisit.leadPriority === 'Hot' ? '🔥 Hot' : selectedVisit.leadPriority === 'Warm' ? '⚡ Warm' : '❄️ Cold'}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Person Met</span>
                <span className="font-bold text-slate-800 block">
                  {selectedVisit.personMet || 'Owner'}
                </span>
                {selectedVisit.contactPersonName && (
                  <span className="text-[11px] text-slate-500 block">
                    ({selectedVisit.contactPersonName})
                  </span>
                )}
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
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Location / Area</span>
                <span className="font-semibold text-slate-800">{selectedVisit.address || 'N/A'}</span>
              </div>
            </div>

            {/* Current Software & Competitor Box */}
            <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs">
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block mb-1">
                💻 Current Management System & Competitor Info
              </span>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-indigo-950">
                  {selectedVisit.currentSoftwareType || 'Manual Register / Diary'}
                </span>
                {selectedVisit.competitorName && (
                  <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[10px] font-bold">
                    {selectedVisit.competitorName}
                  </span>
                )}
              </div>
              {selectedVisit.competitorExpiryDate && (
                <p className="text-[11px] text-indigo-800 mt-1 font-semibold">
                  ⏳ Subscription Expiry: <strong>{selectedVisit.competitorExpiryDate}</strong>
                  {selectedVisit.competitorDuration && ` (${selectedVisit.competitorDuration})`}
                </p>
              )}
              {selectedVisit.switchingReason && (
                <p className="text-[11px] text-slate-600 mt-1 italic">
                  Issue with current software: "{selectedVisit.switchingReason}"
                </p>
              )}
            </div>

            {/* Next Action Item & Follow-Up Alert Box */}
            {selectedVisit.followUpDate && (
              <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <BellRing size={12} className="text-amber-600" />
                    <span>Follow-Up Callback Scheduled</span>
                  </span>
                  <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 font-bold rounded text-[10px]">
                    {selectedVisit.followUpType || 'In-Person Re-Visit'}
                  </span>
                </div>
                <p className="text-xs font-black text-amber-950">
                  📅 {selectedVisit.followUpDate} {selectedVisit.followUpTime ? `@ ${selectedVisit.followUpTime}` : ''}
                </p>
                {selectedVisit.nextActionItem && (
                  <p className="text-xs font-bold text-amber-800">
                    🎯 Agenda: {selectedVisit.nextActionItem}
                  </p>
                )}
                {selectedVisit.reminderNote && (
                  <p className="text-[11px] text-slate-700 italic bg-white/70 p-2 rounded-lg border border-amber-200/60">
                    📝 Reminder: {selectedVisit.reminderNote}
                  </p>
                )}
              </div>
            )}

            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Meeting Discussion</span>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedVisit.discussionNotes}
              </div>
            </div>

            {/* Visit History for same place */}
            {getPlaceVisitHistory(selectedVisit.placeId, selectedVisit.businessName).length > 1 && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  📜 All Visits to this Library ({getPlaceVisitHistory(selectedVisit.placeId, selectedVisit.businessName).length})
                </span>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {getPlaceVisitHistory(selectedVisit.placeId, selectedVisit.businessName).map((hv, idx) => (
                    <div key={hv.id} className={`p-2.5 rounded-lg border text-xs ${hv.id === selectedVisit.id ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          Visit #{getPlaceVisitHistory(selectedVisit.placeId, selectedVisit.businessName).length - idx}: {hv.staffName} — {formatDate(hv.createdAt)}
                        </span>
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

      {/* ═══ Photo Lightbox Preview Modal ═══ */}
      {previewPhotoUrl && (
        <Modal
          isOpen={!!previewPhotoUrl}
          onClose={() => setPreviewPhotoUrl(null)}
          title="📸 Library On-Site Photo Proof"
          subtitle="Captured during field marketing verification"
          maxWidth="max-w-3xl"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-h-[75vh] flex items-center justify-center bg-black/5 rounded-2xl overflow-hidden border border-slate-200">
              <img
                src={previewPhotoUrl}
                alt="Library Proof Preview"
                className="max-h-[75vh] max-w-full object-contain rounded-2xl"
              />
            </div>
            <div className="flex items-center justify-between w-full pt-2 border-t border-slate-100">
              <a
                href={previewPhotoUrl}
                download="library-proof.jpg"
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Download size={13} />
                <span>Save Image</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
