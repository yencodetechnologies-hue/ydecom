const Voucher = require('../models/Voucher');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

const isWithinDateRange = (voucher, now = new Date()) => {
  if (voucher.startDate && now < new Date(voucher.startDate)) return false;
  if (voucher.endDate && now > new Date(voucher.endDate)) return false;
  return true;
};

const computeDiscountAmount = (voucher, subtotal) => {
  const amount = Number(subtotal) || 0;
  if (amount <= 0) return 0;

  let discount = 0;
  if (voucher.type === 'percentage') {
    discount = amount * (Number(voucher.value) / 100);
    if (voucher.maxDiscount != null && voucher.maxDiscount > 0) {
      discount = Math.min(discount, Number(voucher.maxDiscount));
    }
  } else {
    discount = Number(voucher.value);
  }

  discount = roundMoney(discount);
  return Math.min(discount, amount);
};

/** Sum of subtotal across the buyer's completed (paid, non-cancelled) orders. */
const getCustomerTotalSpend = async (userId) => {
  if (!userId) return 0;
  const [result] = await Order.aggregate([
    { $match: { user: userId, paymentStatus: 'paid', status: { $ne: 'cancelled' } } },
    { $group: { _id: null, total: { $sum: '$subtotal' } } },
  ]);
  return result?.total || 0;
};

const isAutoVoucherAvailable = (voucher, now = new Date()) => {
  if (!voucher?.isActive) return false;
  if (!isWithinDateRange(voucher, now)) return false;
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) return false;
  return true;
};

/** Auto vouchers this buyer currently qualifies for, based on cumulative spend. */
const getEligibleAutoVouchers = async (buyer) => {
  const buyerRole = buyer?.role || 'customer';
  const now = new Date();
  const candidates = await Voucher.find({
    voucherMode: 'auto',
    isActive: true,
    applicableRoles: buyerRole,
  }).sort({ createdAt: -1 });

  const eligible = candidates.filter((voucher) => isAutoVoucherAvailable(voucher, now));
  if (!eligible.length) return [];

  const totalSpend = await getCustomerTotalSpend(buyer._id);
  return eligible.filter(
    (voucher) => totalSpend >= Number(voucher.qualifyingPurchaseAmount || 0)
  );
};

/** Customer wallet: unlocked auto vouchers + locked ones with spend progress. */
const getCustomerVoucherWallet = async (buyer) => {
  const buyerRole = buyer?.role || 'customer';
  const now = new Date();
  const totalSpend = await getCustomerTotalSpend(buyer._id);

  const candidates = await Voucher.find({
    voucherMode: 'auto',
    isActive: true,
    applicableRoles: buyerRole,
  }).sort({ qualifyingPurchaseAmount: 1, createdAt: -1 });

  const vouchers = candidates
    .filter((voucher) => isAutoVoucherAvailable(voucher, now))
    .map((voucher) => {
      const required = Number(voucher.qualifyingPurchaseAmount || 0);
      const unlocked = totalSpend >= required;
      const remaining = Math.max(0, roundMoney(required - totalSpend));
      const progress =
        required > 0 ? Math.min(100, Math.round((totalSpend / required) * 100)) : 100;

      return {
        _id: voucher._id,
        code: voucher.code,
        description: voucher.description,
        type: voucher.type,
        value: voucher.value,
        maxDiscount: voucher.maxDiscount,
        minOrderAmount: voucher.minOrderAmount,
        qualifyingPurchaseAmount: required,
        startDate: voucher.startDate,
        endDate: voucher.endDate,
        unlocked,
        remaining,
        progress,
      };
    });

  return {
    totalSpend: roundMoney(totalSpend),
    unlockedCount: vouchers.filter((v) => v.unlocked).length,
    vouchers,
  };
};

const validateVoucherForCheckout = async ({ code, subtotal, buyer }) => {
  const normalized = normalizeCode(code);
  if (!normalized) throw new AppError('Voucher code is required', 400);

  const voucher = await Voucher.findOne({ code: normalized });
  if (!voucher) throw new AppError('Invalid voucher code', 400);
  if (!voucher.isActive) throw new AppError('This voucher is no longer active', 400);
  if (!isWithinDateRange(voucher)) throw new AppError('This voucher has expired or is not yet valid', 400);
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
    throw new AppError('This voucher has reached its usage limit', 400);
  }

  const buyerRole = buyer?.role || 'customer';
  const roles = voucher.applicableRoles?.length ? voucher.applicableRoles : ['customer'];
  if (!roles.includes(buyerRole)) {
    throw new AppError('This voucher is not valid for your account type', 400);
  }

  if (voucher.voucherMode === 'auto') {
    const totalSpend = await getCustomerTotalSpend(buyer?._id);
    if (totalSpend < Number(voucher.qualifyingPurchaseAmount || 0)) {
      throw new AppError('You have not unlocked this voucher yet', 400);
    }
  }

  const orderAmount = Number(subtotal) || 0;
  if (orderAmount < Number(voucher.minOrderAmount || 0)) {
    throw new AppError(
      `Minimum order amount of ₹${Number(voucher.minOrderAmount).toFixed(2)} required for this voucher`,
      400
    );
  }

  const discount = computeDiscountAmount(voucher, orderAmount);
  if (discount <= 0) {
    throw new AppError('Voucher does not apply to this order', 400);
  }

  const payable = roundMoney(orderAmount - discount);

  return {
    voucher,
    discount,
    payable,
    subtotal: roundMoney(orderAmount),
  };
};

const redeemVoucher = async (voucherId) => {
  if (!voucherId) return;
  await Voucher.findByIdAndUpdate(voucherId, { $inc: { usedCount: 1 } });
};

module.exports = {
  normalizeCode,
  computeDiscountAmount,
  validateVoucherForCheckout,
  redeemVoucher,
  isWithinDateRange,
  getCustomerTotalSpend,
  getEligibleAutoVouchers,
  getCustomerVoucherWallet,
};
