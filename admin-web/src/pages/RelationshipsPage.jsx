import { useEffect, useState } from 'react';

import { getRelationship, listRelationships, revokeRelationship } from '../services/api';

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const displayUser = (user) => {
  if (!user) {
    return 'Unavailable';
  }

  if (user.username) {
    return user.username;
  }

  if (user.email) {
    return user.email;
  }

  return 'Unavailable';
};

const formatPermission = (permission) => {
  if (permission === 'ADHERENCE_SUPPORT') {
    return 'Adherence support';
  }

  if (permission === 'VIEW_ONLY') {
    return 'View only';
  }

  if (permission === true || permission === 'true') {
    return 'Enabled';
  }

  if (permission === false || permission === 'false') {
    return 'Disabled';
  }

  return 'Unavailable';
};

export default function RelationshipsPage() {
  const [relationships, setRelationships] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState(null);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    const loadRelationships = async () => {
      const auth = getStoredAuth();

      if (!auth?.token) {
        setError('Authentication is required.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const result = await listRelationships(auth.token, {
          page,
          limit: 20,
          search: searchTerm,
          status: statusFilter,
        });

        setRelationships(result?.data || []);
        setPagination(result?.pagination || { page, limit: 20, total: 0, pages: 0 });
      } catch (err) {
        setRelationships([]);
        setError(err.message || 'Unable to load relationships.');
      } finally {
        setLoading(false);
      }
    };

    loadRelationships();
  }, [page, searchTerm, statusFilter]);

  const openRelationshipDetails = async (relationshipId) => {
    const auth = getStoredAuth();

    if (!auth?.token) {
      setError('Authentication is required.');
      return;
    }

    try {
      setDetailsLoading(true);
      setError('');
      const result = await getRelationship(auth.token, relationshipId);
      setSelectedRelationship(result?.relationship || null);
    } catch (err) {
      setError(err.message || 'Unable to load relationship details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleRevoke = async (relationship) => {
    const confirmed = window.confirm('Revoke this caregiver relationship?');

    if (!confirmed) {
      return;
    }

    const auth = getStoredAuth();

    if (!auth?.token) {
      setError('Authentication is required.');
      return;
    }

    try {
      setError('');
      setStatusMessage('');
      await revokeRelationship(auth.token, relationship._id);
      setStatusMessage('Relationship revoked successfully.');
      setSelectedRelationship(null);
      const refreshed = await listRelationships(auth.token, {
        page,
        limit: 20,
        search: searchTerm,
        status: statusFilter,
      });
      setRelationships(refreshed?.data || []);
      setPagination(refreshed?.pagination || pagination);
    } catch (err) {
      setError(err.message || 'Unable to revoke relationship.');
    }
  };

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Management</p>
          <h2>Relationships</h2>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <input
            className="search-input"
            type="search"
            placeholder="Search caregiver or patient"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />

          <select
            className="select-input"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        {statusMessage ? <div className="success-banner">{statusMessage}</div> : null}
        {error ? <div className="error-state">{error}</div> : null}

        {loading ? (
          <div className="loading-state">Loading relationships…</div>
        ) : relationships.length === 0 ? (
          <div className="empty-state">No relationships match the current filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Caregiver</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Permission</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {relationships.map((relationship) => (
                  <tr key={relationship._id}>
                    <td>{displayUser(relationship.caregiver)}</td>
                    <td>{displayUser(relationship.patient)}</td>
                    <td>
                      <span className={`status-badge status-${relationship.status || 'unknown'}`}>
                        {relationship.status ? relationship.status.charAt(0).toUpperCase() + relationship.status.slice(1) : 'Unknown'}
                      </span>
                    </td>
                    <td>{formatPermission(relationship.permission)}</td>
                    <td>{formatDate(relationship.createdAt)}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="secondary-button small"
                        onClick={() => openRelationshipDetails(relationship._id)}
                      >
                        Details
                      </button>
                      {relationship.status !== 'revoked' ? (
                        <button
                          type="button"
                          className="logout-button small"
                          onClick={() => handleRevoke(relationship)}
                        >
                          Revoke
                        </button>
                      ) : null}
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

      <div className="panel">
        <h3>Relationship details</h3>
        {detailsLoading ? (
          <div className="loading-state">Loading relationship details…</div>
        ) : selectedRelationship ? (
          <div className="detail-grid">
            <div><span>Caregiver</span><strong>{displayUser(selectedRelationship.caregiver)}</strong></div>
            <div><span>Patient</span><strong>{displayUser(selectedRelationship.patient)}</strong></div>
            <div><span>Status</span><strong>{selectedRelationship.status || 'Unknown'}</strong></div>
            <div><span>Permission</span><strong>{formatPermission(selectedRelationship.permission)}</strong></div>
            <div><span>Created</span><strong>{formatDate(selectedRelationship.createdAt)}</strong></div>
            <div><span>Updated</span><strong>{formatDate(selectedRelationship.updatedAt)}</strong></div>
          </div>
        ) : (
          <div className="empty-state">Select a relationship to inspect its details.</div>
        )}
      </div>
    </div>
  );
}
