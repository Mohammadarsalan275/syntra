import { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteChat as deleteChatRequest,
  getChats,
  importLocalChats,
  renameChat,
  sendMessage,
} from './service/chat.api';

const STORAGE_KEY = 'syntra-chat-history';
const THEME_STORAGE_KEY = 'syntra-theme';
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = /\.(pdf|docx|txt)$/i;

function loadChats() {
  try {
    const storedChats = window.localStorage.getItem(STORAGE_KEY);
    const parsedChats = storedChats ? JSON.parse(storedChats) : [];

    return Array.isArray(parsedChats)
      ? parsedChats
          .filter(
            (chat) =>
              typeof chat.id === 'string' &&
              typeof chat.title === 'string' &&
              Array.isArray(chat.messages) &&
              chat.incognito !== true,
          )
          .map((chat) => ({ ...chat, localOnly: chat.localOnly ?? true }))
      : [];
  } catch (error) {
    console.error('Unable to load chat history from local storage.', error);
    return [];
  }
}

function loadTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch (error) {
    console.error('Unable to load theme preference.', error);
    return 'dark';
  }
}

function NewChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
      <path
        d="M12 5v14m-7-7h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4">
      <path
        d="M12 19V5m-6 6 6-6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const suggestions = [
  { title: 'Write something', prompt: 'Help me write a clear, thoughtful message about ' },
  { title: 'Learn something', prompt: 'Explain a topic to me in a simple way: ' },
  { title: 'Get inspired', prompt: 'Give me some creative ideas for ' },
];

export default function Dashboard() {
  const [chats, setChats] = useState(loadChats);
  const initialChatIds = useRef(new Set(chats.map((chat) => chat.id)));
  const [activeChatId, setActiveChatId] = useState(null);
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchMode, setSearchMode] = useState('none');
  const [isSending, setIsSending] = useState(false);
  const [theme, setTheme] = useState(loadTheme);
  const [isIncognito, setIsIncognito] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [chatTitleDraft, setChatTitleDraft] = useState('');
  const [actionError, setActionError] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [documentFile, setDocumentFile] = useState(null);
  const textareaRef = useRef(null);
  const documentInputRef = useRef(null);
  const chatHydrationRequest = useRef(null);
  const isDark = theme === 'dark';
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const activeDocument = [...(activeChat?.messages ?? [])]
    .reverse()
    .find((item) => item.role === 'user' && item.documentId);
  const savedChats = useMemo(
    () => chats.filter((chat) => chat.incognito !== true),
    [chats],
  );
  const lastAssistantMessageIndex = activeChat
    ? activeChat.messages.reduce(
        (lastIndex, item, index) => item.role === 'assistant' ? index : lastIndex,
        -1,
      )
    : -1;

  useEffect(() => {
    let cancelled = false;

    if (!chatHydrationRequest.current) {
      chatHydrationRequest.current = (async () => {
        let response = await getChats();
        if (response.localOnly) return { response, importedLocalIds: new Set() };

        const localChats = loadChats().filter((chat) => chat.localOnly);
        let importedLocalIds = new Set();
        if (localChats.length) {
          const importResponse = await importLocalChats(
            localChats.map((chat) => ({
              localId: chat.id,
              title: chat.title,
              messages: chat.messages,
            })),
          );
          importedLocalIds = new Set(
            importResponse.imported.map(({ localId }) => localId),
          );
          response = await getChats();
        }

        return { response, importedLocalIds };
      })();
    }

    chatHydrationRequest.current
      .then(({ response, importedLocalIds }) => {
        if (cancelled || response.localOnly) return;
        setChats((previousChats) => {
          const serverChatIds = new Set(response.chats.map((chat) => chat.id));
          const unsyncedChats = previousChats.filter(
            (chat) =>
              chat.localOnly &&
              !importedLocalIds.has(chat.id) &&
              !serverChatIds.has(chat.id),
          );
          const chatsCreatedDuringHydration = previousChats.filter(
            (chat) =>
              !initialChatIds.current.has(chat.id) &&
              !importedLocalIds.has(chat.id) &&
              !serverChatIds.has(chat.id),
          );
          return [...response.chats, ...unsyncedChats, ...chatsCreatedDuringHydration]
            .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
        });
      })
      .catch((error) => {
        console.error('Unable to load chats from MongoDB.', error);
        if (!cancelled) {
          setActionError(
            error.response?.data?.message ||
              'Unable to load saved chats. Your local chat history is still available.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedChats));
    } catch (error) {
      console.error('Unable to save chat history to local storage.', error);
    }
  }, [savedChats]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error('Unable to save theme preference.', error);
    }
  }, [theme]);

  function startNewChat() {
    setActiveChatId(null);
    setMessage('');
    setDocumentFile(null);
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function toggleIncognito() {
    if (isSending) return;
    startNewChat();
    setIsIncognito((enabled) => !enabled);
  }

  function submitMessage(event) {
    event.preventDefault();
    void sendContent(message.trim());
  }

  async function sendContent(content) {
    if (!content || isSending) return;

    const requestedSearchMode = searchMode;
    const timestamp = new Date().toISOString();
    const existingChat = chats.find((chat) => chat.id === activeChatId);
    const newChatId = existingChat?.id ?? crypto.randomUUID();
    const attachedDocumentId = documentFile ? undefined : activeDocument?.documentId;
    const userMessage = {
      role: 'user',
      content,
      ...(documentFile
        ? { documentName: documentFile.name }
        : attachedDocumentId
          ? {
              documentId: attachedDocumentId,
              documentName: activeDocument.documentName,
            }
          : {}),
    };
    let serverChatId =
      existingChat &&
      !existingChat.localOnly &&
      /^[a-f\d]{24}$/i.test(existingChat.id)
        ? existingChat.id
        : undefined;

    if (existingChat) {
      setChats((previousChats) =>
        previousChats
          .map((chat) =>
            chat.id === existingChat.id
              ? {
                  ...chat,
                  messages: [...chat.messages, userMessage],
                  updatedAt: timestamp,
                }
              : chat,
          )
          .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
      );
    } else {
      const newChat = {
        id: newChatId,
        title: content.length > 42 ? `${content.slice(0, 42).trim()}…` : content,
        messages: [userMessage],
        updatedAt: timestamp,
        incognito: isIncognito,
        localOnly: true,
      };

      setChats((previousChats) => [newChat, ...previousChats]);
      setActiveChatId(newChat.id);
    }

    setMessage('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsSending(true);

    try {
      if (existingChat?.localOnly && !existingChat.incognito && !isIncognito) {
        try {
          const importResponse = await importLocalChats([{
            localId: existingChat.id,
            title: existingChat.title,
            messages: existingChat.messages,
          }]);
          serverChatId = importResponse.imported.find(
            ({ localId }) => localId === existingChat.id,
          )?.id;
          if (!serverChatId) {
            throw new Error('The local chat import did not return a saved chat.');
          }
        } catch (error) {
          if (error.response?.status !== 503) throw error;
        }
      }

      const response = await sendMessage({
        message: content,
        chatId: serverChatId,
        history: existingChat?.messages ?? [],
        searchMode: requestedSearchMode,
        incognito: existingChat?.incognito === true || isIncognito,
        document: documentFile,
        documentId: attachedDocumentId,
      });

      const assistantReply = response.message;
      const persistedChatId = response.chat?._id || newChatId;
      const userMessageIndex = existingChat?.messages.length ?? 0;

      setChats((previousChats) =>
        previousChats
          .map((chat) =>
            chat.id === newChatId
              ? {
                  ...chat,
                  id: persistedChatId,
                  title: response.chat?.title || chat.title,
                  localOnly: response.localOnly ?? !response.chat,
                  messages: [
                    ...chat.messages.map((item, index) =>
                      index === userMessageIndex && response.document
                        ? {
                            ...item,
                            documentId: response.document.id,
                            documentName: response.document.name,
                          }
                        : item,
                    ),
                    {
                      role: 'assistant',
                      content: assistantReply,
                      sources: response.sources ?? [],
                      searchMode: response.searchMode ?? requestedSearchMode,
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : chat,
          )
          .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
      );
      setActiveChatId((currentChatId) =>
        currentChatId === newChatId ? persistedChatId : currentChatId,
      );
      if (response.document) setDocumentFile(null);
    } catch (error) {
      console.error('Unable to get AI response.', error);
      const errorMessage =
        error.response?.data?.message ||
        (error.request
          ? 'Cannot connect to the server. Check that the backend is running.'
          : 'Unable to get an AI response. Please try again.');
      setChats((previousChats) =>
        previousChats
          .map((chat) =>
            chat.id === newChatId
              ? {
                  ...chat,
                  messages: [
                    ...chat.messages,
                    { role: 'assistant', content: `Unable to get an AI response: ${errorMessage}` },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : chat,
          )
          .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
      );
    } finally {
      setIsSending(false);
    }
  }

  async function removeChat(event, chatId) {
    event.stopPropagation();
    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;

    if (!chat.localOnly && /^[a-f\d]{24}$/i.test(chatId)) {
      try {
        await deleteChatRequest(chatId);
      } catch (error) {
        console.error('Unable to delete chat.', error);
        setActionError(error.response?.data?.message || 'Unable to delete this chat. Please try again.');
        return;
      }
    }

    setChats((previousChats) => previousChats.filter((chat) => chat.id !== chatId));
    if (activeChatId === chatId) setActiveChatId(null);
    if (editingChatId === chatId) setEditingChatId(null);
    setActionError('');
  }

  function beginRenameChat(event, chat) {
    event.stopPropagation();
    setActionError('');
    setEditingChatId(chat.id);
    setChatTitleDraft(chat.title);
  }

  async function saveChatTitle(event, chat) {
    event.preventDefault();
    const title = chatTitleDraft.trim();
    if (!title || title.length > 120) {
      setActionError('Chat titles must be between 1 and 120 characters.');
      return;
    }

    if (!chat.localOnly && /^[a-f\d]{24}$/i.test(chat.id)) {
      try {
        await renameChat(chat.id, title);
      } catch (error) {
        console.error('Unable to rename chat.', error);
        setActionError(error.response?.data?.message || 'Unable to rename this chat. Please try again.');
        return;
      }
    }

    setChats((previousChats) =>
      previousChats.map((item) => item.id === chat.id ? { ...item, title } : item),
    );
    setEditingChatId(null);
    setActionError('');
  }

  async function regenerateAnswer(chat, assistantIndex) {
    const userIndex = chat.messages
      .slice(0, assistantIndex)
      .reduce((lastIndex, item, index) => item.role === 'user' ? index : lastIndex, -1);
    if (userIndex === -1 || isSending) return;

    let serverChatId =
      !chat.localOnly && /^[a-f\d]{24}$/i.test(chat.id) ? chat.id : undefined;
    setIsSending(true);
    setActionError('');

    try {
      if (chat.localOnly && !chat.incognito) {
        try {
          const importResponse = await importLocalChats([{
            localId: chat.id,
            title: chat.title,
            messages: chat.messages,
          }]);
          serverChatId = importResponse.imported.find(
            ({ localId }) => localId === chat.id,
          )?.id;
          if (!serverChatId) {
            throw new Error('The local chat import did not return a saved chat.');
          }
        } catch (error) {
          if (error.response?.status !== 503) throw error;
        }
      }

      const response = await sendMessage({
        message: chat.messages[userIndex].content,
        chatId: serverChatId,
        history: chat.messages.slice(0, userIndex),
        searchMode: chat.messages[assistantIndex].searchMode ?? 'none',
        incognito: chat.incognito === true,
        regenerate: Boolean(serverChatId),
        document:
          chat.messages[userIndex].documentId ||
          chat.messages[userIndex].documentName !== documentFile?.name
            ? undefined
            : documentFile,
        documentId: chat.messages[userIndex].documentId,
      });
      const replacementChatId =
        response.localOnly !== true && response.chat?._id
          ? response.chat._id
          : chat.id;

      setChats((previousChats) =>
        previousChats.map((item) =>
          item.id === chat.id
            ? {
                ...item,
                id: replacementChatId,
                localOnly: response.localOnly ?? item.localOnly,
                messages: item.messages.map((entry, index) =>
                  index === assistantIndex
                    ? {
                        ...entry,
                        content: response.message,
                        sources: response.sources ?? [],
                        searchMode: response.searchMode ?? 'none',
                      }
                    : entry,
                ),
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      if (replacementChatId !== chat.id) {
        setActiveChatId((currentChatId) =>
          currentChatId === chat.id ? replacementChatId : currentChatId,
        );
      }
    } catch (error) {
      console.error('Unable to regenerate AI response.', error);
      setActionError(error.response?.data?.message || 'Unable to regenerate this response. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  async function copyResponse(content, messageId) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setActionError('');
    } catch (error) {
      console.error('Unable to copy response.', error);
      setActionError('Unable to copy this response. Check your clipboard permissions and try again.');
    }
  }

  function handleDocumentChange(event) {
    const [file] = event.target.files ?? [];
    event.target.value = '';
    if (!file) return;

    if (!DOCUMENT_EXTENSIONS.test(file.name)) {
      setActionError('Choose a PDF, DOCX, or TXT document.');
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      setActionError('Documents must be 10 MB or smaller.');
      return;
    }

    setDocumentFile(file);
    setActionError('');
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form.requestSubmit();
    }
  }

  return (
    <main className={`flex h-dvh overflow-hidden ${isDark ? 'bg-[#212121] text-[#ececec]' : 'bg-white text-slate-900'}`}>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close chat history"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-{260px} shrink-0 flex-col p-3 transition-transform duration-200 md:static md:translate-x-0 ${
          isDark ? 'bg-[#171717]' : 'bg-slate-100'
        } ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-5 flex items-center justify-between px-2 py-2">
          <a href="/dashboard" className="text-lg font-semibold tracking-tight">
            syntra<span className="text-violet-400">.</span>
          </a>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className={`rounded-lg p-2 transition md:hidden ${
              isDark
                ? 'text-[#a3a3a3] hover:bg-[#262626] hover:text-white'
                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={startNewChat}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
            isDark
              ? 'border-white/10 hover:bg-[#262626]'
              : 'border-slate-300 hover:bg-slate-200'
          }`}
        >
          <NewChatIcon />
          <span>New chat</span>
        </button>

        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <p className={`mb-2 px-3 text-xs font-medium ${isDark ? 'text-[#8e8e8e]' : 'text-slate-500'}`}>Recent</p>
          {savedChats.length === 0 ? (
            <p className={`px-3 py-2 text-xs leading-5 ${isDark ? 'text-[#777]' : 'text-slate-500'}`}>
              Your conversations will show up here.
            </p>
          ) : (
            <ul className="space-y-1">
              {savedChats.map((chat) => (
                <li key={chat.id}>
                  {editingChatId === chat.id ? (
                    <form
                      onSubmit={(event) => saveChatTitle(event, chat)}
                      className={`flex gap-1 rounded-lg p-1 ${
                        isDark ? 'bg-[#2f2f2f]' : 'bg-slate-200'
                      }`}
                    >
                      <input
                        autoFocus
                        value={chatTitleDraft}
                        maxLength={120}
                        aria-label="Chat title"
                        onChange={(event) => setChatTitleDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') setEditingChatId(null);
                        }}
                        className={`min-w-0 flex-1 bg-transparent px-2 text-sm outline-none ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      />
                      <button
                        type="submit"
                        aria-label="Save chat title"
                        className="rounded px-2 text-xs font-medium text-violet-400 hover:bg-white/10"
                      >
                        Save
                      </button>
                    </form>
                  ) : (
                    <div
                      className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
                        activeChatId === chat.id
                          ? isDark
                            ? 'bg-[#2f2f2f] text-white'
                            : 'bg-slate-200 text-slate-900'
                          : isDark
                            ? 'text-[#c5c5c5] hover:bg-[#242424]'
                            : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChatId(chat.id);
                          setDocumentFile(null);
                          setSidebarOpen(false);
                        }}
                        className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
                      >
                        {chat.title}
                      </button>
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={(event) => beginRenameChat(event, chat)}
                        aria-label={`Rename ${chat.title}`}
                        className={`rounded p-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 ${
                          isDark
                            ? 'text-[#8e8e8e] hover:bg-[#3b3b3b] hover:text-white'
                            : 'text-slate-500 hover:bg-slate-300 hover:text-slate-900'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4">
                          <path
                            d="m15 5 4 4M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={(event) => removeChat(event, chat.id)}
                        aria-label={`Delete ${chat.title}`}
                        className={`rounded p-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 ${
                          isDark
                            ? 'text-[#8e8e8e] hover:bg-[#3b3b3b] hover:text-white'
                            : 'text-slate-500 hover:bg-slate-300 hover:text-slate-900'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4">
                          <path
                            d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`mt-3 border-t px-3 pt-4 text-xs ${isDark ? 'border-white/10 text-[#8e8e8e]' : 'border-slate-300 text-slate-500'}`}>
          {isIncognito ? 'Incognito chats are not saved' : 'Chats are saved on this device'}
        </div>
      </aside>

      <section className={`flex min-w-0 flex-1 flex-col ${isDark ? 'bg-[#212121] text-[#ececec]' : 'bg-white text-slate-900'}`}>
        <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open chat history"
              onClick={() => setSidebarOpen(true)}
              className={`rounded-lg p-2 transition md:hidden ${
                isDark
                  ? 'text-[#c5c5c5] hover:bg-white/10'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
            <span className={`text-sm font-medium ${isDark ? 'text-[#ececec]' : 'text-slate-800'}`}>Syntra</span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`size-4 ${isDark ? 'text-[#8e8e8e]' : 'text-slate-500'}`}>
              <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleIncognito}
              disabled={isSending}
              aria-pressed={isIncognito}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isIncognito
                  ? 'border-violet-400/50 bg-violet-400/15 text-violet-300'
                  : isDark
                    ? 'border-white/10 text-[#c5c5c5] hover:bg-white/10'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isIncognito ? 'Incognito on' : 'Incognito'}
            </button>
            <button
              type="button"
              onClick={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isDark
                  ? 'border-white/10 text-[#c5c5c5] hover:bg-white/10'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            <div className={`flex size-8 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold ${isDark ? 'text-violet-200' : 'text-violet-700'}`}>
              S
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4">
            {actionError && (
              <p role="alert" className="mx-auto mt-3 w-fit rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {actionError}
              </p>
            )}
            {isIncognito && (
              <p className="mx-auto mt-3 w-fit rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs text-violet-300">
                Incognito chat — this conversation won’t be saved
              </p>
            )}
            {activeChat?.messages.length ? (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10 md:py-14">
                {activeChat.messages.map((chatMessage, index) => (
                  <article key={`${activeChat.id}-${index}`} className="flex gap-4">
                    <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      isDark ? 'bg-[#343434] text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {chatMessage.role === 'user' ? 'You' : 'S'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`whitespace-pre-wrap pt-1.5 text-[15px] leading-7 ${isDark ? 'text-[#ececec]' : 'text-slate-800'}`}>
                        {chatMessage.content}
                      </p>
                      {chatMessage.documentName && (
                        <p className={`mt-2 text-xs ${isDark ? 'text-[#8e8e8e]' : 'text-slate-500'}`}>
                          Attached: {chatMessage.documentName}
                        </p>
                      )}
                      {chatMessage.sources?.length > 0 && (
                        <div className="mt-4">
                          <p className={`mb-2 text-xs font-medium ${isDark ? 'text-[#a3a3a3]' : 'text-slate-500'}`}>
                            Sources
                          </p>
                          <ul className="flex flex-wrap gap-2">
                            {chatMessage.sources.map((source, sourceIndex) => (
                              <li key={`${source.url}-${sourceIndex}`}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                                    isDark
                                      ? 'border-white/10 text-[#c5c5c5] hover:border-white/25 hover:text-white'
                                      : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900'
                                  }`}
                                >
                                  <span className="text-violet-300">[{sourceIndex + 1}]</span>
                                  <span className="max-w-56 truncate">{source.title}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {chatMessage.role === 'assistant' && (
                        <div className="mt-2 flex items-center gap-3">
                          {index === lastAssistantMessageIndex && (
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => regenerateAnswer(activeChat, index)}
                              className={`text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                isDark ? 'text-[#8e8e8e] hover:text-white' : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              Regenerate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => copyResponse(chatMessage.content, `${activeChat.id}-${index}`)}
                            className={`text-xs transition ${
                              isDark ? 'text-[#8e8e8e] hover:text-white' : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            {copiedMessageId === `${activeChat.id}-${index}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center pb-10">
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-xl font-semibold text-violet-300">
                    S
                  </div>
                  <h1 className={`text-2xl font-semibold tracking-tight sm:text-3xl ${isDark ? 'text-[#f4f4f4]' : 'text-slate-900'}`}>
                    What can I help with?
                  </h1>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.title}
                      type="button"
                      onClick={() => {
                        setMessage(suggestion.prompt);
                        textareaRef.current?.focus();
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isDark
                          ? 'border-white/10 hover:border-white/20 hover:bg-white/5'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`block text-sm font-medium ${isDark ? 'text-[#e5e5e5]' : 'text-slate-700'}`}>
                        {suggestion.title}
                      </span>
                      <span className={`mt-1 block text-xs ${isDark ? 'text-[#8e8e8e]' : 'text-slate-500'}`}>
                        {suggestion.prompt.trim()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 pb-4 pt-2">
            <form
              onSubmit={submitMessage}
              className={`mx-auto w-full max-w-3xl rounded-[1.75rem] border p-2 shadow-lg focus-within:border-violet-400/50 ${
                isDark
                  ? 'border-white/10 bg-[#2f2f2f] shadow-black/10'
                  : 'border-slate-300 bg-slate-100 shadow-slate-200/50'
              }`}
            >
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleDocumentChange}
                className="hidden"
              />
              {activeDocument && !documentFile && (
                <p className={`mb-2 px-3 text-xs ${isDark ? 'text-[#a3a3a3]' : 'text-slate-500'}`}>
                  Using saved document: {activeDocument.documentName}
                </p>
              )}
              {documentFile && (
                <div className={`mb-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ${
                  isDark ? 'bg-white/5' : 'bg-white'
                }`}>
                  <span className="min-w-0 flex-1 truncate text-xs">{documentFile.name}</span>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void sendContent(
                      'Summarize the attached document by section. Include its main ideas, conclusions, and important details.',
                    )}
                    className="rounded-full border border-violet-400/30 px-3 py-1 text-xs text-violet-300 transition hover:bg-violet-400/10 disabled:opacity-50"
                  >
                    Summarize
                  </button>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void sendContent(
                      'Extract the important information from the attached document. List key facts, dates, names, figures, requirements, and action items. Do not infer details that are not stated.',
                    )}
                    className="rounded-full border border-violet-400/30 px-3 py-1 text-xs text-violet-300 transition hover:bg-violet-400/10 disabled:opacity-50"
                  >
                    Extract key info
                  </button>
                  <button
                    type="button"
                    disabled={isSending}
                    aria-label="Remove attached document"
                    onClick={() => setDocumentFile(null)}
                    className={`rounded-full px-2 py-1 text-xs transition disabled:opacity-50 ${
                      isDark ? 'text-[#a3a3a3] hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Remove
                  </button>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={message}
                disabled={isSending}
                onChange={(event) => {
                  setMessage(event.target.value);
                  event.target.style.height = 'auto';
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
                }}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                placeholder="Message Syntra"
                aria-label="Message Syntra"
                className={`block max-h-{180px} min-h-11 w-full resize-none bg-transparent px-3 py-3 text-sm leading-5 outline-none ${
                  isDark
                    ? 'text-white placeholder:text-[#8e8e8e]'
                    : 'text-slate-900 placeholder:text-slate-500'
                }`}
              />
              <div className="flex items-center justify-between px-1 pb-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={searchMode === 'internet'}
                    disabled={isSending}
                    onClick={() =>
                      setSearchMode((mode) => (mode === 'internet' ? 'none' : 'internet'))
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      searchMode === 'internet'
                        ? 'border-sky-400/50 bg-sky-400/15 text-sky-200'
                        : isDark
                          ? 'border-white/10 text-[#a3a3a3] hover:border-white/25 hover:text-white'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Internet search
                  </button>
                  <button
                    type="button"
                    aria-pressed={searchMode === 'deep'}
                    disabled={isSending}
                    onClick={() =>
                      setSearchMode((mode) => (mode === 'deep' ? 'none' : 'deep'))
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      searchMode === 'deep'
                        ? 'border-violet-400/50 bg-violet-400/15 text-violet-200'
                        : isDark
                          ? 'border-white/10 text-[#a3a3a3] hover:border-white/25 hover:text-white'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Deep research
                  </button>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => documentInputRef.current?.click()}
                    className={`rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isDark
                        ? 'border-white/10 text-[#a3a3a3] hover:border-white/25 hover:text-white'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Attach document
                  </button>
                  <span className={`hidden px-1 text-xs sm:inline ${isDark ? 'text-[#777]' : 'text-slate-500'}`}>
                    Shift + Enter for a new line
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={!message.trim() || isSending}
                  aria-label="Send message"
                  className={`flex size-9 items-center justify-center rounded-full transition disabled:cursor-not-allowed ${
                    isDark
                      ? 'bg-white text-[#202020] hover:bg-[#dedede] disabled:bg-[#555] disabled:text-[#999]'
                      : 'bg-slate-800 text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:text-slate-500'
                  }`}
                >
                  <SendIcon />
                </button>
              </div>
            </form>
            {isSending && (
              <p role="status" className={`mx-auto mt-2 max-w-3xl text-center text-xs ${isDark ? 'text-[#a3a3a3]' : 'text-slate-500'}`}>
                {searchMode === 'deep'
                  ? 'Researching multiple sources and preparing a cited report...'
                  : searchMode === 'internet'
                    ? 'Searching the internet...'
                    : 'Syntra is thinking...'}
              </p>
            )}
            <p className={`mx-auto mt-3 max-w-3xl text-center text-[11px] ${isDark ? 'text-[#777]' : 'text-slate-500'}`}>
              Syntra can make mistakes. Check important information.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
