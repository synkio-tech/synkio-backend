import { NextFunction, Router } from 'express';
import { ReputationController } from '../controllers/ReputationController';
import { asyncHandler } from '../middleware';
import { Request, Response } from 'express';

const router = Router();

// Initialize controller with services (will be injected)
let reputationController: ReputationController;

export const initializeReputationRoutes = (reputationService: any) => {
  reputationController = new ReputationController(reputationService);
};

// Reputation management routes
router.get('/:userAddress', asyncHandler(async (req: Request, res: Response, next: NextFunction) => reputationController.getReputation(req, res, next)));
router.post('/update', asyncHandler(async (req: Request, res: Response, next: NextFunction) => reputationController.updateReputation(req, res, next)));

export default router;
