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

const formatNumber = (value) => Number(value || 0).toLocaleString();

const metricIconPaths = {
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  patients: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2M12 12v4m-2-2h4" /></>,
  caregivers: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /><path d="M7 12h3l1.5-2 2 4 1.5-2H18" /></>,
  admins: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  medications: <><path d="m10.5 20.5 10-10a5.7 5.7 0 0 0-8-8l-10 10a5.7 5.7 0 0 0 8 8Z" /><path d="m8.5 8.5 7 7" /></>,
  schedules: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M8 2v2m8-2v2" /></>,
  adherence: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  missed: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
  notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  relationships: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7" /></>,
};

const DashboardMetricIcon = ({ name }) => (
  <span className="dashboard-stat-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {metricIconPaths[name]}
    </svg>
  </span>
);

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
          <p className="eyebrow">Operations overview</p>
          <h2>Admin Dashboard</h2>
          <p className="page-intro">A live view of medication operations, adherence, and account activity.</p>
        </div>
        <div className="header-actions">
          <span className="live-indicator"><span />Live data</span>
          <button type="button" className="secondary-button" onClick={loadStats}>Refresh</button>
        </div>
      </div>

      <div className="stat-grid dashboard-stat-grid">
        <div className="stat-card stat-card-primary dashboard-stat-card">
          <DashboardMetricIcon name="users" />
          <span>Total Users</span>
          <strong>{formatNumber(stats?.users?.total)}</strong>
          <small>{formatNumber(stats?.users?.patients)} patients enrolled</small>
        </div>
        <div className="stat-card dashboard-stat-card">
          <DashboardMetricIcon name="patients" />
          <span>Patients</span>
          <strong>{formatNumber(stats?.users?.patients)}</strong>
          <small>Care recipients</small>
        </div>
        <div className="stat-card dashboard-stat-card">
          <DashboardMetricIcon name="caregivers" />
          <span>Caregivers</span>
          <strong>{formatNumber(stats?.users?.caregivers)}</strong>
          <small>Support accounts</small>
        </div>
        <div className="stat-card dashboard-stat-card">
          <DashboardMetricIcon name="admins" />
          <span>Admins</span>
          <strong>{formatNumber(stats?.users?.admins)}</strong>
          <small>Administrative access</small>
        </div>
        <div className="stat-card dashboard-stat-card">
          <DashboardMetricIcon name="medications" />
          <span>Medications</span>
          <strong>{formatNumber(stats?.medications?.total)}</strong>
          <small>{formatNumber(stats?.medications?.zeroStock)} out of stock</small>
        </div>
        <div className="stat-card dashboard-stat-card">
          <DashboardMetricIcon name="schedules" />
          <span>Active Schedules</span>
          <strong>{formatNumber(stats?.schedules?.enabled)}</strong>
          <small>of {formatNumber(stats?.schedules?.total)} total schedules</small>
        </div>
        <div className="stat-card stat-card-accent dashboard-stat-card">
          <DashboardMetricIcon name="adherence" />
          <span>Overall Adherence</span>
          <strong>{formatPercent(stats?.adherence?.rate)}</strong>
          <small>{formatNumber(stats?.adherence?.eligible)} eligible doses</small>
        </div>
        <div className="stat-card dashboard-stat-card">
          <DashboardMetricIcon name="missed" />
          <span>Missed Doses</span>
          <strong>{formatNumber(stats?.doses?.missed)}</strong>
          <small>Across recorded dose history</small>
        </div>
        <div className="stat-card dashboard-stat-card">
          <DashboardMetricIcon name="notifications" />
          <span>Notifications</span>
          <strong>{formatNumber(stats?.notifications?.total)}</strong>
          <small>System notifications</small>
        </div>
        <div className="stat-card dashboard-stat-card">
          <DashboardMetricIcon name="relationships" />
          <span>Relationships</span>
          <strong>{formatNumber(stats?.relationships?.active)}</strong>
          <small>{formatNumber(stats?.relationships?.pending)} pending review</small>
        </div>
      </div>

      <section className="attention-panel" aria-labelledby="attention-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Action queue</p>
            <h3 id="attention-heading">What needs attention</h3>
          </div>
          <span className="section-caption">Based on current records</span>
        </div>
        <div className="attention-grid">
          <div className={`attention-item ${stats?.medications?.zeroStock > 0 ? 'attention-high' : ''}`}>
            <span className="attention-icon">!</span>
            <div><strong>{formatNumber(stats?.medications?.zeroStock)} medications</strong><span>out of stock</span></div>
          </div>
          <div className={`attention-item ${stats?.medications?.lowRefill > 0 ? 'attention-medium' : ''}`}>
            <span className="attention-icon">↘</span>
            <div><strong>{formatNumber(stats?.medications?.lowRefill)} medications</strong><span>at refill threshold</span></div>
          </div>
          <div className={`attention-item ${stats?.relationships?.pending > 0 ? 'attention-medium' : ''}`}>
            <span className="attention-icon">◷</span>
            <div><strong>{formatNumber(stats?.relationships?.pending)} relationships</strong><span>awaiting review</span></div>
          </div>
          <div className={`attention-item ${stats?.doses?.missed > 0 ? 'attention-medium' : ''}`}>
            <span className="attention-icon">×</span>
            <div><strong>{formatNumber(stats?.doses?.missed)} missed doses</strong><span>in recorded history</span></div>
          </div>
        </div>
      </section>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">System health</p>
            <h3>System summary</h3>
          </div>
        </div>
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
