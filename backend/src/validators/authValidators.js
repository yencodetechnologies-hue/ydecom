const { body } = require('express-validator');

const shopBusinessRoles = ['retailer', 'distributor', 'stockist'];
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^[0-9]{12}$/;

const registerValidator = [
  body('role')
    .isIn(['customer', 'retailer', 'reseller', 'distributor', 'stockist', 'salesman'])
    .withMessage('Invalid register type'),
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
    if (req.body.role === 'salesman' && !value) throw new Error('PAN Number is required');
    if (req.body.role === 'reseller') {
      const pan = String(value || '')
        .trim()
        .toUpperCase();
      if (!PAN_RE.test(pan)) throw new Error('Enter a valid PAN number (e.g. ABCDE1234F)');
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
  body('aadhaarNumber').custom((value, { req }) => {
    if (req.body.role === 'salesman' || req.body.role === 'reseller') {
      const aadhaar = String(value || '')
        .trim()
        .replace(/\s/g, '');
      if (!AADHAAR_RE.test(aadhaar)) throw new Error('Aadhaar must be 12 digits');
    }
    return true;
  }),
  body('drivingLicenseNumber').custom((value, { req }) => {
    if (req.body.role === 'salesman' && !String(value || '').trim()) {
      throw new Error('Driving license number is required');
    }
    return true;
  }),
  body().custom((_, { req }) => {
    const role = req.body.role;
    const files = req.files || {};
    if (role === 'salesman') {
      const required = [
        ['aadhaarFront', 'Aadhaar front image'],
        ['aadhaarBack', 'Aadhaar back image'],
        ['panFront', 'PAN card front image'],
        ['drivingLicenseFront', 'Driving license front image'],
        ['drivingLicenseBack', 'Driving license back image'],
      ];
      for (const [field, label] of required) {
        if (!files[field]?.[0]) throw new Error(`${label} is required`);
      }
    }
    if (role === 'reseller') {
      const required = [
        ['aadhaarFront', 'Aadhaar front image'],
        ['aadhaarBack', 'Aadhaar back image'],
        ['panFront', 'PAN card image'],
      ];
      for (const [field, label] of required) {
        if (!files[field]?.[0]) throw new Error(`${label} is required`);
      }
    }
    return true;
  }),
];

const loginValidator = [
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .bail()
    .customSanitizer((value) => value.toLowerCase()),
  body('mobile')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile must be 10 digits'),
  body('password').notEmpty().withMessage('Password is required'),
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.mobile) {
      throw new Error('Email or mobile is required');
    }
    return true;
  }),
];

const emailOtpValidator = [
  body('email').isEmail().withMessage('Valid email is required').bail().customSanitizer((v) => String(v).toLowerCase()),
  body('otp')
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('OTP must be a 6-digit code'),
];

const resendOtpValidator = [
  body('email').isEmail().withMessage('Valid email is required').bail().customSanitizer((v) => String(v).toLowerCase()),
];

const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').bail().customSanitizer((v) => String(v).toLowerCase()),
];

const resetPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').bail().customSanitizer((v) => String(v).toLowerCase()),
  body('otp')
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('OTP must be a 6-digit code'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Passwords do not match');
    return true;
  }),
];

module.exports = {
  registerValidator,
  loginValidator,
  emailOtpValidator,
  resendOtpValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
};
