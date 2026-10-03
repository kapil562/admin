import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { SearchBar } from '../components/ui/SearchBar';
import { useAuth } from '../context/AuthContext';
import { getFieldVisits } from '../firebase/services/marketingService';
import {
  runCityMarketResearch,
  saveResearchReport,
  getResearchReports,
  deleteResearchReport,
  CATEGORY_CONFIGS,
} from '../firebase/services/marketResearchService';
import { syncCityTargetsToFieldMarketing } from '../firebase/services/targetSyncService';
import {
  Compass,
  Search,
  MapPin,
  Phone,
  MessageCircle,
  Download,
  Printer,
  Sparkles,
  Building2,
  Star,
  ExternalLink,
  History,
  Trash2,
  TrendingUp,
  CheckCircle2,
  Users,
  Target,
  ArrowRight,
  Filter,
  Layers,
  ChevronRight,
  ShieldCheck,
  BookmarkPlus,
  RefreshCw,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const INDIA_STATES_AND_CITIES = {
  'Madhya Pradesh': [
    'Indore', 'Bhopal', 'Guna', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar', 'Rewa', 'Satna', 'Dewas', 'Ratlam', 'Shivpuri', 'Vidisha', 'Khandwa', 'Burhanpur', 'Neemuch', 'Mandsaur', 'Chhindwara', 'Hoshangabad (Narmadapuram)', 'Pithampur', 'Mhow', 'Ashoknagar', 'Datia', 'Damoh', 'Raisen', 'Sehore', 'Betul', 'Harda', 'Khargone', 'Barwani', 'Dhar', 'Jhabua', 'Alirajpur', 'Shajapur', 'Agar Malwa', 'Seoni', 'Balaghat', 'Mandla', 'Dindori', 'Narsinghpur', 'Katni', 'Sidhi', 'Singrauli', 'Shahdol', 'Umaria', 'Anuppur', 'Panna', 'Tikamgarh', 'Chhatarpur', 'Niwari', 'Sheopur', 'Morena', 'Bhind', 'Maihar', 'Pandhurna', 'Mauganj'
  ],
  'Rajasthan': [
    'Kota', 'Jaipur', 'Jodhpur', 'Udaipur', 'Ajmer', 'Bikaner', 'Alwar', 'Bhilwara', 'Sikar', 'Bharatpur', 'Sri Ganganagar', 'Pali', 'Chittorgarh', 'Jhunjhunu', 'Hanumangarh', 'Barmer', 'Nagaur', 'Tonk', 'Dausa', 'Bundi', 'Baran', 'Jhalawar', 'Sawai Madhopur', 'Rajsamand', 'Dungarpur', 'Banswara', 'Sirohi', 'Jaisalmer', 'Churu', 'Dholpur', 'Karauli', 'Pratapgarh', 'Beawar', 'Neem Ka Thana', 'Didwana', 'Balotra', 'Phalodi', 'Deeg', 'Kekri'
  ],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Varanasi', 'Prayagraj', 'Agra', 'Noida', 'Greater Noida', 'Ghaziabad', 'Meerut', 'Bareilly', 'Gorakhpur', 'Jhansi', 'Aligarh', 'Mathura', 'Moradabad', 'Saharanpur', 'Ayodhya', 'Firozabad', 'Muzaffarnagar', 'Budaun', 'Rampur', 'Shahjahanpur', 'Farrukhabad', 'Hapur', 'Etawah', 'Mirzapur', 'Bulandshahr', 'Sambhal', 'Amroha', 'Hardoi', 'Fatehpur', 'Raebareli', 'Orai', 'Sitapur', 'Bahraich', 'Unnao', 'Jaunpur', 'Lakhimpur', 'Hathras', 'Banda', 'Pilibhit', 'Barabanki', 'Gonda', 'Mainpuri', 'Lalitpur', 'Deoria', 'Ghazipur', 'Sultanpur', 'Azamgarh', 'Bijnor', 'Basti', 'Ballia', 'Bhadohi', 'Kasganj'
  ],
  'Delhi NCR': [
    'New Delhi', 'South Delhi', 'North Delhi', 'West Delhi', 'East Delhi', 'Central Delhi', 'Noida', 'Greater Noida', 'Gurugram', 'Ghaziabad', 'Faridabad', 'Sonipat'
  ],
  'Maharashtra': [
    'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Chhatrapati Sambhajinagar', 'Navi Mumbai', 'Solapur', 'Kolhapur', 'Amravati', 'Nanded', 'Sangli', 'Jalgaon', 'Akola', 'Latur', 'Dhule', 'Ahmednagar', 'Chandrapur', 'Parbhani', 'Satara', 'Beed'
  ],
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Anand', 'Junagadh', 'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch', 'Mehsana', 'Bhuj', 'Porbandar', 'Valsad', 'Vapi', 'Gondal'
  ],
  'Bihar': [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Begusarai', 'Bihar Sharif', 'Arrah', 'Katihar', 'Munger', 'Chhapra', 'Danapur', 'Saharsa', 'Sasaram', 'Hajipur', 'Dehri', 'Siwan', 'Motihari', 'Nawada', 'Bettiah', 'Buxar', 'Kishanganj'
  ],
  'Haryana': [
    'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Rohtak', 'Hisar', 'Sonipat', 'Panchkula', 'Yamunanagar', 'Sirsa', 'Bhiwani', 'Bahadurgarh', 'Jind', 'Thanesar', 'Kaithal', 'Rewari', 'Palwal'
  ],
  'Punjab': [
    'Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Batala', 'Pathankot', 'Moga', 'Abohar', 'Malerkotla', 'Khanna', 'Phagwara', 'Muktsar', 'Barnala', 'Firozpur'
  ],
  'Chhattisgarh': [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Jagdalpur', 'Raigarh', 'Ambikapur', 'Dhamtari', 'Mahasamund'
  ],
  'Uttarakhand': [
    'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh', 'Kashipur', 'Rudrapur', 'Nainital', 'Pithoragarh'
  ],
  'Jharkhand': [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Giridih', 'Ramgarh', 'Medininagar', 'Chas'
  ],
  'Karnataka': [
    'Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Davanagere', 'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Kalaburagi', 'Bidar', 'Udupi'
  ],
  'Telangana': [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Siddipet'
  ],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Ranipet', 'Nagercoil', 'Thanjavur', 'Vellore', 'Kancheepuram', 'Erode', 'Dindigul'
  ],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Dankuni'
  ],
  'Other / Custom State': [
    'Goa', 'Shimla', 'Jammu', 'Srinagar', 'Guwahati', 'Bhubaneswar', 'Cuttack', 'Rourkela', 'Agartala', 'Shillong', 'Imphal', 'Aizawl', 'Kohima', 'Gangtok', 'Port Blair'
  ],
};

export const MarketResearch = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Search parameters: State & City
  const [selectedState, setSelectedState] = useState('Madhya Pradesh');
  const [cityInput, setCityInput] = useState('Indore');
  const [selectedCategory, setSelectedCategory] = useState('library');
  const [customQuery, setCustomQuery] = useState('');
  const [scanDepth, setScanDepth] = useState('exhaustive'); // exhaustive (100% all zones) | standard | quick

  const handleStateChange = (stateName) => {
    setSelectedState(stateName);
    const cities = INDIA_STATES_AND_CITIES[stateName] || [];
    if (cities.length > 0) {
      setCityInput(cities[0]);
    }
  };

  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ stage: '', message: '', percent: 0 });
  const [currentReport, setCurrentReport] = useState(null);
  const [isReportSaved, setIsReportSaved] = useState(false);

  // Filters for results list
  const [filterSearch, setFilterSearch] = useState('');
  const [filterArea, setFilterArea] = useState('All');
  const [filterCrmStatus, setFilterCrmStatus] = useState('All'); // All | Untapped | Visited
  const [filterHasPhoneOnly, setFilterHasPhoneOnly] = useState(false);

  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // 1. Fetch Existing Visits (to cross-reference lead coverage)
  const { data: visits = [] } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  // 2. Fetch Saved Past Reports
  const { data: savedReports = [], isLoading: loadingSavedReports } = useQuery({
    queryKey: ['market_research_reports'],
    queryFn: getResearchReports,
  });

  // 3. Save Report Mutation
  const saveMutation = useMutation({
    mutationFn: saveResearchReport,
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['market_research_reports'] });
      setIsReportSaved(true);
      toast.success('Report saved to History!');
    },
    onError: (err) => {
      toast.error('Failed to save report: ' + err.message);
    },
  });

  // 4. Delete Report Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteResearchReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market_research_reports'] });
      toast.success('Saved report removed.');
    },
    onError: (err) => {
      toast.error('Failed to delete report: ' + err.message);
    },
  });

  // 5. Sync to Field Marketing Targets Mutation (Smart Delta Sync)
  const [syncStatusData, setSyncStatusData] = useState(null);
  const syncMutation = useMutation({
    mutationFn: syncCityTargetsToFieldMarketing,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['field_marketing_target_cities'] });
      queryClient.invalidateQueries({ queryKey: ['field_marketing_targets'] });
      setSyncStatusData(data);
      toast.success(
        `🚀 Synced ${data.totalPlaces} ${data.category === 'gym' ? 'Gyms' : 'Libraries'} to Field Marketing! (${data.addedCount} Fresh Added, ${data.preservedCount} Preserved)`,
        { duration: 5500 }
      );
    },
    onError: (err) => {
      toast.error('Failed to sync to Field Marketing: ' + err.message);
    },
  });

  // ── Handler: Execute Scan ──────────────────────────────────────────────────
  const handleStartScan = async () => {
    if (!cityInput.trim()) {
      toast.error('Please enter a city name.');
      return;
    }
    if (selectedCategory === 'custom' && !customQuery.trim()) {
      toast.error('Please enter what you want to search.');
      return;
    }

    setIsScanning(true);
    setScanProgress({ stage: 'starting', message: `Initializing intelligence scan for ${cityInput.trim()}...`, percent: 5 });

    try {
      const report = await runCityMarketResearch({
        city: cityInput.trim(),
        state: selectedState,
        category: selectedCategory,
        customQuery: customQuery.trim(),
        scanDepth,
        existingVisits: visits,
        onProgress: (p) => setScanProgress(p),
      });

      setCurrentReport(report);
      setIsReportSaved(false);
      // Reset view filters
      setFilterSearch('');
      setFilterArea('All');
      setFilterCrmStatus('All');
      setFilterHasPhoneOnly(false);

      toast.success(`Discovered ${report.totalCount} places in ${cityInput.trim()}!`);
    } catch (err) {
      console.error('Market scan error:', err);
      toast.error(err.message || 'Market scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  // ── Handler: Load Past Saved Report ────────────────────────────────────────
  const handleLoadSavedReport = (report) => {
    setCurrentReport(report);
    setIsReportSaved(true);
    setCityInput(report.city);
    if (report.state) setSelectedState(report.state);
    setSelectedCategory(report.category || 'library');
    if (report.customQuery) setCustomQuery(report.customQuery);
    setShowHistoryModal(false);
    toast.success(`Loaded saved report: ${report.title}`);
  };

  // ── Handler: CSV Export ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!currentReport || !currentReport.places || currentReport.places.length === 0) {
      toast.error('No places to export.');
      return;
    }

    const headers = [
      'Business Name',
      'State',
      'City',
      'Locality / Area',
      'Full Address',
      'Phone Number',
      'Rating',
      'Total Reviews',
      'Distance from City Center (KM)',
      'Lead Status',
      'Google Maps Link',
      'Website',
    ];

    const rows = filteredPlaces.map((p) => [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(currentReport.state || selectedState || '').replace(/"/g, '""')}"`,
      `"${(p.city || currentReport.city || '').replace(/"/g, '""')}"`,
      `"${(p.locality || '').replace(/"/g, '""')}"`,
      `"${(p.address || '').replace(/"/g, '""')}"`,
      `"${(p.phone || '').replace(/"/g, '""')}"`,
      p.rating != null ? p.rating : '',
      p.totalRatings || 0,
      p.distanceKm != null ? p.distanceKm : '',
      `"${(p.crmStatus || 'Untapped Prospect').replace(/"/g, '""')}"`,
      `"${(p.mapsUrl || '').replace(/"/g, '""')}"`,
      `"${(p.website || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeCity = currentReport.city.replace(/\s+/g, '_');
    link.download = `${safeCity}_${currentReport.category}_Market_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Market report CSV downloaded successfully!');
  };

  // ── Handler: Print Report ──────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // ── Handler: Navigate to Field Marketing to Log Visit ─────────────────────
  const handleLogVisitPrefill = (place) => {
    // Store prefill target in localStorage for FieldMarketing page to pick up
    localStorage.setItem(
      'univo_prefill_visit',
      JSON.stringify({
        businessName: place.name,
        address: place.address,
        phone: place.phone,
        city: currentReport.city,
        placeId: place.placeId,
        placeName: place.name,
        placeAddress: place.address,
        placeLat: place.lat,
        placeLng: place.lng,
      })
    );
    navigate('/marketing');
  };

  // ── Filtered Places ────────────────────────────────────────────────────────
  const filteredPlaces = useMemo(() => {
    if (!currentReport || !currentReport.places) return [];

    return currentReport.places.filter((p) => {
      // 1. Text Search
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase().trim();
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesArea = p.locality?.toLowerCase().includes(q);
        const matchesAddr = p.address?.toLowerCase().includes(q);
        const matchesPhone = p.phone?.toLowerCase().includes(q);
        if (!matchesName && !matchesArea && !matchesAddr && !matchesPhone) return false;
      }

      // 2. Area Filter
      if (filterArea !== 'All' && p.locality !== filterArea) {
        return false;
      }

      // 3. CRM Status Filter
      if (filterCrmStatus === 'Untapped' && p.isCoveredInCrm) {
        return false;
      }
      if (filterCrmStatus === 'Visited' && !p.isCoveredInCrm) {
        return false;
      }

      // 4. Phone Filter
      if (filterHasPhoneOnly && !p.hasPhone) {
        return false;
      }

      return true;
    });
  }, [currentReport, filterSearch, filterArea, filterCrmStatus, filterHasPhoneOnly]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Market Research & City Intelligence"
        subtitle="Deep scan any city (Indore, Gwalior, Kota, etc.) to discover libraries, gyms, contact numbers, and market share."
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <History size={14} className="text-slate-500" />
            <span>Saved Reports ({savedReports.length})</span>
          </button>
        </div>
      </PageHeader>

      {/* 2. Control Panel & State/City Selector Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-5 space-y-4">
        {/* Step 1: Select State */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black flex items-center justify-center">1</span>
              Target State
            </span>
            <span className="text-[11px] font-normal text-slate-400">Select state first</span>
          </label>

          {/* Quick State Chips */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            {Object.keys(INDIA_STATES_AND_CITIES).slice(0, 10).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleStateChange(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedState === st
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Full State Select Dropdown */}
          <div className="relative">
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.keys(INDIA_STATES_AND_CITIES).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 2: Select City / District */}
        <div className="pt-3 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-black flex items-center justify-center">2</span>
              Target City / District in {selectedState}
            </span>
            <span className="text-[11px] font-normal text-slate-400">Click a city chip or type below</span>
          </label>

          {/* Dynamic City Chips for selected state (Top primary hubs) */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            {(INDIA_STATES_AND_CITIES[selectedState] || []).slice(0, 14).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCityInput(c)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  cityInput.toLowerCase() === c.toLowerCase()
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              list="city-suggestions"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder={`e.g. ${INDIA_STATES_AND_CITIES[selectedState]?.[0] || 'Indore'} or any district in ${selectedState}...`}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <datalist id="city-suggestions">
              {(INDIA_STATES_AND_CITIES[selectedState] || []).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {cityInput.toLowerCase().includes('indore') && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 shrink-0">
                ⚡ Indore Metro Corridors:
              </span>
              <button
                type="button"
                onClick={() => setCityInput('Indore')}
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition shadow-2xs"
              >
                🌐 Full Metro (Indore + MR-10 + Aurobindo + Lavkush + Pithampur)
              </button>
              <button
                type="button"
                onClick={() => setCityInput('Pithampur')}
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition shadow-2xs"
              >
                🏭 Pithampur Sector 1, 2, 3
              </button>
              <button
                type="button"
                onClick={() => setCityInput('MR 10 Indore')}
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition shadow-2xs"
              >
                🛣️ MR-10 & Aurobindo Corridor
              </button>
              <button
                type="button"
                onClick={() => setCityInput('Lavkush Indore')}
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition shadow-2xs"
              >
                📍 Lavkush & Super Corridor
              </button>
              <button
                type="button"
                onClick={() => setCityInput('Bhanwarkuan Indore')}
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition shadow-2xs"
              >
                🎓 Bhawar Kuan Student Core
              </button>
            </div>
          )}
        </div>

        {/* Category & Scan Depth Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 size={13} className="text-blue-600" />
              Vertical / Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(CATEGORY_CONFIGS).map(([k, cfg]) => (
                <option key={k} value={k}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Query Input (if selected) */}
          {selectedCategory === 'custom' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Search size={13} className="text-blue-600" />
                Custom Search Query
              </label>
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="e.g. Badminton Academy, Dance Studio..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers size={13} className="text-blue-600" />
                  Coverage Scan Mode
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  ⚡ 101% Deepest Sweep
                </span>
              </label>
              <select
                value={scanDepth}
                onChange={(e) => setScanDepth(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="exhaustive">💯 101% Deepest Multi-Area Sweep (All Colonies, Sectors & Hubs - Patient Scan)</option>
                <option value="standard">🎯 Standard Multi-Area Scan (~60-100 places)</option>
                <option value="quick">⚡ Quick Scan (~30-50 places / Core zone)</option>
              </select>
            </div>
          )}

          {/* Execute Button */}
          <div className="flex items-end">
            <button
              onClick={handleStartScan}
              disabled={isScanning}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isScanning ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Researching...</span>
                </>
              ) : (
                <>
                  <Compass size={15} />
                  <span>Start Market Research</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scanning Progress Bar */}
        {isScanning && (
          <div className="pt-3 border-t border-slate-100 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5 text-blue-600">
                <Sparkles size={14} className="animate-spin" />
                {scanProgress.message || 'Scanning Google Places API...'}
              </span>
              <span>{scanProgress.percent || 30}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${scanProgress.percent || 30}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Generated Report Dashboard */}
      {currentReport ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Report Top Meta & Export Bar */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {currentReport.categoryLabel || 'Market Report'}
                </span>
                <span className="text-xs text-slate-400">
                  Generated: {new Date(currentReport.generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mt-1">
                {currentReport.title}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentReport.fullCityName || currentReport.city} • Radius ~25 KM coverage
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  syncMutation.mutate({
                    city: currentReport.city,
                    state: currentReport.state,
                    category: currentReport.category,
                    places: currentReport.places,
                    staffId: user?.uid || user?.id,
                    staffName: user?.displayName || user?.name || 'Admin',
                  });
                }}
                disabled={syncMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                title="Send or Sync this city's places to Field Marketing Targets (Preserves existing visits, adds newly opened places)"
              >
                <Send size={14} className={syncMutation.isPending ? 'animate-bounce' : ''} />
                <span>
                  {syncMutation.isPending
                    ? 'Syncing Targets...'
                    : syncStatusData?.city === currentReport.city
                    ? '✅ Synced to Field Team'
                    : '🚀 Send / Sync to Field Team'}
                </span>
              </button>

              {!isReportSaved ? (
                <button
                  onClick={() => saveMutation.mutate(currentReport)}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                >
                  <BookmarkPlus size={14} />
                  <span>{saveMutation.isPending ? 'Saving...' : 'Save to History'}</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                  <CheckCircle2 size={13} />
                  <span>Saved in History</span>
                </span>
              )}

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/10 shadow-sm"
              >
                <Download size={14} />
                <span>Export CSV ({filteredPlaces.length})</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/10 shadow-sm"
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* 4 Executive Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Discovered"
              value={currentReport.totalCount}
              subtitle={`Total ${currentReport.category === 'gym' ? 'Gyms' : 'Libraries'} in ${currentReport.city}`}
              icon={Building2}
              trend={`${currentReport.areaBreakdown?.length || 0} Areas Identified`}
              trendPositive={true}
            />
            <StatCard
              title="Verified Phone Contacts"
              value={`${currentReport.withPhoneCount} (${currentReport.phonePercentage}%)`}
              subtitle="Direct phone numbers available"
              icon={Phone}
              trend="Ready for Tele-Calling"
              trendPositive={true}
            />
            <StatCard
              title="Top Rated (4.5★+)"
              value={currentReport.topRatedCount}
              subtitle={`Avg City Rating: ${currentReport.avgRating}★ (${currentReport.totalReviews.toLocaleString()} reviews)`}
              icon={Star}
              trend="Premium client prospects"
              trendPositive={true}
            />
            <StatCard
              title="Untapped Sales Opportunity"
              value={`${currentReport.untappedCount} (${currentReport.untappedPercentage}%)`}
              subtitle={`${currentReport.alreadyVisitedCount} already visited / in CRM`}
              icon={Target}
              trend="Immediate field expansion"
              trendPositive={true}
            />
          </div>

          {/* Locality & Area Heatmap Distribution */}
          {currentReport.areaBreakdown && currentReport.areaBreakdown.length > 0 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin size={14} className="text-blue-600" />
                  Area & Locality Breakdown in {currentReport.city}
                </h3>
                <span className="text-[11px] text-slate-400">Click an area to filter list below</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterArea('All')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    filterArea === 'All'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>All Areas</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {currentReport.totalCount}
                  </span>
                </button>

                {currentReport.areaBreakdown.slice(0, 15).map((ab) => (
                  <button
                    key={ab.area}
                    onClick={() => setFilterArea(filterArea === ab.area ? 'All' : ab.area)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                      filterArea === ab.area
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{ab.area}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        filterArea === ab.area ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {ab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results List Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex-1 max-w-md">
                <SearchBar
                  value={filterSearch}
                  onChange={setFilterSearch}
                  placeholder="Search by name, area, phone, or address..."
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Lead Status Filter */}
                <select
                  value={filterCrmStatus}
                  onChange={(e) => setFilterCrmStatus(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Lead Statuses</option>
                  <option value="Untapped">🔥 Untapped Prospects Only</option>
                  <option value="Visited">✅ Already in CRM / Visited</option>
                </select>

                {/* Has Phone Toggle */}
                <button
                  type="button"
                  onClick={() => setFilterHasPhoneOnly(!filterHasPhoneOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                    filterHasPhoneOnly
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Phone size={12} className={filterHasPhoneOnly ? 'text-emerald-600' : 'text-slate-400'} />
                  <span>Has Phone Number</span>
                </button>

                <div className="text-xs font-bold text-slate-500 pl-2">
                  Showing {filteredPlaces.length} of {currentReport.totalCount}
                </div>
              </div>
            </div>

            {/* Places Table */}
            {filteredPlaces.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching places found"
                description="Try loosening your search keywords or resetting area and status filters."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Business & Locality</th>
                      <th className="py-3 px-4">Rating & Reviews</th>
                      <th className="py-3 px-4">Contact & Phone</th>
                      <th className="py-3 px-4">Lead Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPlaces.map((place, idx) => (
                      <tr key={place.placeId || idx} className="hover:bg-slate-50/80 transition group">
                        <td className="py-3 px-4 font-bold text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Name & Address */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-extrabold text-slate-900 group-hover:text-blue-600 transition truncate text-sm">
                            {place.name}
                          </div>
                          <div className="text-slate-500 text-[11px] line-clamp-1 mt-0.5">
                            {place.address}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.2 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px]">
                              📍 {place.locality}
                            </span>
                            {place.distanceKm != null && (
                              <span className="text-[10px] text-slate-400">
                                {place.distanceKm} km from center
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Rating */}
                        <td className="py-3 px-4">
                          {place.rating != null ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 font-bold text-slate-800">
                                <Star size={13} className="fill-amber-400 text-amber-400" />
                                <span>{place.rating}</span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                ({place.totalRatings.toLocaleString()} reviews)
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No ratings</span>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-4">
                          {place.phone ? (
                            <div className="space-y-1">
                              <span className="font-mono text-xs font-semibold text-slate-900 block">
                                {place.phone}
                              </span>
                              <div className="flex items-center gap-2">
                                <a
                                  href={`tel:${place.phone}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                                >
                                  <Phone size={11} /> Call
                                </a>
                                <a
                                  href={`https://wa.me/91${place.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800"
                                >
                                  <MessageCircle size={11} /> WhatsApp
                                </a>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">No phone listed</span>
                          )}
                        </td>

                        {/* CRM Status */}
                        <td className="py-3 px-4">
                          {place.isCoveredInCrm ? (
                            <div className="space-y-0.5">
                              <Badge variant="info">
                                <CheckCircle2 size={10} className="mr-1" />
                                {place.crmStatus || 'Already Visited'}
                              </Badge>
                              {place.visitedByStaff && (
                                <span className="block text-[10px] text-slate-400">
                                  by {place.visitedByStaff}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge variant="success">
                              🔥 Untapped Prospect
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {place.mapsUrl && (
                              <a
                                href={place.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition"
                                title="Open in Google Maps"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                            <button
                              onClick={() => handleLogVisitPrefill(place)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-bold text-[11px] transition shadow-xs"
                              title="Assign/Log Visit"
                            >
                              Log Visit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty / Initial State */
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <Compass size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900">
              Ready to Explore Market Potential
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Select or type any target city above (e.g. <b>Indore</b>, <b>Gwalior</b>, <b>Kota</b>) and choose whether you want to scan for Libraries, Gyms, or Coaching to generate an executive intelligence report.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleStartScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <Compass size={15} />
              <span>Research {cityInput || 'Indore'} Now</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Saved Reports History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Saved City Market Intelligence Reports"
      >
        <div className="space-y-4">
          {savedReports.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No saved reports yet. Generate a scan and click "Save to History" to view reports anytime without calling Google APIs.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {savedReports.map((rep) => (
                <div key={rep.id} className="py-3 flex items-center justify-between gap-3 group">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{rep.title}</span>
                      <span className="px-2 py-0.2 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px]">
                        {rep.totalCount} Places
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {rep.fullCityName || rep.city} • Saved on{' '}
                      {new Date(rep.createdAt || rep.generatedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleLoadSavedReport(rep)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowRight size={12} />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(rep.id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition"
                      title="Delete Report"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
