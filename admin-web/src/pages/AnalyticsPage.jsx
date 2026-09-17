import { useEffect, useMemo, useState } from 'react';

import { getAdminAnalytics } from '../services/api';

const CHART_COLORS = ['#2F6690', '#5BA4A4', '#F6A623', '#E76F51', '#7C9CBF', '#8BC34A'];

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const toPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Number(value.toFixed(2));
};

const DashboardCard = ({ title, children }) => (
  <div className="panel chart-panel">
    <h3>{title}</h3>
    {children}
  </div>
);

const EmptyState = ({ message }) => <div className="empty-state">{message}</div>;
const LoadingState = ({ label = 'Loading...' }) => <div className="loading-state">{label}</div>;
const ErrorState = ({ message }) => <div className="error-state">{message}</div>;

const SimpleBarChart = ({ data, color = '#2F6690', valueKey = 'count', labelKey = 'name', height = 260, vertical = false }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyState message="No data available." />;
  }

  const maxValue = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);
  const chartHeight = height;
  const chartWidth = 420;
  const padding = 26;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height={height} role="img" aria-label="Bar chart">
      {data.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const ratio = value / maxValue;
        const barWidth = vertical ? innerWidth / data.length - 12 : Math.min(42, innerWidth / data.length - 10);
        const barHeight = vertical ? innerHeight * ratio : innerHeight / data.length - 12;
        const x = vertical ? padding + index * (innerWidth / data.length) + 6 : padding;
        const y = vertical ? chartHeight - padding - barHeight : padding + index * (innerHeight / data.length) + 6;

        return (
          <g key={`${item[labelKey]}-${index}`}>
            <rect x={vertical ? x : padding} y={vertical ? y : y} width={vertical ? Math.max(18, barWidth) : Math.max(18, barWidth * (value / maxValue) * 1.6)} height={vertical ? Math.max(18, barHeight) : Math.max(18, barHeight)} rx="8" fill={color} opacity={0.9} />
            <text x={vertical ? x + barWidth / 2 : padding + 6} y={vertical ? chartHeight - 8 : y + 16} fill="#475569" fontSize="10" textAnchor="middle">{String(item[labelKey]).slice(0, 12)}</text>
            <text x={vertical ? x + barWidth / 2 : padding + 6} y={vertical ? y - 6 : y + 16} fill="#1e2a4a" fontSize="10" textAnchor="middle">{value}</text>
          </g>
        );
      })}
    </svg>
  );
};

const SimpleLineChart = ({ data, valueKey = 'adherence', labelKey = 'day', color = '#2F6690', height = 260 }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyState message="No data available." />;
  }

  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 100);
  const min = Math.min(...data.map((item) => Number(item[valueKey] || 0)), 0);
  const width = 420;
  const padding = 26;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = data.map((item, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const y = height - padding - ((Number(item[valueKey]) - min) / Math.max(max - min || 1, 1)) * innerHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Line chart">
      {data.map((item, index) => {
        const x = padding + (index / Math.max(data.length - 1, 1)) * innerWidth;
        const y = height - padding - ((Number(item[valueKey]) - min) / Math.max(max - min || 1, 1)) * innerHeight;
        return (
          <g key={`${item[labelKey]}-${index}`}>
            <circle cx={x} cy={y} r="4" fill={color} />
            <text x={x} y={height - 8} fontSize="10" textAnchor="middle" fill="#475569">{String(item[labelKey]).slice(0, 8)}</text>
          </g>
        );
      })}
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const SimpleDonutChart = ({ data, colorScale = CHART_COLORS, valueKey = 'value', labelKey = 'name', height = 260 }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyState message="No data available." />;
  }

  const total = data.reduce((sum, item) => sum + Number(item[valueKey] || 0), 0) || 1;
  let cursor = 0;

  return (
    <svg viewBox="0 0 220 220" width="100%" height={height} role="img" aria-label="Donut chart">
      {data.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const fraction = value / total;
        const radius = 70;
        const circumference = 2 * Math.PI * radius;
        const dash = circumference * fraction;
        const offset = circumference - cursor * circumference;
        const strokeDasharray = `${dash} ${circumference - dash}`;
        const rotation = cursor * 360;
        cursor += fraction;

        return (
          <g key={`${item[labelKey]}-${index}`} transform="translate(110,110)">
            <circle r={radius} fill="transparent" stroke="#edf2f7" strokeWidth="28" />
            <circle
              r={radius}
              fill="transparent"
              stroke={colorScale[index % colorScale.length]}
              strokeWidth="28"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={-offset}
              transform="rotate(-90)"
            />
          </g>
        );
      })}
      <text x="110" y="110" textAnchor="middle" fill="#1e2a4a" fontSize="18" fontWeight="700">{total}</text>
    </svg>
  );
};

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const auth = getStoredAuth();

    if (!auth?.token) {
      setError('Authentication is required.');
      setLoading(false);
      return;
    }

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError('');
        const result = await getAdminAnalytics(auth.token, days);
        setData(result);
      } catch (err) {
        setError(err.message || 'Unable to load analytics.');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [days]);

  const doseChart = useMemo(() => {
    if (!data?.doseOutcomes?.data) return [];
    return data.doseOutcomes.data.map((item) => ({
      ...item,
      name: item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown',
    }));
  }, [data]);

  const trendChart = useMemo(() => {
    if (!data?.adherenceTrend?.data) return [];
    return data.adherenceTrend.data.map((item) => ({
      ...item,
      day: item.date || item.day || 'Unknown',
      adherence: toPercent(item.adherenceRate),
    }));
  }, [data]);

  const timeOfDayChart = useMemo(() => {
    if (!data?.timeOfDay?.data) return [];
    return data.timeOfDay.data.map((item) => ({
      ...item,
      name: item.timeOfDay ? item.timeOfDay.charAt(0).toUpperCase() + item.timeOfDay.slice(1) : 'Unknown',
      adherence: toPercent(item.adherenceRate),
    }));
  }, [data]);

  const regimenChart = useMemo(() => {
    if (!data?.regimenComplexity?.data) return [];
    return data.regimenComplexity.data.map((item) => ({
      ...item,
      name: item.group ? item.group.charAt(0).toUpperCase() + item.group.slice(1) : 'Unknown',
      adherence: toPercent(item.adherenceRate),
    }));
  }, [data]);

  const userRoleChart = useMemo(() => {
    if (!data?.userRoles?.data) return [];
    return data.userRoles.data.map((item) => ({
      ...item,
      name: item.role ? item.role.charAt(0).toUpperCase() + item.role.slice(1) : 'Unknown',
    }));
  }, [data]);

  const notificationsChart = useMemo(() => {
    if (!data?.notifications?.data) return [];
    return data.notifications.data.map((item) => ({
      ...item,
      name: item.type ? item.type.replace(/_/g, ' ') : 'Unknown',
    }));
  }, [data]);

  const refillsChart = useMemo(() => {
    if (!data?.refills) return [];
    return [
      { name: 'Tracked', value: data.refills.tracked || 0 },
      { name: 'At or below threshold', value: data.refills.atOrBelowThreshold || 0 },
      { name: 'Zero stock', value: data.refills.zeroStock || 0 },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="page-stack">
        <div className="panel page-header">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>Analytics</h2>
          </div>
        </div>
        <LoadingState label="Loading analytics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-stack">
        <div className="panel page-header">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>Analytics</h2>
          </div>
        </div>
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Analytics</h2>
        </div>
        <div className="segmented-control">
          {[7, 30, 90].map((option) => (
            <button
              key={option}
              type="button"
              className={option === days ? 'segmented-button active' : 'segmented-button'}
              onClick={() => setDays(option)}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-grid">
        <DashboardCard title="Dose Outcomes">
          {doseChart.length > 0 ? <SimpleBarChart data={doseChart} color="#2F6690" /> : <EmptyState message="No dose outcome data available." />}
        </DashboardCard>

        <DashboardCard title="Adherence Trend">
          {trendChart.length > 0 ? <SimpleLineChart data={trendChart} color="#2F6690" /> : <EmptyState message="No adherence data available." />}
        </DashboardCard>

        <DashboardCard title="Time of Day">
          {timeOfDayChart.length > 0 ? <SimpleBarChart data={timeOfDayChart} color="#5BA4A4" valueKey="adherenceRate" /> : <EmptyState message="No time-of-day data available." />}
        </DashboardCard>

        <DashboardCard title="Regimen Complexity">
          {regimenChart.length > 0 ? <SimpleBarChart data={regimenChart} color="#E76F51" valueKey="adherence" /> : <EmptyState message="No regimen complexity data available." />}
        </DashboardCard>

        <DashboardCard title="User Distribution">
          {userRoleChart.length > 0 ? <SimpleDonutChart data={userRoleChart} valueKey="count" /> : <EmptyState message="No user distribution data available." />}
        </DashboardCard>

        <DashboardCard title="Notification Volume">
          {notificationsChart.length > 0 ? <SimpleBarChart data={notificationsChart} color="#8BC34A" valueKey="count" vertical /> : <EmptyState message="No notification data available." />}
        </DashboardCard>

        <DashboardCard title="Refill Analytics">
          {refillsChart.some((item) => item.value > 0) ? <SimpleDonutChart data={refillsChart} valueKey="value" /> : <EmptyState message="No refill data available." />}
        </DashboardCard>
      </div>
    </div>
  );
}
