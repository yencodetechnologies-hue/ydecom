const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const User = require('../models/User');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { getPagination, buildSearchFilter } = require('../utils/pagination');
const { getMarginsMap, getRolePrice } = require('../services/pricingService');
const {
  creditStock,
  checkAdminWarehouseStock,
} = require('../services/inventoryService');

const createPoNumber = () => `PO${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

const canAccessPo = (po, user) => {
  if (user.role === 'admin') return true;
  return user.role === 'stockist' && String(po.stockist) === String(user._id);
};

const buildPoItems = async (items, stockist) => {
  const marginsMap = await getMarginsMap();
  const poItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product || product.status !== 'active') {
      throw new AppError(`Product not available: ${item.product}`, 400);
    }
    const qty = Number(item.qty) || 0;
    if (qty < 1) throw new AppError('Invalid quantity', 400);
    const unitPrice = await getRolePrice(product, stockist, marginsMap);
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    poItems.push({
      product: product._id,
      name: product.name,
      qty,
      unitPrice,
      lineTotal,
    });
    subtotal += lineTotal;
  }

  return { poItems, subtotal: Math.round(subtotal * 100) / 100 };
};

const listPurchaseOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.user.role === 'stockist') {
    filter.stockist = req.user._id;
  } else if (req.query.stockistId) {
    filter.stockist = req.query.stockistId;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    Object.assign(filter, buildSearchFilter(req.query.search, ['poNumber']));
  }

  const [orders, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .populate('stockist', 'name email mobile shopName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PurchaseOrder.countDocuments(filter),
  ]);

  sendResponse(res, {
    data: orders,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const getPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id).populate(
    'stockist',
    'name email mobile shopName shopAddress'
  );
  if (!po) throw new AppError('Purchase order not found', 404);
  if (!canAccessPo(po, req.user)) throw new AppError('Forbidden', 403);
  sendResponse(res, { data: po });
});

const createPurchaseOrder = asyncHandler(async (req, res) => {
  if (req.user.role !== 'stockist') {
    throw new AppError('Only stockists can create purchase orders', 403);
  }
  const { items, notes } = req.body;
  if (!items?.length) throw new AppError('PO items required', 400);

  const { poItems, subtotal } = await buildPoItems(items, req.user);

  const po = await PurchaseOrder.create({
    poNumber: createPoNumber(),
    stockist: req.user._id,
    items: poItems,
    subtotal,
    notes: notes || '',
    status: 'draft',
    statusHistory: [
      { status: 'draft', note: 'PO created', changedBy: req.user._id },
    ],
  });

  sendResponse(res, { statusCode: 201, message: 'Purchase order created', data: po });
});

const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new AppError('Purchase order not found', 404);
  if (!canAccessPo(po, req.user)) throw new AppError('Forbidden', 403);
  if (po.status !== 'draft') throw new AppError('Only draft POs can be edited', 400);
  if (req.user.role !== 'stockist') throw new AppError('Only stockist can edit draft PO', 403);

  if (req.body.notes !== undefined) po.notes = req.body.notes;
  if (req.body.items?.length) {
    const { poItems, subtotal } = await buildPoItems(req.body.items, req.user);
    po.items = poItems;
    po.subtotal = subtotal;
  }
  await po.save();
  sendResponse(res, { message: 'Purchase order updated', data: po });
});

const notifyAdmins = async (po, title, message) => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  if (!admins.length) return;
  await Notification.insertMany(
    admins.map((admin) => ({ user: admin._id, title, message }))
  );
};

const notifyStockist = async (po, title, message) => {
  await Notification.create({
    user: po.stockist,
    title,
    message,
  });
};

const submitPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new AppError('Purchase order not found', 404);
  if (!canAccessPo(po, req.user)) throw new AppError('Forbidden', 403);
  if (po.status !== 'draft') throw new AppError('Only draft POs can be submitted', 400);

  po.status = 'submitted';
  po.statusHistory.push({
    status: 'submitted',
    note: req.body.note || 'Submitted for approval',
    changedBy: req.user._id,
  });
  await po.save();
  await notifyAdmins(po, 'New purchase order', `PO ${po.poNumber} submitted for approval`);
  sendResponse(res, { message: 'Purchase order submitted', data: po });
});

const approvePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new AppError('Purchase order not found', 404);
  if (req.user.role !== 'admin') throw new AppError('Forbidden', 403);
  if (po.status !== 'submitted') throw new AppError('Only submitted POs can be approved', 400);

  await checkAdminWarehouseStock(po.items);

  po.status = 'approved';
  if (req.body.adminNotes) po.adminNotes = req.body.adminNotes;
  po.statusHistory.push({
    status: 'approved',
    note: req.body.note || 'Approved',
    changedBy: req.user._id,
  });
  await po.save();
  await notifyStockist(po, 'PO approved', `PO ${po.poNumber} has been approved`);
  sendResponse(res, { message: 'Purchase order approved', data: po });
});

const dispatchPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new AppError('Purchase order not found', 404);
  if (req.user.role !== 'admin') throw new AppError('Forbidden', 403);
  if (po.status !== 'approved') throw new AppError('Only approved POs can be dispatched', 400);

  po.status = 'dispatched';
  po.statusHistory.push({
    status: 'dispatched',
    note: req.body.note || 'Dispatched',
    changedBy: req.user._id,
  });
  await po.save();
  await notifyStockist(po, 'PO dispatched', `PO ${po.poNumber} has been dispatched`);
  sendResponse(res, { message: 'Purchase order dispatched', data: po });
});

const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new AppError('Purchase order not found', 404);
  if (!canAccessPo(po, req.user) && req.user.role !== 'admin') {
    throw new AppError('Forbidden', 403);
  }
  if (!['dispatched', 'approved'].includes(po.status)) {
    throw new AppError('PO must be approved or dispatched before receiving', 400);
  }

  await checkAdminWarehouseStock(po.items);

  for (const item of po.items) {
    const product = await Product.findById(item.product);
    if (!product) throw new AppError(`Product not found: ${item.product}`, 400);
    product.depleteStock(item.qty);
    await product.save();
    await creditStock(po.stockist, item.product, item.qty);
  }

  po.status = 'received';
  po.statusHistory.push({
    status: 'received',
    note: req.body.note || 'Stock received',
    changedBy: req.user._id,
  });
  await po.save();
  sendResponse(res, { message: 'Purchase order received — stock credited', data: po });
});

const rejectPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new AppError('Purchase order not found', 404);
  if (req.user.role !== 'admin') throw new AppError('Forbidden', 403);
  if (!['submitted', 'approved'].includes(po.status)) {
    throw new AppError('PO cannot be rejected in current status', 400);
  }

  po.status = 'rejected';
  if (req.body.adminNotes) po.adminNotes = req.body.adminNotes;
  po.statusHistory.push({
    status: 'rejected',
    note: req.body.note || 'Rejected',
    changedBy: req.user._id,
  });
  await po.save();
  await notifyStockist(po, 'PO rejected', `PO ${po.poNumber} has been rejected`);
  sendResponse(res, { message: 'Purchase order rejected', data: po });
});

const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new AppError('Purchase order not found', 404);
  if (!canAccessPo(po, req.user)) throw new AppError('Forbidden', 403);
  if (!['draft', 'submitted'].includes(po.status)) {
    throw new AppError('PO cannot be cancelled in current status', 400);
  }
  if (req.user.role === 'stockist' && po.status === 'submitted' && String(po.stockist) !== String(req.user._id)) {
    throw new AppError('Forbidden', 403);
  }

  po.status = 'cancelled';
  po.statusHistory.push({
    status: 'cancelled',
    note: req.body.note || 'Cancelled',
    changedBy: req.user._id,
  });
  await po.save();
  sendResponse(res, { message: 'Purchase order cancelled', data: po });
});

module.exports = {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  dispatchPurchaseOrder,
  receivePurchaseOrder,
  rejectPurchaseOrder,
  cancelPurchaseOrder,
};
