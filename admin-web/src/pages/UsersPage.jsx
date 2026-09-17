import { useEffect, useState } from 'react';

import { listUsers, updateUserRole } from '../services/api';

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

const getRoleLabel = (role) => {
  if (!role) {
    return 'Unknown';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
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
    const loadUsers = async () => {
      const auth = getStoredAuth();

      if (!auth?.token) {
        setError('Authentication is required.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const result = await listUsers(auth.token, {
          page,
          limit: 20,
          search: searchTerm,
          role: roleFilter,
        });

        setUsers(result?.users || []);
        setPagination(result?.pagination || { page, limit: 20, total: 0, totalPages: 0 });
      } catch (err) {
        setUsers([]);
        setError(err.message || 'Unable to load users.');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [page, searchTerm, roleFilter]);

  const updateRole = async (user, nextRole) => {
    if (!nextRole || nextRole === user.role) {
      return;
    }

    const confirmed = window.confirm(
      `Change this user's role from ${getRoleLabel(user.role).toLowerCase()} to ${getRoleLabel(nextRole).toLowerCase()}?`
    );

    if (!confirmed) {
      return;
    }

    const auth = getStoredAuth();

    if (!auth?.token) {
      setError('Authentication is required.');
      return;
    }

    try {
      setStatusMessage('');
      setError('');
      await updateUserRole(auth.token, user._id, { role: nextRole });
      setStatusMessage(`Role updated for ${user.username || user.email || 'user'}.`);
      setPage((currentPage) => currentPage);
      const refreshed = await listUsers(auth.token, {
        page,
        limit: 20,
        search: searchTerm,
        role: roleFilter,
      });
      setUsers(refreshed?.users || []);
      setPagination(refreshed?.pagination || pagination);
    } catch (err) {
      setError(err.message || 'Unable to update role.');
    }
  };

  const hasUsers = users.length > 0;

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Management</p>
          <h2>Users</h2>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <input
            className="search-input"
            type="search"
            placeholder="Search username or email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />

          <select
            className="select-input"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            <option value="patient">Patient</option>
            <option value="caregiver">Caregiver</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {statusMessage ? <div className="success-banner">{statusMessage}</div> : null}
        {error ? <div className="error-state">{error}</div> : null}

        {loading ? (
          <div className="loading-state">Loading users…</div>
        ) : !hasUsers ? (
          <div className="empty-state">No users match the current filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>{user.username || 'Unavailable'}</td>
                    <td>{user.email || 'Unavailable'}</td>
                    <td>
                      <select
                        className="select-input compact"
                        value={user.role || ''}
                        onChange={(event) => updateRole(user, event.target.value)}
                      >
                        <option value="patient">Patient</option>
                        <option value="caregiver">Caregiver</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <span className={`status-badge status-${user.role || 'unknown'}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pagination.totalPages > 1 ? (
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
              Page {pagination.page || page} of {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={page >= (pagination.totalPages || 1)}
              onClick={() => setPage((currentPage) => Math.min(pagination.totalPages || currentPage, currentPage + 1))}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
