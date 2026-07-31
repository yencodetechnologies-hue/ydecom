const express = require('express');
const {
  createPayment,
  verifyPayment,
  failPayment,
  approvePayment,
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const { body } = require('express-validator');

const router = express.Router();

router.use(protect);

const createPaymentValidator = [
  body('items').custom((value) => {
    const items = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(items) || items.length < 1) {
      throw new Error('At least one item is required');
    }
    return true;
  }),
  body('shippingAddress').trim().notEmpty().withMessage('Delivery address is required'),
  body('voucherCode').optional({ values: 'falsy' }).trim(),
  body('paymentMethod')
    .optional()
    .isIn(['razorpay', 'credit', 'cash', 'cheque', 'neft']),
  body('paymentReference').optional({ values: 'falsy' }).trim(),
  body('paymentNote').optional({ values: 'falsy' }).trim(),
];

const verifyPaymentValidator = [
  body('orderId').notEmpty().withMessage('Order id is required'),
  body('razorpay_order_id').notEmpty().withMessage('Razorpay order id is required'),
  body('razorpay_payment_id').notEmpty().withMessage('Razorpay payment id is required'),
  body('razorpay_signature').notEmpty().withMessage('Razorpay signature is required'),
];

router.post(
  '/create',
  upload.single('paymentProof'),
  createPaymentValidator,
  validateWithDetails,
  createPayment
);
router.post('/verify', verifyPaymentValidator, validateWithDetails, verifyPayment);
router.post('/fail', body('orderId').notEmpty(), validateWithDetails, failPayment);
router.post(
  '/:orderId/approve',
  authorize('admin', 'stockist'),
  body('note').optional({ values: 'falsy' }).trim(),
  body('paymentMethod')
    .optional()
    .isIn(['razorpay', 'credit', 'cash', 'card', 'cheque', 'neft']),
  validateWithDetails,
  approvePayment
);

module.exports = router;
