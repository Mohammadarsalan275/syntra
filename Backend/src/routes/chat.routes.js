import { Router } from "express";
import {
  deleteChat,
  createGuestSession,
  getChats,
  importLocalChats,
  getMessages,
  renameChat,
  sendMessage,
} from "../controllers/chat.controller.js";
import { authChatUser, authUser } from "../middleware/auth.middleware.js";
import multer from "multer";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (/\.(pdf|docx|txt)$/i.test(file.originalname)) {
      return callback(null, true);
    }
    return callback(new Error("Only PDF, DOCX, and TXT documents are supported."));
  },
});

function handleDocumentUpload(req, res, next) {
  upload.single("document")(req, res, (error) => {
    if (!error) return next();

    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({
      success: false,
      message: status === 413
        ? "Documents must be 10 MB or smaller."
        : error.message,
    });
  });
}

router.post("/guest-session", authUser, createGuestSession);
router.post("/chats/import", authChatUser, importLocalChats);
router.post("/send", authChatUser, handleDocumentUpload, sendMessage);
router.get("/chats", authChatUser, getChats);
router.get("/chats/:chatId/messages", authChatUser, getMessages);
router.patch("/chats/:chatId", authChatUser, renameChat);
router.delete("/delete/:chatId", authChatUser, deleteChat);

export default router;