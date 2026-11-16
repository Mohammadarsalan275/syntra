import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'syntra-chat-history';

function loadChats() {
  try {
    const storedChats = window.localStorage.getItem(STORAGE_KEY);
    const parsedChats = storedChats ? JSON.parse(storedChats) : [];

    return Array.isArray(parsedChats)
      ? parsedChats.filter(
          (chat) =>
            typeof chat.id === 'string' &&
            typeof chat.title === 'string' &&
            Array.isArray(chat.messages),
        )
      : [];
  } catch (error) {
    console.error('Unable to load chat history from local storage.', error);
    return [];
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
  const [activeChatId, setActiveChatId] = useState(null);
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const textareaRef = useRef(null);
  const activeChat = chats.find((chat) => chat.id === activeChatId);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error('Unable to save chat history to local storage.', error);
    }
  }, [chats]);

  function startNewChat() {
    setActiveChatId(null);
    setMessage('');
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function submitMessage(event) {
    event.preventDefault();
    const content = message.trim();

    if (!content) return;

    const timestamp = new Date().toISOString();
    const currentChat = chats.find((chat) => chat.id === activeChatId);

    if (currentChat) {
      setChats((previousChats) =>
        previousChats
          .map((chat) =>
            chat.id === currentChat.id
              ? {
                  ...chat,
                  messages: [...chat.messages, { role: 'user', content }],
                  updatedAt: timestamp,
                }
              : chat,
          )
          .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
      );
    } else {
      const newChat = {
        id: crypto.randomUUID(),
        title: content.length > 42 ? `${content.slice(0, 42).trim()}…` : content,
        messages: [{ role: 'user', content }],
        updatedAt: timestamp,
      };

      setChats((previousChats) => [newChat, ...previousChats]);
      setActiveChatId(newChat.id);
    }

    setMessage('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function removeChat(event, chatId) {
    event.stopPropagation();
    setChats((previousChats) => previousChats.filter((chat) => chat.id !== chatId));
    if (activeChatId === chatId) setActiveChatId(null);
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form.requestSubmit();
    }
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#212121] text-[#ececec]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close chat history"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[260px] shrink-0 flex-col bg-[#171717] p-3 transition-transform duration-200 md:static md:translate-x-0 ${
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
            className="rounded-lg p-2 text-[#a3a3a3] transition hover:bg-[#262626] hover:text-white md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={startNewChat}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm font-medium transition hover:bg-[#262626]"
        >
          <NewChatIcon />
          <span>New chat</span>
        </button>

        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <p className="mb-2 px-3 text-xs font-medium text-[#8e8e8e]">Recent</p>
          {chats.length === 0 ? (
            <p className="px-3 py-2 text-xs leading-5 text-[#777]">
              Your conversations will show up here.
            </p>
          ) : (
            <ul className="space-y-1">
              {chats.map((chat) => (
                <li key={chat.id}>
                  <div
                    className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
                      activeChatId === chat.id
                        ? 'bg-[#2f2f2f] text-white'
                        : 'text-[#c5c5c5] hover:bg-[#242424]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChatId(chat.id);
                        setSidebarOpen(false);
                      }}
                      className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
                    >
                      {chat.title}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => removeChat(event, chat.id)}
                      aria-label={`Delete ${chat.title}`}
                      className="rounded p-1 text-[#8e8e8e] opacity-0 transition hover:bg-[#3b3b3b] hover:text-white group-hover:opacity-100 focus:opacity-100"
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
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 border-t border-white/10 px-3 pt-4 text-xs text-[#8e8e8e]">
          Chats are saved on this device
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open chat history"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[#c5c5c5] transition hover:bg-white/10 md:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-sm font-medium text-[#ececec]">Syntra</span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4 text-[#8e8e8e]">
              <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex size-8 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-200">
            S
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4">
            {activeChat?.messages.length ? (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10 md:py-14">
                {activeChat.messages.map((chatMessage, index) => (
                  <article key={`${activeChat.id}-${index}`} className="flex gap-4">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#343434] text-xs font-semibold text-white">
                      S
                    </div>
                    <p className="min-w-0 flex-1 whitespace-pre-wrap pt-1.5 text-[15px] leading-7 text-[#ececec]">
                      {chatMessage.content}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center pb-10">
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-xl font-semibold text-violet-300">
                    S
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-[#f4f4f4] sm:text-3xl">
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
                      className="rounded-2xl border border-white/10 p-4 text-left transition hover:border-white/20 hover:bg-white/[0.03]"
                    >
                      <span className="block text-sm font-medium text-[#e5e5e5]">
                        {suggestion.title}
                      </span>
                      <span className="mt-1 block text-xs text-[#8e8e8e]">
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
              className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-white/10 bg-[#2f2f2f] p-2 shadow-lg shadow-black/10 focus-within:border-white/20"
            >
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  event.target.style.height = 'auto';
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
                }}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                placeholder="Message Syntra"
                aria-label="Message Syntra"
                className="block max-h-[180px] min-h-11 w-full resize-none bg-transparent px-3 py-3 text-sm leading-5 text-white outline-none placeholder:text-[#8e8e8e]"
              />
              <div className="flex items-center justify-between px-1 pb-0.5">
                <span className="px-2 text-xs text-[#8e8e8e]">Shift + Enter for a new line</span>
                <button
                  type="submit"
                  disabled={!message.trim()}
                  aria-label="Send message"
                  className="flex size-9 items-center justify-center rounded-full bg-white text-[#202020] transition hover:bg-[#dedede] disabled:cursor-not-allowed disabled:bg-[#555] disabled:text-[#999]"
                >
                  <SendIcon />
                </button>
              </div>
            </form>
            <p className="mx-auto mt-3 max-w-3xl text-center text-[11px] text-[#777]">
              Syntra can make mistakes. Check important information.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
