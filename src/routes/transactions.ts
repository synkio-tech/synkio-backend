import { Router } from 'express';
import { TransactionController } from '../controllers/TransactionController';

const router = Router();

// Initialize controller with services (will be injected)
let transactionController: TransactionController;

export const initializeTransactionRoutes = (paymentService: any, reputationService: any) => {
  transactionController = new TransactionController(paymentService, reputationService);
};

// Transaction management routes
router.get('/:email', (req, res, next) => transactionController.getTransactions(req, res, next));
router.get('/:email/:transactionId', (req, res, next) => transactionController.getTransaction(req, res, next));
router.put('/:transactionId/status', (req, res, next) => transactionController.updateTransactionStatus(req, res, next));
router.get('/:transactionId/timeline', (req, res, next) => transactionController.getTransactionTimeline(req, res, next));

// Payment routes
router.post('/payment/direct', (req, res, next) => transactionController.makeDirectPayment(req, res, next));

export default router;
