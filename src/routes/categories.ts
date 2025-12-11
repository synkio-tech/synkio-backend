import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';

const router = Router();

router.get('/', CategoryController.getCategories);
router.get('/:slug', CategoryController.getCategory);
router.post('/', CategoryController.createCategory);
router.put('/:slug', CategoryController.updateCategory);
router.delete('/:slug', CategoryController.deleteCategory);

export default router;
