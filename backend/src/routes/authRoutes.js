const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  register,
  verifyRegisterOtp,
  resendRegisterOtp,
  login,
  forgotPassword,
  resetPassword,
  getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateWithDetails } = require('../middleware/validate');
const { kycUploadFields } = require('../middleware/upload');
const {
  registerValidator,
  loginValidator,
  emailOtpValidator,
  resendOtpValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require('../validators/authValidators');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again later' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP attempts, try again later' },
});

router.post(
  '/register',
  authLimiter,
  kycUploadFields,
  registerValidator,
  validateWithDetails,
  register
);
router.post('/verify-register-otp', otpLimiter, emailOtpValidator, validateWithDetails, verifyRegisterOtp);
router.post('/resend-register-otp', otpLimiter, resendOtpValidator, validateWithDetails, resendRegisterOtp);
router.post('/login', authLimiter, loginValidator, validateWithDetails, login);
router.post('/forgot-password', otpLimiter, forgotPasswordValidator, validateWithDetails, forgotPassword);
router.post('/reset-password', otpLimiter, resetPasswordValidator, validateWithDetails, resetPassword);
router.get('/me', protect, getMe);

module.exports = router;
