const express = require('express');
const {
  listManufacturers,
  listPublicManufacturers,
  getManufacturer,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
  toggleActive,
} = require('../controllers/manufacturerController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const { manufacturerValidator } = require('../validators/resourceValidators');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.get('/public', listPublicManufacturers);

router.use(protect);

router.get('/', listManufacturers);
router.post('/:id/toggle-active', authorize('admin'), toggleActive);
router.put('/:id/toggle-active', authorize('admin'), toggleActive);
router.patch('/:id/toggle-active', authorize('admin'), toggleActive);
router.get('/:id', getManufacturer);
router.post(
  '/',
  authorize('admin'),
  upload.single('image'),
  manufacturerValidator,
  validateWithDetails,
  createManufacturer
);
router.put(
  '/:id',
  authorize('admin'),
  upload.single('image'),
  manufacturerValidator,
  validateWithDetails,
  updateManufacturer
);
router.delete('/:id', authorize('admin'), deleteManufacturer);

module.exports = router;
