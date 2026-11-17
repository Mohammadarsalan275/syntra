import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/' : 'http://localhost:3000'),
  withCredentials: true,
});

const useDemoAuth =
  import.meta.env.VITE_USE_DEMO_AUTH === 'true' ||
  (!import.meta.env.PROD && import.meta.env.VITE_USE_DEMO_AUTH !== 'false');

function setAuthToken(token) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem('token', token);
  api.defaults.headers.common.Authorization = 'Bearer ' + token;
}

if (typeof window !== 'undefined') {
  const token = window.localStorage.getItem('token');
  if (token) {
    api.defaults.headers.common.Authorization = 'Bearer ' + token;
  }
}

export async function register({ email, username, password }) {
  const endpoint = useDemoAuth ? '/api/auth/demo/register' : '/api/auth/register';
  const response = await api.post(endpoint, {
    email,
    name: username,
    password,
  });
  return response.data;
}

export async function login({ email, password }) {
  const endpoint = useDemoAuth ? '/api/auth/demo/login' : '/api/auth/login';
  const response = await api.post(endpoint, { email, password });
  const { token } = response.data;
  if (token) setAuthToken(token);
  return response.data;
}

export async function getMe() {
  const response = await api.get('/api/auth/get-me');
  return response.data;
}
