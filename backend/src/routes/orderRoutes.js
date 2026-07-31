const express = require('express');
const {
  createOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
  updateOrderItems,
  generateInvoice,
  getInvoice,
  getOrderPrint,
} = require('../controllers/orderController');
const { payOrder } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const {
  orderValidator,
  orderStatusValidator,
  orderItemsValidator,
} = require('../validators/resourceValidators');
const { body } = require('express-validator');

const router = express.Router();

router.use(protect);

const payOrderValidator = [
  body('paymentMethod').optional().isIn(['razorpay', 'credit', 'cheque', 'neft']),
  body('paymentReference').optional({ values: 'falsy' }).trim(),
  body('paymentNote').optional({ values: 'falsy' }).trim(),
];

router.get('/', listOrders);
router.post('/', orderValidator, validateWithDetails, createOrder);
router.get('/:id', getOrder);
router.get('/:id/invoice', getInvoice);
router.get('/:id/print', getOrderPrint);
router.patch(
  '/:id/items',
  authorize('admin', 'stockist'),
  orderItemsValidator,
  validateWithDetails,
  updateOrderItems
);
router.post(
  '/:id/generate-invoice',
  authorize('admin', 'stockist'),
  validateWithDetails,
  generateInvoice
);
router.post(
  '/:id/pay',
  upload.single('paymentProof'),
  payOrderValidator,
  validateWithDetails,
  payOrder
);
router.patch(
  '/:id/status',
  authorize('admin', 'stockist', 'distributor'),
  orderStatusValidator,
  validateWithDetails,
  updateOrderStatus
);

module.exports = router;
