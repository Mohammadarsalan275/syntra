import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  withCredentials: true,
});

if (typeof window !== "undefined") {
  const token = window.localStorage.getItem("token");
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
}

export const sendMessage = async ({ message, chatId }) => {
  const response = await api.post("/api/chat/send", { message, chatId });
  return response.data;
};

export const getChats = async () => {
  const response = await api.get("/api/chat/chats");
  return response.data;
};

export const getMessage = async (chatId) => {
  const response = await api.get(`/api/chat/chats/${chatId}/messages`);
  return response.data;
};