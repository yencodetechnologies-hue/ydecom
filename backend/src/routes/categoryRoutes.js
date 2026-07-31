const express = require('express');
const {
  listCategories,
  listPublicCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleActive,
} = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const { categoryValidator } = require('../validators/resourceValidators');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public: unauthenticated storefront home page reads active categories only.
router.get('/public', listPublicCategories);

router.use(protect);

router.get('/', listCategories);
// Accept POST/PUT/PATCH — some clients/proxies rewrite or block PATCH and caused 404s.
router.post('/:id/toggle-active', authorize('admin'), toggleActive);
router.put('/:id/toggle-active', authorize('admin'), toggleActive);
router.patch('/:id/toggle-active', authorize('admin'), toggleActive);
router.get('/:id', getCategory);
router.post(
  '/',
  authorize('admin'),
  upload.single('image'),
  categoryValidator,
  validateWithDetails,
  createCategory
);
router.put(
  '/:id',
  authorize('admin'),
  upload.single('image'),
  categoryValidator,
  validateWithDetails,
  updateCategory
);
router.delete('/:id', authorize('admin'), deleteCategory);

module.exports = router;
