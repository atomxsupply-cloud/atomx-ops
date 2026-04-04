import axios from 'axios';
import { showError } from '../components/ErrorOverlay';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('atomx_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('atomx_token');
      window.location.href = '/login';
      return Promise.reject(err);
    }
    // Mostrar errores graves en pantalla
    if (err.response?.status >= 500 || !err.response) {
      const msg = `URL: ${err.config?.method?.toUpperCase()} ${err.config?.url}\nStatus: ${err.response?.status || 'Sin respuesta'}\n\n${JSON.stringify(err.response?.data || err.message, null, 2)}`;
      showError(msg);
    }
    return Promise.reject(err);
  }
);

export default api;
