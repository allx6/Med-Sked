import { useEffect, useMemo, useState } from 'react';

import { listAuditLogs } from '../services/api';

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatActor = (actor) => {
  if (!actor) {
    return 'Unavailable';
  }

  const name = actor.username || actor.email || actor.role || 'Unknown actor';
  return `${name}${actor.role ? ` (${actor.role})` : ''}`;
};

const formatAuditAction = (action) => {
  if (!action) return 'Unknown';

  return String(action)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
};

const formatDetailValue = (value) => {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const AUDIT_ACTIONS = [
  'ADMIN_ROLE_CHANGED',
  'ADMIN_RELATIONSHIP_REVOKED',
  'CAREGIVER_REQUEST_CREATED',
  'CAREGIVER_REQUEST_ACCEPTED',
  'CAREGIVER_REQUEST_DECLINED',
  'CAREGIVER_RELATIONSHIP_REVOKED',
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [actorId, setActorId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsClosing, setDetailsClosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLogs = async () => {
      const auth = getStoredAuth();

      if (!auth?.token) {
        setError('Authentication is required.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const result = await listAuditLogs(auth.token, {
          page,
          limit: 20,
          action,
          targetType,
          actorId,
          from: fromDate,
          to: toDate,
        });

        setLogs(result?.data || []);
        setPagination(result?.pagination || { page, limit: 20, total: 0, pages: 0 });
        setSelectedLog((current) => {
          if (current && result?.data?.some((item) => item._id === current._id)) {
            return current;
          }
          return null;
        });
      } catch (err) {
        setLogs([]);
        setError(err.message || 'Unable to load audit logs.');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [page, action, targetType, actorId, fromDate, toDate]);

  const detailEntries = useMemo(() => {
    if (!selectedLog?.details) {
      return [];
    }

    return Object.entries(selectedLog.details || {});
  }, [selectedLog]);

  const hasActiveFilters = Boolean(action || targetType || actorId || fromDate || toDate);

  const clearFilters = () => {
    setAction('');
    setTargetType('');
    setActorId('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const closeAuditDetails = () => {
    setDetailsClosing(true);
  };

  const finishClosingAuditDetails = (event) => {
    if (event.target !== event.currentTarget || !detailsClosing) {
      return;
    }

    setDetailsOpen(false);
    setDetailsClosing(false);
  };

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Security</p>
          <h2 className="audit-logs-page-title">Audit Logs</h2>
          <p className="page-intro">Review administrative events and relationship changes.</p>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar audit-filter-toolbar">
          <select
            className="select-input"
            aria-label="Filter by action"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <input
            className="search-input"
            type="text"
            aria-label="Filter by target type"
            placeholder="Target type"
            value={targetType}
            onChange={(event) => {
              setTargetType(event.target.value);
              setPage(1);
            }}
          />

          <input
            className="search-input"
            type="text"
            aria-label="Filter by actor ID"
            placeholder="Actor ID"
            value={actorId}
            onChange={(event) => {
              setActorId(event.target.value);
              setPage(1);
            }}
          />

          <input
            className="select-input"
            type="date"
            aria-label="Filter from date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
          />

          <input
            className="select-input"
            type="date"
            aria-label="Filter to date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
          />
          <button type="button" className="secondary-button audit-clear-button" disabled={!hasActiveFilters} onClick={clearFilters}>
            Clear filters
          </button>
        </div>

        {error ? <div className="error-state">{error}</div> : null}

        {loading ? (
          <div className="loading-state">Loading audit logs…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">No audit records match the current filters.</div>
        ) : (
          <div className="table-wrap">
            <div className="audit-table-summary">
              <span>Activity records</span>
              <strong>{formatNumber(pagination.total)} total</strong>
            </div>
            <table className="data-table audit-table">
              <caption className="visually-hidden">Administrative audit log records</caption>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target Type</th>
                  <th>Target ID</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className={selectedLog?._id === log._id ? 'audit-log-row selected' : 'audit-log-row'}>
                    <td>{formatDateTime(log.timestamp)}</td>
                    <td><span className="audit-action-badge">{formatAuditAction(log.action)}</span></td>
                    <td>{formatActor(log.actorId)}</td>
                    <td>{log.targetType || 'Unknown'}</td>
                    <td><code className="audit-target-id" title={log.targetId || ''}>{log.targetId || '—'}</code></td>
                    <td>
                      <button
                        type="button"
                        className="audit-detail-button"
                        aria-haspopup="dialog"
                        aria-pressed={detailsOpen && selectedLog?._id === log._id}
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailsClosing(false);
                          setDetailsOpen(true);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pagination.pages > 1 ? (
          <div className="pagination-bar">
            <button
              type="button"
              className="secondary-button"
              disabled={page <= 1}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              Previous
            </button>
            <span>
              Page {pagination.page || page} of {pagination.pages || 1}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={page >= (pagination.pages || 1)}
              onClick={() => setPage((currentPage) => Math.min(pagination.pages || currentPage, currentPage + 1))}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {detailsOpen && selectedLog ? (
        <div
          className={`modal-backdrop audit-details-backdrop${detailsClosing ? ' is-closing' : ''}`}
          role="presentation"
          onAnimationEnd={finishClosingAuditDetails}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAuditDetails();
          }}
        >
          <section className="modal-panel audit-details-modal" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Security</p>
                <h3 id="audit-detail-title">Audit detail</h3>
              </div>
              <button type="button" className="modal-close" aria-label="Close audit details" onClick={closeAuditDetails}>
                ×
              </button>
            </div>
            <div className="detail-grid">
              <div>
                <span>Timestamp</span>
                <strong>{formatDateTime(selectedLog.timestamp)}</strong>
              </div>
              <div>
                <span>Action</span>
                <strong>{formatAuditAction(selectedLog.action)}</strong>
              </div>
              <div>
                <span>Actor</span>
                <strong>{formatActor(selectedLog.actorId)}</strong>
              </div>
              <div>
                <span>Target Type</span>
                <strong>{selectedLog.targetType || 'Unknown'}</strong>
              </div>
              <div>
                <span>Target ID</span>
                <strong>{selectedLog.targetId || '—'}</strong>
              </div>
              <div>
                <span>Role</span>
                <strong>{selectedLog.actorRole || 'Unknown'}</strong>
              </div>
            </div>
            {detailEntries.length > 0 ? (
              <pre className="audit-detail-data">
                {detailEntries.map(([key, value]) => `${key}: ${formatDetailValue(value)}`).join('\n')}
              </pre>
            ) : null}
          </section>
        </div>
      ) : null}

    </div>
  );
}
