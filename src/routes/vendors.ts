import { Router } from 'express';
import { IdentityController } from '../controllers/IdentityController';
import { ProductController } from '../controllers/ProductController';

const router = Router();

router.post('/', IdentityController.createVendor);
router.get('/', IdentityController.getVendors);
router.put('/:email', IdentityController.updateVendor);
router.get('/:email/products', ProductController.getVendorProducts);
router.get('/:email', IdentityController.getVendor);

export default router;
