const Voucher = require('../models/Voucher');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { resolveBuyer } = require('../services/networkService');
const {
  normalizeCode,
  validateVoucherForCheckout,
  getEligibleAutoVouchers,
  getCustomerVoucherWallet,
} = require('../services/voucherService');

const listVouchers = asyncHandler(async (req, res) => {
  const vouchers = await Voucher.find().sort({ createdAt: -1 });
  sendResponse(res, { data: vouchers });
});

const getVoucher = asyncHandler(async (req, res) => {
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) throw new AppError('Voucher not found', 404);
  sendResponse(res, { data: voucher });
});

/** Orders that redeemed this voucher — customer, products, amounts, dates. */
const listVoucherUsage = asyncHandler(async (req, res) => {
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) throw new AppError('Voucher not found', 404);

  const orders = await Order.find({
    $or: [{ voucher: voucher._id }, { voucherCode: voucher.code }],
  })
    .populate('user', 'name mobile email role shopName')
    .populate('placedBy', 'name mobile email role shopName')
    .sort({ createdAt: -1 });

  sendResponse(res, {
    data: {
      voucher: {
        _id: voucher._id,
        code: voucher.code,
        description: voucher.description,
        type: voucher.type,
        value: voucher.value,
        usedCount: voucher.usedCount,
        usageLimit: voucher.usageLimit,
      },
      orders,
      totalUses: orders.length,
      totalDiscount: orders.reduce((sum, o) => sum + (Number(o.voucherDiscount) || 0), 0),
    },
  });
});

const createVoucher = asyncHandler(async (req, res) => {
  const code = normalizeCode(req.body.code);
  const existing = await Voucher.findOne({ code });
  if (existing) throw new AppError('Voucher code already exists', 400);

  const voucherMode = req.body.voucherMode === 'auto' ? 'auto' : 'manual';
  if (voucherMode === 'auto' && !(Number(req.body.qualifyingPurchaseAmount) > 0)) {
    throw new AppError('Qualifying purchase amount is required for auto vouchers', 400);
  }

  const voucher = await Voucher.create({
    code,
    description: req.body.description || '',
    voucherMode,
    qualifyingPurchaseAmount:
      voucherMode === 'auto' ? Number(req.body.qualifyingPurchaseAmount) : null,
    type: req.body.type,
    value: Number(req.body.value),
    maxDiscount: req.body.maxDiscount != null && req.body.maxDiscount !== ''
      ? Number(req.body.maxDiscount)
      : null,
    minOrderAmount: Number(req.body.minOrderAmount) || 0,
    startDate: req.body.startDate || null,
    endDate: req.body.endDate || null,
    usageLimit: req.body.usageLimit != null && req.body.usageLimit !== ''
      ? Number(req.body.usageLimit)
      : null,
    isActive: req.body.isActive !== false && req.body.isActive !== 'false',
    applicableRoles: Array.isArray(req.body.applicableRoles) && req.body.applicableRoles.length
      ? req.body.applicableRoles
      : ['customer'],
    createdBy: req.user._id,
  });

  sendResponse(res, { statusCode: 201, message: 'Voucher created', data: voucher });
});

const updateVoucher = asyncHandler(async (req, res) => {
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) throw new AppError('Voucher not found', 404);

  if (req.body.code !== undefined) {
    const code = normalizeCode(req.body.code);
    const existing = await Voucher.findOne({ code, _id: { $ne: voucher._id } });
    if (existing) throw new AppError('Voucher code already exists', 400);
    voucher.code = code;
  }
  if (req.body.description !== undefined) voucher.description = req.body.description;
  if (req.body.voucherMode !== undefined) {
    voucher.voucherMode = req.body.voucherMode === 'auto' ? 'auto' : 'manual';
  }
  if (req.body.qualifyingPurchaseAmount !== undefined) {
    voucher.qualifyingPurchaseAmount =
      req.body.qualifyingPurchaseAmount != null && req.body.qualifyingPurchaseAmount !== ''
        ? Number(req.body.qualifyingPurchaseAmount)
        : null;
  }
  if (voucher.voucherMode === 'auto' && !(Number(voucher.qualifyingPurchaseAmount) > 0)) {
    throw new AppError('Qualifying purchase amount is required for auto vouchers', 400);
  }
  if (req.body.type !== undefined) voucher.type = req.body.type;
  if (req.body.value !== undefined) voucher.value = Number(req.body.value);
  if (req.body.maxDiscount !== undefined) {
    voucher.maxDiscount =
      req.body.maxDiscount != null && req.body.maxDiscount !== ''
        ? Number(req.body.maxDiscount)
        : null;
  }
  if (req.body.minOrderAmount !== undefined) {
    voucher.minOrderAmount = Number(req.body.minOrderAmount) || 0;
  }
  if (req.body.startDate !== undefined) voucher.startDate = req.body.startDate || null;
  if (req.body.endDate !== undefined) voucher.endDate = req.body.endDate || null;
  if (req.body.usageLimit !== undefined) {
    voucher.usageLimit =
      req.body.usageLimit != null && req.body.usageLimit !== ''
        ? Number(req.body.usageLimit)
        : null;
  }
  if (req.body.isActive !== undefined) {
    voucher.isActive = req.body.isActive === true || req.body.isActive === 'true';
  }
  if (req.body.applicableRoles !== undefined) {
    voucher.applicableRoles = Array.isArray(req.body.applicableRoles) && req.body.applicableRoles.length
      ? req.body.applicableRoles
      : ['customer'];
  }

  await voucher.save();
  sendResponse(res, { message: 'Voucher updated', data: voucher });
});

const deleteVoucher = asyncHandler(async (req, res) => {
  const voucher = await Voucher.findByIdAndDelete(req.params.id);
  if (!voucher) throw new AppError('Voucher not found', 404);
  sendResponse(res, { message: 'Voucher deleted' });
});

const toggleVoucherActive = asyncHandler(async (req, res) => {
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) throw new AppError('Voucher not found', 404);
  voucher.isActive = !voucher.isActive;
  await voucher.save();
  sendResponse(res, {
    message: voucher.isActive ? 'Voucher activated' : 'Voucher deactivated',
    data: voucher,
  });
});

/** Auto vouchers the current buyer has unlocked via cumulative spend. */
const listEligibleVouchers = asyncHandler(async (req, res) => {
  const { buyer } = await resolveBuyer(req.user, req.query.buyerId);
  const vouchers = await getEligibleAutoVouchers(buyer);
  sendResponse(res, { data: vouchers });
});

/** Customer "My Vouchers" wallet: unlocked + locked auto vouchers with progress. */
const listMyVouchers = asyncHandler(async (req, res) => {
  const { buyer } = await resolveBuyer(req.user, req.query.buyerId);
  const wallet = await getCustomerVoucherWallet(buyer);
  sendResponse(res, { data: wallet });
});

/** Validate voucher against cart subtotal for the checkout buyer. */
const validateVoucher = asyncHandler(async (req, res) => {
  const { code, subtotal, buyerId } = req.body;
  const { buyer } = await resolveBuyer(req.user, buyerId);
  const result = await validateVoucherForCheckout({ code, subtotal, buyer });

  sendResponse(res, {
    message: 'Voucher applied',
    data: {
      code: result.voucher.code,
      description: result.voucher.description,
      type: result.voucher.type,
      value: result.voucher.value,
      discount: result.discount,
      subtotal: result.subtotal,
      payable: result.payable,
    },
  });
});

module.exports = {
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
};
