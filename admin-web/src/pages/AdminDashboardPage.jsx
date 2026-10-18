import { useEffect, useState } from 'react';

import { getAdminAdherenceTrend, getAdminStats } from '../services/api';

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

const getTimeBasedGreeting = (hour = new Date().getHours()) => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatTrendDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || 'Unknown date');

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getTrendPoints = (data) => (
  (Array.isArray(data) ? data : []).map((item) => {
    const taken = Number(item.taken) || 0;
    const skipped = Number(item.skipped) || 0;
    const missed = Number(item.missed) || 0;
    const eligible = taken + skipped + missed;
    const value = Number(item.adherenceRate);

    return {
      date: String(item.date || ''),
      taken,
      skipped,
      missed,
      eligible,
      adherence: eligible > 0 && Number.isFinite(value)
        ? Math.max(0, Math.min(100, value))
        : null,
    };
  })
);

const AdherenceTrendChart = ({ data }) => {
  const points = getTrendPoints(data);
  const validPoints = points.filter((point) => point.adherence !== null);

  if (!validPoints.length) {
    return <div className="empty-state">No eligible dose data available for this period.</div>;
  }

  const width = 1000;
  const height = 320;
  const padding = { top: 24, right: 28, bottom: 62, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xForIndex = (index) => (
    points.length === 1
      ? padding.left + plotWidth / 2
      : padding.left + (index / (points.length - 1)) * plotWidth
  );
  const yForValue = (value) => (
    padding.top + ((100 - value) / 100) * plotHeight
  );

  let lineSegments = [];
  let currentSegment = [];

  points.forEach((point, index) => {
    if (point.adherence === null) {
      if (currentSegment.length) lineSegments.push(currentSegment);
      currentSegment = [];
      return;
    }

    currentSegment.push(`${currentSegment.length ? 'L' : 'M'} ${xForIndex(index)} ${yForValue(point.adherence)}`);
  });
  if (currentSegment.length) lineSegments.push(currentSegment);

  const labelIndexes = [...new Set(
    [0, 0.25, 0.5, 0.75, 1]
      .map((position) => Math.round((points.length - 1) * position))
  )];

  return (
    <div className="adherence-trend-chart-wrap">
      <svg
        className="adherence-trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily medication adherence over the last 30 days"
      >
        <title>Daily medication adherence over the last 30 days</title>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = yForValue(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="adherence-trend-gridline"
              />
              <text
                x={padding.left - 12}
                y={y + 5}
                textAnchor="end"
                className="adherence-trend-axis-label"
              >
                {tick}%
              </text>
            </g>
          );
        })}
        {lineSegments.map((segment, index) => (
          <path
            key={`segment-${index}`}
            d={segment.join(' ')}
            className="adherence-trend-line"
          />
        ))}
        {points.map((point, index) => {
          const x = xForIndex(index);
          const y = point.adherence === null
            ? padding.top + plotHeight
            : yForValue(point.adherence);
          const tooltip = point.adherence === null
            ? `${point.date}: No eligible doses`
            : `${point.date}: ${formatPercent(point.adherence)} adherence; ${point.taken} taken, ${point.skipped} skipped, ${point.missed} missed (${point.eligible} eligible)`;

          return (
            <g key={point.date || index}>
              <circle
                cx={x}
                cy={y}
                r={point.adherence === null ? 4 : 6}
                className={point.adherence === null
                  ? 'adherence-trend-no-data'
                  : 'adherence-trend-point'}
              >
                <title>{tooltip}</title>
              </circle>
              {labelIndexes.includes(index) ? (
                <text
                  x={x}
                  y={height - 24}
                  textAnchor="middle"
                  className="adherence-trend-axis-label adherence-trend-date-label"
                >
                  {formatTrendDate(point.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="adherence-trend-note">Gaps indicate dates with no eligible completed doses. Hover or focus a point for dose counts.</p>
    </div>
  );
};

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
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendError, setTrendError] = useState('');

  const loadStats = async () => {
    const auth = getStoredAuth();

    if (!auth?.token) {
      setError('Authentication is required.');
      setLoading(false);
      setTrendError('Authentication is required.');
      setTrendLoading(false);
      return;
    }

    setLoading(true);
    setTrendLoading(true);
    setError('');
    setTrendError('');

    const [statsResult, trendResult] = await Promise.allSettled([
      getAdminStats(auth.token),
      getAdminAdherenceTrend(auth.token, 30),
    ]);

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value);
    } else {
      setError(statsResult.reason?.message || 'Unable to load dashboard statistics.');
    }
    setLoading(false);

    if (trendResult.status === 'fulfilled') {
      setTrendData(trendResult.value?.data || []);
    } else {
      setTrendError(trendResult.reason?.message || 'Unable to load adherence trend.');
    }
    setTrendLoading(false);
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

  const decisionsNeeded = (stats?.medications?.lowRefill ?? 0) + (stats?.relationships?.pending ?? 0);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Operations • updated just now</p>
          <h2 className="dashboard-page-title">{getTimeBasedGreeting()} — here&apos;s where adherence stands</h2>
          <p className="page-intro">
            {formatNumber(stats?.users?.patients ?? 0)} patients enrolled across {formatNumber(stats?.schedules?.enabled ?? 0)} active schedules. {decisionsNeeded ? `${formatNumber(decisionsNeeded)} things need a decision today.` : 'Everything is running smoothly today.'}
          </p>
        </div>
        <div className="header-actions">
          <span className="live-indicator"><span />Live data</span>
          <button type="button" className="secondary-button" onClick={loadStats}>Refresh</button>
        </div>
      </div>

      <section className="panel adherence-trend-panel" aria-labelledby="adherence-trend-heading">
        <div className="adherence-trend-heading">
          <div>
            <p className="eyebrow">Last 30 days</p>
            <h3 id="adherence-trend-heading">Adherence Trend</h3>
            <p className="adherence-trend-description">Daily medication adherence over the selected period</p>
          </div>
        </div>
        {trendLoading ? (
          <div className="loading-state">Loading adherence trend...</div>
        ) : trendError ? (
          <div className="error-state">{trendError}</div>
        ) : (
          <AdherenceTrendChart data={trendData} />
        )}
      </section>

      <div className="stat-grid dashboard-stat-grid">
        <div className="stat-card dashboard-stat-card dashboard-stat-card-rose">
          <DashboardMetricIcon name="missed" />
          <span>Missed Doses</span>
          <strong>{formatNumber(stats?.doses?.missed)}</strong>
          <small>{formatNumber(stats?.doses?.missed)} of {formatNumber(stats?.adherence?.eligible ?? 0)} doses missed</small>
        </div>
        <div className="stat-card dashboard-stat-card dashboard-stat-card-teal">
          <DashboardMetricIcon name="users" />
          <span>Overall adherence, last 30 days</span>
          <strong>{formatPercent(stats?.adherence?.rate)}</strong>
          <small>{formatNumber(stats?.adherence?.eligible)} eligible doses tracked</small>
        </div>
        <div className="stat-card dashboard-stat-card dashboard-stat-card-cyan">
          <DashboardMetricIcon name="adherence" />
          <span>Active Schedules</span>
          <strong>{formatNumber(stats?.schedules?.enabled)}</strong>
          <small>of {formatNumber(stats?.schedules?.total)} total</small>
        </div>
        <div className="stat-card dashboard-stat-card dashboard-stat-card-seafoam">
          <DashboardMetricIcon name="medications" />
          <span>Medications</span>
          <strong>{formatNumber(stats?.medications?.total)}</strong>
          <small>{formatNumber(stats?.medications?.zeroStock)} out of stock</small>
        </div>
        <div className="stat-card dashboard-stat-card dashboard-stat-card-blue">
          <DashboardMetricIcon name="patients" />
          <span>Patients</span>
          <strong>{formatNumber(stats?.users?.patients)}</strong>
          <small>Care recipients</small>
        </div>
        <div className="stat-card dashboard-stat-card dashboard-stat-card-indigo">
          <DashboardMetricIcon name="caregivers" />
          <span>Caregivers</span>
          <strong>{formatNumber(stats?.users?.caregivers)}</strong>
          <small>Support accounts</small>
        </div>
        <div className="stat-card dashboard-stat-card dashboard-stat-card-indigo-soft">
          <DashboardMetricIcon name="notifications" />
          <span>Notifications</span>
          <strong>{formatNumber(stats?.notifications?.total)}</strong>
          <small>System notifications</small>
        </div>
        <div className="stat-card dashboard-stat-card dashboard-stat-card-violet">
          <DashboardMetricIcon name="relationships" />
          <span>Relationships</span>
          <strong>{formatNumber(stats?.relationships?.active)}</strong>
          <small>{formatNumber(stats?.relationships?.pending)} pending review</small>
        </div>
        <div className="stat-card dashboard-stat-card dashboard-stat-card-slate">
          <DashboardMetricIcon name="admins" />
          <span>Admins</span>
          <strong>{formatNumber(stats?.users?.admins)}</strong>
          <small>Administrative access</small>
        </div>
        <div className="stat-card dashboard-stat-card dashboard-stat-card-slate-soft">
          <DashboardMetricIcon name="users" />
          <span>Total Users</span>
          <strong>{formatNumber(stats?.users?.total)}</strong>
          <small>{formatNumber(stats?.users?.patients)} patients enrolled</small>
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
