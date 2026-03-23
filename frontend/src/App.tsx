import { useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TicketList } from './pages/TicketList';
import { TicketDetail } from './pages/TicketDetail';
import { NewTicket } from './pages/NewTicket';
import { AdminPanel } from './pages/AdminPanel';
import { Unauthorized } from './pages/Unauthorized';
import { ProtectedRoute } from './components/ProtectedRoute';
import Cooldown from './pages/Cooldown';
import { useAuthStore } from './store/auth.store';
import { useIdleTimer } from './hooks/useIdleTimer';
import { User, UserRole } from './types';

const BASE_URL = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3001';

// Musi żyć wewnątrz BrowserRouter, bo useIdleTimer używa useNavigate.
function AppRoutes(): JSX.Element {
  useIdleTimer();

  return (
    <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cooldown" element={<Cooldown />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets"
          element={
            <ProtectedRoute>
              <TicketList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/new"
          element={
            <ProtectedRoute>
              <NewTicket />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/:id"
          element={
            <ProtectedRoute>
              <TicketDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole={UserRole.ADMIN}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
  );
}

export default function App(): JSX.Element {
  const { login, setInitializing } = useAuthStore();

  useEffect(() => {
    const csrfCookie = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/)?.[1];
    axios
      .post<{ success: boolean; data?: { accessToken: string; user: User; csrfToken: string } }>(
        `${BASE_URL}/api/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: csrfCookie ? { 'X-CSRF-Token': decodeURIComponent(csrfCookie) } : {},
        }
      )
      .then((res) => {
        const { accessToken, user, csrfToken } = res.data.data ?? {};
        if (accessToken && user && csrfToken) {
          login(accessToken, user, csrfToken);
        }
      })
      .catch(() => {})
      .finally(() => {
        setInitializing(false);
      });
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
