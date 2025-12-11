import { Router } from 'express';
import { EscrowController } from '../controllers/EscrowController';
import { validateDto } from '../middleware';
import { CreateEscrowDto, ReleaseEscrowDto, RefundEscrowDto, DisputeEscrowDto, GetEscrowDto } from '../dto/escrow.dto';

const router = Router();

// Initialize controller with services (will be injected)
let escrowController: EscrowController;

export const initializeEscrowRoutes = (escrowService: any, disputeService: any) => {
  escrowController = new EscrowController(escrowService, disputeService);
};

// Escrow management routes
router.post('/create', validateDto(CreateEscrowDto, 'body'), (req, res, next) => escrowController.createEscrow(req, res, next));
router.post('/:escrowId/release', 
  validateDto(ReleaseEscrowDto, 'params'),
  (req, res, next) => {
    const bodyDto = req.body as Partial<ReleaseEscrowDto>;
    req.body = { ...req.params, ...bodyDto } as ReleaseEscrowDto;
    next();
  },
  (req, res, next) => escrowController.releaseEscrow(req, res, next)
);
router.post('/:escrowId/refund', validateDto(RefundEscrowDto, 'params'), (req, res, next) => escrowController.refundEscrow(req, res, next));
router.post('/:escrowId/dispute', 
  validateDto(DisputeEscrowDto, 'params'),
  (req, res, next) => {
    const bodyDto = req.body as Partial<DisputeEscrowDto>;
    req.body = { ...req.params, ...bodyDto } as DisputeEscrowDto;
    next();
  },
  (req, res, next) => escrowController.disputeEscrow(req, res, next)
);
router.get('/:escrowId', validateDto(GetEscrowDto, 'params'), (req, res, next) => escrowController.getEscrow(req, res, next));

// Dispute resolution routes
router.post('/:escrowId/disputes/open', (req, res, next) => escrowController.openDispute(req, res, next));
router.post('/:escrowId/disputes/evidence', (req, res, next) => escrowController.addEvidence(req, res, next));
router.post('/:escrowId/disputes/resolve', (req, res, next) => escrowController.resolveDispute(req, res, next));
router.get('/:escrowId/disputes', (req, res, next) => escrowController.getDispute(req, res, next));

export default router;
