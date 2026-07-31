const express = require('express');
const { getMargins, updateMargins } = require('../controllers/marginController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const { marginValidator } = require('../validators/resourceValidators');

const router = express.Router();

router.use(protect, authorize('admin'));
router.get('/', getMargins);
router.put('/', marginValidator, validateWithDetails, updateMargins);

module.exports = router;
