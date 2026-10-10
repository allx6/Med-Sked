import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { validateAdminSession } from '../services/api';

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const hasCurrentSession = () => {
  try {
    return sessionStorage.getItem('medsked-admin-app-session') === 'active';
  } catch (error) {
    return false;
  }
};

const clearStoredAuth = () => {
  localStorage.removeItem('medsked-admin-auth');
  try {
    sessionStorage.removeItem('medsked-admin-app-session');
  } catch (error) {
    // no-op
  }
};

export default function ProtectedAdminRoute({ children }) {
  const location = useLocation();
  const auth = getStoredAuth();
  const [isChecking, setIsChecking] = useState(Boolean(auth?.token) && hasCurrentSession());
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const currentAuth = getStoredAuth();

    if (!currentAuth?.token || !currentAuth?.user || !hasCurrentSession()) {
      setIsChecking(false);
      setIsValid(false);
      return;
    }

    let isActive = true;

    const verifySession = async () => {
      try {
        const result = await validateAdminSession(currentAuth.token);

        if (!isActive) {
          return;
        }

        if (result?.user?.role !== 'admin') {
          clearStoredAuth();
          setIsChecking(false);
          setIsValid(false);
          return;
        }

        setIsChecking(false);
        setIsValid(true);
      } catch (error) {
        if (!isActive) {
          return;
        }

        clearStoredAuth();
        setIsChecking(false);
        setIsValid(false);
      }
    };

    verifySession();

    return () => {
      isActive = false;
    };
  }, [location.pathname]);

  if (!auth?.token || !auth?.user || !hasCurrentSession()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (auth.user.role !== 'admin') {
    clearStoredAuth();
    return <Navigate to="/login" replace />;
  }

  if (isChecking) {
    return <div className="loading-state">Checking admin session…</div>;
  }

  if (!isValid) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
