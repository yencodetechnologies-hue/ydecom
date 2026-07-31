const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    throw new AppError('Not authorized, token missing', 401, 'NO_TOKEN');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Not authorized, token invalid', 401, 'INVALID_TOKEN');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }
  if (!user.isActive) {
    throw new AppError('Account is blocked', 403, 'ACCOUNT_BLOCKED');
  }
  if (user.role !== 'admin' && user.status !== 'approved') {
    throw new AppError('Your account is waiting for admin approval.', 403, 'PENDING_APPROVAL');
  }

  req.user = user;
  next();
});

/** Attach req.user when a valid Bearer token is present; otherwise continue as guest. */
const optionalProtect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive && (user.role === 'admin' || user.status === 'approved')) {
      req.user = user;
    } else {
      req.user = undefined;
    }
  } catch {
    req.user = undefined;
  }
  next();
});

const authorize = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN');
    }
    next();
  });

module.exports = { protect, optionalProtect, authorize };
