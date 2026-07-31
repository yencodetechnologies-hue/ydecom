const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { getPagination, buildSearchFilter } = require('../utils/pagination');
const { getDisplayPriceForOrder } = require('./productController');
const { generateInvoiceHtml } = require('../services/invoiceService');
const { resolveBuyer } = require('../services/networkService');
const { buildOrderLineItem } = require('../utils/orderLineItem');
const {
  resolveSupplyContext,
  checkOrderStock,
  creditOrderInventory,
} = require('../services/inventoryService');
const { orderSupplierId, isOrderSupplier } = require('../utils/orderAccess');

const createOrderNumber = () => `YD${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

const isB2BSelfProcurement = (buyer, placedBy) =>
  !placedBy && (buyer.role === 'stockist' || buyer.role === 'distributor');

/** Stockist→distributor (and self B2B) go through review/invoice before payment. */
const isB2BReviewOrder = (buyer, placedBy, requester) => {
  if (isB2BSelfProcurement(buyer, placedBy)) return true;
  if (
    placedBy &&
    requester?.role === 'stockist' &&
    buyer.role === 'distributor'
  ) {
    return true;
  }
  // Salesman placing for assigned stockist/distributor (review channel).
  if (
    placedBy &&
    requester?.role === 'salesman' &&
    ['stockist', 'distributor'].includes(buyer.role)
  ) {
    return true;
  }
  return false;
};

const canViewOrder = (order, user) => {
  const supplySource = order.supplySource || 'admin';
  // Admin only sees admin-fulfilled orders; stockist→distributor stays with stockist.
  if (user.role === 'admin') return supplySource === 'admin';
  const ownerId = order.user?._id || order.user;
  const placerId = order.placedBy?._id || order.placedBy;
  const supplierId = orderSupplierId(order);
  if (String(ownerId) === String(user._id)) return true;
  if (placerId && String(placerId) === String(user._id)) return true;
  if (supplierId && String(supplierId) === String(user._id)) return true;
  return false;
};

/** B2B orders the supplier can still edit (before payment is submitted or completed). */
const canSupplierEditOrder = (order) =>
  ['unpaid', 'failed'].includes(order.paymentStatus) &&
  (order.status === 'pending' || order.status === 'ordered');

const canManagePendingOrder = (order, user) => {
  if (!canSupplierEditOrder(order)) return false;
  return isOrderSupplier(order, user);
};

const isStockistOnBehalfOfDistributor = (requester, buyer, placedBy) =>
  Boolean(placedBy) &&
  buyer?.role === 'distributor' &&
  (requester?.role === 'stockist' || requester?.role === 'salesman');

const buildOrderItemsFromPayload = async (
  items,
  buyer,
  { allowPriceOverride = false, skipPurchaseGate = false } = {}
) => {
  await checkOrderStock(items, buyer);

  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) throw new AppError('Product not found', 404);
    const qty = Number(item.qty) || 0;
    if (qty < 1) throw new AppError('Invalid quantity', 400);

    let unitPrice;
    if (allowPriceOverride && item.unitPrice != null && item.unitPrice !== '') {
      unitPrice = Math.round(Number(item.unitPrice) * 100) / 100;
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new AppError('Invalid unit price', 400);
      }
    } else {
      unitPrice = await getDisplayPriceForOrder(product, buyer, { skipPurchaseGate });
    }

    orderItems.push(buildOrderLineItem(product, qty, unitPrice));
    subtotal += Math.round(unitPrice * qty * 100) / 100;
  }

  return {
    orderItems,
    subtotal: Math.round(subtotal * 100) / 100,
  };
};

const notifyOrderPlaced = async (order, placer, buyer, supplySource, supplierId) => {
  const onBehalfMsg = placer
    ? `Order ${order.orderNumber} placed by ${placer.name} for ${buyer.name}`
    : `Order ${order.orderNumber} placed by ${buyer.name}`;

  if (supplySource === 'stockist' && supplierId) {
    // Avoid noisy self-notify when stockist places on behalf of distributor.
    if (!placer || String(placer._id) !== String(supplierId)) {
      await Notification.create({
        user: supplierId,
        title: 'New distributor order',
        message: `${onBehalfMsg} — awaiting review`,
      });
    }
    if (placer && String(placer._id) === String(supplierId) && String(buyer._id) !== String(supplierId)) {
      await Notification.create({
        user: buyer._id,
        title: 'Order placed for you',
        message: `${placer.name} placed order ${order.orderNumber} for your account — awaiting invoice.`,
      });
    }
    return;
  }

  if (supplySource === 'distributor' && supplierId) {
    await Notification.create({
      user: supplierId,
      title: 'New retailer order',
      message: onBehalfMsg,
    });
    return;
  }

  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  if (!admins.length) return;
  await Notification.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      title: 'New pending order',
      message: `${onBehalfMsg} — review and generate invoice`,
    }))
  );
};

const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, buyerId } = req.body;
  if (!items?.length) throw new AppError('Order items required', 400);

  const { buyer, placedBy } = await resolveBuyer(req.user, buyerId);
  const supplyContext = await resolveSupplyContext(buyer);

  if (!isB2BReviewOrder(buyer, placedBy, req.user)) {
    throw new AppError('Use payment checkout for this order type', 400);
  }

  const { orderItems, subtotal } = await buildOrderItemsFromPayload(items, buyer, {
    skipPurchaseGate: isStockistOnBehalfOfDistributor(req.user, buyer, placedBy),
  });

  const placedNote = placedBy
    ? `Order placed by ${req.user.name} for ${buyer.name} — awaiting supplier review`
    : 'Order placed — awaiting supplier review';

  const order = await Order.create({
    orderNumber: createOrderNumber(),
    user: buyer._id,
    placedBy: placedBy || null,
    supplySource: supplyContext.supplySource,
    supplier: supplyContext.supplierId || null,
    items: orderItems,
    subtotal,
    shippingAddress: shippingAddress || buyer.shopAddress || '',
    status: 'pending',
    paymentStatus: 'unpaid',
    statusHistory: [
      {
        status: 'pending',
        note: placedNote,
        changedBy: req.user._id,
      },
    ],
  });

  await notifyOrderPlaced(
    order,
    placedBy || req.user,
    buyer,
    supplyContext.supplySource,
    supplyContext.supplierId
  );

  sendResponse(res, { statusCode: 201, message: 'Order placed — pending review', data: order });
});

const updateOrderItems = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  if (!canManagePendingOrder(order, req.user)) {
    throw new AppError('Cannot edit this order', 403);
  }

  const { items } = req.body;
  if (!items?.length) throw new AppError('At least one item is required', 400);

  const buyer = await User.findById(order.user);
  if (!buyer) throw new AppError('Buyer not found', 404);

  const { orderItems, subtotal } = await buildOrderItemsFromPayload(items, buyer, {
    allowPriceOverride: true,
    // Supplier/admin may price first-time distributor SKUs when editing pending orders.
    skipPurchaseGate:
      buyer.role === 'distributor' &&
      (req.user.role === 'stockist' || req.user.role === 'admin'),
  });

  order.items = orderItems;
  order.subtotal = subtotal;
  order.invoiceFinalized = false;
  order.invoiceNumber = '';
  order.invoiceGeneratedAt = null;
  order.statusHistory.push({
    status: 'pending',
    note: 'Order items updated by supplier',
    changedBy: req.user._id,
  });
  await order.save();

  sendResponse(res, { message: 'Order items updated', data: order });
});

const generateInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  if (!canManagePendingOrder(order, req.user)) {
    throw new AppError('Cannot generate invoice for this order', 403);
  }
  if (!order.items?.length) throw new AppError('Order has no items', 400);

  order.invoiceNumber = `INV-${Date.now()}`;
  order.invoiceFinalized = true;
  order.invoiceGeneratedAt = new Date();
  order.statusHistory.push({
    status: 'pending',
    note: 'Invoice generated — awaiting payment',
    changedBy: req.user._id,
  });
  await order.save();

  await Notification.create({
    user: order.user,
    title: 'Invoice ready',
    message: `Invoice for order ${order.orderNumber} is ready. Please complete payment.`,
  });

  sendResponse(res, { message: 'Invoice generated', data: order });
});

const listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.user.role === 'stockist' && req.query.distributorOrders === 'true') {
    filter.supplier = req.user._id;
    filter.supplySource = 'stockist';
  } else if (req.user.role === 'distributor' && req.query.retailerOrders === 'true') {
    filter.supplier = req.user._id;
    filter.supplySource = 'distributor';
  } else if (req.user.role !== 'admin') {
    filter.$or = [
      { user: req.user._id },
      { placedBy: req.user._id },
      { supplier: req.user._id },
    ];
    if (req.user.role === 'customer') {
      filter.paymentStatus = 'paid';
    }
  } else if (req.query.stockistId) {
    // Stockist self-procurement only — not orders they place for distributors.
    filter.$or = [{ user: req.query.stockistId }, { placedBy: req.query.stockistId }];
    filter.supplySource = 'admin';
  } else if (req.query.stockistOrders === 'true') {
    const stockistIds = await User.find({ role: 'stockist' }).distinct('_id');
    filter.user = { $in: stockistIds };
    filter.supplySource = 'admin';
  } else if (req.query.customerOrders === 'true') {
    const customerIds = await User.find({ role: 'customer' }).distinct('_id');
    filter.user = { $in: customerIds };
    filter.supplySource = 'admin';
  } else if (req.query.userId) {
    filter.user = req.query.userId;
    filter.supplySource = 'admin';
  } else {
    // Admin default / "All orders": only admin-fulfilled channel.
    filter.supplySource = 'admin';
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentStatus === 'unpaid') {
    filter.paymentStatus = { $in: ['unpaid', 'pending', 'failed'] };
  } else if (req.query.paymentStatus) {
    filter.paymentStatus = req.query.paymentStatus;
  }
  if (req.query.search) {
    Object.assign(filter, buildSearchFilter(req.query.search, ['orderNumber', 'invoiceNumber']));
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name mobile email role shopName')
      .populate('placedBy', 'name mobile email role shopName')
      .populate('supplier', 'name mobile email role shopName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  sendResponse(res, {
    data: orders,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name mobile email role shopName shopAddress creditLimit creditUsed')
    .populate('placedBy', 'name mobile email role shopName')
    .populate('supplier', 'name mobile email role shopName');
  if (!order) throw new AppError('Order not found', 404);
  if (!canViewOrder(order, req.user)) {
    throw new AppError('Forbidden', 403);
  }
  sendResponse(res, { data: order });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  if (order.paymentStatus !== 'paid') {
    throw new AppError('Cannot update status until payment is completed', 400);
  }
  if (!isOrderSupplier(order, req.user)) {
    throw new AppError('Forbidden', 403);
  }

  const nextStatus = req.body.status;
  order.status = nextStatus;
  order.statusHistory.push({
    status: nextStatus,
    note: req.body.note || '',
    changedBy: req.user._id,
  });

  if (nextStatus === 'delivered') {
    if (!order.deliveredAt) {
      order.deliveredAt = new Date();
    }
    if (!order.inventoryCredited) {
      const { credited, buyer } = await creditOrderInventory(order);
      order.inventoryCredited = true;
      if (credited) {
        order.statusHistory.push({
          status: 'delivered',
          note: 'Products added to buyer inventory',
          changedBy: req.user._id,
        });
        await Notification.create({
          user: buyer._id,
          title: 'Stock received',
          message: `Order ${order.orderNumber} delivered — products added to your inventory.`,
        });
      }
    }
  }

  await order.save();

  await Notification.create({
    user: order.user,
    title: 'Order status updated',
    message: `Order ${order.orderNumber} is now ${order.status}.`,
  });

  sendResponse(res, { message: 'Order status updated', data: order });
});

const getInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name mobile email role shopName shopAddress')
    .populate('placedBy', 'name mobile email role')
    .populate('items.product', 'itemCode images mrp cost tax netCost salesTax name');
  if (!order) throw new AppError('Order not found', 404);
  if (!canViewOrder(order, req.user)) {
    throw new AppError('Forbidden', 403);
  }
  const supplierId = orderSupplierId(order);
  const canViewInvoice =
    order.paymentStatus === 'paid' ||
    order.invoiceFinalized ||
    req.user.role === 'admin' ||
    (supplierId && String(supplierId) === String(req.user._id));
  if (!canViewInvoice) {
    throw new AppError('Invoice not available yet', 400);
  }
  const html = await generateInvoiceHtml(order, order.user);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

const getOrderPrint = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name mobile email role shopName shopAddress')
    .populate('placedBy', 'name mobile email role')
    .populate('items.product', 'itemCode images mrp cost tax netCost salesTax name');
  if (!order) throw new AppError('Order not found', 404);
  if (!canViewOrder(order, req.user)) {
    throw new AppError('Forbidden', 403);
  }
  const html = await generateInvoiceHtml(order, order.user, { autoPrint: true });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

module.exports = {
  createOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
  updateOrderItems,
  generateInvoice,
  getInvoice,
  getOrderPrint,
  canViewOrder,
  canManagePendingOrder,
  isB2BSelfProcurement,
};
