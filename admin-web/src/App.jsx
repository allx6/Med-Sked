import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import UsersPage from './pages/UsersPage';
import RelationshipsPage from './pages/RelationshipsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ProfilePage from './pages/ProfilePage';
import AdminLayout from './components/AdminLayout';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedAdminRoute>
            <AdminLayout>
              <AdminDashboardPage />
            </AdminLayout>
          </ProtectedAdminRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedAdminRoute>
            <AdminLayout>
              <AnalyticsPage />
            </AdminLayout>
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedAdminRoute>
            <AdminLayout>
              <UsersPage />
            </AdminLayout>
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/relationships"
        element={
          <ProtectedAdminRoute>
            <AdminLayout>
              <RelationshipsPage />
            </AdminLayout>
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/audit-logs"
        element={
          <ProtectedAdminRoute>
            <AdminLayout>
              <AuditLogsPage />
            </AdminLayout>
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedAdminRoute>
            <AdminLayout>
              <ProfilePage />
            </AdminLayout>
          </ProtectedAdminRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
