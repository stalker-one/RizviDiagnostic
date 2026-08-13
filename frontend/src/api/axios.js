import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rdc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Every create/update/delete call made through this axios instance, from
// any page in the app, is recognized here by its method + URL and broadcast
// as an 'rdc:data-added' event carrying a proper "<Resource> <action>
// successfully" message. The global toast (Toast.jsx) listens for this and
// pops a confirmation — no need to wire up a toast call in every single
// form/handler by hand.
//
// Matched as { label, resource-only pattern (no id) } — used for POST
// (create); the same pattern with a trailing /:id also covers PUT/PATCH
// (update) and DELETE (delete) for that resource.
const RESOURCES = [
  { test: (url) => /^\/procedures\/import\/?$/.test(url), label: 'Procedures', idBased: false },
  { test: (url) => /^\/patients(\/[^/]+)?\/?$/.test(url), label: 'Patient' },
  { test: (url) => /^\/invoices(\/[^/]+)?\/?$/.test(url), label: 'Invoice' },
  { test: (url) => /^\/doctors(\/[^/]+)?\/?$/.test(url), label: 'Doctor' },
  { test: (url) => /^\/procedures(\/[^/]+)?\/?$/.test(url), label: 'Procedure' },
  { test: (url) => /^\/referrals(\/[^/]+)?\/?$/.test(url), label: 'Referral' },
  { test: (url) => /^\/users(\/[^/]+)?\/?$/.test(url), label: 'User' },
];

// Endpoints that already show their own inline success message (e.g.
// Settings.jsx, SiteControl.jsx) are excluded so the user doesn't see two
// confirmations for the same action.
const EXCLUDED = [/^\/settings\/?$/, /^\/site\//];

function resourceLabelFor(url) {
  const clean = (url || '').split('?')[0];
  if (EXCLUDED.some((re) => re.test(clean))) return null;
  const match = RESOURCES.find((r) => r.test(clean));
  return match ? match.label : null;
}

const ACTION_BY_METHOD = {
  post: 'added',
  put: 'updated',
  patch: 'updated',
  delete: 'deleted',
};

api.interceptors.response.use(
  (res) => {
    const method = (res.config?.method || '').toLowerCase();
    const action = ACTION_BY_METHOD[method];
    if (action && (res.status === 200 || res.status === 201 || res.status === 204)) {
      const label = resourceLabelFor(res.config.url);
      if (label) {
        window.dispatchEvent(
          new CustomEvent('rdc:data-added', {
            detail: { message: `${label} ${action} successfully`, resource: label, action },
          })
        );
      }
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rdc_token');
      localStorage.removeItem('rdc_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    if (err.response?.status === 423) {
      // Superadmin has deactivated the site. Broadcast so the app-wide
      // SiteLockGate can show the blocking modal, no matter which page or
      // API call triggered it.
      window.dispatchEvent(new CustomEvent('rdc:site-locked', { detail: err.response.data }));
    }
    return Promise.reject(err);
  }
);

export default api;