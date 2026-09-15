import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { LayoutDashboard, Wallet, MonitorPlay, Megaphone, Settings, LogOut } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { name: 'Finances', path: ROUTES.FINANCES, icon: Wallet },
    { name: 'Softwares', path: ROUTES.SOFTWARES, icon: MonitorPlay },
    { name: 'Services', path: ROUTES.SERVICES, icon: Megaphone },
    { name: 'Settings', path: ROUTES.SETTINGS, icon: Settings },
  ];

  return (
    <div className="w-64 bg-white h-screen border-r border-gray-200 flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
          Univo
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-brand-blue/10 to-brand-green/10 text-brand-blue font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <NavLink
          to={ROUTES.LOGIN}
          className="flex items-center px-4 py-3 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </NavLink>
      </div>
    </div>
  );
};

export const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-brand-light">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};
