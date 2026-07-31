const express = require('express');
const {
  listVouchers,
  getVoucher,
  listVoucherUsage,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  toggleVoucherActive,
  validateVoucher,
  listEligibleVouchers,
  listMyVouchers,
} = require('../controllers/voucherController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const {
  voucherValidator,
  voucherUpdateValidator,
  voucherValidateValidator,
} = require('../validators/resourceValidators');

const router = express.Router();

router.use(protect);

router.post('/validate', voucherValidateValidator, validateWithDetails, validateVoucher);
router.get('/eligible', listEligibleVouchers);
router.get('/mine', listMyVouchers);

router.use(authorize('admin'));
router.get('/', listVouchers);
router.get('/:id/usage', listVoucherUsage);
router.get('/:id', getVoucher);
router.post('/', voucherValidator, validateWithDetails, createVoucher);
router.put('/:id', voucherUpdateValidator, validateWithDetails, updateVoucher);
router.delete('/:id', deleteVoucher);
router.post('/:id/toggle-active', toggleVoucherActive);
router.patch('/:id/toggle-active', toggleVoucherActive);

module.exports = router;
