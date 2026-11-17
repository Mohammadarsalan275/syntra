import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/" : "http://localhost:3000"),
  withCredentials: true,
});

const GUEST_SESSION_KEY = "syntra-guest-session";
let guestSessionRequest;

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

function isDemoToken(token) {
  if (!token) return false;

  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(payload)).demo === true;
  } catch {
    return false;
  }
}

async function getGuestSession() {
  const authToken = window.localStorage.getItem("token");
  if (!isDemoToken(authToken)) return null;

  const existingSession = window.localStorage.getItem(GUEST_SESSION_KEY);
  if (existingSession) return existingSession;

  if (!guestSessionRequest) {
    guestSessionRequest = api
      .post("/api/chat/guest-session")
      .then(({ data }) => {
        window.localStorage.setItem(GUEST_SESSION_KEY, data.token);
        return data.token;
      })
      .finally(() => {
        guestSessionRequest = undefined;
      });
  }

  return guestSessionRequest;
}

async function chatRequest(config) {
  const guestSession = await getGuestSession();
  if (guestSession) {
    config.headers = {
      ...config.headers,
      "X-Guest-Session": guestSession,
    };
  }
  return api.request(config);
}

export const sendMessage = async ({
  message,
  chatId,
  history,
  searchMode,
  incognito,
  regenerate,
  document,
  documentId,
}) => {
  const body = document ? new FormData() : {
    message,
    chatId,
    history,
    searchMode,
    incognito,
    regenerate,
    documentId,
  };

  if (document) {
    body.append("document", document);
    body.append("message", message);
    if (chatId) body.append("chatId", chatId);
    if (history) body.append("history", JSON.stringify(history));
    if (searchMode) body.append("searchMode", searchMode);
    if (incognito) body.append("incognito", "true");
    if (regenerate) body.append("regenerate", "true");
    if (documentId) body.append("documentId", documentId);
  }

  const response = await chatRequest({
    method: "post",
    url: "/api/chat/send",
    data: body,
  });
  return response.data;
};

export const getChats = async () => {
  const response = await chatRequest({ method: "get", url: "/api/chat/chats" });
  return response.data;
};

export const importLocalChats = async (chats) => {
  const response = await chatRequest({
    method: "post",
    url: "/api/chat/chats/import",
    data: { chats },
  });
  return response.data;
};

export const getMessage = async (chatId) => {
  const response = await chatRequest({
    method: "get",
    url: `/api/chat/chats/${chatId}/messages`,
  });
  return response.data;
};

export const renameChat = async (chatId, title) => {
  const response = await chatRequest({
    method: "patch",
    url: `/api/chat/chats/${chatId}`,
    data: { title },
  });
  return response.data;
};

export const deleteChat = async (chatId) => {
  const response = await chatRequest({
    method: "delete",
    url: `/api/chat/delete/${chatId}`,
  });
  return response.data;
};