
import chatModel from "../models/chat.model.js";
import messageModel from "../models/message.model.js";
import chatDocumentModel from "../models/chat-document.model.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import { generateResponse, generateTitle } from "../service/ai.service.js";
import { extractDocumentText } from "../service/document.service.js";
import { deepSearchInternet, searchInternet } from "../service/internet.service.js";

function getOwnerQuery(user) {
  return user.demo
    ? { guestId: String(user._id) }
    : { user: user._id };
}

function getDocumentOwnerQuery(user) {
  return user.demo
    ? { ownerGuestId: String(user._id) }
    : { ownerUser: user._id };
}

function getSenderFields(user) {
  return user.demo
    ? { senderGuestId: String(user._id) }
    : { sender: user._id };
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export function createGuestSession(req, res) {
  if (!req.user?.demo) {
    return res.status(403).json({
      success: false,
      message: "Guest chat sessions are only available for demo users.",
    });
  }

  const secret = getJwtSecret();
  if (!secret) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured",
    });
  }

  const token = jwt.sign(
    { guestId: randomUUID(), guestSession: true },
    secret,
    { expiresIn: "365d" },
  );
  return res.status(200).json({ success: true, token });
}

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
  const ownerQuery = getOwnerQuery(req.user);
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

  if (!document && req.body.documentId) {
    if (!chatId || !/^[a-f\d]{24}$/i.test(chatId) || !isDatabaseConnected()) {
      return res.status(404).json({
        success: false,
        message: "The attached document could not be found.",
      });
    }

    const documentChat = await chatModel.findOne({
      _id: chatId,
      ...ownerQuery,
    });
    const savedDocument = documentChat
      ? await chatDocumentModel
          .findOne({
            _id: req.body.documentId,
            chat: documentChat._id,
            ...getDocumentOwnerQuery(req.user),
          })
          .select("+extractedText")
      : null;

    if (!savedDocument) {
      return res.status(404).json({
        success: false,
        message: "The attached document could not be found.",
      });
    }

    document = {
      id: savedDocument._id,
      name: savedDocument.originalName,
      text: savedDocument.extractedText,
    };
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

  if (req.user.demo && !isDatabaseConnected()) {
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
    ? await chatModel.findOne({ _id: chatId, ...ownerQuery })
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
      ...ownerQuery,
      title: await generateTitle(trimmedMessage),
    });
  }

  if (req.file && document) {
    const savedDocument = await chatDocumentModel.create({
      chat: chat._id,
      ...getDocumentOwnerQuery(req.user),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      extractedText: document.text,
    });
    document.id = savedDocument._id;
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
        ...getSenderFields(req.user),
        role: "user",
        content: trimmedMessage,
        ...(document
          ? {
              attachments: [{
                name: document.name,
                type: req.file?.mimetype || "application/octet-stream",
                documentId: document.id,
              }],
              metadata: { documentId: document.id },
            }
          : {}),
      });

  const aiMessage = await messageModel.create({
    chat: chat._id,
    ...getSenderFields(req.user),
    role: "assistant",
    content: result,
    metadata: {
      sources: searchSources,
      searchMode,
      ...(document ? { documentId: document.id } : {}),
    },
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
    document: document
      ? { id: String(document.id), name: document.name }
      : null,
  });
}

export async function renameChat(req, res) {
  if (req.user.demo && !isDatabaseConnected()) {
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
    { _id: req.params.chatId, ...getOwnerQuery(req.user) },
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

export async function importLocalChats(req, res) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({
      success: false,
      message: "MongoDB is unavailable. Local chat history was not imported.",
    });
  }

  const chats = req.body?.chats;
  if (!Array.isArray(chats) || chats.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Provide up to 100 local chats to import.",
    });
  }

  const ownerQuery = getOwnerQuery(req.user);
  const imported = [];

  for (const localChat of chats) {
    if (
      typeof localChat?.localId !== "string" ||
      localChat.localId.length > 128 ||
      typeof localChat.title !== "string" ||
      !Array.isArray(localChat.messages) ||
      localChat.messages.length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: "A local chat has invalid or excessive data.",
      });
    }

    let chat = await chatModel.findOne({
      ...ownerQuery,
      "metadata.localChatId": localChat.localId,
    });

    if (!chat) {
      const title = localChat.title.trim().slice(0, 120) || "Imported chat";
      chat = await chatModel.create({
        ...ownerQuery,
        title,
        metadata: { localChatId: localChat.localId },
      });

      const messages = localChat.messages
        .filter(
          (item) =>
            (item?.role === "user" || item?.role === "assistant") &&
            typeof item.content === "string" &&
            item.content.length > 0,
        )
        .map((item) => ({
          chat: chat._id,
          ...getSenderFields(req.user),
          role: item.role,
          content: item.content.slice(0, 40_000),
          metadata: {
            ...(Array.isArray(item.sources)
              ? {
                  sources: item.sources
                    .filter(
                      (source) =>
                        typeof source?.url === "string" &&
                        typeof source?.title === "string",
                    )
                    .slice(0, 20)
                    .map((source) => ({
                      url: source.url.slice(0, 2048),
                      title: source.title.slice(0, 512),
                      ...(typeof source.snippet === "string"
                        ? { snippet: source.snippet.slice(0, 2000) }
                        : {}),
                    })),
                }
              : {}),
            ...(["none", "internet", "deep"].includes(item.searchMode)
              ? { searchMode: item.searchMode }
              : {}),
            ...(typeof item.documentName === "string"
              ? { documentName: item.documentName.slice(0, 255) }
              : {}),
          },
        }))
        .filter((item) => item.content.trim().length > 0);

      if (messages.length) {
        await messageModel.insertMany(messages);
      }
    }

    imported.push({ localId: localChat.localId, id: String(chat._id) });
  }

  return res.status(200).json({ success: true, imported });
}

export async function getChats(req, res) {
  if (req.user.demo && !isDatabaseConnected()) {
    return res.status(200).json({ success: true, chats: [], localOnly: true });
  }

  const chats = await chatModel
    .find(getOwnerQuery(req.user))
    .sort({ updatedAt: -1 })
    .lean();
  const messages = chats.length
    ? await messageModel
        .find({ chat: { $in: chats.map(({ _id }) => _id) } })
        .sort({ createdAt: 1 })
        .lean()
    : [];
  const messagesByChat = new Map();
  for (const message of messages) {
    const key = String(message.chat);
    const chatMessages = messagesByChat.get(key) ?? [];
    chatMessages.push({
      role: message.role,
      content: message.content,
      sources: message.metadata?.sources ?? [],
      searchMode: message.metadata?.searchMode ?? "none",
      documentId: message.metadata?.documentId
        ? String(message.metadata.documentId)
        : undefined,
      documentName: message.attachments?.[0]?.name ?? message.metadata?.documentName,
      createdAt: message.createdAt,
    });
    messagesByChat.set(key, chatMessages);
  }

  return res.status(200).json({
    success: true,
    chats: chats.map((chat) => ({
      id: String(chat._id),
      title: chat.title,
      updatedAt: chat.updatedAt?.toISOString?.() ?? chat.updatedAt,
      messages: messagesByChat.get(String(chat._id)) ?? [],
      localOnly: false,
    })),
  });
}

export async function getMessages(req, res) {
  if (req.user.demo && !isDatabaseConnected()) {
    return res.status(404).json({ success: false, message: "Chat not found" });
  }

  const { chatId } = req.params;

  const chat = await chatModel.findOne({
    _id: chatId,
    ...getOwnerQuery(req.user),
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
    messages: messages.map((message) => ({
      ...message,
      sources: message.metadata?.sources ?? [],
      searchMode: message.metadata?.searchMode ?? "none",
      documentId: message.metadata?.documentId
        ? String(message.metadata.documentId)
        : undefined,
      documentName: message.attachments?.[0]?.name ?? message.metadata?.documentName,
    })),
  });
}

export async function deleteChat(req, res) {
  if (req.user.demo && !isDatabaseConnected()) {
    return res.status(404).json({ success: false, message: "Chat not found" });
  }

  const { chatId } = req.params;

  const chat = await chatModel.findOneAndDelete({
    _id: chatId,
    ...getOwnerQuery(req.user),
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: "Chat not found",
    });
  }

  await messageModel.deleteMany({ chat: chat._id });
  await chatDocumentModel.deleteMany({ chat: chat._id });

  return res.status(200).json({
    success: true,
    message: "Chat deleted successfully",
  });
}