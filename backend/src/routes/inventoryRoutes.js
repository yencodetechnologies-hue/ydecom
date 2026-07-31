const express = require('express');
const { body, param } = require('express-validator');
const { listInventory, updateMinRackQty } = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');

const router = express.Router();

router.use(protect, authorize('admin', 'stockist', 'distributor'));
router.get('/', listInventory);
router.patch(
  '/:id/min-rack-qty',
  authorize('stockist', 'distributor'),
  param('id').isMongoId().withMessage('Invalid inventory id'),
  body('minRackQty').isInt({ min: 0 }).withMessage('Min rack qty must be 0 or more'),
  validateWithDetails,
  updateMinRackQty
);

module.exports = router;
