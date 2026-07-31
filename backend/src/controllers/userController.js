const User = require('../models/User');
const { ASSIGNMENT_PARTNER_TYPES } = require('../models/User');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { getPagination, buildSearchFilter } = require('../utils/pagination');
const { listNetworkChildren } = require('../services/networkService');
const { generateCustomerId } = require('../services/customerIdService');
const { uploadKycImage } = require('../services/cloudinaryService');

const CREDIT_ROLES = ['stockist', 'distributor', 'retailer', 'reseller'];

const firstFile = (files, field) => files?.[field]?.[0] || null;

const getMyNetwork = asyncHandler(async (req, res) => {
  const children = await listNetworkChildren(req.user);
  sendResponse(res, {
    data: children.map((u) => u.toSafeObject()),
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  // Stockist / distributor no longer manage salesmen; child lists use /users/network.
  // They still update credit via PUT on specific ids.
  if (req.user.role === 'stockist' || req.user.role === 'distributor') {
    throw new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN');
  }

  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.status) filter.status = req.query.status;

  Object.assign(
    filter,
    buildSearchFilter(req.query.search, [
      'name',
      'mobile',
      'email',
      'shopName',
      'gstNumber',
      'panNumber',
      'aadhaarNumber',
      'customerId',
    ])
  );

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate('assignedPartners', 'name mobile shopName role email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  sendResponse(res, {
    data: users.map((u) => u.toSafeObject()),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const assertOwnsSalesman = (req, target) => {
  if (req.user.role === 'admin') return;
  // Stockist/distributor may not manage salesmen anymore
  if (req.user.role === 'stockist' || req.user.role === 'distributor') {
    if (target.role === 'salesman') {
      throw new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN');
    }
  }
};

const assertStockistOwnsDistributor = (req, target) => {
  if (
    target.role !== 'distributor' ||
    String(target.assignedStockist) !== String(req.user._id)
  ) {
    throw new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN');
  }
};

const assertDistributorOwnsRetailer = (req, target) => {
  if (
    !['retailer', 'reseller'].includes(target.role) ||
    String(target.assignedDistributor) !== String(req.user._id)
  ) {
    throw new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN');
  }
};

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate(
    'assignedPartners',
    'name mobile shopName role email'
  );
  if (!user) throw new AppError('User not found', 404);
  assertOwnsSalesman(req, user);
  sendResponse(res, { data: user.toSafeObject() });
});

const createUser = asyncHandler(async (req, res) => {
  const {
    name,
    mobile,
    email,
    password,
    gstNumber,
    panNumber,
    aadhaarNumber,
    shopName,
    shopAddress,
    shopPhone,
    businessEmail,
    status,
    isActive,
    marginType,
    marginBasis,
    marginValue,
    discountPercent,
    assignedDistributor,
    assignedStockist,
    creditLimit,
    stockAllocationPercent,
  } = req.body;

  if (req.user.role === 'stockist' || req.user.role === 'distributor') {
    throw new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN');
  }

  const role = req.body.role;

  // Salesmen self-register with KYC; admin creates other roles only.
  if (!['customer', 'retailer', 'reseller', 'distributor', 'stockist'].includes(role)) {
    throw new AppError('Invalid user type', 400);
  }

  const exists = await User.findOne({ $or: [{ mobile }, { email: email.toLowerCase() }] });
  if (exists) {
    throw new AppError('Mobile or email already registered', 409, 'DUPLICATE_USER');
  }

  let aadhaarFrontUrl = '';
  let aadhaarBackUrl = '';
  let panFrontUrl = '';

  if (role === 'reseller') {
    const [front, back, pan] = await Promise.all([
      uploadKycImage(firstFile(req.files, 'aadhaarFront')),
      uploadKycImage(firstFile(req.files, 'aadhaarBack')),
      uploadKycImage(firstFile(req.files, 'panFront')),
    ]);
    if (!front || !back || !pan) {
      throw new AppError('PAN and Aadhaar (front & back) images are required', 400, 'KYC_REQUIRED');
    }
    aadhaarFrontUrl = front;
    aadhaarBackUrl = back;
    panFrontUrl = pan;
  }

  const user = await User.create({
    name,
    mobile,
    email,
    password,
    role,
    status: status || 'approved',
    isActive: isActive === undefined ? true : Boolean(isActive),
    customerId: role === 'customer' ? await generateCustomerId(name) : undefined,
    gstNumber: gstNumber || '',
    panNumber: panNumber ? String(panNumber).trim().toUpperCase() : '',
    aadhaarNumber: aadhaarNumber ? String(aadhaarNumber).trim().replace(/\s/g, '') : '',
    aadhaarFrontUrl,
    aadhaarBackUrl,
    panFrontUrl,
    shopName: shopName || '',
    shopAddress: shopAddress || '',
    shopPhone: shopPhone || '',
    businessEmail: businessEmail || '',
    marginType: marginType || undefined,
    marginBasis: marginBasis || undefined,
    marginValue: marginValue === undefined || marginValue === '' ? undefined : Number(marginValue),
    discountPercent:
      role === 'customer' && discountPercent !== undefined && discountPercent !== ''
        ? Math.max(0, Math.min(100, Number(discountPercent) || 0))
        : 0,
    assignedDistributor: assignedDistributor || undefined,
    assignedStockist: assignedStockist || undefined,
    creditLimit:
      CREDIT_ROLES.includes(role) && creditLimit !== undefined && creditLimit !== ''
        ? Math.max(0, Number(creditLimit) || 0)
        : 0,
    stockAllocationPercent:
      role === 'stockist' && stockAllocationPercent !== undefined && stockAllocationPercent !== ''
        ? Math.max(0, Math.min(100, Number(stockAllocationPercent) || 100))
        : 100,
    creditUsed: 0,
  });

  sendResponse(res, {
    statusCode: 201,
    message: 'User created',
    data: user.toSafeObject(),
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const allowed = [
    'name',
    'email',
    'mobile',
    'gstNumber',
    'panNumber',
    'aadhaarNumber',
    'shopName',
    'shopAddress',
    'shopPhone',
    'businessEmail',
    'marginType',
    'marginBasis',
    'marginValue',
    'discountPercent',
    'assignedDistributor',
    'assignedStockist',
    'creditLimit',
    'stockAllocationPercent',
  ];
  const updates = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  if (updates.discountPercent !== undefined) {
    updates.discountPercent = Math.max(0, Math.min(100, Number(updates.discountPercent) || 0));
  }

  if (updates.creditLimit !== undefined) {
    updates.creditLimit = Math.max(0, Number(updates.creditLimit) || 0);
  }

  if (updates.stockAllocationPercent !== undefined) {
    updates.stockAllocationPercent = Math.max(
      0,
      Math.min(100, Number(updates.stockAllocationPercent) || 0)
    );
  }

  const existing = await User.findById(req.params.id);
  if (!existing) throw new AppError('User not found', 404);

  // Stockist may set credit limit on their assigned distributors.
  if (req.user.role === 'stockist' && existing.role === 'distributor') {
    assertStockistOwnsDistributor(req, existing);
    if (updates.creditLimit === undefined) {
      throw new AppError('Only credit limit can be updated for distributors', 400);
    }
    if (updates.creditLimit < (existing.creditUsed || 0)) {
      throw new AppError('Credit limit cannot be less than credit already used', 400);
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { creditLimit: updates.creditLimit },
      { new: true, runValidators: true }
    );
    sendResponse(res, { message: 'Distributor credit updated', data: user.toSafeObject() });
    return;
  }

  // Distributor may set credit limit on assigned retailers / resellers.
  if (req.user.role === 'distributor' && ['retailer', 'reseller'].includes(existing.role)) {
    assertDistributorOwnsRetailer(req, existing);
    if (updates.creditLimit === undefined) {
      throw new AppError('Only credit limit can be updated for retailers', 400);
    }
    if (updates.creditLimit < (existing.creditUsed || 0)) {
      throw new AppError('Credit limit cannot be less than credit already used', 400);
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { creditLimit: updates.creditLimit },
      { new: true, runValidators: true }
    );
    sendResponse(res, { message: 'Retailer credit updated', data: user.toSafeObject() });
    return;
  }

  if (req.user.role !== 'admin') {
    throw new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN');
  }

  assertOwnsSalesman(req, existing);

  if (CREDIT_ROLES.includes(existing.role) && updates.creditLimit !== undefined) {
    if (updates.creditLimit < (existing.creditUsed || 0)) {
      throw new AppError('Credit limit cannot be less than credit already used', 400);
    }
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new AppError('User not found', 404);

  if (user.role !== 'customer' && updates.discountPercent !== undefined) {
    user.discountPercent = 0;
    await user.save();
  }

  if (!CREDIT_ROLES.includes(user.role) && (user.creditLimit || user.creditUsed)) {
    user.creditLimit = 0;
    user.creditUsed = 0;
    await user.save();
  }

  sendResponse(res, { message: 'User updated', data: user.toSafeObject() });
});

const deleteUser = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Cannot delete admin', 400);
  await user.deleteOne();
  sendResponse(res, { message: 'User deleted' });
});

const setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Cannot change admin status', 400);

  user.status = status;
  await user.save();

  await Notification.create({
    user: user._id,
    title: status === 'approved' ? 'Account approved' : 'Account update',
    message:
      status === 'approved'
        ? 'Your account has been approved. You can now log in.'
        : `Your account status is now: ${status}.`,
  });

  sendResponse(res, { message: `User ${status}`, data: user.toSafeObject() });
});

const setActive = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new AppError('Forbidden: insufficient permissions', 403, 'FORBIDDEN');
  }
  const { isActive } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Cannot block admin', 400);
  user.isActive = Boolean(isActive);
  await user.save();
  sendResponse(res, {
    message: user.isActive ? 'User activated' : 'User deactivated',
    data: user.toSafeObject(),
  });
});

const setPriceVisible = asyncHandler(async (req, res) => {
  const { priceVisible } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Cannot change admin price visibility', 400);
  user.priceVisible = Boolean(priceVisible);
  await user.save();
  sendResponse(res, {
    message: `Price visibility ${user.priceVisible ? 'ON' : 'OFF'}`,
    data: user.toSafeObject(),
  });
});

/** Admin: assign salesman to multiple partners of one type. */
const setAssignment = asyncHandler(async (req, res) => {
  const { assignmentPartnerType, assignedPartnerIds } = req.body;

  if (!ASSIGNMENT_PARTNER_TYPES.includes(assignmentPartnerType)) {
    throw new AppError('Invalid partner type. Use stockist, distributor, or retailer.', 400);
  }

  const ids = Array.isArray(assignedPartnerIds)
    ? assignedPartnerIds.map((id) => String(id)).filter(Boolean)
    : [];

  const salesman = await User.findById(req.params.id);
  if (!salesman) throw new AppError('User not found', 404);
  if (salesman.role !== 'salesman') {
    throw new AppError('Assignment is only for salesman accounts', 400);
  }

  if (ids.length) {
    const partners = await User.find({
      _id: { $in: ids },
      role: assignmentPartnerType,
      status: 'approved',
      isActive: true,
    }).select('_id');

    if (partners.length !== ids.length) {
      throw new AppError(
        'One or more partners are invalid, inactive, or not the selected type',
        400,
        'INVALID_PARTNERS'
      );
    }
  }

  salesman.assignmentPartnerType = assignmentPartnerType;
  salesman.assignedPartners = ids;
  await salesman.save();

  await salesman.populate('assignedPartners', 'name mobile shopName role email');

  sendResponse(res, {
    message: 'Salesman assignment updated',
    data: salesman.toSafeObject(),
  });
});

module.exports = {
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
};
