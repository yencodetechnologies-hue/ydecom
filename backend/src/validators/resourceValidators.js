const { body, param } = require('express-validator');

const asScalar = (v) => (Array.isArray(v) ? v[0] : v);

const manufacturerValidator = [
  body('name')
    .customSanitizer(asScalar)
    .trim()
    .notEmpty()
    .withMessage('Manufacturer name is required'),
  body('description').optional({ values: 'falsy' }).customSanitizer(asScalar).trim(),
  body('isActive')
    .optional()
    .customSanitizer((v) => {
      if (v === undefined || v === null || v === '') return undefined;
      const value = asScalar(v);
      if (value === true || value === 'true' || value === '1') return true;
      if (value === false || value === 'false' || value === '0') return false;
      return value;
    })
    .custom((v) => v === undefined || typeof v === 'boolean')
    .withMessage('isActive must be true or false'),
  body('clearImage').optional({ values: 'falsy' }),
];

const categoryValidator = [
  body('name')
    .customSanitizer(asScalar)
    .trim()
    .notEmpty()
    .withMessage('Category name is required'),
  body('description').optional({ values: 'falsy' }).customSanitizer(asScalar).trim(),
  // Do NOT use values:'falsy' here — boolean false would be skipped and never applied.
  body('isActive')
    .optional()
    .customSanitizer((v) => {
      if (v === undefined || v === null || v === '') return undefined;
      const value = asScalar(v);
      if (value === true || value === 'true' || value === '1') return true;
      if (value === false || value === 'false' || value === '0') return false;
      return value;
    })
    .custom((v) => v === undefined || typeof v === 'boolean')
    .withMessage('isActive must be true or false'),
  body('clearImage').optional({ values: 'falsy' }),
];

const productValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('brand').optional().trim(),
  body('manufacturer').optional({ values: 'falsy' }).isMongoId(),
  body('category').notEmpty().withMessage('Category is required'),
  body('description').optional().trim(),
  body('purchaseTax').optional().isFloat({ min: 0 }).withMessage('Purchase tax must be >= 0'),
  body('salesTax').optional().isFloat({ min: 0 }).withMessage('Sales tax must be >= 0'),
  body('minQuantity').optional().isInt({ min: 1 }).withMessage('Minimum quantity must be at least 1'),
  body('moq').optional().isInt({ min: 1 }).withMessage('MOQ must be at least 1'),
  body('stockBatches').custom((value) => {
    let batches;
    try {
      batches = JSON.parse(value);
    } catch {
      throw new Error('Stock batches must be valid JSON');
    }
    if (!Array.isArray(batches) || !batches.length) {
      throw new Error('At least one stock row is required');
    }
    const isNonNegNumber = (n) => Number.isFinite(Number(n)) && Number(n) >= 0;
    if (!batches.every((b) => isNonNegNumber(b.cost) && isNonNegNumber(b.mrp) && isNonNegNumber(b.qty))) {
      throw new Error('Each stock row needs a valid Cost, MRP and Quantity (>= 0)');
    }
    return true;
  }),
  body('status').optional().isIn(['active', 'inactive']),
  body('priceVisible')
    .optional()
    .customSanitizer((v) => v === true || v === 'true' || v === '1')
    .custom((v) => typeof v === 'boolean'),
];

const marginValidator = [
  body('margins').isArray({ min: 1 }).withMessage('Margins array is required'),
  body('margins.*.role').isIn(['stockist', 'distributor', 'retailer', 'reseller']),
  body('margins.*.type').isIn(['fixed', 'percentage']),
  body('margins.*.basis').optional().isIn(['cost', 'mrp']),
  body('margins.*.value').isFloat({ min: 0 }),
];

const orderItemsValidator = [
  param('id').notEmpty(),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').notEmpty().withMessage('Product id is required'),
  body('items.*.qty').isInt({ min: 1 }).withMessage('Qty must be at least 1'),
  body('items.*.unitPrice')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('Unit price must be zero or greater'),
];

const orderValidator = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').notEmpty().withMessage('Product id is required'),
  body('items.*.qty').isInt({ min: 1 }).withMessage('Qty must be at least 1'),
  body('shippingAddress').optional().trim(),
];

const orderStatusValidator = [
  param('id').notEmpty(),
  body('status').isIn(['pending', 'ordered', 'order_packed', 'dispatched', 'delivered', 'cancelled']),
  body('note').optional().trim(),
];

const userUpdateValidator = [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('mobile').optional().matches(/^[0-9]{10}$/),
  body('gstNumber').optional().trim(),
  body('panNumber').optional().trim(),
  body('aadhaarNumber').optional().trim(),
  body('shopName').optional().trim(),
  body('shopAddress').optional().trim(),
  body('shopPhone').optional().trim(),
  body('businessEmail').optional().trim(),
  body('marginType').optional().isIn(['fixed', 'percentage']),
  body('marginBasis').optional().isIn(['cost', 'mrp']),
  body('marginValue').optional().isFloat({ min: 0 }),
  body('discountPercent').optional({ values: 'falsy' }).isFloat({ min: 0, max: 100 }),
  body('assignedDistributor').optional({ values: 'falsy' }).isMongoId(),
  body('assignedStockist').optional({ values: 'falsy' }).isMongoId(),
  body('creditLimit').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('stockAllocationPercent').optional({ values: 'falsy' }).isFloat({ min: 0, max: 100 }),
];

const businessRoles = ['retailer', 'reseller', 'distributor', 'stockist'];
const shopBusinessRoles = ['retailer', 'distributor', 'stockist'];
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^[0-9]{12}$/;

const userCreateValidator = [
  body('role')
    .isIn(['customer', 'retailer', 'reseller', 'distributor', 'stockist'])
    .withMessage('Invalid user type'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('mobile')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile must be 10 digits'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Passwords do not match');
    return true;
  }),
  body('gstNumber').custom((value, { req }) => {
    if (shopBusinessRoles.includes(req.body.role) && !value) throw new Error('GST Number is required');
    return true;
  }),
  body('panNumber').custom((value, { req }) => {
    if (shopBusinessRoles.includes(req.body.role) && !value) {
      throw new Error('PAN Number is required');
    }
    if (req.body.role === 'reseller') {
      const pan = String(value || '')
        .trim()
        .toUpperCase();
      if (!PAN_RE.test(pan)) throw new Error('Enter a valid PAN number (e.g. ABCDE1234F)');
    }
    return true;
  }),
  body('aadhaarNumber').custom((value, { req }) => {
    if (req.body.role === 'reseller') {
      const aadhaar = String(value || '')
        .trim()
        .replace(/\s/g, '');
      if (!AADHAAR_RE.test(aadhaar)) throw new Error('Aadhaar number must be 12 digits');
    }
    return true;
  }),
  body().custom((_, { req }) => {
    if (req.body.role !== 'reseller') return true;
    const files = req.files || {};
    const required = [
      ['aadhaarFront', 'Aadhaar front image'],
      ['aadhaarBack', 'Aadhaar back image'],
      ['panFront', 'PAN card image'],
    ];
    for (const [field, label] of required) {
      if (!files[field]?.[0]) throw new Error(`${label} is required`);
    }
    return true;
  }),
  body('shopName').custom((value, { req }) => {
    if (shopBusinessRoles.includes(req.body.role) && !value) throw new Error('Shop Name is required');
    return true;
  }),
  body('shopAddress').custom((value, { req }) => {
    if (shopBusinessRoles.includes(req.body.role) && !value) throw new Error('Shop Address is required');
    return true;
  }),
  body('shopPhone').custom((value, { req }) => {
    if (shopBusinessRoles.includes(req.body.role) && !value) throw new Error('Shop Phone Number is required');
    return true;
  }),
  body('businessEmail').custom((value, { req }) => {
    if (shopBusinessRoles.includes(req.body.role) && !value) throw new Error('Business Email is required');
    return true;
  }),
  body('marginType').custom((value, { req }) => {
    if (businessRoles.includes(req.body.role) && !['fixed', 'percentage'].includes(value)) {
      throw new Error('Margin type (Fixed or Percentage) is required');
    }
    return true;
  }),
  body('marginBasis').custom((value, { req }) => {
    if (businessRoles.includes(req.body.role) && !['cost', 'mrp'].includes(value)) {
      throw new Error('Margin basis (Cost or MRP) is required');
    }
    return true;
  }),
  body('marginValue').custom((value, { req }) => {
    if (businessRoles.includes(req.body.role) && !(Number.isFinite(Number(value)) && Number(value) >= 0)) {
      throw new Error('Margin value is required');
    }
    return true;
  }),
  body('assignedDistributor').custom((value, { req }) => {
    if (['retailer', 'reseller'].includes(req.body.role) && !value) {
      throw new Error('Assigned distributor is required');
    }
    return true;
  }),
  body('assignedStockist').custom((value, { req }) => {
    if (req.body.role === 'distributor' && !value) throw new Error('Assigned stockist is required');
    return true;
  }),
  body('discountPercent').optional({ values: 'falsy' }).isFloat({ min: 0, max: 100 }),
  body('creditLimit').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('status').optional().isIn(['approved', 'pending', 'rejected']),
  body('isActive').optional().isBoolean(),
];

const voucherValidator = [
  body('code').trim().notEmpty().withMessage('Voucher code is required'),
  body('voucherMode').optional().isIn(['manual', 'auto']),
  body('qualifyingPurchaseAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
  body('value').isFloat({ min: 0 }).withMessage('Value must be >= 0'),
  body('maxDiscount').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('minOrderAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('startDate').optional({ values: 'falsy' }).isISO8601(),
  body('endDate').optional({ values: 'falsy' }).isISO8601(),
  body('usageLimit').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('isActive').optional().isBoolean(),
  body('description').optional().trim(),
  body('applicableRoles').optional().isArray(),
  body('applicableRoles.*').optional().isIn(['customer', 'retailer', 'reseller', 'distributor', 'stockist']),
];

const voucherUpdateValidator = [
  body('code').optional().trim().notEmpty(),
  body('voucherMode').optional().isIn(['manual', 'auto']),
  body('qualifyingPurchaseAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('type').optional().isIn(['percentage', 'fixed']),
  body('value').optional().isFloat({ min: 0 }),
  body('maxDiscount').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('minOrderAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('startDate').optional({ values: 'falsy' }).isISO8601(),
  body('endDate').optional({ values: 'falsy' }).isISO8601(),
  body('usageLimit').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('isActive').optional().isBoolean(),
  body('description').optional().trim(),
  body('applicableRoles').optional().isArray(),
  body('applicableRoles.*').optional().isIn(['customer', 'retailer', 'reseller', 'distributor', 'stockist']),
];

const voucherValidateValidator = [
  body('code').trim().notEmpty().withMessage('Voucher code is required'),
  body('subtotal').isFloat({ min: 0 }).withMessage('Valid subtotal is required'),
  body('buyerId').optional({ values: 'falsy' }).isMongoId(),
];

const purchaseOrderItemValidator = [
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.product').isMongoId().withMessage('Valid product id required'),
  body('items.*.qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

const purchaseOrderValidator = [
  ...purchaseOrderItemValidator,
  body('notes').optional().trim(),
];

const purchaseOrderUpdateValidator = [
  body('items').optional().isArray({ min: 1 }),
  body('items.*.product').optional().isMongoId(),
  body('items.*.qty').optional().isInt({ min: 1 }),
  body('notes').optional().trim(),
];

const purchaseOrderActionValidator = [
  body('note').optional().trim(),
  body('adminNotes').optional().trim(),
];

module.exports = {
  manufacturerValidator,
  categoryValidator,
  productValidator,
  marginValidator,
  orderValidator,
  orderStatusValidator,
  orderItemsValidator,
  userUpdateValidator,
  userCreateValidator,
  voucherValidator,
  voucherUpdateValidator,
  voucherValidateValidator,
  purchaseOrderValidator,
  purchaseOrderUpdateValidator,
  purchaseOrderActionValidator,
};
