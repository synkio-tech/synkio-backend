import { Router } from 'express';
import { WaitlistController } from '../controllers/WaitlistController';

const router = Router();

router.post('/join', WaitlistController.joinWaitlist);
router.get('/', WaitlistController.getAllWaitlist);
router.get('/:email', WaitlistController.getWaitlistEntry);

export default router;
