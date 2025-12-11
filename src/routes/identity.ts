import { Router } from 'express';
import { IdentityController } from '../controllers/IdentityController';

const router = Router();

// User management routes
router.post('/create', IdentityController.createUser);
router.post('/signin', IdentityController.signIn);
router.get('/:email', IdentityController.getUser);
router.get('/:email/onboarding', IdentityController.checkOnboarding);
router.put('/:email/onboarding', IdentityController.completeOnboarding);
router.get('/:email/wallet/balance', IdentityController.getWalletBalance);
router.put('/:email/link-farcaster', IdentityController.linkFarcaster);
router.put('/:email/profile', IdentityController.updateProfile);

// Vendor search routes
router.get('/', IdentityController.getVendors);

export default router;
