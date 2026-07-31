const express = require('express');
const { body, param } = require('express-validator');
const {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require('../controllers/addressController');
const { protect } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

const addressBody = [
  body('label').optional().isIn(['Home', 'Work', 'Other']),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('mobile')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile must be 10 digits'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('pincode')
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('Pincode must be 6 digits'),
  body('isDefault').optional().isBoolean(),
];

router.get('/', listAddresses);
router.post('/', addressBody, validateWithDetails, createAddress);
router.put('/:id', param('id').isMongoId(), addressBody, validateWithDetails, updateAddress);
router.patch('/:id/default', param('id').isMongoId(), validateWithDetails, setDefaultAddress);
router.delete('/:id', param('id').isMongoId(), validateWithDetails, deleteAddress);

module.exports = router;
