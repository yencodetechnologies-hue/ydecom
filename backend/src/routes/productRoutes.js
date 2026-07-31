const express = require('express');
const {
  listProducts,
  listPublicProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  togglePriceVisible,
} = require('../controllers/productController');
const { listInterestIds, listInterests, expressInterest } = require('../controllers/productInterestController');
const { protect, authorize, optionalProtect } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const { productValidator } = require('../validators/resourceValidators');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public storefront: optional auth so logged-in customers get personal discount pricing.
router.get('/public', optionalProtect, listPublicProducts);

router.use(protect);

router.get('/interest/ids', listInterestIds);
router.get('/interest', authorize('admin', 'stockist', 'distributor'), listInterests);
router.get('/', listProducts);
router.post('/:productId/interest', expressInterest);
router.post('/:id/toggle-price', authorize('admin'), togglePriceVisible);
router.put('/:id/toggle-price', authorize('admin'), togglePriceVisible);
router.patch('/:id/toggle-price', authorize('admin'), togglePriceVisible);
router.get('/:id', getProduct);
router.post(
  '/',
  authorize('admin'),
  upload.array('images', 8),
  productValidator,
  validateWithDetails,
  createProduct
);
router.put(
  '/:id',
  authorize('admin'),
  upload.array('images', 8),
  updateProduct
);
router.delete('/:id', authorize('admin'), deleteProduct);

module.exports = router;
