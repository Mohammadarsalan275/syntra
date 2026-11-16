import {Router} from 'express';
import { sendMessage,getChats,getMessages} from '../controllers/chat.controller.js';
import {authUser} from '../middleware/auth.middleware.js';

const router = Router();

router.post("/send",authUser, sendMessage);
router.get("/chats",authUser, getChats);
router.get("/chats/:chatId/messages",authUser, getMessages);
chatRouter.post("/send", sendMessage);
chatRouter.delete("/delete/:chatId", authUser, deleteChat);
export default router;