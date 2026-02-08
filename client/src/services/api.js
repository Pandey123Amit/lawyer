import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 min for AI calls
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// --- Auth ---
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// --- Create Mode ---
export const createApi = {
  transcribe: (formData) =>
    api.post('/create/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000, // 3 min for large audio
    }),
  draft: (data) => api.post('/create/draft', data),
  refine: (data) => api.post('/create/refine', data),
  fromText: (data) => api.post('/create/from-text', data),
  export: (data) =>
    api.post('/create/export', data, { responseType: 'blob' }),
};

// --- Understand Mode ---
export const understandApi = {
  upload: (formData) =>
    api.post('/understand/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    }),
  explainText: (data) => api.post('/understand/explain-text', data),
  export: (data) =>
    api.post('/understand/export', data, { responseType: 'blob' }),
};

// --- Documents ---
export const documentsApi = {
  list: (params) => api.get('/documents', { params }),
  get: (id) => api.get(`/documents/${id}`),
  delete: (id) => api.delete(`/documents/${id}`),
};

export default api;
