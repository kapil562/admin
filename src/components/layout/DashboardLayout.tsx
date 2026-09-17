import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import logo from '@/assets/logo.jpg';

const navItems = [
  {
    name: 'Dashboard',
    path: ROUTES.DASHBOARD,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.9" />
        <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.5" />
        <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.5" />
        <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.9" />
      </svg>
    ),
  },
  {
    name: 'Expenses',
    path: ROUTES.FINANCES,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-4H9l3-3 3 3h-2v4z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'Library',
    path: ROUTES.SOFTWARES,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'Queries',
    path: ROUTES.SERVICES,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'Reports',
    path: ROUTES.REPORTS,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-5h7v5zm3-7H7V7h10v3z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'Plans',
    path: ROUTES.PLANS,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z" fill="currentColor" />
      </svg>
    ),
  },
];

export const DashboardLayout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate(ROUTES.LOGIN);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F0F4FF' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0A192F 0%, #0D2247 100%)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
      }}>
        {/* Logo Section */}
        <div style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={logo}
              alt="Univo Infotech"
              style={{
                width: '52px',
                height: '52px',
                objectFit: 'contain',
                borderRadius: '12px',
                background: 'white',
                padding: '4px',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '16px', lineHeight: 1.2 }}>Univo</div>
              <div style={{ color: '#60A5FA', fontSize: '11px', marginTop: '2px', fontWeight: 400 }}>Infotech Portal</div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', padding: '0 8px', marginBottom: '8px' }}>
            MENU
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === ROUTES.DASHBOARD}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '11px 12px',
                borderRadius: '10px',
                marginBottom: '4px',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                background: isActive ? 'linear-gradient(90deg, #005CE6, #00C853)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                fontSize: '14px',
                textDecoration: 'none',
                transition: 'all 0.2s',
              })}
            >
              {item.icon}
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 12px',
              borderRadius: '10px',
              width: '100%',
              color: 'rgba(255,100,100,0.85)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" fill="currentColor" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ marginLeft: '240px', flex: 1, padding: '28px 32px', minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  );
};
