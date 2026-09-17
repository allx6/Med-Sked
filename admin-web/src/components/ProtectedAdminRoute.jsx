import { Navigate, useLocation } from 'react-router-dom';

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

export default function ProtectedAdminRoute({ children }) {
  const location = useLocation();
  const auth = getStoredAuth();

  if (!auth?.token || !auth?.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (auth.user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
}
