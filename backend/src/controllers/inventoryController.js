const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const Inventory = require('../models/Inventory');
const {
  listInventoryForOwner,
  maybeNotifyLowStock,
} = require('../services/inventoryService');

const listInventory = asyncHandler(async (req, res) => {
  const ownerId =
    req.user.role === 'admin' && req.query.ownerId ? req.query.ownerId : req.user._id;

  if (!['stockist', 'distributor', 'admin'].includes(req.user.role)) {
    throw new AppError('Forbidden', 403);
  }
  if (req.user.role !== 'admin' && String(ownerId) !== String(req.user._id)) {
    throw new AppError('Forbidden', 403);
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const { rows, total, pages } = await listInventoryForOwner(ownerId, {
    page,
    limit,
    search: req.query.search,
  });

  sendResponse(res, {
    data: rows,
    meta: { page, limit, total, pages },
  });
});

const updateMinRackQty = asyncHandler(async (req, res) => {
  if (!['stockist', 'distributor'].includes(req.user.role)) {
    throw new AppError('Forbidden', 403);
  }

  const row = await Inventory.findById(req.params.id).populate(
    'product',
    'name sku images status mrp'
  );
  if (!row) throw new AppError('Inventory item not found', 404);
  if (String(row.owner) !== String(req.user._id)) {
    throw new AppError('Forbidden', 403);
  }

  const minRackQty = Math.max(0, Math.floor(Number(req.body.minRackQty) || 0));
  row.minRackQty = minRackQty;
  if (minRackQty <= 0 || row.stock >= minRackQty) {
    row.lowStockNotified = false;
  }
  await row.save();
  await maybeNotifyLowStock(row);

  const refreshed = await Inventory.findById(row._id).populate(
    'product',
    'name sku images status mrp'
  );
  sendResponse(res, { message: 'Min rack qty updated', data: refreshed });
});

module.exports = { listInventory, updateMinRackQty };
