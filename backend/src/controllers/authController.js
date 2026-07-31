const User = require('../models/User');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { generateToken } = require('../utils/generateToken');
const { issueOtp, consumeOtp } = require('../services/otpService');
const { generateCustomerId } = require('../services/customerIdService');
const { uploadKycImage } = require('../services/cloudinaryService');

const notifyAdminsOfRegistration = async (user) => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  if (!admins.length) return;
  await Notification.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      title: 'New registration',
      message: `${user.name} (${user.role}) registered and awaits approval.`,
    }))
  );
};

const firstFile = (files, field) => files?.[field]?.[0] || null;

const buildRegisterPayload = async (body, files = {}) => {
  const {
    name,
    mobile,
    email,
    password,
    role,
    gstNumber,
    panNumber,
    shopName,
    shopAddress,
    shopPhone,
    businessEmail,
    aadhaarNumber,
    drivingLicenseNumber,
  } = body;

  const payload = {
    name,
    mobile,
    email: String(email).trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role,
    gstNumber: gstNumber || '',
    panNumber: panNumber || '',
    shopName: shopName || '',
    shopAddress: shopAddress || '',
    shopPhone: shopPhone || '',
    businessEmail: businessEmail || '',
    aadhaarNumber: '',
    aadhaarFrontUrl: '',
    aadhaarBackUrl: '',
    panFrontUrl: '',
    drivingLicenseNumber: '',
    drivingLicenseFrontUrl: '',
    drivingLicenseBackUrl: '',
  };

  if (role === 'salesman') {
    const [
      aadhaarFrontUrl,
      aadhaarBackUrl,
      panFrontUrl,
      drivingLicenseFrontUrl,
      drivingLicenseBackUrl,
    ] = await Promise.all([
      uploadKycImage(firstFile(files, 'aadhaarFront')),
      uploadKycImage(firstFile(files, 'aadhaarBack')),
      uploadKycImage(firstFile(files, 'panFront')),
      uploadKycImage(firstFile(files, 'drivingLicenseFront')),
      uploadKycImage(firstFile(files, 'drivingLicenseBack')),
    ]);

    if (
      !aadhaarFrontUrl ||
      !aadhaarBackUrl ||
      !panFrontUrl ||
      !drivingLicenseFrontUrl ||
      !drivingLicenseBackUrl
    ) {
      throw new AppError('Failed to upload KYC documents', 500, 'KYC_UPLOAD_FAILED');
    }

    payload.aadhaarNumber = String(aadhaarNumber || '')
      .trim()
      .replace(/\s/g, '');
    payload.aadhaarFrontUrl = aadhaarFrontUrl;
    payload.aadhaarBackUrl = aadhaarBackUrl;
    payload.panNumber = panNumber ? String(panNumber).trim().toUpperCase() : '';
    payload.panFrontUrl = panFrontUrl;
    payload.drivingLicenseNumber = String(drivingLicenseNumber || '').trim().toUpperCase();
    payload.drivingLicenseFrontUrl = drivingLicenseFrontUrl;
    payload.drivingLicenseBackUrl = drivingLicenseBackUrl;
  }

  if (role === 'reseller') {
    const [aadhaarFrontUrl, aadhaarBackUrl, panFrontUrl] = await Promise.all([
      uploadKycImage(firstFile(files, 'aadhaarFront')),
      uploadKycImage(firstFile(files, 'aadhaarBack')),
      uploadKycImage(firstFile(files, 'panFront')),
    ]);

    if (!aadhaarFrontUrl || !aadhaarBackUrl || !panFrontUrl) {
      throw new AppError('Failed to upload KYC documents', 500, 'KYC_UPLOAD_FAILED');
    }

    payload.aadhaarNumber = String(aadhaarNumber || '')
      .trim()
      .replace(/\s/g, '');
    payload.aadhaarFrontUrl = aadhaarFrontUrl;
    payload.aadhaarBackUrl = aadhaarBackUrl;
    payload.panNumber = panNumber ? String(panNumber).trim().toUpperCase() : '';
    payload.panFrontUrl = panFrontUrl;
  }

  return payload;
};

/** Step 1: validate registration, send email OTP (user created after verify). */
const register = asyncHandler(async (req, res) => {
  const payload = await buildRegisterPayload(req.body, req.files);

  const exists = await User.findOne({
    $or: [{ mobile: payload.mobile }, { email: payload.email }],
  });
  if (exists) {
    throw new AppError('Mobile or email already registered', 409, 'DUPLICATE_USER');
  }

  const otpMeta = await issueOtp({
    email: payload.email,
    purpose: 'register',
    payload,
  });

  sendResponse(res, {
    statusCode: 200,
    message: 'OTP sent to your email. Enter it to complete registration.',
    data: {
      requiresOtp: true,
      email: otpMeta.email,
      expiresInMinutes: otpMeta.expiresInMinutes,
    },
  });
});

/** Step 2: verify register OTP and create the user account. */
const verifyRegisterOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const { payload } = await consumeOtp({
    email,
    purpose: 'register',
    otp,
  });

  if (!payload?.email || !payload?.passwordHash || !payload?.mobile) {
    throw new AppError('Registration session expired. Please register again.', 400, 'OTP_PAYLOAD_MISSING');
  }

  const exists = await User.findOne({
    $or: [{ mobile: payload.mobile }, { email: payload.email }],
  });
  if (exists) {
    throw new AppError('Mobile or email already registered', 409, 'DUPLICATE_USER');
  }

  const user = await User.create({
    name: payload.name,
    mobile: payload.mobile,
    email: payload.email,
    password: payload.passwordHash,
    role: payload.role,
    status: 'pending',
    isActive: true,
    emailVerified: true,
    customerId: payload.role === 'customer' ? await generateCustomerId(payload.name) : undefined,
    gstNumber: payload.gstNumber,
    panNumber: payload.panNumber,
    shopName: payload.shopName,
    shopAddress: payload.shopAddress,
    shopPhone: payload.shopPhone,
    businessEmail: payload.businessEmail,
    aadhaarNumber: payload.aadhaarNumber || '',
    aadhaarFrontUrl: payload.aadhaarFrontUrl || '',
    aadhaarBackUrl: payload.aadhaarBackUrl || '',
    panFrontUrl: payload.panFrontUrl || '',
    drivingLicenseNumber: payload.drivingLicenseNumber || '',
    drivingLicenseFrontUrl: payload.drivingLicenseFrontUrl || '',
    drivingLicenseBackUrl: payload.drivingLicenseBackUrl || '',
  });

  await notifyAdminsOfRegistration(user);

  sendResponse(res, {
    statusCode: 201,
    message: 'Email verified. Registration successful. Please wait for admin approval.',
    data: { user: user.toSafeObject() },
  });
});

/** Resend registration OTP using the stored pending payload. */
const resendRegisterOtp = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  const Otp = require('../models/Otp');
  const record = await Otp.findOne({ email, purpose: 'register' });
  if (!record?.payload) {
    throw new AppError('No pending registration found for this email. Please register again.', 400, 'NO_PENDING_REGISTER');
  }

  const otpMeta = await issueOtp({
    email,
    purpose: 'register',
    payload: record.payload,
  });

  sendResponse(res, {
    message: 'OTP resent to your email.',
    data: {
      requiresOtp: true,
      email: otpMeta.email,
      expiresInMinutes: otpMeta.expiresInMinutes,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, mobile, password } = req.body;
  const query = email ? { email: email.toLowerCase() } : { mobile };
  const user = await User.findOne(query).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email/mobile or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Your account has been blocked. Contact admin.', 403, 'ACCOUNT_BLOCKED');
  }

  if (user.emailVerified === false) {
    throw new AppError('Please verify your email with the OTP sent to you.', 403, 'EMAIL_NOT_VERIFIED');
  }

  if (user.role !== 'admin' && user.status === 'pending') {
    throw new AppError('Your account is waiting for admin approval.', 403, 'PENDING_APPROVAL');
  }

  if (user.role !== 'admin' && user.status === 'rejected') {
    throw new AppError('Your registration was rejected by admin.', 403, 'REJECTED');
  }

  const token = generateToken(user._id);
  sendResponse(res, {
    message: 'Login successful',
    data: { token, user: user.toSafeObject() },
  });
});

/** Forgot password step 1: send OTP to registered email. */
const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  const user = await User.findOne({ email });

  // Always return success-shaped response to avoid email enumeration,
  // but only send mail when the account exists.
  if (user) {
    await issueOtp({ email, purpose: 'reset_password', payload: null });
  }

  sendResponse(res, {
    message: 'If an account exists for this email, an OTP has been sent.',
    data: {
      requiresOtp: true,
      email,
      expiresInMinutes: 10,
    },
  });
});

/** Forgot password step 2: verify OTP and set new password. */
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;
  await consumeOtp({
    email,
    purpose: 'reset_password',
    otp,
  });

  const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
  if (!user) {
    throw new AppError('Account not found for this email.', 404, 'USER_NOT_FOUND');
  }

  user.password = password;
  user.emailVerified = true;
  await user.save();

  sendResponse(res, {
    message: 'Password updated successfully. You can sign in now.',
    data: { email: user.email },
  });
});

const getMe = asyncHandler(async (req, res) => {
  sendResponse(res, { data: { user: req.user.toSafeObject() } });
});

module.exports = {
  register,
  verifyRegisterOtp,
  resendRegisterOtp,
  login,
  forgotPassword,
  resetPassword,
  getMe,
};
