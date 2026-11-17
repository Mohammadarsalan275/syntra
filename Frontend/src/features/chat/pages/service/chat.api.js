import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/" : "http://localhost:3000"),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = "Bearer " + token;
    } else {
      delete config.headers.Authorization;
    }
  }
  return config;
});

export const sendMessage = async ({
  message,
  chatId,
  history,
  searchMode,
  incognito,
  regenerate,
}) => {
  const response = await api.post("/api/chat/send", {
    message,
    chatId,
    history,
    searchMode,
    incognito,
    regenerate,
  });
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

export const renameChat = async (chatId, title) => {
  const response = await api.patch(`/api/chat/chats/${chatId}`, { title });
  return response.data;
};

export const deleteChat = async (chatId) => {
  const response = await api.delete(`/api/chat/delete/${chatId}`);
  return response.data;
};