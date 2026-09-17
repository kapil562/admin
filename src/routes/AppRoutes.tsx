
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Login } from '@/pages/Login/Login';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Dashboard } from '@/pages/Dashboard/Dashboard';
import { Finances } from '@/pages/Dashboard/Finances';
import { Softwares } from '@/pages/Dashboard/Softwares';
import { Services } from '@/pages/Dashboard/Services';
import { Reports } from '@/pages/Dashboard/Reports';
import { Plans } from '@/pages/Dashboard/Plans';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<Login />} />
      <Route element={<DashboardLayout />}>
        <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
        <Route path={ROUTES.FINANCES} element={<Finances />} />
        <Route path={ROUTES.SOFTWARES} element={<Softwares />} />
        <Route path={ROUTES.SERVICES} element={<Services />} />
        <Route path={ROUTES.REPORTS} element={<Reports />} />
        <Route path={ROUTES.PLANS} element={<Plans />} />
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Route>
    </Routes>
  );
};
