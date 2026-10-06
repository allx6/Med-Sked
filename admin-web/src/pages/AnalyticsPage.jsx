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

const formatPercent = (value) => `${toPercent(value)}%`;
const formatNumber = (value) => Number(value || 0).toLocaleString();

const DashboardCard = ({ title, meta, children }) => (
  <div className="panel chart-panel">
    <div className="chart-panel-heading">
      <h3>{title}</h3>
      {meta ? <span className="chart-panel-meta">{meta}</span> : null}
    </div>
    {children}
  </div>
);

const EmptyState = ({ message }) => <div className="empty-state">{message}</div>;
const LoadingState = ({ label = 'Loading...' }) => <div className="loading-state">{label}</div>;
const ErrorState = ({ message }) => <div className="error-state">{message}</div>;

const getChartValue = (item, valueKey) => {
  const value = Number(item?.[valueKey]);
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
};

const SimpleBarChart = ({ data, color = '#2F6690', valueKey = 'count', labelKey = 'name', valueSuffix = '' }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyState message="No data available." />;
  }

  const maxValue = Math.max(...data.map((item) => getChartValue(item, valueKey)), 1);

  return (
    <div className="bar-chart" role="list">
      {data.map((item, index) => {
        const value = getChartValue(item, valueKey);
        const percentage = (value / maxValue) * 100;
        const label = String(item[labelKey] ?? 'Unknown');

        return (
          <div className="bar-chart-row" key={`${label}-${index}`} role="listitem">
            <div className="bar-chart-heading">
              <span className="bar-chart-label" title={label}>{label}</span>
              <strong>{formatNumber(value)}{valueSuffix}</strong>
            </div>
            <div
              className="bar-chart-track"
              role="progressbar"
              aria-label={label}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.round(percentage)}
              aria-valuetext={`${formatNumber(value)}${valueSuffix}`}
            >
              <span className="bar-chart-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SimpleLineChart = ({ data, valueKey = 'adherence', labelKey = 'day', color = '#2F6690' }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyState message="No data available." />;
  }

  const width = 640;
  const height = 300;
  const padding = { top: 18, right: 20, bottom: 44, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = data.map((item) => Math.min(100, getChartValue(item, valueKey)));
  const peakValue = Math.max(...values);
  const points = values.map((value, index) => {
    const x = padding.left + (index / Math.max(values.length - 1, 1)) * plotWidth;
    const y = padding.top + ((100 - value) / 100) * plotHeight;
    return { x, y, value, label: String(data[index][labelKey] ?? 'Unknown') };
  });
  const pointString = points.map(({ x, y }) => `${x},${y}`).join(' ');
  const areaString = `${padding.left},${padding.top + plotHeight} ${pointString} ${padding.left + plotWidth},${padding.top + plotHeight}`;
  const labelIndexes = [...new Set([0, 0.25, 0.5, 0.75, 1].map((position) => Math.round((data.length - 1) * position)))];

  return (
    <svg className="line-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Adherence trend by date">
      <title>Adherence trend by date</title>
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = padding.top + ((100 - tick) / 100) * plotHeight;
        return (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="line-chart-gridline" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="line-chart-axis-label line-chart-percentage-label">{tick}%</text>
          </g>
        );
      })}
      <polygon points={areaString} fill={color} opacity="0.1" />
      <polyline points={pointString} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => (
        <circle
          key={`${point.label}-${index}`}
          cx={point.x}
          cy={point.y}
          r={peakValue > 0 && point.value === peakValue ? 6 : data.length > 30 ? 2.5 : 4}
          fill={color}
          stroke={peakValue > 0 && point.value === peakValue ? '#ffffff' : 'none'}
          strokeWidth="2"
        >
          <title>{`${point.label}: ${formatPercent(point.value)}`}</title>
        </circle>
      ))}
      {labelIndexes.map((index) => {
        const label = points[index].label;
        const shortLabel = /^\d{4}-\d{2}-\d{2}/.test(label) ? label.slice(5, 10) : label.slice(0, 12);
        return (
          <text key={`${label}-${index}`} x={points[index].x} y={height - 12} textAnchor="middle" className="line-chart-axis-label line-chart-date-label">
            {shortLabel}
          </text>
        );
      })}
    </svg>
  );
};

const SimpleDonutChart = ({ data, colorScale = CHART_COLORS, valueKey = 'value', labelKey = 'name' }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyState message="No data available." />;
  }

  const total = data.reduce((sum, item) => sum + getChartValue(item, valueKey), 0);
  if (total <= 0) {
    return <EmptyState message="No recorded values available." />;
  }

  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-chart">
      <svg className="donut-chart-svg" viewBox="0 0 220 220" role="img" aria-label={`Distribution of ${formatNumber(total)} records`}>
        <title>Record distribution</title>
        <circle cx="110" cy="110" r={radius} fill="none" stroke="#e3e9ef" strokeWidth="24" />
        {data.map((item, index) => {
          const value = getChartValue(item, valueKey);
          const segmentLength = (value / total) * circumference;
          const segmentOffset = offset;
          offset += segmentLength;

          if (value === 0) return null;

          return (
            <circle
              key={`${item[labelKey]}-${index}`}
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke={colorScale[index % colorScale.length]}
              strokeWidth="24"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-segmentOffset}
              transform="rotate(-90 110 110)"
            >
              <title>{`${String(item[labelKey] ?? 'Unknown')}: ${formatNumber(value)} (${Math.round((value / total) * 100)}%)`}</title>
            </circle>
          );
        })}
        <text x="110" y="106" textAnchor="middle" className="donut-chart-total">{formatNumber(total)}</text>
        <text x="110" y="128" textAnchor="middle" className="donut-chart-caption">total</text>
      </svg>
      <ul className="donut-chart-legend">
        {data.map((item, index) => {
          const value = getChartValue(item, valueKey);
          return (
            <li key={`${item[labelKey]}-${index}`}>
              <span className="donut-legend-name">
                <span className="donut-legend-swatch" style={{ backgroundColor: colorScale[index % colorScale.length] }} aria-hidden="true" />
                {String(item[labelKey] ?? 'Unknown')}
              </span>
              <strong>{formatNumber(value)} <span>{Math.round((value / total) * 100)}%</span></strong>
            </li>
          );
        })}
      </ul>
    </div>
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
      name: item.type
        ? String(item.type)
          .replace(/[_-]+/g, ' ')
          .trim()
          .toLowerCase()
          .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
        : 'Unknown',
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

  const analyticsSummary = useMemo(() => {
    const trend = trendChart.filter((item) => Number.isFinite(item.adherence));
    const latest = trend[trend.length - 1]?.adherence ?? 0;
    const first = trend[0]?.adherence ?? latest;
    const peak = Math.max(...trend.map((item) => item.adherence), 0);
    const bestTime = [...timeOfDayChart].sort((a, b) => b.adherence - a.adherence)[0];
    const weakestRegimen = [...regimenChart].sort((a, b) => a.adherence - b.adherence)[0];
    const missed = doseChart.find((item) => item.status === 'Missed')?.count || 0;

    return { latest, peak, change: latest - first, bestTime, weakestRegimen, missed };
  }, [doseChart, regimenChart, timeOfDayChart, trendChart]);

  if (loading) {
    return (
      <div className="page-stack">
        <div className="panel page-header">
          <div>
            <p className="eyebrow">Overview</p>
            <h2 className="analytics-page-title">Analytics</h2>
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
            <h2 className="analytics-page-title">Analytics</h2>
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
          <p className="eyebrow">Decision support</p>
          <h2 className="analytics-page-title">Analytics</h2>
          <p className="page-intro">Explore adherence and medication activity over the selected period.</p>
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

      <div className="analytics-summary" aria-label="Analytics summary">
        <div className="summary-highlight">
          <span>Latest adherence</span>
          <strong>{formatPercent(analyticsSummary.latest)}</strong>
          <small className={analyticsSummary.change >= 0 ? 'trend-positive' : 'trend-negative'}>
            {analyticsSummary.change >= 0 ? '↑' : '↓'} {Math.abs(toPercent(analyticsSummary.change))}% vs period start
          </small>
        </div>
        <div className="summary-highlight">
          <span>Missed doses</span>
          <strong>{formatNumber(analyticsSummary.missed)}</strong>
          <small>Across the selected dose data</small>
        </div>
        <div className="summary-highlight">
          <span>Strongest time window</span>
          <strong>{analyticsSummary.bestTime?.name || 'No data'}</strong>
          <small>{analyticsSummary.bestTime ? `${formatPercent(analyticsSummary.bestTime.adherence)} adherence` : 'Awaiting records'}</small>
        </div>
        <div className="summary-highlight">
          <span>Lowest regimen adherence</span>
          <strong>{analyticsSummary.weakestRegimen?.name || 'No data'}</strong>
          <small>{analyticsSummary.weakestRegimen ? `${formatPercent(analyticsSummary.weakestRegimen.adherence)} adherence` : 'Awaiting records'}</small>
        </div>
      </div>

      <div className="analytics-grid">
        <DashboardCard title="Dose Outcomes">
          {doseChart.length > 0 ? <SimpleBarChart data={doseChart} color="#2F6690" /> : <EmptyState message="No dose outcome data available." />}
        </DashboardCard>

        <DashboardCard title="Adherence Trend" meta={trendChart.length ? `Peak ${formatPercent(analyticsSummary.peak)}` : null}>
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

        <DashboardCard title="Notifications by Type">
          {notificationsChart.length > 0 ? <SimpleBarChart data={notificationsChart} color="#8BC34A" valueKey="count" /> : <EmptyState message="No notification data available." />}
        </DashboardCard>

        <DashboardCard title="Refill Analytics">
          {refillsChart.some((item) => item.value > 0) ? <SimpleDonutChart data={refillsChart} valueKey="value" /> : <EmptyState message="No refill data available." />}
        </DashboardCard>
      </div>
    </div>
  );
}
