
import chatModel from "../models/chat.model.js";
import messageModel from "../models/message.model.js";
import { randomBytes } from "node:crypto";
import { generateResponse, generateTitle } from "../service/ai.service.js";
import { deepSearchInternet, searchInternet } from "../service/internet.service.js";

function getClientHistory(history = []) {
  return Array.isArray(history)
    ? history
        .filter(
          (entry) =>
            (entry.role === "user" || entry.role === "assistant") &&
            typeof entry.content === "string",
        )
        .slice(-20)
        .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }))
    : [];
}

export async function sendMessage(req, res) {
  const { message, chatId, regenerate = false } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({
      success: false,
      message: "Message is required",
    });
  }

  let trimmedMessage = String(message).trim();
  const searchMode = ["web", "deep"].includes(req.body.searchMode)
    ? req.body.searchMode
    : "none";

  if (req.body.incognito === true) {
    const history = getClientHistory(req.body.history);

    try {
      const search = searchMode === "web"
        ? await searchInternet(trimmedMessage)
        : null;
      const deepSearch = searchMode === "deep"
        ? await deepSearchInternet(trimmedMessage)
        : null;
      const result = deepSearch
        ? deepSearch.report
        : await generateResponse(trimmedMessage, history, {
            searchResults: search?.sources ?? [],
          });

      return res.status(200).json({
        success: true,
        message:
          searchMode !== "none" && !deepSearch && search.sources.length === 0
            ? "No relevant web sources were found. Try a different search query."
            : result,
        chat: {
          _id:
            chatId && /^[a-f\d]{24}$/i.test(chatId)
              ? chatId
              : randomBytes(12).toString("hex"),
          title: trimmedMessage.slice(0, 60),
        },
        sources: deepSearch?.sources ?? search?.sources ?? [],
        searchMode,
        incognito: true,
        localOnly: true,
      });
    } catch (error) {
      console.error("Incognito AI/search response failed:", error.message);
      return res.status(503).json({
        success: false,
        message: error.message || "The AI or search provider could not generate a response.",
      });
    }
  }

  if (req.user.demo) {
    const history = getClientHistory(req.body.history);

    try {
      const search = searchMode === "web"
        ? await searchInternet(trimmedMessage)
        : null;
      const deepSearch = searchMode === "deep"
        ? await deepSearchInternet(trimmedMessage)
        : null;
      if (searchMode !== "none" && !deepSearch && search.sources.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No relevant web sources were found. Try a different search query.",
          chat: {
            _id: chatId && /^[a-f\d]{24}$/i.test(chatId)
              ? chatId
              : randomBytes(12).toString("hex"),
            title: trimmedMessage.slice(0, 60),
          },
          sources: [],
          searchMode,
          localOnly: true,
        });
      }
      const [result, title] = await Promise.all([
        deepSearch
          ? Promise.resolve(deepSearch.report)
          : generateResponse(trimmedMessage, history, {
              searchResults: search?.sources ?? [],
            }),
        chatId ? Promise.resolve(null) : generateTitle(trimmedMessage),
      ]);
      const chat = {
        _id: chatId && /^[a-f\d]{24}$/i.test(chatId)
          ? chatId
          : randomBytes(12).toString("hex"),
        title: title || trimmedMessage.slice(0, 60),
      };

      return res.status(200).json({
        success: true,
        message: result,
        chat,
        sources: deepSearch?.sources ?? search?.sources ?? [],
        searchMode,
        localOnly: true,
      });
    } catch (error) {
      console.error("Demo AI/search response failed:", error.message);
      return res.status(503).json({
        success: false,
        message: error.message || "The AI or search provider could not generate a response.",
      });
    }
  }

  let chat = chatId && /^[a-f\d]{24}$/i.test(chatId)
    ? await chatModel.findOne({ _id: chatId, user: req.user._id })
    : null;

  if (regenerate && !chat) {
    return res.status(404).json({
      success: false,
      message: "Chat not found",
    });
  }

  let history = chat
    ? await messageModel
        .find({ chat: chat._id })
        .sort({ createdAt: 1 })
        .select("role content")
        .lean()
    : getClientHistory(req.body.history);
  let regenerateUserMessage = null;
  let supersededAssistantMessageIds = [];

  if (regenerate && chat) {
    const conversation = await messageModel
      .find({ chat: chat._id })
      .sort({ createdAt: 1 })
      .select("role content createdAt")
      .lean();
    let lastUserIndex = -1;
    for (let index = conversation.length - 1; index >= 0; index -= 1) {
      if (conversation[index].role === "user") {
        lastUserIndex = index;
        break;
      }
    }

    if (lastUserIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "There is no user message to regenerate.",
      });
    }

    regenerateUserMessage = conversation[lastUserIndex];
    supersededAssistantMessageIds = conversation
      .slice(lastUserIndex + 1)
      .filter(({ role }) => role === "assistant")
      .map(({ _id }) => _id);
    trimmedMessage = regenerateUserMessage.content;
    history = conversation
      .slice(0, lastUserIndex)
      .map(({ role, content }) => ({ role, content }));
  }

  let search = null;
  let deepSearch = null;
  let result;
  try {
    if (searchMode === "web") {
      search = await searchInternet(trimmedMessage);
    } else if (searchMode === "deep") {
      deepSearch = await deepSearchInternet(trimmedMessage);
    }

    result = deepSearch
      ? deepSearch.report
      : await generateResponse(trimmedMessage, history, {
          searchResults: search?.sources ?? [],
        });
  } catch (error) {
    console.error("AI/search response failed:", error.message);
    return res.status(503).json({
      success: false,
      message: error.message || "The AI or search provider could not generate a response.",
    });
  }

  const searchSources = deepSearch?.sources ?? search?.sources ?? [];
  if (searchMode !== "none" && !deepSearch && searchSources.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No relevant web sources were found. Try a different search query.",
      chat,
      sources: [],
      searchMode,
    });
  }

  if (!chat) {
    chat = await chatModel.create({
      user: req.user._id,
      title: await generateTitle(trimmedMessage),
    });
  }

  if (regenerateUserMessage) {
    await messageModel.deleteMany({
      _id: { $in: supersededAssistantMessageIds },
    });
  }

  const userMessage = regenerateUserMessage
    ? regenerateUserMessage
    : await messageModel.create({
        chat: chat._id,
        sender: req.user._id,
        role: "user",
        content: trimmedMessage,
      });

  const aiMessage = await messageModel.create({
    chat: chat._id,
    sender: req.user._id,
    role: "assistant",
    content: result,
  });

  await chatModel.findByIdAndUpdate(chat._id, {
    lastMessage: aiMessage._id,
    title: chat.title || (await generateTitle(trimmedMessage)),
    summary: result.slice(0, 200),
  });

  return res.status(200).json({
    success: true,
    message: result,
    chat,
    localOnly: false,
    userMessage,
    aiMessage,
    sources: searchSources,
    searchMode,
  });
}

export async function renameChat(req, res) {
  if (req.user.demo) {
    return res.status(404).json({ success: false, message: "Chat not found" });
  }

  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title || title.length > 120) {
    return res.status(400).json({
      success: false,
      message: "Chat title must be between 1 and 120 characters.",
    });
  }

  const chat = await chatModel.findOneAndUpdate(
    { _id: req.params.chatId, user: req.user._id },
    { title },
    { new: true, runValidators: true },
  );

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: "Chat not found",
    });
  }

  return res.status(200).json({ success: true, chat });
}

export async function getChats(req, res) {
  if (req.user.demo) {
    return res.status(200).json({ success: true, chats: [] });
  }

  const chats = await chatModel
    .find({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .lean();

  return res.status(200).json({
    success: true,
    chats,
  });
}

export async function getMessages(req, res) {
  if (req.user.demo) {
    return res.status(404).json({ success: false, message: "Chat not found" });
  }

  const { chatId } = req.params;

  const chat = await chatModel.findOne({
    _id: chatId,
    user: req.user._id,
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: "Chat not found",
    });
  }

  const messages = await messageModel.find({ chat: chat._id }).sort({ createdAt: 1 }).lean();

  return res.status(200).json({
    success: true,
    messages,
  });
}

export async function deleteChat(req, res) {
  if (req.user.demo) {
    return res.status(404).json({ success: false, message: "Chat not found" });
  }

  const { chatId } = req.params;

  const chat = await chatModel.findOneAndDelete({
    _id: chatId,
    user: req.user._id,
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: "Chat not found",
    });
  }

  await messageModel.deleteMany({ chat: chat._id });

  return res.status(200).json({
    success: true,
    message: "Chat deleted successfully",
  });
}