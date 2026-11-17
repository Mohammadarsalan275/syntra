import { Router } from "express";
import {
  deleteChat,
  getChats,
  getMessages,
  renameChat,
  sendMessage,
} from "../controllers/chat.controller.js";
import { authUser } from "../middleware/auth.middleware.js";
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

router.post("/send", authUser, handleDocumentUpload, sendMessage);
router.get("/chats", authUser, getChats);
router.get("/chats/:chatId/messages", authUser, getMessages);
router.patch("/chats/:chatId", authUser, renameChat);
router.delete("/delete/:chatId", authUser, deleteChat);

export default router;