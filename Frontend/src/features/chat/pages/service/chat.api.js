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
  document,
}) => {
  const body = document ? new FormData() : {
    message,
    chatId,
    history,
    searchMode,
    incognito,
    regenerate,
  };

  if (document) {
    body.append("document", document);
    body.append("message", message);
    if (chatId) body.append("chatId", chatId);
    if (history) body.append("history", JSON.stringify(history));
    if (searchMode) body.append("searchMode", searchMode);
    if (incognito) body.append("incognito", "true");
    if (regenerate) body.append("regenerate", "true");
  }

  const response = await api.post("/api/chat/send", body);
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