import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { LibraryClients } from './pages/LibraryClients';
import { Finances } from './pages/Finances';
import { PlansManagement } from './pages/PlansManagement';
import { UserQueries } from './pages/UserQueries';
import { Reports } from './pages/Reports';
import { FieldMarketing } from './pages/FieldMarketing';
import { StaffAttendance } from './pages/StaffAttendance';
import { StaffManagement } from './pages/StaffManagement';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              className: '!rounded-xl !shadow-xl !text-xs !font-bold !tracking-wide !px-4 !py-3',
              success: {
                className: '!bg-emerald-50 !text-emerald-800 !border !border-emerald-200',
              },
              error: {
                className: '!bg-rose-50 !text-rose-800 !border !border-rose-200',
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/marketing" element={<FieldMarketing />} />
              <Route path="/attendance" element={<StaffAttendance />} />
              <Route path="/clients" element={<LibraryClients />} />
              <Route path="/finances" element={<Finances />} />
              <Route path="/plans" element={<PlansManagement />} />
              <Route path="/queries" element={<UserQueries />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/staff" element={<StaffManagement />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

