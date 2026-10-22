const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

const handleResponse = async (response, options = {}) => {
  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    const message = data.message || data.error || `Request failed with status ${response.status}`;

    if (data.verificationRequired === true) {
      throw new Error(
        `The account was created but still requires email verification. ${message}`
      );
    }

    if (response.status === 401 && !options.isLogin) {
      throw new Error('Your session has expired. Please log in again.');
    }

    if (response.status === 403) {
      throw new Error(message || 'You are not authorized to access this resource.');
    }

    if (response.status >= 500 && !options.isLogin) {
      throw new Error('Unable to connect to the MedSked backend.');
    }

    throw new Error(message);
  }

  return data;
};

const fetchWithToken = async (path, token, customOptions = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(token),
      ...(customOptions.headers || {}),
    },
    ...customOptions,
  });

  return handleResponse(response);
};

export const loginAdmin = async (email, password) => {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  return handleResponse(response, { isLogin: true });
};

export const verifyAdminMfa = async (challengeToken, code) => {
  const response = await fetch(`${API_URL}/api/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken, code }),
  });
  return handleResponse(response, { isLogin: true });
};

export const resendAdminMfaCode = async (challengeToken) => {
  const response = await fetch(`${API_URL}/api/auth/mfa/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken }),
  });
  return handleResponse(response, { isLogin: true });
};

export const validateAdminSession = async (token) => {
  const response = await fetch(`${API_URL}/api/auth/session`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(token),
    },
  });

  return handleResponse(response, { isLogin: true });
};

export const createUserAccount = async (payload) => {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await handleResponse(response);
  return { message: result.message, user: result.user };
};

export const getAdminStats = async (token) => fetchWithToken('/api/admin/stats', token);

export const getAdminDoseOutcomes = async (token, days = 30) => fetchWithToken(`/api/admin/analytics/dose-outcomes?days=${days}`, token);

export const getAdminAdherenceTrend = async (token, days = 30) => fetchWithToken(`/api/admin/analytics/adherence-trend?days=${days}`, token);

export const getAdminTimeOfDay = async (token, days = 30) => fetchWithToken(`/api/admin/analytics/time-of-day?days=${days}`, token);

export const getAdminRegimenComplexity = async (token, days = 30) => fetchWithToken(`/api/admin/analytics/regimen-complexity?days=${days}`, token);

export const getAdminUserRoles = async (token) => fetchWithToken('/api/admin/analytics/users', token);

export const getAdminNotifications = async (token) => fetchWithToken('/api/admin/analytics/notifications', token);

export const getAdminRefills = async (token) => fetchWithToken('/api/admin/analytics/refills', token);

export const createAdminUser = async (token, payload) => {
  const response = await fetch(`${API_URL}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(token),
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const getUserById = async (token, userId) => fetchWithToken(`/api/admin/users/${userId}`, token);

export const updateUser = async (token, userId, payload) => {
  const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(token),
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const listUsers = async (token, options = {}) => {
  const params = new URLSearchParams();

  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.search) params.set('search', options.search);
  if (options.role) params.set('role', options.role);
  if (options.accountStatus) params.set('accountStatus', options.accountStatus);

  const queryString = params.toString();
  return fetchWithToken(`/api/admin/users${queryString ? `?${queryString}` : ''}`, token);
};

export const listRelationships = async (token, options = {}) => {
  const params = new URLSearchParams();

  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.search) params.set('search', options.search);
  if (options.status) params.set('status', options.status);

  const queryString = params.toString();
  return fetchWithToken(`/api/admin/relationships${queryString ? `?${queryString}` : ''}`, token);
};

export const getRelationship = async (token, relationshipId) => fetchWithToken(`/api/admin/relationships/${relationshipId}`, token);

export const listAuditLogs = async (token, options = {}) => {
  const params = new URLSearchParams();

  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.action) params.set('action', options.action);
  if (options.targetType) params.set('targetType', options.targetType);
  if (options.actorId) params.set('actorId', options.actorId);
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);

  const queryString = params.toString();
  return fetchWithToken(`/api/admin/audit-logs${queryString ? `?${queryString}` : ''}`, token);
};

const postAdminJson = async (path, token, payload) => {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(token),
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const listPrivilegedActionRequests = async (token, options = {}) => {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  const queryString = params.toString();
  return fetchWithToken(
    `/api/admin/privileged-action-requests${queryString ? `?${queryString}` : ''}`,
    token
  );
};

export const getPrivilegedActionRequest = async (token, requestId) => (
  fetchWithToken(`/api/admin/privileged-action-requests/${requestId}`, token)
);

export const updatePrivilegedActionRequest = async (token, requestId, payload) => {
  const response = await fetch(`${API_URL}/api/admin/privileged-action-requests/${requestId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(token),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const cancelPrivilegedActionRequest = async (token, requestId, reason) => (
  postAdminJson(`/api/admin/privileged-action-requests/${requestId}/cancel`, token, { reason })
);

export const createPrivilegedActionRequest = async (token, payload) => (
  postAdminJson('/api/admin/privileged-action-requests', token, payload)
);

export const approvePrivilegedActionRequest = async (token, requestId) => (
  postAdminJson(`/api/admin/privileged-action-requests/${requestId}/approve`, token, {})
);

export const rejectPrivilegedActionRequest = async (token, requestId, reason) => (
  postAdminJson(`/api/admin/privileged-action-requests/${requestId}/reject`, token, { reason })
);

export const getAdminAnalytics = async (token, days = 30) => {
  const [doseOutcomes, adherenceTrend, timeOfDay, regimenComplexity, userRoles, notifications, refills] = await Promise.all([
    getAdminDoseOutcomes(token, days),
    getAdminAdherenceTrend(token, days),
    getAdminTimeOfDay(token, days),
    getAdminRegimenComplexity(token, days),
    getAdminUserRoles(token),
    getAdminNotifications(token),
    getAdminRefills(token),
  ]);

  return {
    doseOutcomes,
    adherenceTrend,
    timeOfDay,
    regimenComplexity,
    userRoles,
    notifications,
    refills,
  };
};

export { API_URL };
