const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { getDisplayPriceForOrder } = require('./productController');
const { resolveBuyer } = require('../services/networkService');
const { buildOrderLineItem } = require('../utils/orderLineItem');
const {
  getKeyId,
  createRazorpayOrder,
  verifyPaymentSignature,
} = require('../services/razorpayService');
const {
  validateVoucherForCheckout,
  redeemVoucher,
} = require('../services/voucherService');
const {
  resolveSupplyContext,
  checkOrderStock,
  depleteOrderStock: depleteInventoryForOrder,
} = require('../services/inventoryService');
const { uploadPaymentProof } = require('../services/cloudinaryService');
const { canViewOrder } = require('./orderController');
const { orderSupplierId, isOrderSupplier } = require('../utils/orderAccess');

const PROOF_OFFLINE_METHODS = ['cheque', 'neft'];
const STOCKIST_PROCUREMENT_METHODS = ['credit', 'cash', ...PROOF_OFFLINE_METHODS];
/** Methods a buyer may submit via payOrder (cash is admin-recorded only). */
const B2B_BUYER_PAY_METHODS = ['credit', ...PROOF_OFFLINE_METHODS, 'razorpay'];
const B2B_PAY_METHODS = ['credit', 'cash', 'card', ...PROOF_OFFLINE_METHODS, 'razorpay'];
const APPROVE_PAYMENT_METHODS = B2B_PAY_METHODS;

const createOrderNumber = () => `YD${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

const parsePaymentBody = (req) => {
  let { items, shippingAddress, buyerId, voucherCode, paymentMethod, paymentReference, paymentNote } =
    req.body;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      throw new AppError('Invalid order items payload', 400);
    }
  }
  return {
    items,
    shippingAddress,
    buyerId,
    voucherCode,
    paymentMethod: paymentMethod || 'razorpay',
    paymentReference: paymentReference || '',
    paymentNote: paymentNote || '',
  };
};

const assertStockistProcurement = (user, buyer, placedBy) => {
  if (user.role !== 'stockist') {
    throw new AppError('Only stockists can use this payment method', 403);
  }
  if (placedBy || String(buyer._id) !== String(user._id)) {
    throw new AppError('Use Razorpay when ordering for a distributor', 400);
  }
};

const notifyAdminsPendingPayment = async (order, stockist, methodLabel) => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  if (!admins.length) return;
  await Notification.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      title: 'Payment proof submitted',
      message: `${stockist.name} placed order ${order.orderNumber} via ${methodLabel}. Review and approve payment.`,
    }))
  );
};

const isStockistOnBehalfOfDistributor = (requester, buyer, placedBy) =>
  Boolean(placedBy) &&
  requester?.role === 'stockist' &&
  buyer?.role === 'distributor';

const buildOrderItems = async (items, buyer, { skipPurchaseGate = false } = {}) => {
  await checkOrderStock(items, buyer);

  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await Product.findById(item.product);
    const qty = Number(item.qty) || 0;
    const unitPrice = await getDisplayPriceForOrder(product, buyer, { skipPurchaseGate });
    orderItems.push(buildOrderLineItem(product, qty, unitPrice));
    subtotal += Math.round(unitPrice * qty * 100) / 100;
  }

  return {
    orderItems,
    subtotal: Math.round(subtotal * 100) / 100,
  };
};

const depleteOrderStock = async (order) => {
  const { supplySource, supplierId } = await depleteInventoryForOrder(order);
  order.supplySource = supplySource;
  order.supplier = supplierId || null;
};

const notifyOrderFulfiller = async (order, placer, buyer) => {
  const onBehalf =
    placer && buyer && String(placer._id) !== String(buyer._id)
      ? ` by ${placer.name} for ${buyer.name}`
      : ` by ${buyer.name}`;
  const message = `Order ${order.orderNumber} paid${onBehalf}`;
  const supplierId = orderSupplierId(order);

  if (order.supplySource === 'stockist' && supplierId) {
    // Stockist handles distributor orders — do not notify admin.
    await Notification.create({
      user: supplierId,
      title: 'New distributor order',
      message,
    });
    return;
  }

  if (order.supplySource === 'distributor' && supplierId) {
    await Notification.create({
      user: supplierId,
      title: 'New retailer order',
      message,
    });
    return;
  }

  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  if (!admins.length) return;
  await Notification.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      title: 'New paid order',
      message,
    }))
  );
};

/** Confirm payment already submitted by the buyer (paymentStatus pending). */
const canApprovePayment = (order, user) => {
  if (order.paymentStatus !== 'pending') return false;
  return isOrderSupplier(order, user);
};

/**
 * Supplier records offline/cash payment on an invoiced unpaid order
 * (buyer need not submit first — covers cash and offline collection).
 */
const canRecordPayment = (order, user) => {
  const open = order.status === 'pending' || order.status === 'ordered';
  if (!open) return false;
  if (!order.invoiceFinalized) return false;
  if (!['unpaid', 'failed'].includes(order.paymentStatus)) return false;
  return isOrderSupplier(order, user);
};

const orderPayable = (order) =>
  Math.max(
    0,
    Math.round(((Number(order.subtotal) || 0) - (Number(order.voucherDiscount) || 0)) * 100) / 100
  );

const notifyPaymentApprover = async (order, buyer, methodLabel) => {
  const supplierId = orderSupplierId(order);
  if (order.supplySource === 'stockist' && supplierId) {
    await Notification.create({
      user: supplierId,
      title: 'Payment submitted',
      message: `${buyer.name} submitted ${methodLabel} payment for order ${order.orderNumber}. Review and confirm.`,
    });
    return;
  }
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  if (!admins.length) return;
  await Notification.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      title: 'Payment submitted',
      message: `${buyer.name} submitted ${methodLabel} payment for order ${order.orderNumber}. Review and confirm.`,
    }))
  );
};

/** Buyer pays an invoiced B2B pending order. */
const payOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  if (!canViewOrder(order, req.user)) throw new AppError('Forbidden', 403);

  const openForPayment = order.status === 'pending' || order.status === 'ordered';
  if (!openForPayment) {
    throw new AppError('Order is not open for payment', 400);
  }
  // B2B review orders stay pending until paid — require invoice first.
  if (order.status === 'pending' && !order.invoiceFinalized) {
    throw new AppError('Invoice not generated yet', 400);
  }

  const retryableStatuses = ['unpaid', 'failed'];
  const abandonedRazorpay =
    order.paymentStatus === 'pending' && order.paymentMethod === 'razorpay';
  if (!retryableStatuses.includes(order.paymentStatus) && !abandonedRazorpay) {
    throw new AppError('Payment already submitted or completed', 400);
  }

  const buyer = await User.findById(order.user);
  if (!buyer) throw new AppError('Buyer not found', 404);
  if (String(buyer._id) !== String(req.user._id)) {
    throw new AppError('Only the buyer can pay for this order', 403);
  }

  const paymentMethod = req.body.paymentMethod || 'razorpay';
  if (paymentMethod === 'cash' || paymentMethod === 'card') {
    throw new AppError('This payment method can only be set by the supplier when confirming payment', 400);
  }
  if (!B2B_BUYER_PAY_METHODS.includes(paymentMethod)) {
    throw new AppError('Invalid payment method', 400);
  }

  const payable = orderPayable(order);
  if (payable <= 0) throw new AppError('Order amount must be greater than zero', 400);

  const methodLabels = {
    cash: 'Cash',
    card: 'Card',
    credit: 'Credit',
    cheque: 'Cheque',
    neft: 'NEFT',
    razorpay: 'Online',
  };

  if (paymentMethod === 'credit') {
    if (!['stockist', 'distributor', 'retailer', 'reseller'].includes(buyer.role)) {
      throw new AppError('Credit payment is only available for B2B buyers', 400);
    }
    const available = Math.max(0, (Number(buyer.creditLimit) || 0) - (Number(buyer.creditUsed) || 0));
    if (available < payable) {
      throw new AppError('Insufficient credit balance', 400);
    }
    order.paymentMethod = 'credit';
    order.paymentStatus = 'pending';
    order.paymentNote = String(req.body.paymentNote || '').trim();
    order.statusHistory.push({
      status: 'pending',
      note: 'Credit payment submitted — awaiting confirmation',
      changedBy: req.user._id,
    });
    await order.save();
    await notifyPaymentApprover(order, buyer, methodLabels.credit);
    sendResponse(res, { message: 'Credit payment submitted for approval', data: order });
    return;
  }

  if (PROOF_OFFLINE_METHODS.includes(paymentMethod)) {
    if (!req.file) throw new AppError('Payment proof image is required', 400);
    const proofUrl = await uploadPaymentProof(req.file);
    if (!proofUrl) throw new AppError('Failed to upload payment proof', 500);
    if (!String(req.body.paymentReference || '').trim()) {
      throw new AppError(
        paymentMethod === 'cheque' ? 'Cheque number is required' : 'UTR / transaction reference is required',
        400
      );
    }
    order.paymentMethod = paymentMethod;
    order.paymentStatus = 'pending';
    order.paymentProofImage = proofUrl;
    order.paymentReference = String(req.body.paymentReference).trim();
    order.paymentNote = String(req.body.paymentNote || '').trim();
    order.statusHistory.push({
      status: 'pending',
      note: `${methodLabels[paymentMethod]} payment submitted — awaiting confirmation`,
      changedBy: req.user._id,
    });
    await order.save();
    await notifyPaymentApprover(order, buyer, methodLabels[paymentMethod]);
    sendResponse(res, { message: 'Payment submitted for approval', data: order });
    return;
  }

  const amountPaise = Math.round(payable * 100);
  order.paymentMethod = 'razorpay';
  order.paymentStatus = 'pending';

  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder({
      amountPaise,
      receipt: order.orderNumber.slice(0, 40),
      notes: {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        userId: String(buyer._id),
      },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(err?.error?.description || err.message || 'Payment init failed', 502);
  }

  order.razorpayOrderId = razorpayOrder.id;
  order.statusHistory.push({
    status: 'pending',
    note: 'Online payment initiated',
    changedBy: req.user._id,
  });
  await order.save();

  sendResponse(res, {
    message: 'Payment initiated',
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount: amountPaise,
      amountDisplay: payable,
      currency: 'INR',
      key: getKeyId(),
      razorpayOrderId: razorpayOrder.id,
      prefill: {
        name: req.user.name || '',
        email: req.user.email || '',
        contact: req.user.mobile || '',
      },
    },
  });
});

const canAccessOrderPayment = (order, user) => canViewOrder(order, user);

/** Create pending order + Razorpay order; stock NOT depleted until verify. Credit/offline stockist paths handled separately. */
const createPayment = asyncHandler(async (req, res) => {
  const {
    items,
    shippingAddress,
    buyerId,
    voucherCode,
    paymentMethod,
    paymentReference,
    paymentNote,
  } = parsePaymentBody(req);
  if (!items?.length) throw new AppError('Order items required', 400);
  if (!String(shippingAddress || '').trim()) {
    throw new AppError('Delivery address is required', 400);
  }

  const { buyer, placedBy } = await resolveBuyer(req.user, buyerId);
  const supplyContext = await resolveSupplyContext(buyer);
  const { orderItems, subtotal } = await buildOrderItems(items, buyer, {
    skipPurchaseGate: isStockistOnBehalfOfDistributor(req.user, buyer, placedBy),
  });
  if (subtotal <= 0) throw new AppError('Order amount must be greater than zero', 400);

  let voucher = null;
  let voucherDiscount = 0;
  if (voucherCode) {
    const voucherResult = await validateVoucherForCheckout({
      code: voucherCode,
      subtotal,
      buyer,
    });
    voucher = voucherResult.voucher;
    voucherDiscount = voucherResult.discount;
  }

  const payable = Math.round((subtotal - voucherDiscount) * 100) / 100;
  if (payable <= 0) throw new AppError('Order amount must be greater than zero', 400);

  if (paymentMethod === 'cash') {
    assertStockistProcurement(req.user, buyer, placedBy);

    const orderNumber = createOrderNumber();
    const order = await Order.create({
      orderNumber,
      user: buyer._id,
      placedBy: null,
      supplySource: supplyContext.supplySource,
      supplier: supplyContext.supplierId || null,
      items: orderItems,
      subtotal,
      voucher: voucher?._id || null,
      voucherCode: voucher?.code || '',
      voucherDiscount,
      shippingAddress: String(shippingAddress).trim(),
      invoiceNumber: `INV-${Date.now()}`,
      status: 'ordered',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      paymentNote: String(paymentNote).trim(),
      statusHistory: [
        {
          status: 'ordered',
          note: 'Paid in cash — stock procured from admin warehouse',
          changedBy: req.user._id,
        },
      ],
    });

    await depleteOrderStock(order);

    if (order.voucher) {
      await redeemVoucher(order.voucher);
    }

    await notifyOrderFulfiller(order, req.user, buyer);

    sendResponse(res, {
      statusCode: 201,
      message: 'Order placed — paid in cash',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amountDisplay: payable,
        subtotal,
        voucherDiscount,
        voucherCode: voucher?.code || '',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        order,
      },
    });
    return;
  }

  if (PROOF_OFFLINE_METHODS.includes(paymentMethod)) {
    assertStockistProcurement(req.user, buyer, placedBy);
    if (!req.file) {
      throw new AppError('Payment proof image is required', 400);
    }
    const proofUrl = await uploadPaymentProof(req.file);
    if (!proofUrl) throw new AppError('Failed to upload payment proof', 500);

    const methodLabels = { cheque: 'Cheque', neft: 'NEFT' };
    const orderNumber = createOrderNumber();
    const order = await Order.create({
      orderNumber,
      user: buyer._id,
      placedBy: null,
      supplySource: supplyContext.supplySource,
      supplier: supplyContext.supplierId || null,
      items: orderItems,
      subtotal,
      voucher: voucher?._id || null,
      voucherCode: voucher?.code || '',
      voucherDiscount,
      shippingAddress: String(shippingAddress).trim(),
      invoiceNumber: `INV-${Date.now()}`,
      status: 'ordered',
      paymentStatus: 'pending',
      paymentMethod,
      paymentProofImage: proofUrl,
      paymentReference: String(paymentReference).trim(),
      paymentNote: String(paymentNote).trim(),
      statusHistory: [
        {
          status: 'ordered',
          note: `${methodLabels[paymentMethod]} payment submitted — awaiting admin approval`,
          changedBy: req.user._id,
        },
      ],
    });

    await notifyAdminsPendingPayment(order, req.user, methodLabels[paymentMethod]);

    sendResponse(res, {
      statusCode: 201,
      message: 'Order placed — payment pending admin approval',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amountDisplay: payable,
        paymentMethod,
        paymentStatus: 'pending',
        order,
      },
    });
    return;
  }

  if (paymentMethod === 'credit') {
    assertStockistProcurement(req.user, buyer, placedBy);

    const stockist = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        role: 'stockist',
        $expr: { $lte: [{ $add: ['$creditUsed', payable] }, '$creditLimit'] },
      },
      { $inc: { creditUsed: payable } },
      { new: true }
    );
    if (!stockist) {
      throw new AppError('Insufficient credit balance', 400);
    }

    const orderNumber = createOrderNumber();
    let order;
    try {
      order = await Order.create({
        orderNumber,
        user: buyer._id,
        placedBy: null,
        supplySource: supplyContext.supplySource,
        supplier: supplyContext.supplierId || null,
        items: orderItems,
        subtotal,
        voucher: voucher?._id || null,
        voucherCode: voucher?.code || '',
        voucherDiscount,
        shippingAddress: String(shippingAddress).trim(),
        invoiceNumber: `INV-${Date.now()}`,
        status: 'ordered',
        paymentStatus: 'paid',
        paymentMethod: 'credit',
        statusHistory: [
          {
            status: 'ordered',
            note: 'Paid on credit — stock procured from admin warehouse',
            changedBy: req.user._id,
          },
        ],
      });

      await depleteOrderStock(order);

      if (order.voucher) {
        await redeemVoucher(order.voucher);
      }
    } catch (err) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { creditUsed: -payable } });
      throw err;
    }

    await notifyOrderFulfiller(order, req.user, buyer);

    sendResponse(res, {
      statusCode: 201,
      message: 'Order placed on credit',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amountDisplay: payable,
        subtotal,
        voucherDiscount,
        voucherCode: voucher?.code || '',
        paymentMethod: 'credit',
        order,
        creditLimit: stockist.creditLimit,
        creditUsed: stockist.creditUsed,
        creditAvailable: Math.max(0, stockist.creditLimit - stockist.creditUsed),
      },
    });
    return;
  }

  if (!['razorpay'].includes(paymentMethod)) {
    throw new AppError('Invalid payment method', 400);
  }

  const amountPaise = Math.round(payable * 100);
  const orderNumber = createOrderNumber();

  const order = await Order.create({
    orderNumber,
    user: buyer._id,
    placedBy: placedBy || null,
    supplySource: supplyContext.supplySource,
    supplier: supplyContext.supplierId || null,
    items: orderItems,
    subtotal,
    voucher: voucher?._id || null,
    voucherCode: voucher?.code || '',
    voucherDiscount,
    shippingAddress: String(shippingAddress).trim(),
    invoiceNumber: `INV-${Date.now()}`,
    status: 'ordered',
    paymentStatus: 'pending',
    paymentMethod: 'razorpay',
    statusHistory: [
      {
        status: 'ordered',
        note: placedBy
          ? `Awaiting payment (placed by ${req.user.name} for ${buyer.name})`
          : 'Awaiting payment',
        changedBy: req.user._id,
      },
    ],
  });

  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder({
      amountPaise,
      receipt: orderNumber.slice(0, 40),
      notes: {
        orderId: String(order._id),
        orderNumber,
        userId: String(buyer._id),
        placedBy: placedBy ? String(placedBy) : '',
      },
    });
  } catch (err) {
    order.paymentStatus = 'failed';
    order.statusHistory.push({
      status: 'ordered',
      note: 'Razorpay order creation failed',
      changedBy: req.user._id,
    });
    await order.save();
    if (err instanceof AppError) throw err;
    throw new AppError(err?.error?.description || err.message || 'Payment init failed', 502);
  }

  order.razorpayOrderId = razorpayOrder.id;
  await order.save();

  sendResponse(res, {
    statusCode: 201,
    message: 'Payment initiated',
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount: amountPaise,
      amountDisplay: payable,
      subtotal,
      voucherDiscount,
      voucherCode: voucher?.code || '',
      currency: 'INR',
      key: getKeyId(),
      razorpayOrderId: razorpayOrder.id,
      buyerId: buyer._id,
      prefill: {
        name: req.user.name || '',
        email: req.user.email || '',
        contact: req.user.mobile || '',
      },
    },
  });
});

/** Verify Razorpay signature, mark paid, deplete stock. */
const verifyPayment = asyncHandler(async (req, res) => {
  const {
    orderId,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  } = req.body;

  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError('Payment verification payload incomplete', 400);
  }

  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (!canAccessOrderPayment(order, req.user)) {
    throw new AppError('Forbidden', 403);
  }
  if (order.paymentStatus === 'paid') {
    sendResponse(res, { message: 'Already paid', data: order });
    return;
  }
  if (order.razorpayOrderId && order.razorpayOrderId !== razorpayOrderId) {
    throw new AppError('Razorpay order mismatch', 400);
  }

  const valid = verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (!valid) {
    order.paymentStatus = 'failed';
    order.statusHistory.push({
      status: order.status,
      note: 'Payment verification failed',
      changedBy: req.user._id,
    });
    await order.save();
    throw new AppError('Payment verification failed', 400, 'PAYMENT_INVALID');
  }

  await checkOrderStock(
    order.items.map((i) => ({ product: i.product, qty: i.qty })),
    await User.findById(order.user)
  );

  await depleteOrderStock(order);

  if (order.voucher) {
    await redeemVoucher(order.voucher);
  }

  order.paymentStatus = 'paid';
  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  order.razorpayOrderId = razorpayOrderId;
  if (order.status === 'pending') {
    order.status = 'ordered';
  }
  order.statusHistory.push({
    status: order.status,
    note: 'Payment received',
    changedBy: req.user._id,
  });
  await order.save();

  const buyer = await User.findById(order.user);
  await notifyOrderFulfiller(order, req.user, buyer || req.user);

  sendResponse(res, { message: 'Payment successful', data: order });
});

/** Mark payment failed when user dismisses checkout. */
const failPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw new AppError('Order id required', 400);
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (!canAccessOrderPayment(order, req.user)) {
    throw new AppError('Forbidden', 403);
  }
  if (order.paymentStatus === 'paid') {
    throw new AppError('Order already paid', 400);
  }
  order.paymentStatus = 'failed';
  order.statusHistory.push({
    status: order.status,
    note: 'Payment cancelled',
    changedBy: req.user._id,
  });
  await order.save();
  sendResponse(res, { message: 'Payment marked failed', data: order });
});

/** Admin or supplier confirms submitted payment OR records offline payment on invoiced unpaid orders. */
const approvePayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new AppError('Order not found', 404);

  const isConfirm = canApprovePayment(order, req.user);
  const isRecord = canRecordPayment(order, req.user);
  if (!isConfirm && !isRecord) {
    throw new AppError('Forbidden', 403);
  }

  const overrideMethod = req.body.paymentMethod ? String(req.body.paymentMethod).trim() : '';
  if (isRecord && !overrideMethod) {
    throw new AppError('Payment method is required when recording payment', 400);
  }
  if (overrideMethod) {
    if (!APPROVE_PAYMENT_METHODS.includes(overrideMethod)) {
      throw new AppError('Invalid payment method', 400);
    }
    if (overrideMethod === 'razorpay') {
      throw new AppError('Online payments must be completed by the buyer', 400);
    }
    order.paymentMethod = overrideMethod;
  }

  if (!APPROVE_PAYMENT_METHODS.includes(order.paymentMethod)) {
    throw new AppError('This order payment cannot be approved via this action', 400);
  }

  const buyer = await User.findById(order.user);
  if (!buyer) throw new AppError('Buyer not found', 404);

  const payable = orderPayable(order);

  if (order.paymentMethod === 'credit') {
    if (!['stockist', 'distributor', 'retailer', 'reseller'].includes(buyer.role)) {
      throw new AppError('Credit approval only applies to B2B buyers', 400);
    }
    const credited = await User.findOneAndUpdate(
      {
        _id: buyer._id,
        role: buyer.role,
        $expr: { $lte: [{ $add: ['$creditUsed', payable] }, '$creditLimit'] },
      },
      { $inc: { creditUsed: payable } },
      { new: true }
    );
    if (!credited) {
      throw new AppError('Insufficient credit balance', 400);
    }
  }

  try {
    await checkOrderStock(
      order.items.map((i) => ({ product: i.product, qty: i.qty })),
      buyer
    );
    await depleteOrderStock(order);

    if (order.voucher) {
      await redeemVoucher(order.voucher);
    }
  } catch (err) {
    if (order.paymentMethod === 'credit') {
      await User.findByIdAndUpdate(buyer._id, { $inc: { creditUsed: -payable } });
    }
    throw err;
  }

  if (req.body.paymentReference) {
    order.paymentReference = String(req.body.paymentReference).trim();
  }

  order.paymentStatus = 'paid';
  if (order.status === 'pending') {
    order.status = 'ordered';
  }
  const actionNote = isRecord ? 'Payment recorded by supplier' : 'Payment confirmed';
  order.statusHistory.push({
    status: order.status,
    note: req.body.note || `${actionNote} (${order.paymentMethod})`,
    changedBy: req.user._id,
  });
  await order.save();

  await notifyOrderFulfiller(order, req.user, buyer);

  await Notification.create({
    user: buyer._id,
    title: 'Payment confirmed',
    message: `Your order ${order.orderNumber} payment has been confirmed (${order.paymentMethod}).`,
  });

  sendResponse(res, {
    message: isRecord ? 'Payment recorded' : 'Payment confirmed',
    data: order,
  });
});

module.exports = {
  createPayment,
  verifyPayment,
  failPayment,
  approvePayment,
  payOrder,
  STOCKIST_PROCUREMENT_METHODS,
};
