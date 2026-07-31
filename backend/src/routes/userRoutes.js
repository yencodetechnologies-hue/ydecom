const express = require('express');
const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  setStatus,
  setActive,
  setPriceVisible,
  setAssignment,
  getMyNetwork,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const { kycUploadFields } = require('../middleware/upload');
const { userUpdateValidator, userCreateValidator } = require('../validators/resourceValidators');
const { body } = require('express-validator');

const router = express.Router();

router.use(protect);

// Any authenticated role can list assigned children / salesman partners for order-as
router.get('/network', getMyNetwork);

// Stockists/distributors update credit on children; admin manages users.
router.use(authorize('admin', 'stockist', 'distributor'));

router.get('/', authorize('admin'), listUsers);
router.post(
  '/',
  authorize('admin'),
  kycUploadFields,
  userCreateValidator,
  validateWithDetails,
  createUser
);
router.get('/:id', authorize('admin', 'stockist', 'distributor'), getUser);
router.put('/:id', userUpdateValidator, validateWithDetails, updateUser);
router.delete('/:id', authorize('admin'), deleteUser);
router.patch(
  '/:id/status',
  authorize('admin'),
  body('status').isIn(['approved', 'rejected', 'pending']),
  validateWithDetails,
  setStatus
);
router.patch(
  '/:id/active',
  authorize('admin', 'stockist', 'distributor'),
  body('isActive').isBoolean(),
  validateWithDetails,
  setActive
);
router.patch(
  '/:id/price-visible',
  authorize('admin'),
  body('priceVisible').isBoolean(),
  validateWithDetails,
  setPriceVisible
);
router.patch(
  '/:id/assignment',
  authorize('admin'),
  body('assignmentPartnerType').isIn(['stockist', 'distributor', 'retailer']),
  body('assignedPartnerIds').isArray().withMessage('assignedPartnerIds must be an array'),
  validateWithDetails,
  setAssignment
);

module.exports = router;
