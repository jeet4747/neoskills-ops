const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const auth = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  me: () => request('/auth/me'),
  pendingUsers: () => request('/auth/pending-users'),
  approveUser: (id, action) =>
    request(`/auth/approve/${id}`, { method: 'POST', body: JSON.stringify({ action }) }),
};

export const api = {
  dashboard: {
    summary: () => request('/dashboard/summary'),
    team: () => request('/dashboard/team'),
    trends: () => request('/dashboard/trends'),
    sourceAnalytics: () => request('/dashboard/source-analytics'),
  },
  students: {
    list: (search) => request(`/students${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    create: (data) => request('/students', { method: 'POST', body: JSON.stringify(data) }),
  },
  enrollments: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/enrollments${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/enrollments/${id}`),
    create: (data) => request('/enrollments', { method: 'POST', body: JSON.stringify(data) }),
  },
  payments: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/payments${q ? `?${q}` : ''}`);
    },
    create: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
    uploadReceipt: (id, file) => {
      const form = new FormData();
      form.append('receipt', file);
      return request(`/payments/${id}/receipt`, { method: 'POST', body: form });
    },
  },
  approvals: {
    pending: () => request('/approvals/pending'),
    approve: (id) => request(`/approvals/${id}/approve`, { method: 'POST' }),
    reject: (id, reason) =>
      request(`/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  },
  bankAccounts: {
    list: () => request('/bank-accounts'),
    create: (data) => request('/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
  },
  reports: {
    salesperson: () => request('/reports/salesperson'),
    bankWise: () => request('/reports/bank-wise'),
    pendingPayments: () => request('/reports/pending-payments'),
  },
  users: {
    list: () => request('/users'),
  },
};
