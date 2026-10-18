import { useEffect, useState } from 'react';

import {
  createPrivilegedActionRequest,
  getRelationship,
  listRelationships,
} from '../services/api';

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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsClosing, setDetailsClosing] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [revokeRequest, setRevokeRequest] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [requestingRevoke, setRequestingRevoke] = useState(false);
  const [revokeError, setRevokeError] = useState('');

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
      setDetailsError('Authentication is required.');
      setDetailsClosing(false);
      setDetailsOpen(true);
      return;
    }

    setDetailsClosing(false);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setSelectedRelationship(null);
    setDetailsError('');
    try {
      const result = await getRelationship(auth.token, relationshipId);
      setSelectedRelationship(result?.relationship || null);
    } catch (err) {
      setDetailsError(err.message || 'Unable to load relationship details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeRelationshipDetails = () => {
    setDetailsClosing(true);
  };

  const finishClosingRelationshipDetails = (event) => {
    if (event.target !== event.currentTarget || !detailsClosing) {
      return;
    }

    setDetailsOpen(false);
    setDetailsClosing(false);
    setSelectedRelationship(null);
    setDetailsError('');
  };

  const handleRevoke = (relationship) => {
    setRevokeRequest(relationship);
    setRevokeReason('');
    setRevokeError('');
  };

  const submitRevokeRequest = async (event) => {
    event.preventDefault();
    if (!revokeRequest) return;
    const auth = getStoredAuth();

    if (!auth?.token) {
      setRevokeError('Authentication is required.');
      return;
    }

    try {
      setRequestingRevoke(true);
      setRevokeError('');
      await createPrivilegedActionRequest(auth.token, {
        actionType: 'CAREGIVER_RELATIONSHIP_REVOKE',
        targetId: revokeRequest._id,
        reason: revokeReason.trim(),
      });
      setStatusMessage('Approval request submitted. Another administrator must review it.');
      setRevokeRequest(null);
      setRevokeReason('');
    } catch (err) {
      setRevokeError(err.message || 'Unable to submit the approval request.');
    } finally {
      setRequestingRevoke(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Management</p>
          <h2 className="relationships-page-title">Relationships</h2>
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
            <option value="">All status</option>
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
                      <span className={`status-badge relationship-status-badge status-${relationship.status || 'unknown'}`}>
                        {relationship.status ? relationship.status.charAt(0).toUpperCase() + relationship.status.slice(1) : 'Unknown'}
                      </span>
                    </td>
                    <td>{formatPermission(relationship.permission)}</td>
                    <td>{formatDate(relationship.createdAt)}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="relationship-action-button relationship-details-button small"
                        onClick={() => openRelationshipDetails(relationship._id)}
                      >
                        Details
                      </button>
                      {relationship.status !== 'revoked' ? (
                        <button
                          type="button"
                          className="relationship-action-button relationship-revoke-button small"
                          onClick={() => handleRevoke(relationship)}
                        >
                          Request revoke
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

      {detailsOpen ? (
        <div
          className={`modal-backdrop relationship-details-backdrop${detailsClosing ? ' is-closing' : ''}`}
          role="presentation"
          onAnimationEnd={finishClosingRelationshipDetails}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRelationshipDetails();
          }}
        >
          <section className="modal-panel relationship-details-modal" role="dialog" aria-modal="true" aria-labelledby="relationship-details-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Relationship</p>
                <h3 id="relationship-details-title">Relationship details</h3>
              </div>
              <button type="button" className="modal-close" aria-label="Close relationship details" onClick={closeRelationshipDetails}>
                ×
              </button>
            </div>
            {detailsLoading ? (
              <div className="loading-state">Loading relationship details…</div>
            ) : detailsError ? (
              <div className="error-state" role="alert">{detailsError}</div>
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
              <div className="empty-state">Relationship details are unavailable.</div>
            )}
          </section>
        </div>
      ) : null}

      {revokeRequest ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !requestingRevoke) setRevokeRequest(null);
        }}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="relationship-revoke-request-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Administrator approval</p>
                <h3 id="relationship-revoke-request-title">Request relationship revocation</h3>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close request form"
                disabled={requestingRevoke}
                onClick={() => setRevokeRequest(null)}
              >
                ×
              </button>
            </div>
            <form className="user-form" onSubmit={submitRevokeRequest}>
              <p>
                {displayUser(revokeRequest.caregiver)} → {displayUser(revokeRequest.patient)}
                {' '}will remain active unless a different administrator approves.
              </p>
              <label>
                Reason for this request
                <textarea
                  required
                  maxLength={500}
                  rows={4}
                  value={revokeReason}
                  onChange={(event) => setRevokeReason(event.target.value)}
                />
              </label>
              {revokeError ? <div className="error-state" role="alert">{revokeError}</div> : null}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={requestingRevoke}
                  onClick={() => setRevokeRequest(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={requestingRevoke || !revokeReason.trim()}>
                  {requestingRevoke ? 'Submitting…' : 'Submit for approval'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

    </div>
  );
}
