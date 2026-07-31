const express = require('express');
const {
  listWishlist,
  addToWishlist,
  removeFromWishlist,
  listWishlistIds,
} = require('../controllers/wishlistController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', listWishlist);
router.get('/ids', listWishlistIds);
router.post('/:productId', addToWishlist);
router.delete('/:productId', removeFromWishlist);

module.exports = router;
