const Order = require('../models/Order');
const OrderReturn = require('../models/OrderReturn');
const { ISSUE_TYPES } = require('../models/OrderReturn');
const User = require('../models/User');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { getPagination } = require('../utils/pagination');
const { orderSupplierId, isOrderSupplier } = require('../utils/orderAccess');
const { applyReturnInventory } = require('../services/inventoryService');
const { uploadReturnImage } = require('../services/cloudinaryService');

const B2B_BUYER_ROLES = ['stockist', 'distributor', 'retailer', 'reseller'];
const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_RETURN_STATUSES = ['requested', 'approved', 'pickup_done'];

const createReturnNumber = () => `RT${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

const resolveDeliveredAt = (order) => {
  if (order.deliveredAt) return new Date(order.deliveredAt);
  const deliveredEntry = [...(order.statusHistory || [])]
    .reverse()
    .find((h) => h.status === 'delivered');
  return deliveredEntry?.changedAt ? new Date(deliveredEntry.changedAt) : null;
};

const assertReturnWindowOpen = (order) => {
  if (order.status !== 'delivered') {
    throw new AppError('Returns are only allowed after delivery', 400);
  }
  if (order.paymentStatus !== 'paid') {
    throw new AppError('Order must be paid to request a return', 400);
  }
  const deliveredAt = resolveDeliveredAt(order);
  if (!deliveredAt) {
    throw new AppError('Delivery date is missing for this order', 400);
  }
  if (Date.now() - deliveredAt.getTime() > RETURN_WINDOW_MS) {
    throw new AppError('Return window of 7 days after delivery has expired', 400);
  }
  return deliveredAt;
};

const canManageReturnAsSupplier = (ret, user) => {
  if (!user) return false;
  const supplySource = ret.supplySource || 'admin';
  if (user.role === 'admin' && supplySource === 'admin') return true;
  const supplierId = ret.supplier?._id || ret.supplier;
  if (
    ['stockist', 'distributor'].includes(user.role) &&
    supplierId &&
    String(supplierId) === String(user._id)
  ) {
    return true;
  }
  return false;
};

const canViewReturn = (ret, user) => {
  if (!user) return false;
  if (canManageReturnAsSupplier(ret, user)) return true;
  const buyerId = ret.buyer?._id || ret.buyer;
  return buyerId && String(buyerId) === String(user._id);
};

const parseReturnItems = (raw) => {
  let items = raw;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      throw new AppError('Invalid return items payload', 400);
    }
  }
  if (!Array.isArray(items) || !items.length) {
    throw new AppError('Select at least one product to return', 400);
  }
  return items;
};

const buildReturnItemsFromOrder = (order, requestedItems) => {
  const orderLines = order.items || [];
  const built = [];
  let creditAmount = 0;

  for (const reqItem of requestedItems) {
    const productId = String(reqItem.product);
    const qty = Number(reqItem.qty) || 0;
    if (qty < 1) throw new AppError('Invalid return quantity', 400);

    const issueType = reqItem.issueType;
    if (!ISSUE_TYPES.includes(issueType)) {
      throw new AppError('Invalid issue type', 400);
    }
    const issueNote = String(reqItem.issueNote || '').trim();
    if (issueType === 'other' && !issueNote) {
      throw new AppError('Please describe the issue for "Other"', 400);
    }

    const line = orderLines.find((l) => String(l.product?._id || l.product) === productId);
    if (!line) throw new AppError('Product is not on this order', 400);

    const unitPrice = Number(line.unitPrice) || 0;
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    creditAmount += lineTotal;

    built.push({
      product: line.product?._id || line.product,
      name: line.name,
      qty,
      unitPrice,
      lineTotal,
      issueType,
      issueNote,
    });
  }

  return {
    items: built,
    creditAmount: Math.round(creditAmount * 100) / 100,
  };
};

const assertReturnQtyCap = async (orderId, newItems) => {
  const existing = await OrderReturn.find({
    order: orderId,
    status: { $in: ACTIVE_RETURN_STATUSES },
  }).select('items');

  const returnedByProduct = {};
  for (const ret of existing) {
    for (const item of ret.items || []) {
      const pid = String(item.product);
      returnedByProduct[pid] = (returnedByProduct[pid] || 0) + Number(item.qty);
    }
  }

  const order = await Order.findById(orderId).select('items');
  if (!order) throw new AppError('Order not found', 404);

  for (const item of newItems) {
    const pid = String(item.product);
    const ordered = order.items.find((l) => String(l.product) === pid);
    const orderedQty = ordered ? Number(ordered.qty) : 0;
    const already = returnedByProduct[pid] || 0;
    if (already + Number(item.qty) > orderedQty) {
      throw new AppError(
        `Cannot return more than ordered for ${item.name} (ordered ${orderedQty}, already returning ${already})`,
        400
      );
    }
  }
};

const createReturn = asyncHandler(async (req, res) => {
  if (!B2B_BUYER_ROLES.includes(req.user.role)) {
    throw new AppError('Only B2B buyers can request returns', 403);
  }

  const { orderId } = req.body;
  if (!orderId) throw new AppError('Order id is required', 400);

  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  const buyerId = order.user?._id || order.user;
  if (String(buyerId) !== String(req.user._id)) {
    throw new AppError('Only the order buyer can request a return', 403);
  }

  assertReturnWindowOpen(order);

  const requestedItems = parseReturnItems(req.body.items);
  const { items, creditAmount } = buildReturnItemsFromOrder(order, requestedItems);
  await assertReturnQtyCap(order._id, items);

  if (!req.file) throw new AppError('Please upload an image of the product issue', 400);
  const image = await uploadReturnImage(req.file);
  if (!image) throw new AppError('Failed to upload image', 500);

  const supplySource = order.supplySource || 'admin';
  const supplierId = orderSupplierId(order);

  const ret = await OrderReturn.create({
    returnNumber: createReturnNumber(),
    order: order._id,
    buyer: req.user._id,
    supplier: supplierId,
    supplySource,
    items,
    image,
    creditAmount,
    status: 'requested',
    requestedAt: new Date(),
    statusHistory: [
      {
        status: 'requested',
        note: 'Return requested by buyer',
        changedBy: req.user._id,
      },
    ],
  });

  if (supplySource === 'admin') {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    if (admins.length) {
      await Notification.insertMany(
        admins.map((admin) => ({
          user: admin._id,
          title: 'New return request',
          message: `${req.user.name} requested return ${ret.returnNumber} for order ${order.orderNumber}`,
        }))
      );
    }
  } else if (supplierId) {
    await Notification.create({
      user: supplierId,
      title: 'New return request',
      message: `${req.user.name} requested return ${ret.returnNumber} for order ${order.orderNumber}`,
    });
  }

  sendResponse(res, { statusCode: 201, message: 'Return requested', data: ret });
});

const listReturns = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.query.orderId) {
    const order = await Order.findById(req.query.orderId);
    if (!order) throw new AppError('Order not found', 404);
    const buyerId = order.user?._id || order.user;
    const isBuyer = String(buyerId) === String(req.user._id);
    const isSupplier = isOrderSupplier(order, req.user);
    if (!isBuyer && !isSupplier) throw new AppError('Forbidden', 403);
    filter.order = order._id;
  } else if (req.query.asSupplier === 'true') {
    if (req.user.role === 'admin') {
      filter.supplySource = 'admin';
    } else if (['stockist', 'distributor'].includes(req.user.role)) {
      filter.supplier = req.user._id;
    } else {
      throw new AppError('Forbidden', 403);
    }
  } else {
    filter.buyer = req.user._id;
  }

  if (req.query.status) filter.status = req.query.status;

  const [rows, total] = await Promise.all([
    OrderReturn.find(filter)
      .populate('order', 'orderNumber status deliveredAt')
      .populate('buyer', 'name mobile email role shopName')
      .populate('supplier', 'name mobile email role shopName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    OrderReturn.countDocuments(filter),
  ]);

  sendResponse(res, {
    data: rows,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const getReturn = asyncHandler(async (req, res) => {
  const ret = await OrderReturn.findById(req.params.id)
    .populate('order', 'orderNumber status deliveredAt items paymentStatus')
    .populate('buyer', 'name mobile email role shopName creditLimit creditUsed')
    .populate('supplier', 'name mobile email role shopName');
  if (!ret) throw new AppError('Return not found', 404);
  if (!canViewReturn(ret, req.user)) throw new AppError('Forbidden', 403);
  sendResponse(res, { data: ret });
});

const approveReturn = asyncHandler(async (req, res) => {
  const ret = await OrderReturn.findById(req.params.id);
  if (!ret) throw new AppError('Return not found', 404);
  if (!canManageReturnAsSupplier(ret, req.user)) throw new AppError('Forbidden', 403);
  if (ret.status !== 'requested') {
    throw new AppError('Only requested returns can be approved', 400);
  }

  ret.status = 'approved';
  ret.approvedAt = new Date();
  ret.note = req.body.note ? String(req.body.note).trim() : ret.note;
  ret.statusHistory.push({
    status: 'approved',
    note: req.body.note || 'Return approved — pickup scheduled',
    changedBy: req.user._id,
  });
  await ret.save();

  await Notification.create({
    user: ret.buyer,
    title: 'Return approved',
    message: `Return ${ret.returnNumber} approved. Pickup will be arranged.`,
  });

  sendResponse(res, { message: 'Return approved', data: ret });
});

const rejectReturn = asyncHandler(async (req, res) => {
  const ret = await OrderReturn.findById(req.params.id);
  if (!ret) throw new AppError('Return not found', 404);
  if (!canManageReturnAsSupplier(ret, req.user)) throw new AppError('Forbidden', 403);
  if (!['requested', 'approved'].includes(ret.status)) {
    throw new AppError('This return cannot be rejected', 400);
  }

  const note = req.body.note ? String(req.body.note).trim() : '';
  if (!note) throw new AppError('Rejection note is required', 400);

  ret.status = 'rejected';
  ret.rejectedAt = new Date();
  ret.note = note;
  ret.statusHistory.push({
    status: 'rejected',
    note,
    changedBy: req.user._id,
  });
  await ret.save();

  await Notification.create({
    user: ret.buyer,
    title: 'Return rejected',
    message: `Return ${ret.returnNumber} was rejected: ${note}`,
  });

  sendResponse(res, { message: 'Return rejected', data: ret });
});

const markPickupDone = asyncHandler(async (req, res) => {
  const ret = await OrderReturn.findById(req.params.id);
  if (!ret) throw new AppError('Return not found', 404);
  if (!canManageReturnAsSupplier(ret, req.user)) throw new AppError('Forbidden', 403);
  if (ret.status !== 'approved') {
    throw new AppError('Approve the return before marking pickup done', 400);
  }
  if (ret.creditApplied) {
    throw new AppError('Credit already applied for this return', 400);
  }

  const buyer = await User.findById(ret.buyer);
  if (!buyer) throw new AppError('Buyer not found', 404);

  await applyReturnInventory({
    items: ret.items,
    buyer,
    supplySource: ret.supplySource,
    supplierId: ret.supplier,
  });

  const creditAmount = Number(ret.creditAmount) || 0;
  if (creditAmount > 0 && B2B_BUYER_ROLES.includes(buyer.role)) {
    await User.findByIdAndUpdate(buyer._id, { $inc: { creditUsed: -creditAmount } });
  }

  ret.status = 'pickup_done';
  ret.pickupDoneAt = new Date();
  ret.creditApplied = true;
  ret.note = req.body.note ? String(req.body.note).trim() : ret.note;
  ret.statusHistory.push({
    status: 'pickup_done',
    note: req.body.note || `Pickup done — ₹${creditAmount} credited to buyer wallet`,
    changedBy: req.user._id,
  });
  await ret.save();

  await Notification.create({
    user: buyer._id,
    title: 'Return completed',
    message: `Return ${ret.returnNumber} pickup done. ${creditAmount} credited to your account.`,
  });

  sendResponse(res, { message: 'Pickup done — credit applied', data: ret });
});

/** Helper for frontends / order detail eligibility. */
const getOrderReturnEligibility = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new AppError('Order not found', 404);

  const buyerId = order.user?._id || order.user;
  const isBuyer = String(buyerId) === String(req.user._id);
  const isSupplier = isOrderSupplier(order, req.user);

  if (!isBuyer && !isSupplier) throw new AppError('Forbidden', 403);

  let eligible = false;
  let reason = '';
  let deliveredAt = null;
  let expiresAt = null;

  try {
    if (!B2B_BUYER_ROLES.includes(req.user.role) && isBuyer) {
      reason = 'Only B2B buyers can return';
    } else if (isBuyer) {
      deliveredAt = assertReturnWindowOpen(order);
      expiresAt = new Date(deliveredAt.getTime() + RETURN_WINDOW_MS);
      eligible = true;
    } else {
      deliveredAt = resolveDeliveredAt(order);
      reason = 'Supplier views only';
    }
  } catch (err) {
    reason = err.message || 'Not eligible';
  }

  const returns = await OrderReturn.find({ order: order._id }).sort({ createdAt: -1 });

  sendResponse(res, {
    data: {
      eligible: isBuyer && eligible,
      reason,
      deliveredAt,
      expiresAt,
      returns,
    },
  });
});

module.exports = {
  createReturn,
  listReturns,
  getReturn,
  approveReturn,
  rejectReturn,
  markPickupDone,
  getOrderReturnEligibility,
  resolveDeliveredAt,
  B2B_BUYER_ROLES,
  RETURN_WINDOW_MS,
};
