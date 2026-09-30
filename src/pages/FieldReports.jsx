import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getFieldVisits, getAttendanceLogs, getSearchAudits } from '../firebase/services/marketingService';
import { getStaffUsers, calculateStaffPayroll } from '../firebase/services/staffService';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { SearchBar } from '../components/ui/SearchBar';
import {
  evaluateVisitAuthenticity,
  getVisitDurationMinutes,
  formatDurationMinutes,
  formatDisplayTime,
  formatEntryTimestamp,
  evaluateSyncDelay,
  calculateStaffDailyDistanceKm,
} from '../services/visitAuditHelper';
import {
  ClipboardList,
  MapPin,
  Calendar,
  Clock,
  User,
  Users,
  Award,
  CheckCircle2,
  AlertCircle,
  Camera,
  Phone,
  MessageCircle,
  Download,
  Filter,
  Eye,
  Flame,
  Zap,
  Building2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Crown,
  ShieldCheck,
  ShieldAlert,
  Layers,
  ArrowRight,
  CalendarDays,
  Target,
  BarChart3,
  PhoneCall,
  BellRing,
  Send,
  Search,
  Globe,
  FileSpreadsheet,
  Compass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCompetitorExpiringLeads } from '../services/salesBoosterHelper';

export const FieldReports = () => {
  const { user } = useAuth();
  const isSuperAdmin = !user?.role || user.role === 'super_admin' || user.role === 'owner';

  // Active Tab: 'daily_analytics' | 'pipeline_competitor' | 'audit_log' | 'api_search_history'
  const [activeTab, setActiveTab] = useState('daily_analytics');

  // Filters for Audit Log & Reports
  const [dateRange, setDateRange] = useState('all'); // all, today, yesterday, week, month, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Filters for Google API Search History
  const [apiSearchDateRange, setApiSearchDateRange] = useState('all');
  const [apiSearchStaff, setApiSearchStaff] = useState('All');
  const [apiSearchCategory, setApiSearchCategory] = useState('All');
  const [apiSearchQuery, setApiSearchQuery] = useState('');

  // 1. Fetch Visits
  const { data: visits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ['admin_field_visits'],
    queryFn: getFieldVisits,
  });

  // 2. Fetch Staff
  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['admin_staff_users'],
    queryFn: getStaffUsers,
  });

  // 3. Fetch Attendance Logs
  const { data: attendanceLogs = [], isLoading: loadingAtt } = useQuery({
    queryKey: ['admin_attendance_logs'],
    queryFn: getAttendanceLogs,
  });

  // 4. Fetch Google API Search Audits
  const { data: searchAudits = [], isLoading: loadingSearchAudits } = useQuery({
    queryKey: ['admin_search_audits'],
    queryFn: getSearchAudits,
  });

  // ── Date Formatting Helpers ────────────────────────────────────────────────
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
          roleLabel: isAdmin ? '👑 Administrator / Owner' : 'Field Rep',
          isAdmin: isAdmin,
        });
      }
    });

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

  // ── Filter Visits by Date, Staff, Status, Search ───────────────────────────
  const filteredVisits = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    return visits.filter((v) => {
      // 1. Non-admin visibility restriction
      if (!isSuperAdmin) {
        const myId = user?.uid || user?.id;
        const myName = (user?.displayName || user?.name || '').toLowerCase();
        const isMine = v.staffId === myId || (v.staffName && v.staffName.toLowerCase() === myName);
        if (!isMine) return false;
      }

      // 2. Staff filter
      if (selectedStaff !== 'All') {
        const staffObj = allStaffAndAdmins.find((s) => s.id === selectedStaff);
        const matchStaff =
          v.staffId === selectedStaff ||
          (staffObj && (v.staffName || '').toLowerCase() === (staffObj.name || '').toLowerCase()) ||
          (v.staffName || '').toLowerCase() === selectedStaff.toLowerCase();
        if (!matchStaff) return false;
      }

      // 3. Status filter
      if (statusFilter !== 'All' && v.status !== statusFilter) {
        return false;
      }

      // 4. Date range filter
      if (dateRange === 'today') {
        if (!(v.createdAt || '').startsWith(todayStr)) return false;
      } else if (dateRange === 'yesterday') {
        if (!(v.createdAt || '').startsWith(yesterdayStr)) return false;
      } else if (dateRange === 'week') {
        if ((v.createdAt || '') < weekAgo) return false;
      } else if (dateRange === 'month') {
        if ((v.createdAt || '') < monthStart) return false;
      } else if (dateRange === 'custom') {
        if (customStartDate && (v.createdAt || '').substring(0, 10) < customStartDate) return false;
        if (customEndDate && (v.createdAt || '').substring(0, 10) > customEndDate) return false;
      }

      // 5. Search text filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (v.businessName || '').toLowerCase().includes(q) ||
          (v.ownerName || '').toLowerCase().includes(q) ||
          (v.staffName || '').toLowerCase().includes(q) ||
          (v.city || '').toLowerCase().includes(q) ||
          (v.phone || '').toLowerCase().includes(q) ||
          (v.discussionNotes || '').toLowerCase().includes(q) ||
          (v.status || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [visits, isSuperAdmin, selectedStaff, statusFilter, dateRange, customStartDate, customEndDate, search, user, allStaffAndAdmins]);

  // ── High-Level Overall Statistics ──────────────────────────────────────────
  const reportStats = useMemo(() => {
    const totalVisits = filteredVisits.length;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const todayVisits = filteredVisits.filter((v) => (v.createdAt || '').startsWith(todayStr)).length;
    const weekVisits = filteredVisits.filter((v) => (v.createdAt || '') >= weekAgo).length;
    const monthVisits = filteredVisits.filter((v) => (v.createdAt || '') >= monthStart).length;

    const dealsClosed = filteredVisits.filter((v) => v.status === 'Deal Closed').length;
    const demosGiven = filteredVisits.filter((v) => v.demoGiven).length;
    const followUps = filteredVisits.filter((v) => v.status === 'Follow Up').length;
    const withGps = filteredVisits.filter((v) => v.location && v.location.latitude).length;
    const withPhoto = filteredVisits.filter((v) => v.photoUrl).length;

    // Distinct staff active in filtered set
    const activeStaffSet = new Set(filteredVisits.map((v) => v.staffName || v.staffId).filter(Boolean));

    const totalGroundMins = filteredVisits.reduce((acc, v) => acc + getVisitDurationMinutes(v), 0);

    return {
      totalVisits,
      todayVisits,
      weekVisits,
      monthVisits,
      dealsClosed,
      demosGiven,
      followUps,
      withGps,
      gpsRate: totalVisits ? Math.round((withGps / totalVisits) * 100) : 0,
      withPhoto,
      photoRate: totalVisits ? Math.round((withPhoto / totalVisits) * 100) : 0,
      activeStaffCount: activeStaffSet.size,
      conversionRate: totalVisits ? Math.round((dealsClosed / totalVisits) * 100) : 0,
      totalGroundMins,
      totalGroundFormatted: formatDurationMinutes(totalGroundMins),
    };
  }, [filteredVisits]);

  // ── DAILY BREAKDOWN: Daily Visits Trend & Operations Report ───────
  const dailyBreakdown = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const map = new Map();

    visits.forEach((v) => {
      const dateStr = (v.createdAt || '').substring(0, 10) || todayStr;
      if (!map.has(dateStr)) {
        map.set(dateStr, {
          date: dateStr,
          totalVisits: 0,
          staffMap: new Map(), // staffName -> count
          demos: 0,
          deals: 0,
          followUps: 0,
          withGps: 0,
          withPhoto: 0,
          totalDurationMins: 0,
          visits: [],
        });
      }

      const d = map.get(dateStr);
      d.totalVisits += 1;
      const sName = v.staffName || 'Staff Rep';
      d.staffMap.set(sName, (d.staffMap.get(sName) || 0) + 1);

      if (v.demoGiven) d.demos += 1;
      if (v.status === 'Deal Closed') d.deals += 1;
      if (v.status === 'Follow Up') d.followUps += 1;
      if (v.location?.latitude) d.withGps += 1;
      if (v.photoUrl) d.withPhoto += 1;
      d.totalDurationMins += getVisitDurationMinutes(v);
      d.visits.push(v);
    });

    const list = Array.from(map.values())
      .map((d) => {
        let label = d.date;
        try {
          const dt = new Date(d.date + 'T00:00:00');
          const dayName = dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
          if (d.date === todayStr) label = `Today, ${dayName}`;
          else if (d.date === yesterdayStr) label = `Yesterday, ${dayName}`;
          else label = dayName;
        } catch {}

        const staffArray = Array.from(d.staffMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        return {
          ...d,
          displayDate: label,
          isToday: d.date === todayStr,
          isYesterday: d.date === yesterdayStr,
          staffArray,
          gpsRate: d.totalVisits ? Math.round((d.withGps / d.totalVisits) * 100) : 0,
          formattedGroundTime: formatDurationMinutes(d.totalDurationMins),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return list;
  }, [visits]);

  // ── Staff Breakdown (Visits logged by staff member) ──────────────────────
  const staffBreakdown = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const staffMap = new Map();

    allStaffAndAdmins.forEach((s) => {
      const isOwnerOrAdmin = s.isAdmin || s.role === 'owner' || s.role === 'super_admin';
      staffMap.set(s.id, {
        id: s.id,
        name: s.name,
        role: s.role,
        roleLabel: s.roleLabel || (isOwnerOrAdmin ? '👑 Administrator / Owner' : 'Field Rep'),
        isAdmin: isOwnerOrAdmin,
        phone: s.phone || '',
        email: s.email || '',
        dailyTargetVisits: Number(s.compensation?.dailyTargetVisits) || 0,
        dailyTargetDeals: Number(s.compensation?.dailyTargetDeals) || 0,
        totalVisits: 0,
        todayVisits: 0,
        todayDeals: 0,
        weekVisits: 0,
        demos: 0,
        deals: 0,
        photos: 0,
        gpsCount: 0,
        totalGroundMins: 0,
        lastVisit: null,
      });
    });

    visits.forEach((v) => {
      let key = v.staffId;
      if (!staffMap.has(key)) {
        const found = allStaffAndAdmins.find(
          (s) => (s.name || '').toLowerCase() === (v.staffName || '').toLowerCase()
        );
        if (found) {
          key = found.id;
        } else {
          const unregKey = `unreg_${v.staffName || 'Unknown'}`;
          if (!staffMap.has(unregKey)) {
            const isAdm =
              (v.staffName || '').toLowerCase().includes('admin') ||
              (v.staffName || '').toLowerCase().includes('owner') ||
              String(v.staffId || '').toLowerCase().includes('admin');
            staffMap.set(unregKey, {
              id: unregKey,
              name: v.staffName || 'Unknown Staff',
              role: isAdm ? 'owner' : 'marketing',
              roleLabel: isAdm ? '👑 Administrator / Owner' : 'Field Rep',
              isAdmin: isAdm,
              phone: '',
              email: '',
              dailyTargetVisits: 0,
              dailyTargetDeals: 0,
              totalVisits: 0,
              todayVisits: 0,
              todayDeals: 0,
              weekVisits: 0,
              demos: 0,
              deals: 0,
              photos: 0,
              gpsCount: 0,
              totalGroundMins: 0,
              lastVisit: null,
            });
          }
          key = unregKey;
        }
      }

      const entry = staffMap.get(key);
      if (entry) {
        entry.totalVisits += 1;
        const isToday = (v.createdAt || '').startsWith(todayStr);
        if (isToday) {
          entry.todayVisits += 1;
          if (v.status === 'Deal Closed') entry.todayDeals += 1;
        }
        if ((v.createdAt || '') >= weekAgo) entry.weekVisits += 1;
        if (v.demoGiven) entry.demos += 1;
        if (v.status === 'Deal Closed') entry.deals += 1;
        if (v.photoUrl) entry.photos += 1;
        if (v.location?.latitude) entry.gpsCount += 1;
        entry.totalGroundMins += getVisitDurationMinutes(v);

        if (!entry.lastVisit || new Date(v.createdAt) > new Date(entry.lastVisit.createdAt)) {
          entry.lastVisit = v;
        }
      }
    });

    return Array.from(staffMap.values())
      .map((entry) => ({
        ...entry,
        todayDistanceKm: calculateStaffDailyDistanceKm(
          entry.id,
          entry.name,
          todayStr,
          visits,
          attendanceLogs
        ),
      }))
      .sort((a, b) => {
        if (b.totalVisits !== a.totalVisits) {
          return b.totalVisits - a.totalVisits;
        }
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [allStaffAndAdmins, visits, attendanceLogs]);

  // ── Pipeline & Competitor Analytics ───────────────────────────────────────
  const pipelineStats = useMemo(() => {
    const statusCounts = {
      'Interested': 0,
      'Demo Given': 0,
      'Follow Up': 0,
      'Deal Closed': 0,
      'Not Interested': 0,
    };

    const competitorCounts = {};
    const softwareTypeCounts = {
      'Manual Register': 0,
      'Competitor Software': 0,
      'Excel / Sheets': 0,
      'No System': 0,
      'Other': 0,
    };

    visits.forEach((v) => {
      if (statusCounts[v.status] !== undefined) {
        statusCounts[v.status] += 1;
      }
      if (v.competitorName) {
        const cName = v.competitorName.trim();
        competitorCounts[cName] = (competitorCounts[cName] || 0) + 1;
      }
      const st = v.currentSoftwareType || 'Manual Register';
      if (softwareTypeCounts[st] !== undefined) {
        softwareTypeCounts[st] += 1;
      } else {
        softwareTypeCounts['Other'] += 1;
      }
    });

    return {
      statusCounts,
      competitorCounts: Object.entries(competitorCounts).sort((a, b) => b[1] - a[1]),
      softwareTypeCounts,
    };
  }, [visits]);

  // ── Competitor Expiring Radar ─────────────────────────────────────────────
  const expiringCompetitors = useMemo(() => {
    return getCompetitorExpiringLeads(visits, 35);
  }, [visits]);

  // ── CSV Export Function ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (filteredVisits.length === 0) {
      toast.error('No records to export in the selected filter.');
      return;
    }

    const headers = [
      'Visit Date',
      'Visit Time',
      'Staff Name',
      'Business / Library Name',
      'Category',
      'Owner / Met Person',
      'Phone Number',
      'Alt WhatsApp',
      'City',
      'State',
      'Address',
      'Lead Status',
      'Priority',
      'Live Demo Given',
      'Current Software',
      'Competitor Name',
      'Follow-Up Date',
      'Follow-Up Time',
      'Next Agenda',
      'Discussion Notes',
      'GPS Lat',
      'GPS Lng',
      'Google Maps Link',
      'Photo Attached',
    ];

    const rows = filteredVisits.map((v) => {
      const dt = formatDateTime(v.createdAt);
      return [
        `"${dt.date}"`,
        `"${dt.time}"`,
        `"${v.staffName || ''}"`,
        `"${(v.businessName || '').replace(/"/g, '""')}"`,
        `"${v.clientType || 'Library'}"`,
        `"${v.ownerName || v.contactPersonName || ''}"`,
        `"${v.phone || ''}"`,
        `"${v.secondaryPhone || ''}"`,
        `"${v.city || ''}"`,
        `"${v.state || ''}"`,
        `"${(v.address || '').replace(/"/g, '""')}"`,
        `"${v.status || ''}"`,
        `"${v.leadPriority || ''}"`,
        `"${v.demoGiven ? 'Yes' : 'No'}"`,
        `"${v.currentSoftwareType || ''}"`,
        `"${v.competitorName || ''}"`,
        `"${v.followUpDate || ''}"`,
        `"${v.followUpTime || ''}"`,
        `"${(v.nextActionItem || '').replace(/"/g, '""')}"`,
        `"${(v.discussionNotes || '').replace(/"/g, '""')}"`,
        `"${v.location?.latitude || ''}"`,
        `"${v.location?.longitude || ''}"`,
        `"${v.location?.mapsUrl || ''}"`,
        `"${v.photoUrl ? 'Yes' : 'No'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `field_marketing_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Field Report CSV exported successfully!');
  };

  // ── Google API Search Audit Filtering & Analytics ─────────────────────────
  const filteredSearchAudits = useMemo(() => {
    return searchAudits.filter((item) => {
      // 1. Staff Filter
      if (apiSearchStaff !== 'All') {
        const staffMatch =
          item.staffId === apiSearchStaff ||
          (item.staffName && item.staffName.toLowerCase() === apiSearchStaff.toLowerCase());
        if (!staffMatch) return false;
      }

      // 2. Category Filter
      if (apiSearchCategory !== 'All' && item.category !== apiSearchCategory) {
        return false;
      }

      // 3. Date Range Filter
      if (apiSearchDateRange !== 'all') {
        const itemDate = item.createdAt ? item.createdAt.split('T')[0] : '';
        const today = new Date().toISOString().split('T')[0];
        if (apiSearchDateRange === 'today' && itemDate !== today) return false;
        if (apiSearchDateRange === 'yesterday') {
          const yest = new Date();
          yest.setDate(yest.getDate() - 1);
          const yestStr = yest.toISOString().split('T')[0];
          if (itemDate !== yestStr) return false;
        }
        if (apiSearchDateRange === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weekAgoStr = weekAgo.toISOString().split('T')[0];
          if (itemDate < weekAgoStr) return false;
        }
      }

      // 4. Keyword Search
      if (apiSearchQuery.trim()) {
        const q = apiSearchQuery.toLowerCase();
        const queryText = (item.query || '').toLowerCase();
        const staffText = (item.staffName || '').toLowerCase();
        const locText = (item.location?.locationName || '').toLowerCase();
        if (!queryText.includes(q) && !staffText.includes(q) && !locText.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [searchAudits, apiSearchStaff, apiSearchCategory, apiSearchDateRange, apiSearchQuery]);

  const searchAuditsTodayCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return searchAudits.filter((a) => a.createdAt && a.createdAt.split('T')[0] === today).length;
  }, [searchAudits]);

  const totalPlacesDiscovered = useMemo(() => {
    return filteredSearchAudits.reduce((acc, curr) => acc + (Number(curr.resultsCount) || 0), 0);
  }, [filteredSearchAudits]);

  const totalEstimatedGrossCost = useMemo(() => {
    return filteredSearchAudits
      .reduce((acc, curr) => acc + (Number(curr.estimatedGrossInr) || 0), 0)
      .toFixed(2);
  }, [filteredSearchAudits]);

  const mostActiveSearchRep = useMemo(() => {
    if (filteredSearchAudits.length === 0) return { name: 'None', count: 0 };
    const counts = {};
    filteredSearchAudits.forEach((a) => {
      const name = a.staffName || 'Staff';
      counts[name] = (counts[name] || 0) + 1;
    });
    let topName = 'None';
    let max = 0;
    Object.entries(counts).forEach(([name, c]) => {
      if (c > max) {
        max = c;
        topName = name;
      }
    });
    return { name: topName, count: max };
  }, [filteredSearchAudits]);

  const exportSearchAuditsToCSV = () => {
    if (filteredSearchAudits.length === 0) {
      toast.error('No search audit records to export');
      return;
    }

    const headers = [
      'Date',
      'Time',
      'Staff Name',
      'Staff Role',
      'Search Query',
      'Category',
      'Radius (km)',
      'Limit Requested',
      'Places Found',
      'Staff Location Name',
      'Staff Latitude',
      'Staff Longitude',
      'Google Maps URL',
      'Pages Fetched',
      'Estimated Gross Cost (INR)',
      'Net Billed',
    ];

    const rows = filteredSearchAudits.map((item) => {
      const dt = formatDateTime(item.createdAt);
      const lat = item.location?.latitude || '';
      const lng = item.location?.longitude || '';
      const mapsLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '';
      const rKm = item.radiusKm != null ? (Number(item.radiusKm) >= 1000 ? Math.round(Number(item.radiusKm) / 1000) : Number(item.radiusKm)) : null;
      return [
        `"${dt.date}"`,
        `"${dt.time}"`,
        `"${item.staffName || ''}"`,
        `"${item.staffRole || ''}"`,
        `"${(item.query || '').replace(/"/g, '""')}"`,
        `"${item.category || ''}"`,
        `"${rKm != null ? `${rKm} km radius` : 'All Distance'}"`,
        `"${item.limitCount != null ? `Max ${item.limitCount}` : 'All Results'}"`,
        `"${item.resultsCount || 0}"`,
        `"${(item.location?.locationName || 'Live Location').replace(/\s*\(Default Location\)/gi, '').replace(/"/g, '""')}"`,
        `"${lat}"`,
        `"${lng}"`,
        `"${mapsLink}"`,
        `"${item.pagesCount || 1}"`,
        `"${item.estimatedGrossInr || 0}"`,
        `"Rs. 0.00 (Free Tier)"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Google_API_Search_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Search Audit Log exported to CSV!');
  };

  const getStatusBadgeVariant = (st) => {
    switch (st) {
      case 'Deal Closed':
        return 'success';
      case 'Demo Given':
        return 'info';
      case 'Follow Up':
        return 'warning';
      case 'Interested':
        return 'purple';
      case 'Not Interested':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  if (loadingVisits || loadingStaff || loadingAtt) {
    return <LoadingSpinner fullScreen label="Compiling Field Sales & Marketing Reports..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Sales & Visits Reports"
        subtitle="Executive Dashboard: Daily visit metrics, staff productivity, lead conversion pipeline, and on-ground client intelligence."
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/attendance"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              title="View Staff Duty & Hours Tracking"
            >
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Staff Duty & Hours</span>
            </Link>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {/* ═══ View Mode Tabs ═══ */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 w-full sm:w-fit overflow-x-auto shadow-2xs">
        <button
          onClick={() => setActiveTab('daily_analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'daily_analytics'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <CalendarDays size={16} />
          <span>📊 Daily Activity & Staff Performance</span>
        </button>

        <button
          onClick={() => setActiveTab('pipeline_competitor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'pipeline_competitor'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Target size={16} />
          <span>🎯 Lead Pipeline & Competitor Analysis</span>
        </button>

        <button
          onClick={() => setActiveTab('audit_log')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'audit_log'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <ClipboardList size={16} />
          <span>📋 All Field Visits Audit Log</span>
        </button>

        <button
          onClick={() => setActiveTab('api_search_history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'api_search_history'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Search size={16} />
          <span>🔍 Google API Search History</span>
          {searchAudits.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'api_search_history' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-800'
            }`}>
              {searchAudits.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ═══ TAB 1: DAILY ACTIVITY & STAFF WORK REPORTS ═══                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'daily_analytics' && (
        <div className="space-y-6">
          {/* Top Key KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Field Visits"
              value={reportStats.totalVisits}
              subtitle={`${reportStats.todayVisits} today • ${reportStats.weekVisits} this week`}
              icon={Building2}
              color="blue"
            />
            <StatCard
              title="Deals Won / Closed"
              value={reportStats.dealsClosed}
              subtitle={`${reportStats.conversionRate}% overall conversion rate`}
              icon={CheckCircle2}
              color="emerald"
              trend={`${reportStats.demosGiven} Demos Given`}
              trendPositive={true}
            />
            <StatCard
              title="Active Field Reps"
              value={reportStats.activeStaffCount}
              subtitle="Staff & Admins logging visits"
              icon={Users}
              color="indigo"
            />
            <StatCard
              title="Ground Time with Clients"
              value={reportStats.totalGroundFormatted}
              subtitle={`${reportStats.gpsRate}% Verified with Device GPS`}
              icon={Clock}
              color="amber"
            />
          </div>

          {/* ═══ SUB-SECTION 1: DAY-BY-DAY VISITS BREAKDOWN ═══ */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    📅 Daily Visits Trend & Operational Activity Report
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Day-by-day audit: Total visits logged, active staff members, demos given, and closed deals
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                Last {dailyBreakdown.length} Active Days Tracked
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-4 py-3.5 text-center">Visits Logged</th>
                    <th className="px-5 py-3.5">Staff Active on Field (Visits by Staff)</th>
                    <th className="px-4 py-3.5 text-center">Demos Given</th>
                    <th className="px-4 py-3.5 text-center">Deals Won</th>
                    <th className="px-4 py-3.5 text-center">Ground Time</th>
                    <th className="px-4 py-3.5 text-center">GPS Rate</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyBreakdown.length > 0 ? (
                    dailyBreakdown.slice(0, 15).map((day) => (
                      <tr key={day.date} className="hover:bg-slate-50/80 transition">
                        {/* Date Column */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                              {day.displayDate}
                            </span>
                            {day.isToday && (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                                Today
                              </span>
                            )}
                            {day.isYesterday && (
                              <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                Yesterday
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{day.date}</span>
                        </td>

                        {/* Total Visits Count */}
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-8 h-8 px-2.5 rounded-xl font-black text-sm bg-blue-50 text-blue-700 border border-blue-200">
                            {day.totalVisits}
                          </span>
                        </td>

                        {/* Staff Active & Counts */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                            {day.staffArray.map((s, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200"
                              >
                                <span>{s.name}</span>
                                <strong className="text-blue-600 bg-white px-1.5 py-0.2 rounded-md shadow-2xs">
                                  {s.count}
                                </strong>
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Demos */}
                        <td className="px-4 py-4 text-center">
                          <span className={`font-bold ${day.demos > 0 ? 'text-indigo-600 font-extrabold' : 'text-slate-400'}`}>
                            {day.demos > 0 ? `💻 ${day.demos}` : '-'}
                          </span>
                        </td>

                        {/* Deals Won */}
                        <td className="px-4 py-4 text-center">
                          <span className={`font-black ${day.deals > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {day.deals > 0 ? `🎉 ${day.deals}` : '-'}
                          </span>
                        </td>

                        {/* Ground Time */}
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <span className="font-extrabold text-blue-700 text-xs">
                            ⏱️ {day.formattedGroundTime}
                          </span>
                        </td>

                        {/* GPS Rate */}
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`font-bold text-[11px] px-2 py-0.5 rounded-md ${
                              day.gpsRate >= 80
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {day.gpsRate}%
                          </span>
                        </td>

                        {/* Action: Quick Filter */}
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setDateRange('custom');
                              setCustomStartDate(day.date);
                              setCustomEndDate(day.date);
                              setActiveTab('audit_log');
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>View All {day.totalVisits}</span>
                            <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No field visits recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ SUB-SECTION 2: STAFF PERFORMANCE LEADERBOARD ═══ */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Award size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    🏆 Staff Performance & Entry Breakdown Leaderboard
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Track visit volumes, demos given, deals closed, GPS verification rate, and on-site duration
                  </p>
                </div>
              </div>
              {selectedStaff !== 'All' && (
                <button
                  onClick={() => setSelectedStaff('All')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition self-start sm:self-auto cursor-pointer"
                >
                  Filtered: {staffBreakdown.find((s) => s.id === selectedStaff)?.name || selectedStaff} (Clear)
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="px-5 py-3.5">Staff Rep</th>
                    <th className="px-4 py-3.5 text-center">Today's Visits & Target</th>
                    <th className="px-4 py-3.5 text-center">Today's Deals</th>
                    <th className="px-4 py-3.5 text-center">Today's Distance</th>
                    <th className="px-4 py-3.5 text-center">Total Visits</th>
                    <th className="px-4 py-3.5 text-center">This Week</th>
                    <th className="px-4 py-3.5 text-center">Demos</th>
                    <th className="px-4 py-3.5 text-center">Total Deals</th>
                    <th className="px-4 py-3.5 text-center">Ground Time</th>
                    <th className="px-4 py-3.5 text-center">GPS %</th>
                    <th className="px-5 py-3.5">Last Visit Entry Logged</th>
                    <th className="px-4 py-3.5 text-right">Filter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffBreakdown.length > 0 ? (
                    staffBreakdown.map((s) => {
                      const isSelected = selectedStaff === s.id;
                      const gpsRate = s.totalVisits ? Math.round((s.gpsCount / s.totalVisits) * 100) : 0;
                      const lastDt = s.lastVisit ? formatDateTime(s.lastVisit.createdAt) : null;

                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-blue-50/50' : ''}`}
                        >
                          <td className="px-5 py-3.5 font-medium">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                                  s.isAdmin
                                    ? 'bg-gradient-to-tr from-amber-600 to-yellow-500 text-white border border-amber-300'
                                    : 'bg-gradient-to-tr from-slate-800 to-blue-700 text-white'
                                }`}
                              >
                                {s.isAdmin ? <Crown size={15} /> : s.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 block">{s.name}</span>
                                  {s.isAdmin && (
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded">
                                      Owner / Admin
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 block">{s.roleLabel}</span>
                              </div>
                            </div>
                          </td>

                          {/* Today's Visits & Daily Target */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full font-black text-xs ${
                                s.todayVisits > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {s.todayVisits} {s.dailyTargetVisits > 0 ? `/ ${s.dailyTargetVisits}` : ''}
                              </span>
                              {s.dailyTargetVisits > 0 && (
                                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${
                                  s.todayVisits >= s.dailyTargetVisits
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {s.todayVisits >= s.dailyTargetVisits ? 'Goal Met ✓' : `${Math.round((s.todayVisits / s.dailyTargetVisits) * 100)}% Done`}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Today's Deals */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`font-black text-xs ${s.todayDeals > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {s.todayDeals} {s.dailyTargetDeals > 0 ? `/ ${s.dailyTargetDeals}` : ''}
                              </span>
                              {s.dailyTargetDeals > 0 && (
                                <span className="text-[10px] font-bold text-slate-500">
                                  {s.todayDeals >= s.dailyTargetDeals ? '✓ Target Hit' : `${Math.round((s.todayDeals / s.dailyTargetDeals) * 100)}%`}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Today's Distance (KM) */}
                          <td className="px-4 py-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full font-black text-xs inline-flex items-center gap-1 ${
                              s.todayDistanceKm > 0
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              <span>🏍️</span>
                              <span>{s.todayDistanceKm} KM</span>
                            </span>
                          </td>

                          {/* Total Visits */}
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-black text-slate-900 text-sm">{s.totalVisits}</span>
                          </td>

                          {/* This Week */}
                          <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                            {s.weekVisits}
                          </td>

                          {/* Demos Given */}
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-700">
                            {s.demos > 0 ? `💻 ${s.demos}` : '-'}
                          </td>

                          {/* Total Deals Won */}
                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-black ${s.deals > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {s.deals > 0 ? `🎉 ${s.deals}` : '-'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center font-bold text-blue-700 whitespace-nowrap">
                            ⏱️ {formatDurationMinutes(s.totalGroundMins)}
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-bold text-[11px] ${gpsRate >= 80 ? 'text-emerald-700' : gpsRate >= 50 ? 'text-amber-700' : 'text-slate-400'}`}>
                              {gpsRate}%
                            </span>
                          </td>

                          <td className="px-5 py-3.5 text-slate-600">
                            {lastDt ? (
                              <div>
                                <p className="font-bold text-slate-800 text-[11px] truncate max-w-[180px]">
                                  {s.lastVisit.businessName}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {lastDt.date} at {lastDt.time}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No visits yet</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedStaff(isSelected ? 'All' : s.id);
                                setActiveTab('audit_log');
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'View Logs'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        No staff records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ═══ TAB 2: LEAD PIPELINE & COMPETITOR ANALYSIS ═══                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pipeline_competitor' && (
        <div className="space-y-6">
          {/* Status Distribution Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Interested', count: pipelineStats.statusCounts['Interested'], color: 'purple', icon: Flame },
              { label: 'Demo Given', count: pipelineStats.statusCounts['Demo Given'], color: 'indigo', icon: Zap },
              { label: 'Follow Up', count: pipelineStats.statusCounts['Follow Up'], color: 'amber', icon: Clock },
              { label: 'Deals Won', count: pipelineStats.statusCounts['Deal Closed'], color: 'emerald', icon: CheckCircle2 },
              { label: 'Not Interested', count: pipelineStats.statusCounts['Not Interested'], color: 'rose', icon: AlertCircle },
            ].map((st) => (
              <div key={st.label} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {st.label}
                </span>
                <span className="text-2xl font-black text-slate-900 block mt-1">
                  {st.count || 0}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {visits.length ? `${Math.round(((st.count || 0) / visits.length) * 100)}% of all visits` : '0%'}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Competitor Systems Used by Libraries */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Current Management Systems Used
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400">Market Share</span>
              </div>

              <div className="space-y-3">
                {Object.entries(pipelineStats.softwareTypeCounts).map(([type, count]) => {
                  const pct = visits.length ? Math.round((count / visits.length) * 100) : 0;
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">{type}</span>
                        <span className="text-slate-500">{count} places ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Competitor Brands Encountered */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-rose-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Competitor Software Brands
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400">Tracked</span>
              </div>

              {pipelineStats.competitorCounts.length > 0 ? (
                <div className="space-y-2.5">
                  {pipelineStats.competitorCounts.map(([name, count]) => (
                    <div
                      key={name}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-extrabold text-slate-900 block text-xs">{name}</span>
                        <span className="text-[10px] text-slate-400">Library Management Competitor</span>
                      </div>
                      <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-black text-indigo-700 shadow-2xs">
                        {count} Clients
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No competitor brands noted yet in field visit logs.
                </div>
              )}
            </div>
          </div>

          {/* Competitor Expiry Radar: Hot Switch Targets (35 Days) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Flame size={20} className="text-rose-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Competitor Expiry Radar — Hot Switch Targets ({expiringCompetitors.length})
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Libraries whose current competitor software is expiring within 35 days. Target them now before they renew!
                </p>
              </div>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl w-fit">
                🔥 High Conversion Window
              </span>
            </div>

            {expiringCompetitors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Library / Business</th>
                      <th className="px-4 py-3">Owner Contact</th>
                      <th className="px-4 py-3">Current Software</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3">Urgency Status</th>
                      <th className="px-4 py-3 text-right">Quick Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expiringCompetitors.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3.5">
                          <p className="font-extrabold text-slate-900">{item.businessName}</p>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {item.clientType || 'Library'} • {item.city || 'Local'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-slate-800">{item.ownerName || 'Owner'}</p>
                          <span className="text-[11px] text-slate-500">{item.phone || 'No phone'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                            💻 {item.competitorName || 'Competitor'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-extrabold text-slate-900">{item.competitorExpiryDate}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {item.isUrgent ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full animate-pulse">
                              🚨 {item.daysRemaining} days left!
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              ⏳ {item.daysRemaining} days left
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.phone && (
                              <>
                                <a
                                  href={`tel:${item.phone}`}
                                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1 transition"
                                  title="Call"
                                >
                                  <PhoneCall size={11} /> Call
                                </a>
                                <a
                                  href={`https://wa.me/91${item.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1 transition"
                                  title="WhatsApp"
                                >
                                  <MessageCircle size={11} /> WhatsApp
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                No competitor licenses expiring in the next 35 days found in the system. Log competitor renewal dates during field visits to populate this radar!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ═══ TAB 3: FULL VISITS AUDIT LOG ═══                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit_log' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList size={18} className="text-blue-600" />
                <span>Full Field Visits Activity Log ({filteredVisits.length} Records)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Exact arrival time, departure time, duration on site, verified GPS, and discussion notes
              </p>
            </div>

            {/* Quick Date Range Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'Last 7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'custom', label: 'Custom' },
              ].map((dr) => (
                <button
                  key={dr.id}
                  onClick={() => setDateRange(dr.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    dateRange === dr.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {dr.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Pickers */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex-wrap">
              <span className="text-xs font-bold text-slate-700">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
              />
              <span className="text-xs font-bold text-slate-700">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
              />
            </div>
          )}

          {/* Filter Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search library, staff, city, phone..."
              />
            </div>

            <div>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="All">All Staff & Admins ({visits.length} visits)</option>
                {staffBreakdown.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.isAdmin ? '👑 ' : ''}{s.name} ({s.totalVisits} visits)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="All">All Lead Statuses</option>
                <option value="Interested">Interested</option>
                <option value="Demo Given">Demo Given</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Deal Closed">Deal Closed / Won</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>

            <div className="flex items-center justify-end text-xs font-bold text-slate-500">
              Showing <strong className="text-slate-900 mx-1">{filteredVisits.length}</strong> of {visits.length} records
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3.5">Logged By (Staff)</th>
                  <th className="px-4 py-3.5">Date & Exact Time & Duration</th>
                  <th className="px-5 py-3.5">Library / Business</th>
                  <th className="px-4 py-3.5">Contact Person</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Boss Verification & GPS</th>
                  <th className="px-5 py-3.5">Discussion Summary</th>
                  <th className="px-4 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVisits.length > 0 ? (
                  filteredVisits.map((v) => {
                    const dt = formatDateTime(v.createdAt);
                    const dur = getVisitDurationMinutes(v);
                    const auth = evaluateVisitAuthenticity(v);

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition">
                        {/* Logged By */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {(() => {
                            const isAdm =
                              (v.staffName || '').toLowerCase().includes('admin') ||
                              (v.staffName || '').toLowerCase().includes('owner') ||
                              String(v.staffId || '').toLowerCase().includes('admin');
                            return (
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-7 h-7 rounded-lg font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                                    isAdm
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {isAdm ? (
                                    <Crown size={14} className="text-amber-700" />
                                  ) : (
                                    (v.staffName || 'S').substring(0, 1).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 block text-xs">
                                      {v.staffName || 'Staff Member'}
                                    </span>
                                    {isAdm && (
                                      <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded">
                                        Admin
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Date, Exact Time & Duration */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg w-fit shadow-2xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Entry Made At:</span>
                              <strong className="text-xs font-black">{dt.time}</strong>
                              <span className="text-[10px] text-slate-500">({dt.date})</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="On-site visit time">
                                🚶 Visit: {formatDisplayTime(v.checkInTime, v.createdAt)} → {formatDisplayTime(v.checkOutTime)}
                              </span>
                              {dur > 0 && (
                                <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                  ⏱️ {formatDurationMinutes(dur)} on site
                                </span>
                              )}
                              {(() => {
                                const sync = evaluateSyncDelay(v.checkInTime, v.createdAt);
                                return (
                                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${sync.badgeClass}`}>
                                    {sync.label}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </td>

                        {/* Business Name */}
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">
                            {v.businessName || 'Unnamed Business'}
                          </p>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {v.clientType || 'Library'} • {v.city || 'Local'}
                            {v.seatCapacity ? ` • 🪑 ${v.seatCapacity}` : ''}
                          </span>
                        </td>

                        {/* Contact Person */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-800 block text-xs">
                            {v.ownerName || v.contactPersonName || 'N/A'}
                          </span>
                          {v.phone && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                              <a
                                href={`tel:${v.phone}`}
                                className="text-blue-600 hover:text-blue-800"
                                title="Call"
                              >
                                <PhoneCall size={10} />
                              </a>
                              <a
                                href={`https://wa.me/91${v.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:text-emerald-800"
                                title="WhatsApp"
                              >
                                <MessageCircle size={10} />
                              </a>
                              <span>{v.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Badge variant={getStatusBadgeVariant(v.status)} size="sm">
                            {v.status}
                          </Badge>
                        </td>

                        {/* Proof & GPS Verification */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border inline-flex items-center gap-1 ${auth.badgeClass}`}>
                              {auth.isGenuine ? <ShieldCheck size={11} className="text-emerald-700" /> : <ShieldAlert size={11} />}
                              <span>{auth.statusText}</span>
                            </span>

                            <div className="flex items-center gap-2">
                              {v.photoUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto(v.photoUrl)}
                                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Camera size={10} /> Photo
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No photo</span>
                              )}

                              {v.location ? (
                                <a
                                  href={v.location.mapsUrl || `https://www.google.com/maps?q=${v.location.latitude},${v.location.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-0.5"
                                >
                                  <MapPin size={10} /> GPS (±{v.location.accuracy || 10}m)
                                </a>
                              ) : (
                                <span className="text-[10px] text-rose-600 font-bold">No GPS ⚠️</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Discussion & Reminder */}
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="text-slate-700 line-clamp-2 text-xs leading-relaxed">
                            {v.discussionNotes || <span className="italic text-slate-400">No notes</span>}
                          </p>
                          {v.reminderNote && (
                            <p className="text-[10px] text-amber-800 font-semibold mt-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 line-clamp-1">
                              🔔 {v.reminderNote}
                            </p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedVisit(v)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8">
                      <EmptyState
                        icon={ClipboardList}
                        title="No visit entries match your filters"
                        description="Try clearing search or selecting 'All Time' to view previous marketing visits."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ═══ TAB 4: GOOGLE API SEARCH & DISCOVERY HISTORY ═══                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'api_search_history' && (
        <div className="space-y-6">
          {/* Header & Quick Intro */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Search size={22} />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Google API Search & Discovery Audit Trail
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time audit log of all map queries executed by staff reps, including live GPS coordinates at search time, radius, limits, and results found.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportSearchAuditsToCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Audit CSV</span>
              </button>
            </div>
          </div>

          {/* Top 4 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total API Searches"
              value={filteredSearchAudits.length}
              icon={Search}
              color="blue"
              subtext={`${searchAuditsTodayCount} executed today`}
            />
            <StatCard
              title="Places Discovered"
              value={totalPlacesDiscovered}
              icon={Building2}
              color="emerald"
              subtext="Libraries & gyms found on map"
            />
            <StatCard
              title="Estimated API Cost"
              value={`Rs. ${totalEstimatedGrossCost}`}
              icon={TrendingUp}
              color="indigo"
              subtext="100% Free via $200 Monthly Credit (Rs. 0 Net)"
            />
            <StatCard
              title="Most Active Rep"
              value={mostActiveSearchRep.name}
              icon={Award}
              color="amber"
              subtext={`${mostActiveSearchRep.count} searches logged`}
            />
          </div>

          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Left: Date Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-1">Period:</span>
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'week', label: 'Last 7 Days' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setApiSearchDateRange(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      apiSearchDateRange === p.id
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Right: Dropdowns & Keyword Search */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Staff Filter */}
                <select
                  value={apiSearchStaff}
                  onChange={(e) => setApiSearchStaff(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="All">All Staff Reps ({searchAudits.length})</option>
                  {allStaffAndAdmins.map((s) => {
                    const count = searchAudits.filter(
                      (a) => a.staffId === s.id || (a.staffName && a.staffName.toLowerCase() === (s.name || '').toLowerCase())
                    ).length;
                    return (
                      <option key={s.id} value={s.name}>
                        {s.name} ({count})
                      </option>
                    );
                  })}
                </select>

                {/* Category Filter */}
                <select
                  value={apiSearchCategory}
                  onChange={(e) => setApiSearchCategory(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  <option value="Library">Library</option>
                  <option value="Gym">Gym</option>
                </select>

                {/* Text search */}
                <div className="w-56">
                  <SearchBar
                    placeholder="Search by query, staff, city..."
                    value={apiSearchQuery}
                    onChange={(e) => setApiSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Search Time & Rep</th>
                    <th className="py-3 px-4">Query & Category</th>
                    <th className="py-3 px-4">Search Parameters</th>
                    <th className="py-3 px-4 text-center">Results Found</th>
                    <th className="py-3 px-4">Staff Location at Search Time</th>
                    <th className="py-3 px-4 text-right">API Pages & Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSearchAudits.length > 0 ? (
                    filteredSearchAudits.map((item) => {
                      const dt = formatDateTime(item.createdAt);
                      const isAdm =
                        (item.staffRole || '').toLowerCase().includes('admin') ||
                        (item.staffRole || '').toLowerCase().includes('owner') ||
                        (item.staffName || '').toLowerCase().includes('admin');
                      const lat = item.location?.latitude;
                      const lng = item.location?.longitude;
                      const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                          {/* 1. Time & Staff */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                                  isAdm ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {isAdm ? <Crown size={13} className="text-amber-700" /> : (item.staffName || 'S').substring(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs truncate flex items-center gap-1.5">
                                  <span>{item.staffName || 'Staff Member'}</span>
                                  {isAdm && (
                                    <span className="text-[9px] uppercase font-black bg-amber-100 text-amber-800 px-1 py-0.2 rounded border border-amber-200">
                                      Admin
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  📅 {dt.date} • 🕒 {dt.time}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* 2. Query & Category */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                  item.category === 'Gym'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}>
                                  {item.category || 'Library'}
                                </span>
                              </div>
                              <p className="font-bold text-slate-800 text-xs max-w-xs truncate" title={item.query}>
                                🔍 "{item.query || 'Nearby Search'}"
                              </p>
                            </div>
                          </td>

                          {/* 3. Parameters (Radius & Limit) */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(() => {
                                const rKm = item.radiusKm != null ? (Number(item.radiusKm) >= 1000 ? Math.round(Number(item.radiusKm) / 1000) : Number(item.radiusKm)) : null;
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
                                    📏 {rKm != null ? `${rKm} km radius` : 'All Distance'}
                                  </span>
                                );
                              })()}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                🎯 {item.limitCount != null ? `Max ${item.limitCount}` : 'All Results'}
                              </span>
                            </div>
                          </td>

                          {/* 4. Results Found */}
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>{item.resultsCount || 0} places</span>
                            </span>
                          </td>

                          {/* 5. Location at search time */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-800 text-xs truncate max-w-xs flex items-center gap-1">
                                <MapPin size={12} className="text-rose-500 shrink-0" />
                                <span>{(item.location?.locationName || 'Live Location').replace(/\s*\(Default Location\)/gi, '')}</span>
                              </p>
                              {lat && lng ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
                                    {item.location?.accuracy ? ` (±${item.location.accuracy}m)` : ''}
                                  </span>
                                  {mapsUrl && (
                                    <a
                                      href={mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      <span>View Map</span>
                                      <ExternalLink size={10} />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">GPS not recorded</span>
                              )}
                            </div>
                          </td>

                          {/* 6. API Impact & Cost */}
                          <td className="py-3 px-4 text-right">
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-slate-500 block">
                                {item.pagesCount || 1} API page{item.pagesCount > 1 ? 's' : ''} (~Rs. {item.estimatedGrossInr || '2.00'})
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200">
                                Billed: Rs. 0.00 (Free)
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12">
                        <EmptyState
                          icon={Search}
                          title="No Google API searches match your filters"
                          description="When staff or admin search for libraries or gyms in Field Marketing, every query is automatically logged here with exact location proof."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Inspection Modal ═══ */}
      <Modal
        isOpen={!!selectedVisit}
        onClose={() => setSelectedVisit(null)}
        title={selectedVisit?.businessName || 'Visit Details'}
        subtitle={`Logged by ${selectedVisit?.staffName} on ${formatDateTime(selectedVisit?.createdAt).date}`}
        maxWidth="max-w-2xl"
      >
        {selectedVisit && (
          <div className="space-y-4 text-xs">
            {/* On-Site Photo Proof */}
            {selectedVisit.photoUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs max-h-56 bg-slate-900">
                <img
                  src={selectedVisit.photoUrl}
                  alt={selectedVisit.businessName}
                  className="w-full h-56 object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-3.5">
                  <span className="text-white text-xs font-bold flex items-center gap-1.5">
                    <Camera size={14} className="text-emerald-400" />
                    <span>On-Site Photo Proof</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(selectedVisit.photoUrl)}
                    className="px-2.5 py-1 bg-white/90 hover:bg-white text-slate-900 text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>View Full Size</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            )}

            {/* Boss Ground Verification Box */}
            {(() => {
              const auth = evaluateVisitAuthenticity(selectedVisit);
              const dur = getVisitDurationMinutes(selectedVisit);
              return (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-blue-600" />
                      <span>Boss Ground Verification & Authenticity</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${auth.badgeClass}`}>
                      {auth.statusText}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">🚶 On-Site Visit Time</span>
                      <span className="font-bold text-blue-700 block">⏱️ {formatDurationMinutes(dur)} on site</span>
                      <span className="text-[10px] text-slate-600 font-semibold block mt-0.5">
                        {formatDisplayTime(selectedVisit.checkInTime, selectedVisit.createdAt)} → {formatDisplayTime(selectedVisit.checkOutTime)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-amber-700 font-bold uppercase block">📥 Server Entry Received</span>
                      <span className="font-bold text-amber-900 block">🕒 {formatEntryTimestamp(selectedVisit.createdAt).time}</span>
                      <span className="text-[10px] text-slate-500 block">📅 {formatEntryTimestamp(selectedVisit.createdAt).date}</span>
                      <span className="text-[9px] font-bold text-emerald-700 block mt-0.5">
                        {evaluateSyncDelay(selectedVisit.checkInTime, selectedVisit.createdAt).label}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">GPS Accuracy</span>
                      <span className="font-bold text-slate-800 block">
                        {selectedVisit.location ? `±${selectedVisit.location.accuracy || 15}m` : 'No GPS'}
                      </span>
                      {auth.distanceToPlace != null && (
                        <span className={`text-[10px] font-bold block mt-0.5 ${auth.level === 'distance_alert' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {auth.distanceToPlace > 800 ? `🚨 ${auth.distanceToPlace}m away` : `🎯 ${auth.distanceToPlace}m from place`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-bold uppercase block text-[10px]">Owner / Director</span>
                <span className="font-bold text-slate-800 text-xs">{selectedVisit.ownerName || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block text-[10px]">Mobile Contact</span>
                <span className="font-bold text-slate-800 text-xs">{selectedVisit.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block text-[10px]">City & State</span>
                <span className="font-bold text-slate-800 text-xs">
                  {selectedVisit.city || 'N/A'}{selectedVisit.state ? `, ${selectedVisit.state}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block text-[10px]">Address</span>
                <span className="font-bold text-slate-800 text-xs">{selectedVisit.address || 'N/A'}</span>
              </div>
            </div>

            {/* Discussion Notes */}
            <div>
              <span className="text-slate-400 font-bold uppercase block text-[10px] mb-1">Meeting Notes</span>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap">
                {selectedVisit.discussionNotes || 'No notes entered.'}
              </div>
            </div>

            {selectedVisit.reminderNote && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 block mb-0.5">🔔 Follow-up Reminder Note:</span>
                <p className="text-amber-800">{selectedVisit.reminderNote}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══ Photo Preview Modal ═══ */}
      {previewPhoto && (
        <Modal
          isOpen={!!previewPhoto}
          onClose={() => setPreviewPhoto(null)}
          title="On-Site Photo Proof"
          subtitle="Captured directly from client premises"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
              <img
                src={previewPhoto}
                alt="On-Site Proof"
                className="w-full max-h-[70vh] object-contain mx-auto"
              />
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
