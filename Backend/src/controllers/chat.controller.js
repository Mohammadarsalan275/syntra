
import chatModel from "../models/chat.model.js";
import messageModel from "../models/message.model.js";
import { randomBytes } from "node:crypto";
import { generateResponse, generateTitle } from "../service/ai.service.js";
import { extractDocumentText } from "../service/document.service.js";
import { deepSearchInternet, searchInternet } from "../service/internet.service.js";

function getClientHistory(history = []) {
  if (typeof history === "string") {
    try {
      history = JSON.parse(history);
    } catch {
      return [];
    }
  }

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
  const isRegenerateRequest = regenerate === true || regenerate === "true";
  const searchMode =
    ["internet", "web", "deep"].includes(req.body.searchMode)
      ? req.body.searchMode === "web" ? "internet" : req.body.searchMode
      : "none";
  let document = null;

  if (req.file) {
    try {
      document = {
        text: await extractDocumentText(req.file),
        name: req.file.originalname,
      };
    } catch (error) {
      console.error("Unable to extract uploaded document:", error.message);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
          ? error.message
          : "Unable to process the uploaded document. Please try again.",
      });
    }
  }

  if (req.body.incognito === true || req.body.incognito === "true") {
    const history = getClientHistory(req.body.history);

    try {
      const research = searchMode === "deep"
        ? await deepSearchInternet(trimmedMessage)
        : null;
      const search = searchMode === "internet"
        ? await searchInternet(trimmedMessage)
        : null;
      const result = research && !document
        ? research.report
        : await generateResponse(trimmedMessage, history, {
            searchResults: research?.sources ?? search?.sources ?? [],
            documentText: document?.text,
            documentName: document?.name,
          });

      return res.status(200).json({
        success: true,
        message:
          searchMode === "internet" && search.sources.length === 0
            ? "No relevant internet sources were found. Try a different search query."
            : result,
        chat: {
          _id:
            chatId && /^[a-f\d]{24}$/i.test(chatId)
              ? chatId
              : randomBytes(12).toString("hex"),
          title: trimmedMessage.slice(0, 60),
        },
        sources: research?.sources ?? search?.sources ?? [],
        searchMode,
        incognito: true,
        localOnly: true,
        documentName: document?.name,
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
      const research = searchMode === "deep"
        ? await deepSearchInternet(trimmedMessage)
        : null;
      const search = searchMode === "internet"
        ? await searchInternet(trimmedMessage)
        : null;
      if (searchMode === "internet" && search.sources.length === 0 && !document) {
        return res.status(200).json({
          success: true,
          message: "No relevant internet sources were found. Try a different search query.",
          chat: {
            _id: chatId && /^[a-f\d]{24}$/i.test(chatId)
              ? chatId
              : randomBytes(12).toString("hex"),
            title: trimmedMessage.slice(0, 60),
          },
          sources: [],
          searchMode,
          localOnly: true,
          documentName: document?.name,
        });
      }
      const [result, title] = await Promise.all([
        research && !document
          ? Promise.resolve(research.report)
          : generateResponse(trimmedMessage, history, {
              searchResults: research?.sources ?? search?.sources ?? [],
              documentText: document?.text,
              documentName: document?.name,
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
        sources: research?.sources ?? search?.sources ?? [],
        searchMode,
        localOnly: true,
        documentName: document?.name,
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

  if (isRegenerateRequest && !chat) {
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
  if (document) {
    history = history
      .slice(-20)
      .map(({ role, content }) => ({
        role,
        content: String(content).slice(-4000),
      }));
  }
  let regenerateUserMessage = null;
  let supersededAssistantMessageIds = [];

  if (isRegenerateRequest && chat) {
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
  let research = null;
  let result;
  try {
    if (searchMode === "internet") {
      search = await searchInternet(trimmedMessage);
    } else if (searchMode === "deep") {
      research = await deepSearchInternet(trimmedMessage);
    }

    result = research && !document
      ? research.report
      : await generateResponse(trimmedMessage, history, {
          searchResults: research?.sources ?? search?.sources ?? [],
          documentText: document?.text,
          documentName: document?.name,
        });
  } catch (error) {
    console.error("AI/search response failed:", error.message);
    return res.status(503).json({
      success: false,
      message: error.message || "The AI or search provider could not generate a response.",
    });
  }

  const searchSources = research?.sources ?? search?.sources ?? [];
  if (searchMode === "internet" && searchSources.length === 0 && !document) {
    return res.status(200).json({
      success: true,
      message: "No relevant internet sources were found. Try a different search query.",
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
    documentName: document?.name,
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