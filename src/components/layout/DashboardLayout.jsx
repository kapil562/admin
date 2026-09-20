import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.jpg';
import {
  LayoutDashboard,
  Wallet,
  BookOpen,
  MessageSquare,
  BarChart3,
  Sparkles,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Navigation,
  CalendarCheck,
  UserCog,
} from 'lucide-react';
import toast from 'react-hot-toast';

const navigationGroups = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard, module: 'dashboard' },
      { name: 'Reports & Analytics', path: '/reports', icon: BarChart3, module: 'reports' },
    ],
  },
  {
    title: 'FIELD SALES & MARKETING',
    items: [
      { name: 'Field Visits (GPS)', path: '/marketing', icon: Navigation, module: 'marketing' },
      { name: 'Staff Duty & Hours', path: '/attendance', icon: CalendarCheck, module: 'attendance' },
    ],
  },
  {
    title: 'CLIENTS & SUPPORT',
    items: [
      { name: 'Library Clients', path: '/clients', icon: BookOpen, module: 'clients' },
      { name: 'User Queries', path: '/queries', icon: MessageSquare, module: 'queries' },
    ],
  },
  {
    title: 'FINANCE & MANAGEMENT',
    items: [
      { name: 'Expenses & Utility', path: '/finances', icon: Wallet, module: 'finances' },
      { name: 'Plans & Pricing', path: '/plans', icon: Sparkles, module: 'plans' },
      { name: 'Staff & Roles', path: '/staff', icon: UserCog, module: 'staff' },
    ],
  },
];

export const DashboardLayout = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (e) {
      toast.error('Logout error');
    }
  };

  const allowedGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPermission(item.module, 'view')),
    }))
    .filter((group) => group.items.length > 0);

  const currentItem = allowedGroups
    .flatMap((g) => g.items)
    .find((item) =>
      item.path === '/'
        ? location.pathname === item.path
        : location.pathname.startsWith(item.path)
    );

  const renderSidebar = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 select-none">
      {/* 1. Header & Branding */}
      <div className="p-5 border-b border-slate-800/90 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-sm flex items-center justify-center shrink-0">
          <img src={logo} alt="Univo Logo" className="w-full h-full object-contain rounded-lg" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-extrabold text-base tracking-tight truncate">
              Univo Infotech
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium truncate flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{user?.roleLabel || (user?.role === 'super_admin' ? '👑 Super Admin' : 'Staff Portal')}</span>
          </p>
        </div>
      </div>

      {/* 2. Navigation Items */}
      <div className="flex-1 px-3.5 py-6 space-y-6 overflow-y-auto">
        {allowedGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === '/'
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    end={item.path === '/'}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={isActive ? 'text-white' : 'text-slate-400'}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>


      {/* 3. Bottom User Profile Card */}
      <div className="p-3.5 border-t border-slate-800/90 bg-slate-950/60">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {user?.displayName || 'Administrator'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {user?.email || 'admin@univoinfotech.com'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex antialiased">
      {/* Desktop Sidebar (Permanent, 256px wide, sticky top) */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-800 sticky top-0 h-screen z-20 shadow-xl">
        {renderSidebar()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 z-10 shadow-2xl">
            <div className="p-3 border-b border-slate-800 flex justify-end">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderSidebar()}</div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 font-medium hidden sm:inline">Admin Portal</span>
              <ChevronRight size={14} className="text-slate-400 hidden sm:inline" />
              <span className="text-slate-900 font-bold">
                {currentItem?.name || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Firebase Connected</span>
            </div>

            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                A
              </div>
              <span className="text-xs font-bold text-slate-800 hidden md:inline">
                {user?.displayName || 'Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        <footer className="px-6 py-4 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
          Univo Infotech Admin Console © {new Date().getFullYear()} • Enterprise Multi-Tenant Platform
        </footer>
      </div>
    </div>
  );
};
