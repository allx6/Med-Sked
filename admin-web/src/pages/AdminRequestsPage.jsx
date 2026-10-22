import { useEffect, useMemo, useState } from 'react';

import {
  approvePrivilegedActionRequest,
  cancelPrivilegedActionRequest,
  getPrivilegedActionRequest,
  listPrivilegedActionRequests,
  rejectPrivilegedActionRequest,
  updatePrivilegedActionRequest,
} from '../services/api';

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const actionLabels = {
  USER_DELETE: 'Legacy deletion (blocked)',
  USER_DEACTIVATE: 'Deactivate account',
  USER_REACTIVATE: 'Reactivate account',
  USER_ROLE_CHANGE: 'Change user role',
  CAREGIVER_RELATIONSHIP_REVOKE: 'Revoke caregiver relationship',
};

const displayUser = (user) => user?.username || user?.email || 'Unavailable';

const getTargetLabel = (request) => {
  if (request.targetType === 'USER') {
    return request.target?.username || request.target?.label || request.requestData?.targetLabel || request.targetId;
  }
  const caregiver = displayUser(request.target?.caregiver);
  const patient = displayUser(request.target?.patient);
  return caregiver !== 'Unavailable' || patient !== 'Unavailable'
    ? `${caregiver} → ${patient}`
    : request.target?.label || request.requestData?.targetLabel || request.targetId;
};

const getUserId = (user) => user?._id || user?.id || user?.userId;

export default function AdminRequestsPage() {
  const auth = useMemo(getStoredAuth, []);
  const [status, setStatus] = useState('PENDING');
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [editRequest, setEditRequest] = useState(null);
  const [editReason, setEditReason] = useState('');
  const [cancelRequest, setCancelRequest] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [updatingRequest, setUpdatingRequest] = useState(false);
  const [requestLifecycleError, setRequestLifecycleError] = useState('');

  useEffect(() => {
    let active = true;
    const loadRequests = async () => {
      if (!auth?.token) {
        setError('Authentication is required.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const result = await listPrivilegedActionRequests(auth.token, { status, page, limit: 20 });
        if (active) {
          setRequests(result?.data || []);
          setPagination(result?.pagination || { page, pages: 0, total: 0 });
        }
      } catch (err) {
        if (active) {
          setRequests([]);
          setError(err.message || 'Unable to load approval requests.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadRequests();
    return () => { active = false; };
  }, [auth, page, refreshKey, status]);

  const openDetails = async (request) => {
    setSelectedRequest(request);
    try {
      const result = await getPrivilegedActionRequest(auth.token, request._id);
      setSelectedRequest(result?.request || request);
    } catch (err) {
      setError(err.message || 'Unable to load request details.');
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!reviewAction || !auth?.token) return;
    try {
      setReviewing(true);
      setReviewError('');
      if (reviewAction.type === 'approve') {
        await approvePrivilegedActionRequest(auth.token, reviewAction.request._id);
        setStatusMessage('Request approved and the action was executed.');
      } else {
        await rejectPrivilegedActionRequest(
          auth.token,
          reviewAction.request._id,
          reviewReason.trim()
        );
        setStatusMessage('Approval request rejected.');
      }
      setReviewAction(null);
      setReviewReason('');
      setSelectedRequest(null);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setReviewError(err.message || 'Unable to complete this review.');
      setRefreshKey((current) => current + 1);
    } finally {
      setReviewing(false);
    }
  };

  const submitRequestEdit = async (event) => {
    event.preventDefault();
    if (!editRequest || !auth?.token) return;
    try {
      setUpdatingRequest(true);
      setRequestLifecycleError('');
      await updatePrivilegedActionRequest(auth.token, editRequest._id, { reason: editReason.trim() });
      setStatusMessage('Request reason updated.');
      setEditRequest(null);
      setRefreshKey((current) => current + 1);
      if (selectedRequest?._id === editRequest._id) setSelectedRequest(null);
    } catch (err) {
      setRequestLifecycleError(err.message || 'Unable to update the request.');
    } finally {
      setUpdatingRequest(false);
    }
  };

  const submitRequestCancellation = async (event) => {
    event.preventDefault();
    if (!cancelRequest || !auth?.token) return;
    try {
      setUpdatingRequest(true);
      setRequestLifecycleError('');
      await cancelPrivilegedActionRequest(auth.token, cancelRequest._id, cancelReason.trim());
      setStatusMessage('Request canceled. The request record remains available for audit.');
      setCancelRequest(null);
      setCancelReason('');
      setRefreshKey((current) => current + 1);
      if (selectedRequest?._id === cancelRequest._id) setSelectedRequest(null);
    } catch (err) {
      setRequestLifecycleError(err.message || 'Unable to cancel the request.');
      setRefreshKey((current) => current + 1);
    } finally {
      setUpdatingRequest(false);
    }
  };

  const currentUserId = getUserId(auth?.user);

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Security</p>
          <h2>Admin Requests</h2>
          <p className="page-intro">Review sensitive actions requested by administrators.</p>
        </div>
        <select
          className="select-input"
          aria-label="Filter requests by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
            setStatusMessage('');
          }}
        >
          <option value="PENDING">Pending</option>
          <option value="EXECUTED">Executed</option>
          <option value="REJECTED">Rejected</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELED">Canceled</option>
        </select>
      </div>

      <div className="panel">
        {statusMessage ? <div className="success-banner" role="status">{statusMessage}</div> : null}
        {error ? <div className="error-state" role="alert">{error}</div> : null}
        {loading ? (
          <div className="loading-state">Loading approval requests…</div>
        ) : requests.length === 0 ? (
          <div className="empty-state">No {status.toLowerCase()} requests.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Requested by</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const isOwnRequest = String(getUserId(request.requesterId)) === String(currentUserId);
                  return (
                    <tr key={request._id}>
                      <td>{actionLabels[request.actionType] || request.actionType}</td>
                      <td>{getTargetLabel(request)}</td>
                      <td>{displayUser(request.requesterId)}</td>
                      <td>{formatDateTime(request.requestedAt)}</td>
                      <td>{request.status}</td>
                      <td className="actions-cell">
                        <button type="button" className="secondary-button compact-button" onClick={() => openDetails(request)}>
                          Details
                        </button>
                        {request.status === 'PENDING' ? (
                          <>
                            <button
                              type="button"
                              className="primary-button compact-button"
                              disabled={isOwnRequest}
                              title={isOwnRequest ? 'A different administrator must review this request.' : undefined}
                              onClick={() => {
                                setReviewAction({ type: 'approve', request });
                                setReviewError('');
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              disabled={isOwnRequest}
                              title={isOwnRequest ? 'A different administrator must review this request.' : undefined}
                              onClick={() => {
                                setReviewAction({ type: 'reject', request });
                                setReviewReason('');
                                setReviewError('');
                              }}
                            >
                              Reject
                            </button>
                            {isOwnRequest ? (
                              <button
                                type="button"
                                className="secondary-button compact-button"
                                onClick={() => {
                                  setEditRequest(request);
                                  setEditReason(request.reason || '');
                                  setRequestLifecycleError('');
                                }}
                              >
                                Edit reason
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => {
                                setCancelRequest(request);
                                setCancelReason('');
                                setRequestLifecycleError('');
                              }}
                            >
                              Cancel request
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pagination.pages > 1 ? (
          <div className="pagination-bar">
            <button type="button" className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>Page {pagination.page || page} of {pagination.pages}</span>
            <button type="button" className="secondary-button" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>
              Next
            </button>
          </div>
        ) : null}
      </div>

      {selectedRequest ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedRequest(null);
        }}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="admin-request-details-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Privileged action</p>
                <h3 id="admin-request-details-title">{actionLabels[selectedRequest.actionType] || selectedRequest.actionType}</h3>
              </div>
              <button type="button" className="modal-close" aria-label="Close request details" onClick={() => setSelectedRequest(null)}>×</button>
            </div>
            <div className="detail-grid">
              <div><span>Target</span><strong>{getTargetLabel(selectedRequest)}</strong></div>
              {selectedRequest.actionType === 'USER_ROLE_CHANGE' ? (
                <div><span>Requested change</span><strong>{selectedRequest.requestData?.previousRole} → {selectedRequest.requestData?.requestedRole}</strong></div>
              ) : null}
              <div><span>Requested by</span><strong>{displayUser(selectedRequest.requesterId)}</strong></div>
              <div><span>Submitted</span><strong>{formatDateTime(selectedRequest.requestedAt)}</strong></div>
              <div><span>Status</span><strong>{selectedRequest.status}</strong></div>
              {selectedRequest.approverId ? <div><span>Reviewed by</span><strong>{displayUser(selectedRequest.approverId)}</strong></div> : null}
              {selectedRequest.reviewedAt ? <div><span>Reviewed</span><strong>{formatDateTime(selectedRequest.reviewedAt)}</strong></div> : null}
              {selectedRequest.executedAt ? <div><span>Executed</span><strong>{formatDateTime(selectedRequest.executedAt)}</strong></div> : null}
              {selectedRequest.canceledBy ? <div><span>Canceled by</span><strong>{displayUser(selectedRequest.canceledBy)}</strong></div> : null}
              {selectedRequest.canceledAt ? <div><span>Canceled</span><strong>{formatDateTime(selectedRequest.canceledAt)}</strong></div> : null}
              <div className="detail-full"><span>Reason</span><strong>{selectedRequest.reason}</strong></div>
              {selectedRequest.rejectionReason ? <div className="detail-full"><span>Rejection reason</span><strong>{selectedRequest.rejectionReason}</strong></div> : null}
              {selectedRequest.cancellationReason ? <div className="detail-full"><span>Cancellation reason</span><strong>{selectedRequest.cancellationReason}</strong></div> : null}
              {selectedRequest.executionResult ? <div className="detail-full"><span>Execution result</span><strong>{selectedRequest.executionResult}</strong></div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {reviewAction ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !reviewing) setReviewAction(null);
        }}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="admin-request-review-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Administrator review</p>
                <h3 id="admin-request-review-title">
                  {reviewAction.type === 'approve' ? 'Approve and execute action?' : 'Reject request?'}
                </h3>
              </div>
              <button type="button" className="modal-close" disabled={reviewing} aria-label="Close review form" onClick={() => setReviewAction(null)}>×</button>
            </div>
            <form className="user-form" onSubmit={submitReview}>
              <p>
                {actionLabels[reviewAction.request.actionType]} for {getTargetLabel(reviewAction.request)}.
                {reviewAction.type === 'approve' ? ' Approval executes this action immediately.' : ''}
              </p>
              {reviewAction.type === 'approve' ? (
                <p><strong>Requester reason:</strong> {reviewAction.request.reason}</p>
              ) : null}

              {reviewAction.type === 'reject' ? (
                <label>
                  Rejection reason
                  <textarea required maxLength={500} rows={4} value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} />
                </label>
              ) : null}

              {reviewError ? <div className="error-state" role="alert">{reviewError}</div> : null}
              <div className="modal-actions">
                <button type="button" className="secondary-button" disabled={reviewing} onClick={() => setReviewAction(null)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={reviewing || (reviewAction.type === 'reject' && !reviewReason.trim())}>
                  {reviewing ? 'Saving…' : reviewAction.type === 'approve' ? 'Approve and execute' : 'Reject request'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {editRequest ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-request-reason-title">
            <div className="modal-heading">
              <div><p className="eyebrow">Pending request</p><h3 id="edit-request-reason-title">Edit request reason</h3></div>
              <button type="button" className="modal-close" disabled={updatingRequest} aria-label="Close edit request form" onClick={() => setEditRequest(null)}>×</button>
            </div>
            <form className="user-form" onSubmit={submitRequestEdit}>
              <label>Reason<textarea required maxLength={500} rows={4} value={editReason} onChange={(event) => setEditReason(event.target.value)} /></label>
              {requestLifecycleError ? <div className="error-state" role="alert">{requestLifecycleError}</div> : null}
              <div className="modal-actions">
                <button type="button" className="secondary-button" disabled={updatingRequest} onClick={() => setEditRequest(null)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={updatingRequest || !editReason.trim()}>{updatingRequest ? 'Saving…' : 'Save reason'}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {cancelRequest ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="cancel-request-title">
            <div className="modal-heading">
              <div><p className="eyebrow">Pending request</p><h3 id="cancel-request-title">Cancel request?</h3></div>
              <button type="button" className="modal-close" disabled={updatingRequest} aria-label="Close cancel request form" onClick={() => setCancelRequest(null)}>×</button>
            </div>
            <form className="user-form" onSubmit={submitRequestCancellation}>
              <p>This will stop review and retain the request and its audit history.</p>
              <label>Cancellation reason<textarea required maxLength={500} rows={4} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label>
              {requestLifecycleError ? <div className="error-state" role="alert">{requestLifecycleError}</div> : null}
              <div className="modal-actions">
                <button type="button" className="secondary-button" disabled={updatingRequest} onClick={() => setCancelRequest(null)}>Keep request</button>
                <button type="submit" className="primary-button" disabled={updatingRequest || !cancelReason.trim()}>{updatingRequest ? 'Canceling…' : 'Cancel request'}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
