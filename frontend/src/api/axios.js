import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rdc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const RESOURCES = [
  { test: (url) => /^\/procedures\/import\/?$/.test(url), label: 'Procedures' },
  { test: (url) => /^\/patients(\/[^/]+)?\/?$/.test(url), label: 'Patient' },
  { test: (url) => /^\/invoices(\/[^/]+)?\/?$/.test(url), label: 'Invoice' },
  { test: (url) => /^\/doctors(\/[^/]+)?\/?$/.test(url), label: 'Doctor' },
  { test: (url) => /^\/procedures(\/[^/]+)?\/?$/.test(url), label: 'Procedure' },
  { test: (url) => /^\/referrals(\/[^/]+)?\/?$/.test(url), label: 'Referral' },
  { test: (url) => /^\/users(\/[^/]+)?\/?$/.test(url), label: 'User' },
];

const EXCLUDED = [/^\/settings\/?$/, /^\/site\//];
const ACTION_BY_METHOD = { post: 'added', put: 'updated', patch: 'updated', delete: 'deleted' };

function resourceLabelFor(url) {
  const clean = (url || '').split('?')[0];
  if (EXCLUDED.some((re) => re.test(clean))) return null;
  const match = RESOURCES.find((r) => r.test(clean));
  return match ? match.label : null;
}

api.interceptors.response.use(
  (res) => {
    const method = (res.config?.method || '').toLowerCase();
    const action = ACTION_BY_METHOD[method];
    if (action && [200, 201, 204].includes(res.status)) {
      const label = resourceLabelFor(res.config.url);
      if (label) {
        window.dispatchEvent(new CustomEvent('rdc:data-added', {
          detail: { message: `${label} ${action} successfully`, resource: label, action },
        }));
      }
    }

    // After a successful NEW patient registration, immediately open the
    // invoice form for that patient. PUT/PATCH patient edits are deliberately
    // excluded. The invoice page reads patientId from the query string.
    const cleanUrl = (res.config?.url || '').split('?')[0];
    if (method === 'post' && /^\/patients\/?$/.test(cleanUrl) && [200, 201].includes(res.status)) {
      const patientId = res.data?.id || res.data?.patient?.id || res.data?._id || res.data?.patient?._id;
      if (patientId && window.location.pathname !== '/invoices/create') {
        window.setTimeout(() => {
          window.location.assign(`/invoices/create?patientId=${encodeURIComponent(patientId)}`);
        }, 0);
      }
    }

    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rdc_token');
      localStorage.removeItem('rdc_user');
      if (!window.location.pathname.includes('/login')) window.location.href = '/login';
    }
    if (err.response?.status === 423) {
      window.dispatchEvent(new CustomEvent('rdc:site-locked', { detail: err.response.data }));
    }
    return Promise.reject(err);
  }
);

export default api;
