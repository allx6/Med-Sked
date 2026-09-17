import { useEffect, useState } from 'react';

import { getAdminStats } from '../services/api';

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0%';
  }

  return `${Number(value.toFixed(2))}%`;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    const auth = getStoredAuth();

    if (!auth?.token) {
      setError('Authentication is required.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await getAdminStats(auth.token);
      setStats(result);
    } catch (err) {
      setError(err.message || 'Unable to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="page-stack">
        <div className="panel page-header">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>Admin Dashboard</h2>
          </div>
        </div>
        <div className="loading-state">Loading dashboard statistics…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-stack">
        <div className="panel page-header">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>Admin Dashboard</h2>
          </div>
        </div>
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Admin Dashboard</h2>
        </div>
        <button type="button" className="secondary-button" onClick={loadStats}>
          Refresh
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span>Total Users</span>
          <strong>{stats?.users?.total ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Patients</span>
          <strong>{stats?.users?.patients ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Caregivers</span>
          <strong>{stats?.users?.caregivers ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Admins</span>
          <strong>{stats?.users?.admins ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Medications</span>
          <strong>{stats?.medications?.total ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Active Schedules</span>
          <strong>{stats?.schedules?.enabled ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Overall Adherence</span>
          <strong>{formatPercent(stats?.adherence?.rate)}</strong>
        </div>
        <div className="stat-card">
          <span>Missed Doses</span>
          <strong>{stats?.doses?.missed ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Notifications</span>
          <strong>{stats?.notifications?.total ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Relationships</span>
          <strong>{stats?.relationships?.active ?? 0}</strong>
        </div>
      </div>

      <div className="panel">
        <h3>System summary</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span>Low refill</span>
            <strong>{stats?.medications?.lowRefill ?? 0}</strong>
          </div>
          <div className="summary-item">
            <span>Zero stock</span>
            <strong>{stats?.medications?.zeroStock ?? 0}</strong>
          </div>
          <div className="summary-item">
            <span>Eligible doses</span>
            <strong>{stats?.adherence?.eligible ?? 0}</strong>
          </div>
          <div className="summary-item">
            <span>At threshold</span>
            <strong>{stats?.refills?.atOrBelowThreshold ?? 0}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
