const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');

/**
 * Notify inventory owner once when stock drops below minRackQty.
 * Clears the flag when stock recovers so a later drop can alert again.
 */
const maybeNotifyLowStock = async (row) => {
  if (!row) return;
  const minRackQty = Number(row.minRackQty) || 0;
  if (minRackQty <= 0) {
    if (row.lowStockNotified) {
      row.lowStockNotified = false;
      await row.save();
    }
    return;
  }

  if (row.stock < minRackQty) {
    if (row.lowStockNotified) return;
    const product = await Product.findById(row.product).select('name sku');
    const name = product?.name || 'Product';
    const sku = product?.sku ? ` (${product.sku})` : '';
    await Notification.create({
      user: row.owner,
      title: 'Low stock alert',
      message: `${name}${sku} is below min rack qty (${row.stock} left, min ${minRackQty}).`,
    });
    row.lowStockNotified = true;
    await row.save();
    return;
  }

  if (row.lowStockNotified) {
    row.lowStockNotified = false;
    await row.save();
  }
};

/**
 * Resolve which stock pool an order draws from based on buyer role.
 */
const resolveSupplyContext = async (buyer) => {
  if (!buyer) {
    return { supplySource: 'admin', supplierId: null };
  }

  if (buyer.role === 'customer') {
    return { supplySource: 'admin', supplierId: null };
  }

  if (buyer.role === 'stockist') {
    return { supplySource: 'admin', supplierId: null };
  }

  if (buyer.role === 'distributor') {
    if (!buyer.assignedStockist) {
      throw new AppError('No stockist assigned to your account', 400);
    }
    return { supplySource: 'stockist', supplierId: buyer.assignedStockist };
  }

  if (buyer.role === 'retailer' || buyer.role === 'reseller') {
    if (!buyer.assignedDistributor) {
      throw new AppError('No distributor assigned to your account', 400);
    }
    return { supplySource: 'distributor', supplierId: buyer.assignedDistributor };
  }

  return { supplySource: 'admin', supplierId: null };
};

const getInventoryStock = async (ownerId, productId) => {
  const row = await Inventory.findOne({ owner: ownerId, product: productId });
  return row?.stock || 0;
};

/** Admin warehouse stock (Product.stock). */
const getAdminWarehouseStock = async (productOrId) => {
  const product =
    productOrId?.stock !== undefined
      ? productOrId
      : await Product.findById(productOrId).select('stock');
  if (!product) return 0;
  return product.stock || 0;
};

const applyStockAllocation = (warehouseStock, buyer) => {
  const stock = Number(warehouseStock) || 0;
  if (!buyer || buyer.role !== 'stockist') return stock;
  const pct = Number(buyer.stockAllocationPercent);
  const allocation = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 100;
  return Math.floor(stock * allocation / 100);
};

/**
 * Returns available stock for a buyer from the correct pool.
 * Stockists and customers order from admin warehouse; distributors/retailers
 * draw from their assigned supplier's inventory.
 */
const getAvailableStock = async (productOrId, buyer) => {
  if (!buyer || buyer.role === 'customer' || buyer.role === 'admin') {
    return getAdminWarehouseStock(productOrId);
  }

  if (buyer.role === 'stockist') {
    const warehouseStock = await getAdminWarehouseStock(productOrId);
    return applyStockAllocation(warehouseStock, buyer);
  }

  const product =
    productOrId?.stock !== undefined
      ? productOrId
      : await Product.findById(productOrId).select('stock');
  if (!product) return 0;

  const { supplierId } = await resolveSupplyContext(buyer);
  if (!supplierId) return 0;
  return getInventoryStock(supplierId, product._id || productOrId);
};

/**
 * Resolve which user's stock pool applies for catalog / interest.
 * When a parent orders on behalf of a child (buyerId), use the child's stock context.
 */
const resolveStockUser = (viewer, pricingUser) => {
  if (pricingUser && viewer && String(pricingUser._id) !== String(viewer._id)) {
    return pricingUser;
  }
  if (viewer?.role === 'stockist') return viewer;
  return pricingUser || viewer;
};

const getOrCreateInventory = async (ownerId, productId) => {
  let row = await Inventory.findOne({ owner: ownerId, product: productId });
  if (!row) {
    row = await Inventory.create({ owner: ownerId, product: productId, stock: 0 });
  }
  return row;
};

const creditStock = async (ownerId, productId, qty) => {
  const row = await getOrCreateInventory(ownerId, productId);
  row.credit(qty);
  await row.save();
  await maybeNotifyLowStock(row);
  return row;
};

const depleteStock = async (ownerId, productId, qty) => {
  const row = await Inventory.findOne({ owner: ownerId, product: productId });
  if (!row || row.stock < qty) {
    const product = await Product.findById(productId).select('name');
    throw new AppError(`Insufficient stock for ${product?.name || 'product'}`, 400);
  }
  row.deplete(qty);
  await row.save();
  await maybeNotifyLowStock(row);
  return row;
};

const checkOrderStock = async (items, buyer) => {
  await resolveSupplyContext(buyer);

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product || product.status !== 'active') {
      throw new AppError(`Product not available: ${item.product}`, 400);
    }
    const qty = Number(item.qty) || 0;
    if (qty < 1) throw new AppError('Invalid quantity', 400);
    const minQuantity = Number(product.minQuantity) > 0 ? Number(product.minQuantity) : 1;
    const moq = Number(product.moq) > 0 ? Number(product.moq) : 1;
    if (qty < minQuantity) {
      throw new AppError(
        `Quantity for ${product.name} must be at least ${minQuantity}`,
        400
      );
    }
    if ((qty - minQuantity) % moq !== 0) {
      throw new AppError(
        `Quantity for ${product.name} must increase in steps of ${moq} from ${minQuantity}`,
        400
      );
    }
    const available = await getAvailableStock(product, buyer);
    if (available < qty) {
      let hint = `Insufficient stock for ${product.name} (available: ${available})`;
      if (buyer.role === 'distributor') {
        hint += '. Stock is drawn from the assigned stockist inventory — replenish via admin fulfillment first.';
      } else if (buyer.role === 'stockist') {
        hint += '. Check your warehouse allocation or ask admin for stock.';
      } else if (buyer.role === 'retailer' || buyer.role === 'reseller') {
        hint += '. Stock is drawn from the assigned distributor inventory.';
      }
      throw new AppError(hint, 400);
    }
  }
};

const depleteOrderStock = async (order) => {
  const buyer = await User.findById(order.user);
  if (!buyer) throw new AppError('Buyer not found', 404);

  const { supplySource, supplierId } = await resolveSupplyContext(buyer);

  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (!product) {
      throw new AppError(`Product missing for order line: ${item.name}`, 400);
    }

    if (supplySource === 'admin') {
      if (product.stock < item.qty) {
        throw new AppError(
          `Insufficient stock for ${product.name} (available: ${product.stock || 0})`,
          400
        );
      }
      product.depleteStock(item.qty);
      await product.save();
      // Stockist inventory is credited when the order is marked delivered.
    } else if (supplySource === 'stockist') {
      try {
        await depleteStock(supplierId, item.product, item.qty);
      } catch (err) {
        if (err.message?.startsWith('Insufficient stock')) {
          throw new AppError(
            `${err.message}. Stock is drawn from your stockist inventory — replenish via admin fulfillment first.`,
            400
          );
        }
        throw err;
      }
      // Distributor inventory is credited when the order is marked delivered.
    } else {
      await depleteStock(supplierId, item.product, item.qty);
    }
  }

  return { supplySource, supplierId };
};

/**
 * Credit buyer's Inventory when goods are delivered (stockist / distributor only).
 */
const creditOrderInventory = async (order) => {
  const buyer = await User.findById(order.user);
  if (!buyer) throw new AppError('Buyer not found', 404);

  if (buyer.role !== 'stockist' && buyer.role !== 'distributor') {
    return { credited: false, buyer };
  }

  for (const item of order.items) {
    await creditStock(buyer._id, item.product, item.qty);
  }

  return { credited: true, buyer };
};

const listInventoryForOwner = async (ownerId, { page = 1, limit = 50, search } = {}) => {
  const skip = (page - 1) * limit;
  const filter = { owner: ownerId };

  let productIds = null;
  if (search) {
    const products = await Product.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    productIds = products.map((p) => p._id);
    filter.product = { $in: productIds };
  }

  const [rows, total] = await Promise.all([
    Inventory.find(filter)
      .populate('product', 'name sku images status mrp')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    Inventory.countDocuments(filter),
  ]);

  return { rows, total, page, limit, pages: Math.ceil(total / limit) };
};

const checkAdminWarehouseStock = async (items) => {
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) throw new AppError(`Product not found: ${item.product}`, 400);
    if (product.stock < item.qty) {
      throw new AppError(`Insufficient warehouse stock for ${product.name}`, 400);
    }
  }
};

/**
 * Restock supplier and (when applicable) deplete buyer inventory after return pickup.
 */
const applyReturnInventory = async ({ items, buyer, supplySource, supplierId }) => {
  for (const item of items) {
    const productId = item.product?._id || item.product;
    const qty = Number(item.qty) || 0;
    if (qty < 1) continue;

    if (supplySource === 'admin') {
      const product = await Product.findById(productId);
      if (!product) throw new AppError(`Product missing for return: ${item.name}`, 400);
      product.stock = (product.stock || 0) + qty;
      await product.save();
    } else if (supplierId) {
      await creditStock(supplierId, productId, qty);
    }

    if (buyer && ['stockist', 'distributor'].includes(buyer.role)) {
      try {
        await depleteStock(buyer._id, productId, qty);
      } catch {
        // Buyer may have already sold stock onward — supplier restock still proceeds.
      }
    }
  }
};

module.exports = {
  resolveSupplyContext,
  resolveStockUser,
  getAvailableStock,
  getAdminWarehouseStock,
  getInventoryStock,
  creditStock,
  depleteStock,
  checkOrderStock,
  depleteOrderStock,
  creditOrderInventory,
  applyReturnInventory,
  listInventoryForOwner,
  checkAdminWarehouseStock,
  getOrCreateInventory,
  maybeNotifyLowStock,
};
