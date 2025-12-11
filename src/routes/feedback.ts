import { Router } from 'express';
import { FeedbackController } from '../controllers/FeedbackController';

const router = Router();

router.post('/', FeedbackController.createFeedback);
router.get('/', FeedbackController.getAllFeedback);
router.get('/stats', FeedbackController.getFeedbackStats);
router.get('/:id', FeedbackController.getFeedbackById);
router.put('/:id/status', FeedbackController.updateFeedbackStatus);

export default router;

