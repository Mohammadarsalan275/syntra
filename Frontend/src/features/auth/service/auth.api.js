import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  withCredentials: true,
})

if (typeof window !== "undefined") {
  const token = window.localStorage.getItem("token")
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  }
}

export async function register({ email, username, password }) {
  const response = await api.post("/api/auth/register", {
    email,
    name: username,
    password,
  })
  return response.data
}

export async function login({ email, password }) {
  const response = await api.post("/api/auth/login", { email, password })
  const { token } = response.data

  if (token && typeof window !== "undefined") {
    window.localStorage.setItem("token", token)
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  }

  return response.data
}

export async function getMe() {
  const response = await api.get("/api/auth/get-me")
  return response.data
}