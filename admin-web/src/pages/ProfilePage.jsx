import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog';
import { listAuditLogs } from '../services/api';

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const formatActivityDate = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatActivityAction = (action) => {
  if (!action) {
    return 'Unknown activity';
  }

  return String(action)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const user = auth?.user;
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    let isActive = true;

    const loadRecentActivity = async () => {
      if (!auth?.token) {
        setActivityError('Authentication is required to load recent activity.');
        setActivityLoading(false);
        return;
      }

      try {
        const result = await listAuditLogs(auth.token, { page: 1, limit: 2 });

        if (isActive) {
          setRecentActivity(result?.data || []);
        }
      } catch (error) {
        if (isActive) {
          setActivityError('Recent activity is currently unavailable.');
        }
      } finally {
        if (isActive) {
          setActivityLoading(false);
        }
      }
    };

    loadRecentActivity();

    return () => {
      isActive = false;
    };
  }, [auth?.token]);

  const handleLogout = () => {
    localStorage.removeItem('medsked-admin-auth');
    try {
      sessionStorage.removeItem('medsked-admin-app-session');
    } catch (error) {
      // no-op
    }
    navigate('/login', { replace: true });
  };

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h2 className="profile-page-title">Profile</h2>
          <p className="page-intro">Your admin account details.</p>
        </div>
      </div>

      <div className="profile-overview-grid">
        <section className="panel profile-account-panel" aria-label="Account details">
          <div className="profile-fields">
            <div>
              <span>Username</span>
              <strong>{user?.username || 'Unavailable'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{user?.email || 'Unavailable'}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unavailable'}</strong>
            </div>
          </div>

          <button type="button" className="logout-button profile-logout-button" onClick={() => setLogoutDialogOpen(true)}>Logout</button>
        </section>

        <section className="panel profile-activity-panel" aria-labelledby="profile-activity-title">
          <h3 id="profile-activity-title">Recent activity</h3>
          {activityLoading ? (
            <div className="loading-state">Loading recent activity…</div>
          ) : activityError ? (
            <div className="empty-state">{activityError}</div>
          ) : recentActivity.length === 0 ? (
            <div className="empty-state">No recent activity is available.</div>
          ) : (
            <ol className="profile-activity-list">
              {recentActivity.map((item) => (
                <li key={item._id}>
                  <time dateTime={item.timestamp || undefined}>{formatActivityDate(item.timestamp)}</time>
                  <span className="profile-activity-marker" aria-hidden="true" />
                  <strong>{formatActivityAction(item.action)}</strong>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={logoutDialogOpen}
        onCancel={() => setLogoutDialogOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
