
import chatModel from "../models/chat.model.js";
import messageModel from "../models/message.model.js";
import { generateResponse, generateTitle } from "../service/ai.service.js";

export async function sendMessage(req, res) {
  const { message, chatId } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({
      success: false,
      message: "Message is required",
    });
  }

  const trimmedMessage = String(message).trim();

  let chat = chatId
    ? await chatModel.findOne({ _id: chatId, user: req.user._id })
    : null;

  if (!chat) {
    const title = await generateTitle(trimmedMessage);
    chat = await chatModel.create({
      user: req.user._id,
      title,
    });
  }

  const userMessage = await messageModel.create({
    chat: chat._id,
    sender: req.user._id,
    role: "user",
    content: trimmedMessage,
  });

  const result = await generateResponse(trimmedMessage, [
    { role: "user", content: trimmedMessage },
  ]);

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
    userMessage,
    aiMessage,
  });
}

export async function getChats(req, res) {
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