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
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { error: `Server error (${res.status}). Please try again.` };
  }
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
    summary: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/dashboard/summary${q ? `?${q}` : ''}`);
    },
    team: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/dashboard/team${q ? `?${q}` : ''}`);
    },
    trends: () => request('/dashboard/trends'),
    sourceAnalytics: () => request('/dashboard/source-analytics'),
    pendingCollections: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/dashboard/pending-collections${q ? `?${q}` : ''}`);
    },
    hrOverview: () => request('/dashboard/hr-overview'),
  },
  targets: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/targets${q ? `?${q}` : ''}`);
    },
    set: (data) => request('/targets', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id) => request(`/targets/${id}`, { method: 'DELETE' }),
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
    createCombined: (data) => request('/enrollments/combined', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/enrollments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id, reason) => request(`/enrollments/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
    requestDeletion: (id, reason) => request(`/enrollments/${id}/request-deletion`, { method: 'POST', body: JSON.stringify({ reason }) }),
  },
  deletionRequests: {
    list: (status) => request(`/deletion-requests${status ? `?status=${status}` : ''}`),
    approve: (id, review_note) => request(`/deletion-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ review_note }) }),
    reject: (id, review_note) => request(`/deletion-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ review_note }) }),
  },
  payments: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/payments${q ? `?${q}` : ''}`);
    },
    create: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    uploadReceipt: (id, files) => {
      const form = new FormData();
      (Array.isArray(files) ? files : [files]).forEach((f) => form.append('receipts', f));
      return request(`/payments/${id}/receipt`, { method: 'POST', body: form });
    },
  },
  bankAccounts: {
    list: () => request('/bank-accounts'),
    create: (data) => request('/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/bank-accounts/${id}`, { method: 'DELETE' }),
  },
  approvals: {
    pending: () => request('/approvals/pending'),
    approve: (id) => request(`/approvals/${id}/approve`, { method: 'POST' }),
    reject: (id, reason) =>
      request(`/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
    count: () => request('/approvals/count'),
  },
  notifications: {
    list: () => request('/notifications'),
    markAllRead: () => request('/notifications/read', { method: 'POST' }),
  },
  tasks: {
    list: () => request('/tasks'),
    create: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id, status) => request(`/tasks/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    remove: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
    comments: (id) => request(`/tasks/${id}/comments`),
    addComment: (id, body) => request(`/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
    activities: (id) => request(`/tasks/${id}/activities`),
    updateLabels: (id, label_ids) => request(`/tasks/${id}/labels`, { method: 'PUT', body: JSON.stringify({ label_ids }) }),
  },
  taskLabels: {
    list: () => request('/task-labels'),
    create: (data) => request('/task-labels', { method: 'POST', body: JSON.stringify(data) }),
  },
  push: {
    vapidKey: () => request('/push/vapid-key'),
    subscribe: (data) => request('/push/subscribe', { method: 'POST', body: JSON.stringify(data) }),
    unsubscribe: (data) => request('/push/subscribe', { method: 'DELETE', body: JSON.stringify(data) }),
    broadcast: (data) => request('/push/broadcast', { method: 'POST', body: JSON.stringify(data) }),
  },
  batches: {
    list: () => request('/batches'),
    get: (id) => request(`/batches/${id}`),
    create: (data) => request('/batches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/batches/${id}`, { method: 'DELETE' }),
    addMembers: (id, enrollmentIds) =>
      request(`/batches/${id}/members`, { method: 'POST', body: JSON.stringify({ enrollment_ids: enrollmentIds }) }),
    removeMember: (id, enrollmentId) =>
      request(`/batches/${id}/members/${enrollmentId}`, { method: 'DELETE' }),
  },
  reports: {
    salesperson: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/reports/salesperson${q ? `?${q}` : ''}`);
    },
    bankWise: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/reports/bank-wise${q ? `?${q}` : ''}`);
    },
    pendingPayments: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/reports/pending-payments${q ? `?${q}` : ''}`);
    },
    category: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/reports/category${q ? `?${q}` : ''}`);
    },
  },
  users: {
    list: () => request('/users'),
    listSimple: () => request('/users/list'),
    getProfile: (id) => request(`/users/${id}/profile`),
    analytics: (id, params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/users/${id}/analytics${q ? `?${q}` : ''}`);
    },
    create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    teamAnalytics: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/team/analytics${q ? `?${q}` : ''}`);
    },
  },
  brands: {
    list: () => request('/brands'),
  },
  receipts: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/receipts${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/receipts/${id}`),
    nextNumber: (prefix) => request(`/receipts/next-number?prefix=${encodeURIComponent(prefix || 'NEO')}`),
    pending: () => request('/receipts/pending'),
    create: (data) => request('/receipts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/receipts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/receipts/${id}`, { method: 'DELETE' }),
    downloadPdf: async (id, filename) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE}/receipts/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text ? JSON.parse(text).error || 'Download failed' : 'Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `receipt-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  },
  receiptTemplates: {
    list: () => request('/receipt-templates'),
    create: (data) => request('/receipt-templates', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id) => request(`/receipt-templates/${id}`, { method: 'DELETE' }),
  },
  gstSettings: {
    get: () => request('/gst-settings'),
    update: (data) => request('/gst-settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  gstInvoices: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/gst-invoices${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/gst-invoices/${id}`),
    create: (data) => request('/gst-invoices', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/gst-invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/gst-invoices/${id}`, { method: 'DELETE' }),
    downloadPdf: async (id, filename) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE}/gst-invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text ? JSON.parse(text).error || 'Download failed' : 'Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `gst-invoice-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  },
  calendar: {
    list: (month) => request(`/training-calendar${month ? `?month=${month}` : ''}`),
    create: (data) => request('/training-calendar', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/training-calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/training-calendar/${id}`, { method: 'DELETE' }),
    saveNominations: (id, nominations) => request(`/training-calendar/${id}/nominations`, { method: 'PUT', body: JSON.stringify({ nominations }) }),
    myEnrollments: () => request('/training-calendar/my-enrollments'),
    addEnrollment: (sessionId, enrollmentId) => request(`/training-calendar/${sessionId}/enrollments`, { method: 'POST', body: JSON.stringify({ enrollment_id: enrollmentId }) }),
    removeEnrollment: (sessionId, enrollmentId) => request(`/training-calendar/${sessionId}/enrollments/${enrollmentId}`, { method: 'DELETE' }),
  },
  attendance: {
    status: (date) => request(`/attendance/status${date ? `?date=${date}` : ''}`),
    punchIn: () => request('/attendance/punch-in', { method: 'POST' }),
    punchOut: (data) => request('/attendance/punch-out', { method: 'POST', body: JSON.stringify(data || {}) }),
    action: (data) => request('/attendance/action', { method: 'POST', body: JSON.stringify(data || {}) }),
    today: () => request('/attendance/today'),
    daily: (date) => request(`/attendance/daily${date ? `?date=${date}` : ''}`),
    monthly: (month) => request(`/attendance/monthly${month ? `?month=${month}` : ''}`),
    dailyReport: (from, to) => request(`/attendance/daily-report${from && to ? `?from=${from}&to=${to}` : ''}`),
  },
  hiring: {
    overview: () => request('/hiring/overview'),
    createCompany: (data) => request('/hiring/companies', { method: 'POST', body: JSON.stringify(data) }),
    createOpening: (data) => request('/hiring/openings', { method: 'POST', body: JSON.stringify(data) }),
    updateOpeningStatus: (id, status) => request(`/hiring/openings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    createCandidate: (data) => request('/hiring/candidates', { method: 'POST', body: JSON.stringify(data) }),
    updateCandidate: (id, data) => request(`/hiring/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    forwardCandidate: (id) => request(`/hiring/candidates/${id}/forward`, { method: 'POST' }),
    removeCandidate: (id) => request(`/hiring/candidates/${id}`, { method: 'DELETE' }),
  },
};
