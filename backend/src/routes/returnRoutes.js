const express = require('express');
const {
  createReturn,
  listReturns,
  getReturn,
  approveReturn,
  rejectReturn,
  markPickupDone,
  getOrderReturnEligibility,
} = require('../controllers/returnController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const { body } = require('express-validator');

const router = express.Router();

router.use(protect);

router.get('/eligibility/:orderId', getOrderReturnEligibility);
router.get('/', listReturns);
router.get('/:id', getReturn);

router.post(
  '/',
  authorize('stockist', 'distributor', 'retailer', 'reseller'),
  upload.single('image'),
  createReturn
);

router.patch(
  '/:id/approve',
  authorize('admin', 'stockist', 'distributor'),
  body('note').optional({ values: 'falsy' }).trim(),
  validateWithDetails,
  approveReturn
);

router.patch(
  '/:id/reject',
  authorize('admin', 'stockist', 'distributor'),
  body('note').trim().notEmpty().withMessage('Rejection note is required'),
  validateWithDetails,
  rejectReturn
);

router.patch(
  '/:id/pickup-done',
  authorize('admin', 'stockist', 'distributor'),
  body('note').optional({ values: 'falsy' }).trim(),
  validateWithDetails,
  markPickupDone
);

module.exports = router;
