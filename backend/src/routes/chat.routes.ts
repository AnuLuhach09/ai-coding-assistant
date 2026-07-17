import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

// Project chats endpoints
router.get('/projects/:projectId/chats', chatController.getProjectChats);
router.post('/projects/:projectId/chats', chatController.createChat);

// Chat messages endpoints
router.get('/chats/:chatId/messages', chatController.getMessages);
router.post('/chats/:chatId/messages', chatController.sendMessage);
router.put('/chats/:chatId/pin', chatController.pinChat);
router.get('/chats/:chatId/export', chatController.exportChat);

// Specific message endpoints
router.put('/messages/:messageId', chatController.editMessage);
router.delete('/messages/:messageId', chatController.deleteMessage);

export default router;
