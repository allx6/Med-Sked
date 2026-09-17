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

const formatActor = (actor) => {
  if (!actor) {
    return 'Unavailable';
  }

  const name = actor.username || actor.email || actor.role || 'Unknown actor';
  return `${name}${actor.role ? ` (${actor.role})` : ''}`;
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
          return result?.data?.[0] || null;
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

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Security</p>
          <h2>Audit Logs</h2>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <select
            className="select-input"
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
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
          />

          <input
            className="select-input"
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {error ? <div className="error-state">{error}</div> : null}

        {loading ? (
          <div className="loading-state">Loading audit logs…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">No audit records match the current filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target Type</th>
                  <th>Target ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} onClick={() => setSelectedLog(log)} style={{ cursor: 'pointer' }}>
                    <td>{formatDateTime(log.timestamp)}</td>
                    <td>{log.action || 'Unknown'}</td>
                    <td>{formatActor(log.actorId)}</td>
                    <td>{log.targetType || 'Unknown'}</td>
                    <td>{log.targetId || '—'}</td>
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

      <div className="panel">
        <h3>Audit detail</h3>
        {selectedLog ? (
          <div className="detail-grid">
            <div>
              <span>Timestamp</span>
              <strong>{formatDateTime(selectedLog.timestamp)}</strong>
            </div>
            <div>
              <span>Action</span>
              <strong>{selectedLog.action || 'Unknown'}</strong>
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
        ) : (
          <div className="empty-state">Select a log entry to view its safe details.</div>
        )}

        {detailEntries.length > 0 ? (
          <pre style={{ marginTop: '18px' }}>
            {detailEntries.map(([key, value]) => `${key}: ${formatDetailValue(value)}`).join('\n')}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
