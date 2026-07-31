const express = require('express');
const {
  listBanners,
  listPublicBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleActive,
} = require('../controllers/bannerController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public: unauthenticated storefront home page reads active banners only.
router.get('/public', listPublicBanners);

router.use(protect, authorize('admin'));

router.get('/', listBanners);
router.post('/', upload.single('image'), createBanner);
router.put('/:id', upload.single('image'), updateBanner);
router.delete('/:id', deleteBanner);
router.post('/:id/toggle-active', toggleActive);
router.put('/:id/toggle-active', toggleActive);
router.patch('/:id/toggle-active', toggleActive);

module.exports = router;
