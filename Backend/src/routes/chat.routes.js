import { Router } from "express";
import {
  deleteChat,
  getChats,
  getMessages,
  sendMessage,
} from "../controllers/chat.controller.js";
import { authUser } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/send", authUser, sendMessage);
router.get("/chats", authUser, getChats);
router.get("/chats/:chatId/messages", authUser, getMessages);
router.delete("/delete/:chatId", authUser, deleteChat);

export default router;