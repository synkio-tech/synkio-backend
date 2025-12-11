import { Router } from 'express';
import { ConversationController } from '../controllers/ConversationController';

const router = Router();

router.get('/:id', ConversationController.getConversation);
router.post('/', ConversationController.createConversation);
router.post('/:id/messages', ConversationController.saveMessage);
router.put('/:id/context', ConversationController.updateContext);
router.get('/:id/history', ConversationController.getConversationHistory);

export default router;

