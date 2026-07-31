const express = require('express');
const {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  dispatchPurchaseOrder,
  receivePurchaseOrder,
  rejectPurchaseOrder,
  cancelPurchaseOrder,
} = require('../controllers/purchaseOrderController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const {
  purchaseOrderValidator,
  purchaseOrderUpdateValidator,
  purchaseOrderActionValidator,
} = require('../validators/resourceValidators');

const router = express.Router();

router.use(protect);

router.get('/', listPurchaseOrders);
router.get('/:id', getPurchaseOrder);

router.post(
  '/',
  authorize('stockist'),
  purchaseOrderValidator,
  validateWithDetails,
  createPurchaseOrder
);
router.put(
  '/:id',
  authorize('stockist'),
  purchaseOrderUpdateValidator,
  validateWithDetails,
  updatePurchaseOrder
);

router.post(
  '/:id/submit',
  authorize('stockist'),
  purchaseOrderActionValidator,
  validateWithDetails,
  submitPurchaseOrder
);
router.post(
  '/:id/approve',
  authorize('admin'),
  purchaseOrderActionValidator,
  validateWithDetails,
  approvePurchaseOrder
);
router.post(
  '/:id/dispatch',
  authorize('admin'),
  purchaseOrderActionValidator,
  validateWithDetails,
  dispatchPurchaseOrder
);
router.post(
  '/:id/receive',
  authorize('admin', 'stockist'),
  purchaseOrderActionValidator,
  validateWithDetails,
  receivePurchaseOrder
);
router.post(
  '/:id/reject',
  authorize('admin'),
  purchaseOrderActionValidator,
  validateWithDetails,
  rejectPurchaseOrder
);
router.post(
  '/:id/cancel',
  authorize('admin', 'stockist'),
  purchaseOrderActionValidator,
  validateWithDetails,
  cancelPurchaseOrder
);

module.exports = router;
