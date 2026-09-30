import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFieldVisits, logFieldVisit, updateFieldVisit, updateVisitStatus, deleteFieldVisit, getCurrentGPSLocation, logSearchAudit } from '../firebase/services/marketingService';
import { getStaffUsers, calculateStaffPayroll } from '../firebase/services/staffService';
import { searchNearbyLibraries, searchLibrariesByText, formatDistance, getNavigationUrl, getPlaceMapUrl, geocodeAddress, reverseGeocode, parseAddressDetails, getPlaceDetails } from '../services/googleMapsService';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Navigation,
  Table as TableIcon,
  LayoutGrid,
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
  Filter,
  Clock,
  AlertTriangle,
  ArrowRight,
  Loader2,
  X,
  Camera,
  Crown,
  Image as ImageIcon,
  Flame,
  Zap,
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Layers,
  HelpCircle,
  BellRing,
  Sparkles,
  Send,
  UserPlus,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  evaluateVisitAuthenticity,
  getVisitDurationMinutes,
  formatDurationMinutes,
  calculateCheckoutTime,
  formatDisplayTime,
  formatEntryTimestamp,
  evaluateSyncDelay,
} from '../services/visitAuditHelper';
import { restoreOrCreateLibraryClient } from '../firebase/services/libraryService';
import {
  getCompetitorExpiringLeads,
  generateMultiStopGoogleMapsRoute,
} from '../services/salesBoosterHelper';

const VISIT_STATUSES = [
  { id: 'Interested', label: 'Interested (Good Lead)', variant: 'info' },
  { id: 'Demo Given', label: 'Software Demo Given', variant: 'purple' },
  { id: 'Follow Up', label: 'Follow Up Scheduled', variant: 'warning' },
  { id: 'Deal Closed', label: '🎉 Deal Closed / Subscribed', variant: 'success' },
  { id: 'Not Interested', label: 'Not Interested', variant: 'danger' },
];

const STATUS_FILTER_OPTIONS = [
  { id: 'All', label: 'All', activeClass: 'bg-blue-600 text-white shadow-xs' },
  { id: 'Interested', label: 'Interested', activeClass: 'bg-blue-600 text-white shadow-xs' },
  { id: 'Demo Given', label: 'Demo Given', activeClass: 'bg-purple-600 text-white shadow-xs' },
  { id: 'Follow Up', label: 'Follow Up', activeClass: 'bg-amber-600 text-white shadow-xs' },
  { id: 'Deal Closed', label: 'Deal Closed', activeClass: 'bg-emerald-600 text-white shadow-xs' },
  { id: 'Not Interested', label: 'Not Interested', activeClass: 'bg-rose-600 text-white shadow-xs' },
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
  { value: '', label: '-- Any Distance (Nearest First) --' },
  { value: 5000, label: '5 km Radius' },
  { value: 10000, label: '10 km Radius' },
  { value: 20000, label: '20 km Radius' },
  { value: 30000, label: '30 km Radius' },
  { value: 50000, label: '50 km Radius' },
  { value: 100000, label: '100 km Radius' },
  { value: 200000, label: '200 km Radius' },
  { value: 300000, label: '300 km Radius' },
  { value: 500000, label: '500 km Radius' },
  { value: 1000000, label: '1000 km Radius' },
];

const LIMIT_OPTIONS = [
  { value: '', label: '-- All Available (Full Coverage) --' },
  { value: 10, label: '10 Places' },
  { value: 20, label: '20 Places' },
  { value: 30, label: '30 Places' },
  { value: 50, label: '50 Places' },
  { value: 75, label: '75 Places' },
  { value: 100, label: '100 Places' },
  { value: 150, label: '150 Places' },
  { value: 200, label: '200 Places' },
  { value: 300, label: '300 Places' },
  { value: 500, label: '500 Places' },
  { value: 1000, label: '1000 Places' },
];

const DATE_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'day', label: 'Day Wise' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'Month Wise' },
  { id: 'custom', label: 'Custom Date' },
];

export const FieldMarketing = () => {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Core state
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedDay, setSelectedDay] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [revisitTarget, setRevisitTarget] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [statusDropdownId, setStatusDropdownId] = useState(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  // Sales Booster States (Onboarding & Expiry Radar)
  const [showConvertModal, setShowConvertModal] = useState(null);
  const [convertForm, setConvertForm] = useState({
    email: '',
    libraryName: '',
    ownerName: '',
    phone: '',
    address: '',
    planName: 'Annual Plan (1 Year)',
  });
  const [converting, setConverting] = useState(false);
  const [showRadarModal, setShowRadarModal] = useState(false);

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
  const [nearbyVisitFilter, setNearbyVisitFilter] = useState('all'); // 'all' | 'unvisited' | 'visited'
  const [showDiscovery, setShowDiscovery] = useState(true);

  const isSuperAdmin = user?.role === 'super_admin';

  // GPS state
  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsData, setGpsData] = useState(null);

  // Form state
  const [form, setForm] = useState(initialFormState);

  // Fetch staff users for management and compensation targets
  const { data: staffList = [] } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const myStaffId = user?.uid || user?.id;
  const staffData = useMemo(() => {
    return (
      staffList.find(
        (s) => s.id === myStaffId || s.email?.toLowerCase() === user?.email?.toLowerCase()
      ) || user
    );
  }, [staffList, myStaffId, user]);

  // Fetch visits
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  const staffPayroll = useMemo(() => {
    return calculateStaffPayroll(staffData, visits);
  }, [staffData, visits]);

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
      if (revisitTarget) {
        toast.success(`Re-visit recorded! Updated record for ${revisitTarget.businessName}. ✅`);
      } else {
        toast.success('Visit record updated! ✅');
      }
      setShowModal(false);
      setEditingVisit(null);
      setRevisitTarget(null);
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

  // ── Booster Computed & Handlers ──────────────────────────────────────────
  const expiringCompetitors = useMemo(() => {
    return getCompetitorExpiringLeads(visits, 35);
  }, [visits]);

  const multiStopRouteUrl = useMemo(() => {
    if (nearbyLibraries.length < 2) return null;
    return generateMultiStopGoogleMapsRoute(myLocation, nearbyLibraries.slice(0, 5));
  }, [myLocation, nearbyLibraries]);

  const openConvertModal = (v) => {
    const cleanPhone = (v.phone || '').replace(/\D/g, '');
    const defaultEmail = cleanPhone ? `${cleanPhone}@univo.in` : `client_${Date.now()}@univo.in`;
    setConvertForm({
      email: defaultEmail,
      libraryName: v.businessName || '',
      ownerName: v.ownerName || '',
      phone: v.phone || '',
      address: v.address || `${v.city || ''}, ${v.state || ''}`,
      planName: 'Annual Plan (1 Year)',
    });
    setShowConvertModal(v);
  };

  const handleConvertClientSubmit = async (e) => {
    e.preventDefault();
    setConverting(true);
    try {
      await restoreOrCreateLibraryClient({
        email: convertForm.email,
        libraryName: convertForm.libraryName,
        ownerName: convertForm.ownerName,
        phone: convertForm.phone,
        address: convertForm.address,
        planName: convertForm.planName,
      });

      if (showConvertModal && showConvertModal.status !== 'Deal Closed') {
        await updateVisitStatus(showConvertModal.id, 'Deal Closed');
        queryClient.invalidateQueries({ queryKey: ['admin_field_visits'] });
      }

      toast.success(`🎉 Client "${convertForm.libraryName}" onboarded! Active in Library Clients.`);
      setShowConvertModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to onboard client');
    } finally {
      setConverting(false);
    }
  };

  // ── Auto Search Runner ────────────────────────────────────────────────────
  const performSearch = useCallback(async (loc, category = activeCategory, customQuery = '', radius = searchRadius, limit = searchLimit) => {
    let targetLoc = loc || myLocation;

    // If live GPS coordinates are not yet available, try to fetch current device GPS directly
    if (!targetLoc) {
      try {
        toast.loading('Acquiring your live GPS location...', { id: 'gps-lock' });
        targetLoc = await getCurrentGPSLocation();
        setMyLocation(targetLoc);
        const rev = await reverseGeocode(targetLoc.latitude, targetLoc.longitude);
        const locName = rev.cityName || rev.formattedAddress || 'Your Live Location';
        setCurrentLocationName(locName);
        toast.dismiss('gps-lock');
      } catch (gpsErr) {
        toast.dismiss('gps-lock');
        toast.error('Device GPS is required to find nearest places. Please enable location permission in your browser.');
        return;
      }
    }

    setSearchingNearby(true);
    try {
      let query = (customQuery != null ? customQuery : manualSearchQuery).trim();
      if (!query) {
        toast.error('Search query is compulsory! Please enter what to search.');
        setSearchingNearby(false);
        return;
      }
      const hasRadius = radius && Number(radius) > 0;
      const hasLimit = limit && Number(limit) > 0;
      if (!hasRadius && !hasLimit) {
        toast.error('Please specify either KM Radius or Number of Places.');
        setSearchingNearby(false);
        return;
      }
      const targetLimit = hasLimit ? Number(limit) : 1000;
      const res = await searchLibrariesByText(query, targetLoc.latitude, targetLoc.longitude, hasRadius ? Number(radius) : null, targetLimit);
      const resultsList = res || [];
      setNearbyLibraries(resultsList);
      setNearbySearchDone(true);

      // ── Audit Log: Record Google API Call for Field Reports ──────────────
      try {
        const pagesCount = Math.ceil(resultsList.length / 20) || 1;
        const estimatedGrossInr = (pagesCount * 1.5 + 0.4).toFixed(2);
        const radiusInKm = radius ? (Number(radius) >= 1000 ? Math.round(Number(radius) / 1000) : Number(radius)) : null;
        await logSearchAudit({
          staffId: user?.uid || user?.id || 'admin',
          staffName: user?.displayName || user?.name || (isSuperAdmin ? 'Admin' : 'Staff Member'),
          staffEmail: user?.email || '',
          staffRole: user?.role || (isSuperAdmin ? 'Admin' : 'Staff'),
          query,
          category: category === 'gym' ? 'Gym' : 'Library',
          radiusKm: radiusInKm,
          limitCount: limit ? Number(limit) : null,
          resultsCount: resultsList.length,
          pagesCount,
          estimatedGrossInr: Number(estimatedGrossInr),
          location: {
            latitude: targetLoc.latitude,
            longitude: targetLoc.longitude,
            accuracy: targetLoc.accuracy || null,
            locationName: (currentLocationName || 'Live Location').replace(/\s*\(Default Location\)/gi, ''),
          },
          createdAt: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Failed to record search audit log:', logErr);
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error(err.message || 'Failed to find nearest places');
    } finally {
      setSearchingNearby(false);
    }
  }, [activeCategory, myLocation, manualSearchQuery, searchRadius, searchLimit, currentLocationName, user, isSuperAdmin]);

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
      console.warn('GPS unavailable:', err);
      setMyLocation(null);
      setCurrentLocationName('GPS Not Available (Location Permission Required)');
      if (isManual) {
        toast.error('Location permission denied or unavailable. Please enable device GPS in browser settings.');
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
    const query = manualSearchQuery.trim();
    if (!query) {
      toast.error('Search query is compulsory! Please enter what to search (e.g. library, gym, area).', { icon: '⚠️' });
      return;
    }

    const hasRadius = searchRadius !== '' && Number(searchRadius) > 0;
    const hasLimit = searchLimit !== '' && Number(searchLimit) > 0;

    if (!hasRadius && !hasLimit) {
      toast.error('Please select either KM Radius or Number of Places!', { icon: '📍' });
      return;
    }

    const radiusVal = hasRadius ? Number(searchRadius) : null;
    const limitVal = hasLimit ? Number(searchLimit) : null;
    performSearch(myLocation, activeCategory, query, radiusVal, limitVal);
  };

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = (categoryOverride) => {
    const now = new Date();
    const liveTimeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const liveOutStr = new Date(now.getTime() + 20 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const defaultCat = categoryOverride || (activeCategory === 'gym' ? 'Gym' : 'Library');
    setForm({
      ...initialFormState,
      clientType: defaultCat,
      checkInTime: liveTimeStr,
      checkOutTime: liveOutStr,
    });
    setGpsData(null);
    setEditingVisit(null);
    setRevisitTarget(null);
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
    setRevisitTarget(visit);
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
      status: visit.status || 'Follow Up',
      discussionNotes: '', // Clean notes input for this new re-visit
      demoGiven: visit.demoGiven || false,
      followUpDate: visit.followUpDate || '',
      followUpTime: visit.followUpTime || '',
      followUpType: visit.followUpType || 'In-Person Re-Visit',
      nextActionItem: visit.nextActionItem || '',
      reminderNote: '',
      photoUrl: null,
      placeId: visit.placeId || null,
      placeName: visit.placeName || visit.businessName || '',
      placeAddress: visit.placeAddress || visit.address || '',
      placeRating: visit.placeRating || null,
      placeLat: visit.placeLat || null,
      placeLng: visit.placeLng || null,
      checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      checkOutTime: new Date(Date.now() + 20 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    });
    setShowModal(true);
    getCurrentGPSLocation().then((loc) => {
      setGpsData(loc);
      toast.success(`GPS Auto-locked (±${loc.accuracy}m)`);
    }).catch(() => {});
  };

  const openEditVisit = (visit) => {
    setRevisitTarget(null);
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

    const now = new Date();
    const liveTimeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const liveOutStr = new Date(now.getTime() + 20 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const checkInTime = (form.checkInTime && form.checkInTime.trim()) || liveTimeStr;
    const checkOutTime = (form.checkOutTime && form.checkOutTime.trim()) || liveOutStr;

    const payload = {
      ...form,
      checkInTime,
      checkOutTime,
      durationMinutes: Number(form.durationMinutes) || 20,
    };

    if (editingVisit) {
      editMutation.mutate({ id: editingVisit.id, data: { ...payload, location: gpsData || editingVisit.location } });
    } else if (revisitTarget) {
      // Archive previous visit state into visitHistory array
      const previousLog = {
        visitedAt: revisitTarget.lastVisitedAt || revisitTarget.createdAt || new Date().toISOString(),
        staffName: revisitTarget.lastStaffName || revisitTarget.staffName || user?.displayName || user?.name || 'Staff',
        staffId: revisitTarget.lastStaffId || revisitTarget.staffId || user?.uid || user?.id || 'staff',
        status: revisitTarget.status || 'Interested',
        discussionNotes: revisitTarget.discussionNotes || '',
        checkInTime: revisitTarget.checkInTime || '',
        checkOutTime: revisitTarget.checkOutTime || '',
        durationMinutes: revisitTarget.durationMinutes || 20,
        followUpDate: revisitTarget.followUpDate || '',
        followUpTime: revisitTarget.followUpTime || '',
        location: revisitTarget.location || null,
        photoUrl: revisitTarget.photoUrl || '',
      };

      const updatedHistory = [...(revisitTarget.visitHistory || []), previousLog];
      const newVisitCount = (revisitTarget.visitCount || updatedHistory.length) + 1;

      editMutation.mutate({
        id: revisitTarget.id,
        data: {
          ...payload,
          staffId: user?.uid || user?.id || revisitTarget.staffId || 'staff',
          staffName: user?.displayName || user?.name || revisitTarget.staffName || 'Staff',
          visitCount: newVisitCount,
          lastVisitedAt: new Date().toISOString(),
          lastStaffName: user?.displayName || user?.name || 'Staff',
          lastStaffId: user?.uid || user?.id || 'staff',
          visitHistory: updatedHistory,
          location: gpsData || revisitTarget.location || null,
          photoUrl: form.photoUrl || revisitTarget.photoUrl || '',
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      addMutation.mutate({
        ...payload,
        visitCount: 1,
        visitHistory: [],
        lastVisitedAt: new Date().toISOString(),
        staffId: user?.uid || user?.id || 'staff',
        staffName: user?.displayName || user?.name || 'Marketing Staff',
        location: gpsData,
      });
    }
  };

  // ── Combined list of registered staff + Admin / Owner ───────────────────────
  const allStaffAndAdmins = useMemo(() => {
    const list = [...staffList];
    const registeredNames = new Set(staffList.map((s) => (s.name || '').toLowerCase()));
    const registeredIds = new Set(staffList.map((s) => s.id));

    // Find any distinct staff/admin in visits who isn't in staffList
    visits.forEach((v) => {
      const name = (v.staffName || '').trim();
      const id = v.staffId || name;
      if (name && !registeredNames.has(name.toLowerCase()) && !registeredIds.has(id)) {
        registeredNames.add(name.toLowerCase());
        registeredIds.add(id);
        const isAdmin =
          name.toLowerCase().includes('admin') ||
          String(id).toLowerCase().includes('admin') ||
          name.toLowerCase().includes('owner');

        list.unshift({
          id: id,
          name: name,
          role: isAdmin ? 'owner' : 'marketing',
          roleLabel: isAdmin ? '👑 Admin / Owner' : 'Field Rep',
          isAdmin: isAdmin,
        });
      }
    });

    // Also ensure currently logged-in Admin is included if isSuperAdmin
    if (isSuperAdmin && user) {
      const myName = (user.displayName || user.name || 'Administrator').trim();
      const myId = user.uid || user.id || 'admin';
      if (!registeredNames.has(myName.toLowerCase()) && !registeredIds.has(myId)) {
        list.unshift({
          id: myId,
          name: myName,
          role: 'owner',
          roleLabel: '👑 Administrator / Owner',
          isAdmin: true,
        });
      }
    }

    return list;
  }, [staffList, visits, isSuperAdmin, user]);

  // ── Filtering logic ────────────────────────────────────────────────────────
  const baseVisits = useMemo(() => {
    if (isSuperAdmin) {
      if (selectedStaffFilter === 'All') return visits;
      return visits.filter((v) => {
        const staffObj = allStaffAndAdmins.find((s) => s.id === selectedStaffFilter);
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
  }, [visits, isSuperAdmin, selectedStaffFilter, user, allStaffAndAdmins]);

  const extractVisitDateStr = (createdAt) => {
    if (!createdAt) return '';
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return String(createdAt).slice(0, 10);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filteredVisits = useMemo(() => {
    const now = new Date();
    const todayUtc = now.toISOString().split('T')[0];
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const oneWeekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return baseVisits.filter((v) => {
      const matchSearch =
        !search.trim() ||
        (v.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.phone || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.staffName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.city || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.discussionNotes || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || v.status === statusFilter;

      let matchDate = true;
      const vDateStr = extractVisitDateStr(v.createdAt);
      const vMonthStr = vDateStr ? vDateStr.slice(0, 7) : '';
      const vDate = v.createdAt ? new Date(v.createdAt) : null;
      const vTime = vDate && !isNaN(vDate.getTime()) ? vDate.getTime() : 0;

      if (dateFilter === 'today') {
        matchDate = (v.createdAt || '').startsWith(todayUtc) || vDateStr === todayLocal;
      } else if (dateFilter === 'day') {
        if (selectedDay) {
          matchDate = vDateStr === selectedDay || (v.createdAt || '').startsWith(selectedDay);
        }
      } else if (dateFilter === 'week') {
        matchDate = vTime >= oneWeekAgoMs;
      } else if (dateFilter === 'month') {
        if (selectedMonth) {
          matchDate = vMonthStr === selectedMonth || (v.createdAt || '').startsWith(selectedMonth);
        } else {
          matchDate = vTime >= startOfMonth;
        }
      } else if (dateFilter === 'custom') {
        if (customStartDate && vDateStr && vDateStr < customStartDate) {
          matchDate = false;
        }
        if (customEndDate && vDateStr && vDateStr > customEndDate) {
          matchDate = false;
        }
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [baseVisits, search, statusFilter, dateFilter, selectedDay, selectedMonth, customStartDate, customEndDate]);

  // Dynamic status counts reflecting current search & date filter
  const statusCounts = useMemo(() => {
    const counts = {
      All: 0,
      'Interested': 0,
      'Demo Given': 0,
      'Follow Up': 0,
      'Deal Closed': 0,
      'Not Interested': 0,
    };

    const now = new Date();
    const todayUtc = now.toISOString().split('T')[0];
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const oneWeekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    baseVisits.forEach((v) => {
      const matchSearch =
        !search.trim() ||
        (v.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.phone || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.staffName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.city || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.discussionNotes || '').toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return;

      let matchDate = true;
      const vDateStr = extractVisitDateStr(v.createdAt);
      const vMonthStr = vDateStr ? vDateStr.slice(0, 7) : '';
      const vDate = v.createdAt ? new Date(v.createdAt) : null;
      const vTime = vDate && !isNaN(vDate.getTime()) ? vDate.getTime() : 0;

      if (dateFilter === 'today') {
        matchDate = (v.createdAt || '').startsWith(todayUtc) || vDateStr === todayLocal;
      } else if (dateFilter === 'day') {
        if (selectedDay) {
          matchDate = vDateStr === selectedDay || (v.createdAt || '').startsWith(selectedDay);
        }
      } else if (dateFilter === 'week') {
        matchDate = vTime >= oneWeekAgoMs;
      } else if (dateFilter === 'month') {
        if (selectedMonth) {
          matchDate = vMonthStr === selectedMonth || (v.createdAt || '').startsWith(selectedMonth);
        } else {
          matchDate = vTime >= startOfMonth;
        }
      } else if (dateFilter === 'custom') {
        if (customStartDate && vDateStr && vDateStr < customStartDate) matchDate = false;
        if (customEndDate && vDateStr && vDateStr > customEndDate) matchDate = false;
      }

      if (!matchDate) return;

      counts.All += 1;
      if (v.status && counts[v.status] !== undefined) {
        counts[v.status] += 1;
      }
    });

    return counts;
  }, [baseVisits, search, dateFilter, selectedDay, selectedMonth, customStartDate, customEndDate]);

  // Dynamic date counts reflecting current search & status filter
  const dateCounts = useMemo(() => {
    const counts = { all: 0, today: 0, day: 0, week: 0, month: 0, custom: 0 };
    const now = new Date();
    const todayUtc = now.toISOString().split('T')[0];
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const oneWeekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    baseVisits.forEach((v) => {
      const matchSearch =
        !search.trim() ||
        (v.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.phone || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.staffName || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.city || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.discussionNotes || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || v.status === statusFilter;

      if (!matchSearch || !matchStatus) return;

      counts.all += 1;

      const vDateStr = extractVisitDateStr(v.createdAt);
      const vMonthStr = vDateStr ? vDateStr.slice(0, 7) : '';
      const vDate = v.createdAt ? new Date(v.createdAt) : null;
      const vTime = vDate && !isNaN(vDate.getTime()) ? vDate.getTime() : 0;

      if ((v.createdAt || '').startsWith(todayUtc) || vDateStr === todayLocal) {
        counts.today += 1;
      }
      if (selectedDay && (vDateStr === selectedDay || (v.createdAt || '').startsWith(selectedDay))) {
        counts.day += 1;
      }
      if (vTime >= oneWeekAgoMs) {
        counts.week += 1;
      }
      if (selectedMonth) {
        if (vMonthStr === selectedMonth || (v.createdAt || '').startsWith(selectedMonth)) {
          counts.month += 1;
        }
      } else if (vTime >= startOfMonth) {
        counts.month += 1;
      }
      let matchCustom = true;
      if (customStartDate && vDateStr && vDateStr < customStartDate) matchCustom = false;
      if (customEndDate && vDateStr && vDateStr > customEndDate) matchCustom = false;
      if (matchCustom && (customStartDate || customEndDate)) {
        counts.custom += 1;
      }
    });

    return counts;
  }, [baseVisits, search, statusFilter, selectedDay, selectedMonth, customStartDate, customEndDate]);

  const isFilterActive =
    search.trim() !== '' ||
    statusFilter !== 'All' ||
    dateFilter !== 'all' ||
    selectedStaffFilter !== 'All' ||
    customStartDate !== '' ||
    customEndDate !== '';

  const handleClearAllFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setDateFilter('all');
    setSelectedStaffFilter('All');
    setCustomStartDate('');
    setCustomEndDate('');
  };

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

  // Computed Visited vs Unvisited for discovery places
  const nearbyCounts = useMemo(() => {
    let visited = 0;
    let unvisited = 0;
    nearbyLibraries.forEach((place) => {
      const history = getPlaceVisitHistory(place.placeId, place.name);
      if (history.length > 0) visited++;
      else unvisited++;
    });
    return { all: nearbyLibraries.length, unvisited, visited };
  }, [nearbyLibraries, getPlaceVisitHistory]);

  const filteredNearbyLibraries = useMemo(() => {
    return nearbyLibraries.filter((place) => {
      const isVisited = getPlaceVisitHistory(place.placeId, place.name).length > 0;
      if (nearbyVisitFilter === 'unvisited') return !isVisited;
      if (nearbyVisitFilter === 'visited') return isVisited;
      return true;
    });
  }, [nearbyLibraries, nearbyVisitFilter, getPlaceVisitHistory]);

  // Visit count per place or business name (Visit #1, Visit #2, etc.)
  const getVisitNumber = useCallback(
    (visit) => {
      if (!visit) return 1;
      const inDocCount = Math.max(Number(visit.visitCount) || 1, (Array.isArray(visit.visitHistory) ? visit.visitHistory.length : 0) + 1);
      const bName = (visit.businessName || '').trim().toLowerCase();
      const placeVisits = visits
        .filter((v) => (visit.placeId && v.placeId === visit.placeId) || (bName && (v.businessName || '').trim().toLowerCase() === bName))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const idx = placeVisits.findIndex((v) => v.id === visit.id);
      const legacyCount = idx >= 0 ? idx + 1 : 1;
      return Math.max(inDocCount, legacyCount);
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

  // ── Table View for PC / Desktop ──────────────────────────────────────────
  const renderTableView = () => (
    <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-xs">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
            <th className="px-4 py-3.5">Business / Client</th>
            <th className="px-4 py-3.5">Owner / Contact</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5">Software / Demo</th>
            <th className="px-4 py-3.5">Discussion Notes</th>
            <th className="px-4 py-3.5">Logged By & Time</th>
            <th className="px-4 py-3.5">GPS Verification</th>
            <th className="px-4 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {filteredVisits.map((visit) => {
            const visitNum = getVisitNumber(visit);
            const isAdm =
              (visit.staffName || '').toLowerCase().includes('admin') ||
              (visit.staffName || '').toLowerCase().includes('owner') ||
              String(visit.staffId || '').toLowerCase().includes('admin');
            const auth = evaluateVisitAuthenticity(visit);
            const sync = evaluateSyncDelay(visit.checkInTime, visit.createdAt);
            const entryTime = formatDateTime(visit.createdAt);

            return (
              <tr
                key={visit.id}
                className={`hover:bg-slate-50/80 transition-colors ${
                  visit.status === 'Deal Closed' ? 'bg-emerald-50/20' : ''
                }`}
              >
                {/* 1. Business / Client */}
                <td className="px-4 py-3.5 align-top">
                  <div className="flex items-start gap-3">
                    {visit.photoUrl ? (
                      <div
                        onClick={() => setPreviewPhotoUrl(visit.photoUrl)}
                        className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 cursor-pointer shrink-0 group shadow-2xs"
                        title="Click to view full photo"
                      >
                        <img src={visit.photoUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition duration-200" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <Camera size={12} className="text-white" />
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${
                          visit.status === 'Deal Closed'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}
                      >
                        <Building2 size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p
                        onClick={() => setSelectedVisit(visit)}
                        className="font-black text-slate-900 text-xs truncate hover:text-blue-600 cursor-pointer max-w-[200px]"
                        title={visit.businessName}
                      >
                        {visit.businessName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-semibold truncate max-w-[200px] mt-0.5">
                        {visit.clientType} · {visit.city || 'City'}
                      </p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {visit.seatCapacity && (
                          <span className="text-[9px] text-slate-600 bg-slate-100 px-1 py-0.2 rounded font-bold">
                            🪑 {visit.seatCapacity}
                          </span>
                        )}
                        {visitNum > 1 ? (
                          <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                            Re-Visit #{visitNum}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            Visit #1
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* 2. Owner / Contact */}
                <td className="px-4 py-3.5 align-top whitespace-nowrap">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {visit.ownerName || 'Owner'}
                      {visit.personMet && (
                        <span className="ml-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          {visit.personMet.split(' ')[0]}
                        </span>
                      )}
                    </p>
                    {visit.phone ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px] text-slate-500 font-medium">{visit.phone}</span>
                        <a
                          href={`tel:${visit.phone}`}
                          className="w-5 h-5 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition"
                          title="Call"
                        >
                          <PhoneCall size={10} />
                        </a>
                        <a
                          href={`https://wa.me/91${visit.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-5 h-5 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition"
                          title="WhatsApp"
                        >
                          <MessageCircle size={10} />
                        </a>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No phone</span>
                    )}
                  </div>
                </td>

                {/* 3. Status */}
                <td className="px-4 py-3.5 align-top whitespace-nowrap">
                  <div className="relative inline-block">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusDropdownId(statusDropdownId === visit.id ? null : visit.id);
                      }}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      <Badge variant={getStatusBadgeVariant(visit.status)} size="sm">
                        {visit.status}
                      </Badge>
                      <ChevronDown size={11} className="text-slate-400" />
                    </button>
                    {statusDropdownId === visit.id && (
                      <div
                        className="absolute z-30 top-full left-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 w-48"
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
                  </div>
                  {visit.followUpDate && (
                    <p className="text-[10px] text-amber-800 font-bold mt-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-fit">
                      ⏰ {visit.followUpDate}
                    </p>
                  )}
                </td>

                {/* 4. Software / Demo */}
                <td className="px-4 py-3.5 align-top whitespace-nowrap">
                  <div className="space-y-1">
                    {visit.currentSoftwareType === 'Competitor Software' ? (
                      <div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                          💻 {visit.competitorName || 'Competitor'}
                        </span>
                        {visit.competitorExpiryDate && (
                          <span className="block text-[9px] text-amber-700 mt-0.5">
                            Exp: {visit.competitorExpiryDate}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {visit.currentSoftwareType || 'Manual Register'}
                      </span>
                    )}
                    {visit.demoGiven && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <Check size={9} /> Demo Given
                      </span>
                    )}
                  </div>
                </td>

                {/* 5. Discussion Notes */}
                <td className="px-4 py-3.5 align-top max-w-[240px]">
                  {visit.discussionNotes ? (
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug" title={visit.discussionNotes}>
                      "{visit.discussionNotes}"
                    </p>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No notes</span>
                  )}
                  {visit.nextActionItem && (
                    <p className="text-[10px] text-amber-800 font-semibold line-clamp-1 mt-0.5">
                      🎯 {visit.nextActionItem}
                    </p>
                  )}
                </td>

                {/* 6. Logged By & Time */}
                <td className="px-4 py-3.5 align-top whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-md font-black text-xs flex items-center justify-center shrink-0 ${
                        isAdm ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isAdm ? <Crown size={12} className="text-amber-700" /> : (visit.staffName || 'S').substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-800 truncate">
                        {visit.staffName || 'Staff'}
                        {isAdm && <span className="ml-1 text-[8px] uppercase bg-amber-100 text-amber-800 px-1 rounded font-bold">Admin</span>}
                      </p>
                      <p className="text-[10px] text-blue-700 font-bold mt-0.5">
                        {entryTime.time} <span className="text-slate-400 font-normal">({entryTime.date})</span>
                      </p>
                    </div>
                  </div>
                </td>

                {/* 7. GPS Verification */}
                <td className="px-4 py-3.5 align-top whitespace-nowrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${sync.badgeClass}`}>
                        {sync.label}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border inline-flex items-center gap-0.5 ${auth.badgeClass}`}>
                        {auth.isGenuine ? <ShieldCheck size={9} className="text-emerald-700" /> : <ShieldAlert size={9} />}
                        {auth.statusText}
                      </span>
                    </div>
                    {visit.location ? (
                      <a
                        href={visit.location.mapsUrl || `https://www.google.com/maps?q=${visit.location.latitude},${visit.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                        title="Open GPS location in Google Maps"
                      >
                        <MapPin size={10} /> View GPS
                      </a>
                    ) : (
                      <span className="text-[9px] text-rose-500 font-bold">No GPS ⚠️</span>
                    )}
                  </div>
                </td>

                {/* 8. Actions */}
                <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setSelectedVisit(visit)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                      title="Inspect full details"
                    >
                      Inspect
                    </button>
                    {hasPermission('marketing', 'create') && (
                      <button
                        onClick={() => openEditVisit(visit)}
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="Edit Record"
                      >
                        <Edit3 size={13} />
                      </button>
                    )}
                    {hasPermission('marketing', 'create') && (
                      <button
                        onClick={() => openReVisit(visit)}
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title="Log Re-Visit"
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
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

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

      {/* ═══ STAFF PERSONAL WORKSPACE: Live Target Progress Banner ═══ */}
      {!isSuperAdmin && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-4 sm:p-5 text-white shadow-md border border-indigo-800/40">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
                <Target size={22} className="text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-white">
                    ⚡ My Daily Targets & Live Progress
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-[10px] font-black text-emerald-300">
                    Live Real-Time
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Keep visiting clients and closing subscriptions to hit your daily performance targets!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto shrink-0">
              {/* Today's Visits Target */}
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 min-w-[140px]">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                  <span className="font-semibold text-amber-300">⚡ Today's Visits</span>
                  <span className="font-black text-amber-300">{staffPayroll.dailyVisitAchievement}%</span>
                </div>
                <p className="text-lg font-black text-white">
                  {staffPayroll.todayVisits} <span className="text-xs font-normal text-slate-400">{staffPayroll.dailyTargetVisits > 0 ? `/ ${staffPayroll.dailyTargetVisits}` : ''}</span>
                </p>
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-amber-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, staffPayroll.dailyVisitAchievement)}%` }}
                  />
                </div>
              </div>

              {/* Today's Deals Goal */}
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 min-w-[140px]">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                  <span className="font-semibold text-emerald-300">🎯 Today's Deals</span>
                  <span className="font-black text-emerald-300">{staffPayroll.dailyDealAchievement}%</span>
                </div>
                <p className="text-lg font-black text-white">
                  {staffPayroll.todayDeals} <span className="text-xs font-normal text-slate-400">{staffPayroll.dailyTargetDeals > 0 ? `/ ${staffPayroll.dailyTargetDeals}` : ''}</span>
                </p>
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, staffPayroll.dailyDealAchievement)}%` }}
                  />
                </div>
              </div>

              {/* Total Visits Logged */}
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 min-w-[140px]">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                  <span className="font-semibold text-blue-300">📍 All-Time Work</span>
                  <span className="font-black text-blue-300">{staffPayroll.dealsClosed} Won</span>
                </div>
                <p className="text-lg font-black text-white">
                  {staffPayroll.totalVisits} <span className="text-xs font-normal text-slate-400">Total Visits</span>
                </p>
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-blue-400 h-1.5 rounded-full"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BOOSTER BANNER: Competitor Expiry Radar ═══ */}
      {expiringCompetitors.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 rounded-2xl border border-rose-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/25">
              <Target size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded-full">
                  🔥 Hot Switch Targets
                </span>
                <span className="text-xs font-black text-rose-700">
                  {expiringCompetitors.length} Libraries with Competitor Software Expiring Soon
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-1">
                Competitor software for these libraries is expiring soon. Send a proposal on WhatsApp or schedule a visit now to switch them to Univo!
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowRadarModal(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Zap size={14} />
            <span>Open Expiry Radar ({expiringCompetitors.length})</span>
          </button>
        </div>
      )}

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

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {multiStopRouteUrl && (
              <a
                href={multiStopRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                title="Open turn-by-turn route for top nearby places in Google Maps"
              >
                <Navigation size={13} />
                <span>Smart Multi-Stop Route</span>
                <ExternalLink size={10} />
              </a>
            )}

            {/* Simple 2-Way Category Switcher: Libraries vs Gyms */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
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
        </div>

        <div className="p-5 space-y-4">
          {/* Search Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder={activeCategory === 'gym' ? "Enter gym name or city (Required)..." : "Enter library name or city (Required)..."}
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch(e)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Radius Control: Dropdown with 5-1000km OR Type Custom km */}
              {customRadiusMode ? (
                <div className="flex items-center bg-slate-50 border border-blue-500 rounded-xl px-2.5 py-1.5 shadow-xs">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={searchRadius ? searchRadius / 1000 : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setSearchRadius('');
                      } else {
                        const val = Math.max(1, Math.min(1000, Number(raw) || 1));
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
                  title="Search Radius (5 km to 1000 km)"
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
                {/* Search summary & Visited Filter Toggle */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-slate-200/80">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Found <span className="text-blue-600 font-extrabold">{nearbyLibraries.length}</span> {activeCategory === 'gym' ? 'gyms' : 'libraries'}
                      {searchRadius > 0 ? ` within ${searchRadius / 1000} km` : ''}
                      {searchLimit > 0 ? ` (top ${searchLimit})` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">Sorted strictly by nearest distance</p>
                  </div>

                  {/* 3-way Filter Pills: All | Not Visited Yet | Already Visited */}
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs gap-1 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={() => setNearbyVisitFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        nearbyVisitFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>All Places</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        nearbyVisitFilter === 'all' ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-600'
                      }`}>
                        {nearbyCounts.all}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNearbyVisitFilter('unvisited')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        nearbyVisitFilter === 'unvisited'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Show only fresh places where no field visit has been logged"
                    >
                      <span>🆕 Not Visited Yet</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        nearbyVisitFilter === 'unvisited' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {nearbyCounts.unvisited}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNearbyVisitFilter('visited')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        nearbyVisitFilter === 'visited'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Show only places that have already been visited"
                    >
                      <span>✅ Already Visited</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        nearbyVisitFilter === 'visited' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {nearbyCounts.visited}
                      </span>
                    </button>
                  </div>
                </div>

                {filteredNearbyLibraries.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
                    {filteredNearbyLibraries.map((place) => {
                      const placeHistory = getPlaceVisitHistory(place.placeId, place.name);
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
                            (() => {
                              const dt = formatDateTime(lastVisit.createdAt);
                              const visitTime = dt.time || lastVisit.checkInTime || '';
                              return (
                                <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200/70 text-[11px] space-y-1.5">
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className="font-bold text-emerald-900">
                                      ✅ Visited {placeHistory.length}x • Last by {lastVisit.staffName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                    <span className="bg-emerald-100/90 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200 font-extrabold inline-flex items-center gap-1">
                                      <span>📅 {dt.date}</span>
                                      {visitTime && <span>• 🕒 {visitTime}</span>}
                                    </span>
                                    <span className="bg-white text-emerald-800 px-1.5 py-0.5 rounded-md border border-emerald-200 font-bold">
                                      {lastVisit.status}
                                    </span>
                                  </div>
                                  {lastVisit.discussionNotes && (
                                    <p className="text-emerald-800 text-[10px] italic leading-tight line-clamp-2">
                                      "{lastVisit.discussionNotes}"
                                    </p>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-1 rounded-md border border-amber-200/60 inline-block">
                              🆕 Not visited yet
                            </p>
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
                  <div className="text-center py-8 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl">
                    <p className="text-sm font-bold text-slate-700">
                      {nearbyVisitFilter === 'unvisited'
                        ? '🎉 All found places have already been visited!'
                        : nearbyVisitFilter === 'visited'
                        ? 'ℹ️ None of these places have been visited yet.'
                        : 'No places found. Try a different search or increase radius.'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {nearbyVisitFilter !== 'all'
                        ? 'Switch filter to "All Places" to see the full list.'
                        : 'Try searching with a higher radius or specific area name.'}
                    </p>
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
                  Results will appear after you search.
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

      {/* ═══ Admin & Staff Performance Panel ═══ */}
      {isSuperAdmin && allStaffAndAdmins.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Users size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Marketing Team & Admin Performance
                </h3>
                <p className="text-[11px] text-slate-500">
                  Click any staff or admin to filter their visits (Admin entries included)
                </p>
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
            {allStaffAndAdmins.map((staff) => {
              const staffVisits = visits.filter(
                (v) => v.staffId === staff.id || (v.staffName && v.staffName.toLowerCase() === staff.name.toLowerCase())
              );
              const todayVisits = staffVisits.filter((v) => (v.createdAt || '').startsWith(todayStr)).length;
              const staffDemos = staffVisits.filter((v) => v.demoGiven).length;
              const staffDeals = staffVisits.filter((v) => v.status === 'Deal Closed').length;
              const isSelected = selectedStaffFilter === staff.id;
              const isOwnerOrAdmin = staff.isAdmin || staff.role === 'owner';

              return (
                <div
                  key={staff.id}
                  onClick={() => setSelectedStaffFilter(isSelected ? 'All' : staff.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? isOwnerOrAdmin
                        ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : isOwnerOrAdmin
                      ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50/70'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        {isOwnerOrAdmin && <Crown size={12} className="text-amber-600 shrink-0" />}
                        <span>{staff.name}</span>
                      </p>
                      <p className="text-[10px] text-slate-500">{staff.roleLabel || 'Marketing Rep'}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={isSelected ? (isOwnerOrAdmin ? 'warning' : 'info') : 'neutral'} size="sm">
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
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3.5">
        {/* Row 1: Search + Staff Filter + Results Summary & Clear */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="flex-1 min-w-[220px]">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search by library, owner, phone, city, notes..."
              />
            </div>

            {isSuperAdmin && allStaffAndAdmins.length > 0 && (
              <div className="relative shrink-0 sm:w-64">
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-bold outline-none focus:border-blue-600 transition cursor-pointer appearance-none pr-8 ${
                    selectedStaffFilter !== 'All'
                      ? 'bg-blue-50 border-blue-400 text-blue-900 ring-2 ring-blue-500/10'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="All">👥 All Staff & Admins ({visits.length})</option>
                  {allStaffAndAdmins.map((s) => {
                    const sCount = visits.filter(
                      (v) => v.staffId === s.id || (v.staffName && v.staffName.toLowerCase() === s.name.toLowerCase())
                    ).length;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.isAdmin ? '👑 ' : '👤 '}{s.name} ({sCount})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Right side: Showing X of Y + Reset button */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-slate-100">
            <span className="text-xs font-bold text-slate-500">
              Showing <strong className="text-slate-900">{filteredVisits.length}</strong> of {baseVisits.length} visits
            </span>
            {isFilterActive && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition cursor-pointer shadow-2xs"
                title="Reset all filters"
              >
                <RotateCcw size={12} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Row 2: Date Filters & Status Filters */}
        <div className="space-y-2.5">
          {/* Date Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
              <Calendar size={11} className="text-slate-400" /> Date:
            </span>
            <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl gap-1">
              {DATE_FILTERS.map((df) => {
                const isSelected = dateFilter === df.id;
                const count = dateCounts[df.id] ?? 0;
                return (
                  <button
                    key={df.id}
                    type="button"
                    onClick={() => setDateFilter(df.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>{df.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-black ${
                        isSelected ? 'bg-indigo-700/90 text-white' : 'bg-slate-200/90 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-bar for Day Wise / Month Wise / Custom Date Pickers */}
          {dateFilter === 'day' && (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs flex-wrap">
              <span className="font-extrabold text-indigo-900 flex items-center gap-1.5 shrink-0">
                <Calendar size={13} className="text-indigo-600" />
                <span>Select Day:</span>
              </span>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-none shadow-2xs focus:border-indigo-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setSelectedDay(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-[11px] cursor-pointer transition"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const yest = new Date(Date.now() - 86400000);
                  setSelectedDay(`${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`);
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-[11px] cursor-pointer transition"
              >
                Yesterday
              </button>
              <span className="text-[11px] font-bold text-indigo-700/80 sm:ml-auto">
                Showing visits for: <span className="font-black text-indigo-950">{selectedDay || 'Selected date'}</span>
              </span>
            </div>
          )}

          {dateFilter === 'month' && (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs flex-wrap">
              <span className="font-extrabold text-indigo-900 flex items-center gap-1.5 shrink-0">
                <Calendar size={13} className="text-indigo-600" />
                <span>Select Month:</span>
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-none shadow-2xs focus:border-indigo-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-[11px] cursor-pointer transition"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  setSelectedMonth(`${lastM.getFullYear()}-${String(lastM.getMonth() + 1).padStart(2, '0')}`);
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-[11px] cursor-pointer transition"
              >
                Last Month
              </button>
              <span className="text-[11px] font-bold text-indigo-700/80 sm:ml-auto">
                Showing visits for: <span className="font-black text-indigo-950">{selectedMonth || 'Selected month'}</span>
              </span>
            </div>
          )}

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs flex-wrap">
              <span className="font-extrabold text-indigo-900 flex items-center gap-1.5 shrink-0">
                <Calendar size={13} className="text-indigo-600" />
                <span>Custom Date Range:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-none shadow-2xs focus:border-indigo-500 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-none shadow-2xs focus:border-indigo-500 cursor-pointer"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="px-2.5 py-1 text-slate-500 hover:text-slate-800 text-xs font-bold underline cursor-pointer"
                >
                  Clear Range
                </button>
              )}
            </div>
          )}

          {/* Status Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
              <Filter size={11} className="text-slate-400" /> Status:
            </span>
            <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl gap-1 overflow-x-auto">
              {STATUS_FILTER_OPTIONS.map((st) => {
                const isSelected = statusFilter === st.id;
                const count = statusCounts[st.id] ?? 0;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? st.activeClass || 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>{st.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-black ${
                        isSelected ? 'bg-black/25 text-white' : 'bg-slate-200/90 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SECTION C: Visits Card Grid ═══ */}
      <div>
        {/* Section header row with Table/Cards toggle for PC */}
        <div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2">
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
            {filteredVisits.length} Visit{filteredVisits.length !== 1 ? 's' : ''} Found
          </p>

          {/* Desktop View Switcher: Table vs Cards (Hidden on mobile; mobile strictly shows Cards) */}
          <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Table View (Compact for PC)"
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Cards View (Detailed Cards)"
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
          </div>
        </div>

        {filteredVisits.length > 0 ? (
          <>
            {/* Desktop Table View (Rendered on PC when viewMode is 'table') */}
            {viewMode === 'table' && (
              <div className="hidden md:block mb-4">
                {renderTableView()}
              </div>
            )}

            {/* Cards View (Rendered on PC when viewMode is 'cards', and ALWAYS rendered on mobile) */}
            <div className={viewMode === 'table' ? 'block md:hidden' : 'block'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredVisits.map((visit) => {
              const visitNum = getVisitNumber(visit);
              const isAdm =
                (visit.staffName || '').toLowerCase().includes('admin') ||
                (visit.staffName || '').toLowerCase().includes('owner') ||
                String(visit.staffId || '').toLowerCase().includes('admin');
              const auth = evaluateVisitAuthenticity(visit);
              const sync = evaluateSyncDelay(visit.checkInTime, visit.createdAt);
              const entryTime = formatDateTime(visit.createdAt);

              return (
                <div
                  key={visit.id}
                  className={`bg-white rounded-2xl border shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col ${
                    visit.status === 'Deal Closed'
                      ? 'border-emerald-200 ring-1 ring-emerald-100'
                      : 'border-slate-200/80'
                  }`}
                >
                  {/* Card Top: Photo + Name + Status */}
                  <div className="p-4 flex items-start gap-3">
                    {/* Avatar / Photo */}
                    {visit.photoUrl ? (
                      <div
                        onClick={() => setPreviewPhotoUrl(visit.photoUrl)}
                        className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 cursor-pointer shrink-0 group shadow-xs"
                        title="Click to view photo"
                      >
                        <img src={visit.photoUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition duration-200" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <Camera size={16} className="text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow-xs ${
                        visit.status === 'Deal Closed'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        <Building2 size={22} />
                      </div>
                    )}

                    {/* Name + type + tags */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="font-black text-slate-900 text-sm leading-tight truncate">
                          {visit.businessName}
                        </p>
                        {/* Status dropdown button */}
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusDropdownId(statusDropdownId === visit.id ? null : visit.id);
                            }}
                            className="flex items-center gap-0.5 cursor-pointer"
                          >
                            <Badge variant={getStatusBadgeVariant(visit.status)} size="sm">
                              {visit.status}
                            </Badge>
                            <ChevronDown size={11} className="text-slate-400" />
                          </button>
                          {statusDropdownId === visit.id && (
                            <div
                              className="absolute z-30 top-full right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 w-52"
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
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] text-slate-400 font-semibold">
                          {visit.clientType} · {visit.city || 'City'}
                        </span>
                        {visit.seatCapacity && (
                          <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                            🪑 {visit.seatCapacity}
                          </span>
                        )}
                        {visitNum > 1 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            <RotateCcw size={10} className="stroke-[2.5]" />
                            Re-Visit #{visitNum}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Visit #1
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-slate-100 mx-4" />

                  {/* Contact Row */}
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {visit.ownerName || 'Owner'}
                        {visit.personMet && (
                          <span className="ml-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {visit.personMet.split(' ')[0]}
                          </span>
                        )}
                      </p>
                      {visit.phone && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{visit.phone}</p>
                      )}
                    </div>

                    {visit.phone && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={`tel:${visit.phone}`}
                          className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition"
                          title="Call"
                        >
                          <PhoneCall size={12} />
                        </a>
                        <a
                          href={`https://wa.me/91${visit.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition"
                          title="WhatsApp"
                        >
                          <MessageCircle size={12} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Software + Notes */}
                  <div className="px-4 pb-3 space-y-2">
                    {/* Current software */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {visit.currentSoftwareType === 'Competitor Software' ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                            💻 {visit.competitorName || 'Competitor App'}
                          </span>
                          {(visit.competitorExpiryDate || visit.competitorDuration) && (
                            <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Exp: {visit.competitorExpiryDate || visit.competitorDuration}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          {visit.currentSoftwareType || '📒 Manual Register'}
                        </span>
                      )}
                      {visit.demoGiven && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <Check size={9} /> Demo Given
                        </span>
                      )}
                    </div>

                    {/* Discussion notes */}
                    {visit.discussionNotes && (
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100">
                        "{visit.discussionNotes}"
                      </p>
                    )}

                    {/* Follow-up */}
                    {visit.followUpDate && (
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-[10px] font-bold text-amber-900">
                          ⏰ Follow-up: {visit.followUpDate}{visit.followUpTime ? ` @ ${visit.followUpTime}` : ''}
                        </p>
                        {visit.nextActionItem && (
                          <p className="text-[10px] text-amber-800 font-semibold line-clamp-1 mt-0.5">
                            🎯 {visit.nextActionItem}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-slate-100 mx-4" />

                  {/* Entry Time & GPS Row */}
                  <div className="px-4 py-2.5 bg-slate-50/60 flex items-center justify-between gap-2 flex-wrap">
                    {/* Staff + entry time */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-6 h-6 rounded-md font-black text-xs flex items-center justify-center shrink-0 ${
                        isAdm ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isAdm ? <Crown size={12} className="text-amber-700" /> : (visit.staffName || 'S').substring(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-700 truncate">
                          {visit.staffName || 'Marketing Rep'}
                          {isAdm && <span className="ml-1 text-[8px] uppercase bg-amber-100 text-amber-800 px-1 rounded">Admin</span>}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[8px] font-bold uppercase text-blue-500">
                            {visit.visitCount > 1 || (visit.visitHistory && visit.visitHistory.length > 0) ? 'Latest:' : 'Entry:'}
                          </span>
                          <strong className="text-[10px] font-black text-blue-700">
                            {visit.lastVisitedAt ? formatDateTime(visit.lastVisitedAt).time : entryTime.time}
                          </strong>
                          <span className="text-[9px] text-slate-400">
                            ({visit.lastVisitedAt ? formatDateTime(visit.lastVisitedAt).date : entryTime.date})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* GPS + sync */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${sync.badgeClass}`}>
                        {sync.label}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border inline-flex items-center gap-0.5 ${auth.badgeClass}`}>
                        {auth.isGenuine ? <ShieldCheck size={9} className="text-emerald-700" /> : <ShieldAlert size={9} />}
                        {auth.statusText}
                      </span>
                      {visit.location ? (
                        <a
                          href={visit.location.mapsUrl || `https://www.google.com/maps?q=${visit.location.latitude},${visit.location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                        >
                          <MapPin size={9} /> GPS
                        </a>
                      ) : (
                        <span className="text-[9px] text-rose-500 font-bold">No GPS ⚠️</span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">

                    <button
                      onClick={() => setSelectedVisit(visit)}
                      className="flex-1 min-w-0 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      Inspect
                    </button>
                    {hasPermission('marketing', 'create') && (
                      <button
                        onClick={() => openEditVisit(visit)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                    {hasPermission('marketing', 'create') && (
                      <button
                        onClick={() => openReVisit(visit)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                        title="Re-Visit"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {hasPermission('marketing', 'delete') && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete visit record for "${visit.businessName}"?`)) {
                            deleteMutation.mutate(visit.id);
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-10">
            <EmptyState
              icon={Navigation}
              title="No visits found"
              description="Try adjusting your filters, or click 'Log Visit' to record an on-site visit."
            />
          </div>
        )}
      </div>


      {/* ═══ Log / Edit / Re-Visit Modal ═══ */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingVisit(null); setRevisitTarget(null); }}
        title={
          revisitTarget
            ? `🔄 Log Re-Visit — ${revisitTarget.businessName}`
            : editingVisit
            ? 'Edit Field Visit Record'
            : 'Log On-Site Field Visit'
        }
        subtitle={
          revisitTarget
            ? `Recording Visit #${(revisitTarget.visitCount || 1) + 1} • Updates existing client record with timeline history`
            : editingVisit
            ? `Editing visit to ${editingVisit.businessName}`
            : form.placeName
            ? `📍 ${form.placeName} — ${form.placeAddress}`
            : 'Capture on-ground photo proof, client details, competitor status & follow-up'
        }
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Re-visit context banner */}
          {revisitTarget && (
            <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-2xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-blue-900 flex items-center gap-1.5">
                  <RotateCcw size={13} className="text-blue-600" />
                  Recording Re-Visit #{(revisitTarget.visitCount || 1) + 1} for "{revisitTarget.businessName}"
                </span>
                <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-md">
                  Updates Existing Record
                </span>
              </div>
              <p className="text-blue-800 text-[11px]">
                Previous status was <strong>{revisitTarget.status}</strong>. Enter new discussion notes, update status, and set a new follow-up if needed.
              </p>
              {revisitTarget.discussionNotes && (
                <p className="text-slate-600 text-[10px] italic bg-white/90 p-2 rounded-lg border border-blue-100">
                  Last discussion notes: "{revisitTarget.discussionNotes}"
                </p>
              )}
            </div>
          )}

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
                <input
                  type="text"
                  placeholder="e.g. 50, 80 Seats, 120"
                  value={form.seatCapacity}
                  onChange={(e) => setForm({ ...form, seatCapacity: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">State *</label>
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">City *</label>
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
                <div className="relative flex items-center">
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={`w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 font-semibold ${
                      form.phone && form.phone.trim().length >= 5 ? 'pr-16' : ''
                    }`}
                  />
                  {form.phone && form.phone.trim().length >= 5 && (
                    <div className="absolute right-1 flex items-center gap-1">
                      <a
                        href={`tel:${form.phone}`}
                        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-2xs"
                        title="Redirect to Phone Dialer / Call App"
                      >
                        <PhoneCall size={12} />
                      </a>
                      <a
                        href={`https://wa.me/91${form.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs"
                        title="Open WhatsApp"
                      >
                        <MessageCircle size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Alternative Mobile / WhatsApp
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">(Optional)</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="tel"
                    placeholder="Optional alternate on-site phone number"
                    value={form.secondaryPhone}
                    onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
                    className={`w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 ${
                      form.secondaryPhone && form.secondaryPhone.trim().length >= 5 ? 'pr-16' : ''
                    }`}
                  />
                  {form.secondaryPhone && form.secondaryPhone.trim().length >= 5 && (
                    <div className="absolute right-1 flex items-center gap-1">
                      <a
                        href={`tel:${form.secondaryPhone}`}
                        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-2xs"
                        title="Redirect to Phone Dialer / Call App"
                      >
                        <PhoneCall size={12} />
                      </a>
                      <a
                        href={`https://wa.me/91${form.secondaryPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs"
                        title="Open WhatsApp"
                      >
                        <MessageCircle size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {form.personMet !== 'Owner / Director' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Contact Person Name & Note (If Owner Not Available)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Manager Suresh Kumar (Owner will arrive at 2:00 PM)"
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
                (Competitor software expiry date)
              </span>
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                How is the Library Currently Managed?
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
                    Expiry Period (Quick Duration Preset)
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: '⚡ 15 Days', months: 0.5 },
                      { label: '🗓️ 1 Month', months: 1 },
                      { label: '🗓️ 2 Months', months: 2 },
                      { label: '🗓️ 3 Months', months: 3 },
                      { label: '🗓️ 6 Months', months: 6 },
                      { label: '🗓️ 1 Year', months: 12 },
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
                    Current Software Issues & Pain Points (Why switch?)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Too expensive, missing WhatsApp automated alerts, poor customer support..."
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
                Discussion Summary (Key Points Discussed) *
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


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
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
                <span>Re-Visit & Follow-Up Reminder</span>
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
                Follow-Up Action Note
              </label>
              <input
                type="text"
                placeholder="e.g. Come back in 30 mins, Meet owner Monday at 2PM, Owner will be back next week..."
                value={form.reminderNote}
                onChange={(e) => setForm({ ...form, reminderNote: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-amber-600 font-medium"
              />
            </div>
          </div>

          {/* SECTION 7: Visit Times & Ground Duration */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} className="text-blue-600" />
                <span>Visit Duration & On-Site Presence</span>
              </span>
              <span className="text-xs font-black text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-md">
                ⏱️ {form.durationMinutes || 20} min on site
              </span>
            </div>

            {/* Quick Duration Preset Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 font-bold">Quick Duration:</span>
              {[15, 30, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    const newOut = calculateCheckoutTime(form.checkInTime, mins);
                    setForm({ ...form, durationMinutes: mins, checkOutTime: newOut });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                    Number(form.durationMinutes) === mins
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Check-in Time (Arrival)</label>
                  <button
                    type="button"
                    onClick={() => {
                      const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                      const newOut = calculateCheckoutTime(nowStr, form.durationMinutes || 20);
                      setForm({ ...form, checkInTime: nowStr, checkOutTime: newOut });
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Set Now
                  </button>
                </div>
                <input
                  type="text"
                  value={form.checkInTime}
                  onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                  placeholder="e.g. 11:30 AM"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Check-out Time (Departure)</label>
                  <button
                    type="button"
                    onClick={() => {
                      const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                      setForm({ ...form, checkOutTime: nowStr });
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Set Now
                  </button>
                </div>
                <input
                  type="text"
                  value={form.checkOutTime}
                  onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                  placeholder="e.g. 12:00 PM"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setShowModal(false); setEditingVisit(null); setRevisitTarget(null); }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || editMutation.isPending}
              className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                revisitTarget ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <CheckCircle2 size={15} />
              <span>
                {addMutation.isPending || editMutation.isPending
                  ? 'Saving...'
                  : revisitTarget
                  ? `🔄 Save Re-Visit #${(revisitTarget.visitCount || 1) + 1} (Update Record)`
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
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Lead Status</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={getStatusBadgeVariant(selectedVisit.status)} size="sm">{selectedVisit.status}</Badge>
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

            {/* Complete Re-Visit Timeline (In-Doc History + Legacy Multi-Doc) */}
            {(() => {
              const inDocHistory = Array.isArray(selectedVisit.visitHistory) ? selectedVisit.visitHistory : [];
              const legacyDocs = getPlaceVisitHistory(selectedVisit.placeId, selectedVisit.businessName)
                .filter((v) => v.id !== selectedVisit.id);
              const totalVisitsCount = (selectedVisit.visitCount || inDocHistory.length + 1) + legacyDocs.length;

              if (inDocHistory.length === 0 && legacyDocs.length === 0) return null;

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <RotateCcw size={14} className="text-indigo-600" />
                      Client Visit Timeline ({totalVisitsCount} Total Visits)
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      All Past History Preserved
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {/* Latest / Current Visit */}
                    <div className="p-3 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 relative">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase bg-indigo-600 text-white px-2 py-0.5 rounded-md shadow-xs">
                            Visit #{selectedVisit.visitCount || (inDocHistory.length + 1)} (Latest)
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {selectedVisit.lastStaffName || selectedVisit.staffName || 'Staff'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={getStatusBadgeVariant(selectedVisit.status)} size="sm">
                            {selectedVisit.status}
                          </Badge>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {formatDate(selectedVisit.lastVisitedAt || selectedVisit.createdAt)}
                          </span>
                        </div>
                      </div>
                      {selectedVisit.checkInTime && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          🕒 Time: {selectedVisit.checkInTime}{selectedVisit.checkOutTime ? ` → ${selectedVisit.checkOutTime}` : ''}
                        </p>
                      )}
                      <p className="text-xs text-slate-700 mt-1.5 bg-white/80 p-2.5 rounded-lg border border-indigo-100 whitespace-pre-wrap">
                        {selectedVisit.discussionNotes || 'No notes entered for this visit.'}
                      </p>
                    </div>

                    {/* Past in-doc visits in reverse chronological order */}
                    {[...inDocHistory].reverse().map((past, idx) => {
                      const pastVisitNum = inDocHistory.length - idx;
                      return (
                        <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                                Visit #{pastVisitNum}
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {past.staffName || 'Staff'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge variant={getStatusBadgeVariant(past.status)} size="sm">
                                {past.status}
                              </Badge>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                {formatDate(past.visitedAt)}
                              </span>
                            </div>
                          </div>
                          {past.checkInTime && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              🕒 Time: {past.checkInTime}{past.checkOutTime ? ` → ${past.checkOutTime}` : ''}
                            </p>
                          )}
                          {past.discussionNotes && (
                            <p className="text-xs text-slate-700 mt-1.5 bg-white p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap">
                              {past.discussionNotes}
                            </p>
                          )}
                          {past.followUpDate && (
                            <p className="text-[10px] text-amber-700 font-semibold mt-1">
                              ⏰ Follow-up set: {past.followUpDate}{past.followUpTime ? ` @ ${past.followUpTime}` : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {/* Legacy separate document visits if any exist */}
                    {legacyDocs.map((leg) => (
                      <div key={leg.id} className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                              Past Record
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {leg.staffName || 'Staff'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={getStatusBadgeVariant(leg.status)} size="sm">
                              {leg.status}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(leg.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{leg.discussionNotes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Boss Eye Ground Verification Box */}
            {(() => {
              const auth = evaluateVisitAuthenticity(selectedVisit);
              const duration = getVisitDurationMinutes(selectedVisit);
              return (
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-blue-600" />
                      <span>Boss Eye Ground Verification (On-Site Proof)</span>
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${auth.badgeClass}`}>
                      {auth.statusText}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* 1. On-Site Ground Timing */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">🚶 On-Site Visit Time</span>
                      <span className="font-extrabold text-blue-700 text-xs mt-0.5 block">
                        ⏱️ {formatDurationMinutes(duration)} on site
                      </span>
                      <span className="text-[10px] text-slate-600 font-semibold block mt-0.5">
                        {formatDisplayTime(selectedVisit.checkInTime, selectedVisit.createdAt)} → {formatDisplayTime(selectedVisit.checkOutTime)}
                      </span>
                    </div>

                    {/* 2. Server Entry Received Time */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-amber-700 font-bold uppercase block">📥 Server Entry Received</span>
                      <span className="font-extrabold text-amber-900 text-xs mt-0.5 block">
                        🕒 {formatEntryTimestamp(selectedVisit.createdAt).time}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium block">
                        📅 {formatEntryTimestamp(selectedVisit.createdAt).date}
                      </span>
                      <span className="text-[9px] font-bold text-emerald-700 block mt-0.5">
                        {evaluateSyncDelay(selectedVisit.checkInTime, selectedVisit.createdAt).label}
                      </span>
                    </div>

                    {/* 3. GPS Accuracy */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">GPS Authenticity</span>
                      <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                        {selectedVisit.location ? `±${selectedVisit.location.accuracy || 15}m Accuracy` : 'No GPS Locked'}
                      </span>
                      {auth.distanceToPlace != null && (
                        <span className={`text-[10px] font-bold ${auth.level === 'distance_alert' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {auth.distanceToPlace > 800 ? `🚨 ${auth.distanceToPlace}m from place` : `🎯 On Target (${auth.distanceToPlace}m)`}
                        </span>
                      )}
                    </div>

                    {/* 4. Photo Proof */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">On-Site Photo Proof</span>
                      <span className={`font-bold text-xs mt-0.5 block ${selectedVisit.photoUrl ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {selectedVisit.photoUrl ? '📸 Photo Attached' : '❌ No Photo Proof'}
                      </span>
                    </div>
                  </div>

                  {selectedVisit.location && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Coordinates: {selectedVisit.location.latitude?.toFixed(5)}, {selectedVisit.location.longitude?.toFixed(5)}
                      </span>
                      <a
                        href={selectedVisit.location.mapsUrl || `https://www.google.com/maps?q=${selectedVisit.location.latitude},${selectedVisit.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition"
                      >
                        <MapPin size={12} /> View on Google Maps <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
              <button
                onClick={() => {
                  const v = selectedVisit;
                  setSelectedVisit(null);
                  openConvertModal(v);
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <UserPlus size={12} /> Onboard as Client
              </button>
              {selectedVisit.phone && (
                <a
                  href={`https://wa.me/91${selectedVisit.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                >
                  <MessageCircle size={12} /> WhatsApp
                </a>
              )}
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

      {/* ═══ 1-Click Convert to Client Modal ═══ */}
      {showConvertModal && (
        <Modal
          isOpen={!!showConvertModal}
          onClose={() => setShowConvertModal(null)}
          title="🚀 Onboard Direct to Library Clients"
          subtitle={`Convert "${showConvertModal.businessName}" into an active software client with live login`}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleConvertClientSubmit} className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles size={14} className="text-emerald-600" />
                <span>Direct CRM & Billing Activation</span>
              </p>
              <p className="mt-0.5 text-emerald-700">
                This creates a new client entry in <strong>Library Clients</strong>, sets status to Active, allocates a trial/subscription, and marks this field visit as <strong>Deal Closed</strong>!
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Library / Business Name *</label>
                <input
                  type="text"
                  required
                  value={convertForm.libraryName}
                  onChange={(e) => setConvertForm({ ...convertForm, libraryName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Owner Name *</label>
                  <input
                    type="text"
                    required
                    value={convertForm.ownerName}
                    onChange={(e) => setConvertForm({ ...convertForm, ownerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={convertForm.phone}
                    onChange={(e) => setConvertForm({ ...convertForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Client Email (Login ID) *</label>
                <input
                  type="email"
                  required
                  value={convertForm.email}
                  onChange={(e) => setConvertForm({ ...convertForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address / Location</label>
                <input
                  type="text"
                  value={convertForm.address}
                  onChange={(e) => setConvertForm({ ...convertForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Selected Plan / Package</label>
                <select
                  value={convertForm.planName}
                  onChange={(e) => setConvertForm({ ...convertForm, planName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="Free Trial (14 Days)">Free Trial (14 Days Demo)</option>
                  <option value="Monthly Starter (30 Days)">Monthly Starter (30 Days)</option>
                  <option value="Annual Plan (1 Year)">Annual Plan (1 Year - Standard)</option>
                  <option value="Enterprise 2-Year Plan">Enterprise 2-Year Plan</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConvertModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={converting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
              >
                {converting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Onboarding Client...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={13} />
                    <span>Confirm Onboarding & Close Deal</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══ Competitor Expiry Radar Modal ═══ */}
      {showRadarModal && (
        <Modal
          isOpen={showRadarModal}
          onClose={() => setShowRadarModal(false)}
          title="🎯 Competitor Software Expiry Radar"
          subtitle="Target these libraries right before their current software expires to close deals immediately"
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 rounded-2xl border border-rose-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
                  <Flame size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {expiringCompetitors.length} High-Intent Switch Prospects Found
                  </h4>
                  <p className="text-xs text-slate-600">
                    Libraries currently paying a competitor whose license expires within the next 35 days.
                  </p>
                </div>
              </div>
            </div>

            {expiringCompetitors.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No competitor softwares found expiring in the next 35 days. Log more competitor renewal dates during field visits!
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-2.5 pr-1">
                {expiringCompetitors.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm">{item.businessName}</span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                          💻 {item.competitorName || 'Competitor'}
                        </span>
                        {item.isUrgent && (
                          <span className="text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full animate-pulse">
                            🚨 URGENT: {item.daysRemaining} days left!
                          </span>
                        )}
                        {!item.isUrgent && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            ⏳ {item.daysRemaining} days left
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>👤 {item.ownerName || 'Owner'}</span>
                        {item.phone && <span>• 📞 {item.phone}</span>}
                        {item.city && <span>• 📍 {item.city}</span>}
                        <span>• 📅 Expiry: <strong className="text-slate-800">{item.competitorExpiryDate}</strong></span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {item.phone && (
                        <>
                          <a
                            href={`tel:${item.phone}`}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1 transition"
                            title="Call Owner"
                          >
                            <PhoneCall size={12} /> Call
                          </a>
                          <a
                            href={`https://wa.me/91${item.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1 transition"
                            title="WhatsApp"
                          >
                            <MessageCircle size={12} /> WhatsApp
                          </a>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setShowRadarModal(false);
                          openConvertModal(item);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        title="Close Deal & Onboard"
                      >
                        <UserPlus size={12} /> Onboard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRadarModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close Radar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
