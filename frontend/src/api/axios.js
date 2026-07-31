import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ydecom_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Never force Content-Type on FormData — the browser must set multipart + boundary.
  // A default application/json (or bare multipart) leaves req.body empty and validators fail.
  const isFormData =
    typeof FormData !== 'undefined' &&
    (config.data instanceof FormData ||
      Object.prototype.toString.call(config.data) === '[object FormData]');

  if (isFormData) {
    if (typeof config.headers?.delete === 'function') {
      config.headers.delete('Content-Type');
    } else if (typeof config.headers?.set === 'function') {
      config.headers.set('Content-Type', false);
    } else {
      delete config.headers['Content-Type'];
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;
    if (code === 'PENDING_APPROVAL') {
      return Promise.reject(error);
    }
    // Only clear session for JWT/auth failures — not payment gateway 401s or other APIs.
    const sessionCodes = new Set(['NO_TOKEN', 'INVALID_TOKEN', 'USER_NOT_FOUND']);
    if (error.response?.status === 401 && sessionCodes.has(code)) {
      localStorage.removeItem('ydecom_token');
      localStorage.removeItem('ydecom_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
