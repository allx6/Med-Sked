import { useEffect, useState } from 'react';

import { createUserAccount, listUsers, updateUserRole } from '../services/api';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createEmailError, setCreateEmailError] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'patient' });

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

  const createUser = async (event) => {
    event.preventDefault();
    const email = newUser.email.trim();

    if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
      setCreateError('');
      setCreateEmailError('Enter an email address ending in @gmail.com.');
      return;
    }

    try {
      setCreating(true);
      setCreateError('');
      setCreateEmailError('');
      await createUserAccount({
        name: newUser.name.trim(),
        email,
        password: newUser.password,
        role: newUser.role,
      });
      setStatusMessage(`${getRoleLabel(newUser.role)} account created successfully.`);
      setNewUser({ name: '', email: '', password: '', role: 'patient' });
      setCreateEmailError('');
      setCreateOpen(false);
      setSearchInput('');
      setSearchTerm('');
      setRoleFilter('');
      setPage(1);
    } catch (err) {
      setCreateError(err.message || 'Unable to create account.');
    } finally {
      setCreating(false);
    }
  };

  const closeCreateForm = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError('');
    setCreateEmailError('');
    setNewUser({ name: '', email: '', password: '', role: 'patient' });
  };

  const hasUsers = users.length > 0;

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Management</p>
          <h2>Users</h2>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setCreateError('');
            setCreateEmailError('');
            setCreateOpen(true);
          }}
        >
          Add user
        </button>
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
                        aria-label={`Role for ${user.username || user.email || 'user'}`}
                        onChange={(event) => updateRole(user, event.target.value)}
                      >
                        <option value="patient">Patient</option>
                        <option value="caregiver">Caregiver</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
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
              className="pagination-button pagination-button-previous"
              disabled={page <= 1}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              <span className="pagination-arrow" aria-hidden="true">←</span>
              <span>Previous</span>
            </button>
            <span className="pagination-current" aria-live="polite">
              Page <strong>{pagination.page || page}</strong> of <strong>{pagination.totalPages || 1}</strong>
            </span>
            <button
              type="button"
              className="pagination-button pagination-button-next"
              disabled={page >= (pagination.totalPages || 1)}
              onClick={() => setPage((currentPage) => Math.min(pagination.totalPages || currentPage, currentPage + 1))}
            >
              <span>Next</span>
              <span className="pagination-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}
      </div>

      {createOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateForm();
          }}
        >
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">User management</p>
                <h3 id="create-user-title">Create account</h3>
              </div>
              <button type="button" className="modal-close" aria-label="Close create account form" onClick={closeCreateForm}>
                ×
              </button>
            </div>
            <form className="user-form" onSubmit={createUser}>
              <label>
                Full name
                <input
                  type="text"
                  autoComplete="name"
                  required
                  value={newUser.name}
                  onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  aria-invalid={Boolean(createEmailError)}
                  aria-describedby={createEmailError ? 'create-user-email-error' : undefined}
                  value={newUser.email}
                  onChange={(event) => {
                    setCreateEmailError('');
                    setNewUser((current) => ({ ...current, email: event.target.value }));
                  }}
                />
                {createEmailError ? <small id="create-user-email-error" className="field-error" role="alert">{createEmailError}</small> : null}
              </label>
              <label>
                Temporary password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={newUser.password}
                  onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                />
                <small className="form-hint">At least 6 characters.</small>
              </label>
              <label>
                Account type
                <select
                  className="select-input"
                  value={newUser.role}
                  onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
                >
                  <option value="patient">Patient</option>
                  <option value="caregiver">Caregiver</option>
                </select>
              </label>
              {createError ? <div className="error-state" role="alert">{createError}</div> : null}
              <div className="modal-actions">
                <button type="button" className="secondary-button" disabled={creating} onClick={closeCreateForm}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={creating}>
                  {creating ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
