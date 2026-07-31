const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { getPagination, buildSearchFilter } = require('../utils/pagination');
const { getMarginsMap, decorateProductForUser, getRolePrice, toPublicProductCard } = require('../services/pricingService');
const { uploadProductImages, deleteProductImages } = require('../services/cloudinaryService');
const { resolveBuyer } = require('../services/networkService');
const { getAvailableStock, resolveStockUser } = require('../services/inventoryService');
const { getPurchasedProductIds } = require('../services/purchaseHistoryService');

const resolvePurchasedProductIds = async (pricingUser) => {
  if (pricingUser?.role === 'distributor') {
    return getPurchasedProductIds(pricingUser._id);
  }
  return null;
};

const attachAvailableStock = async (productObj, user, priceAsUser = null) => {
  const stockUser = resolveStockUser(user, priceAsUser);
  const availableStock = await getAvailableStock(productObj, stockUser);
  return { ...productObj, availableStock };
};

const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {
    ...buildSearchFilter(req.query.search, ['name', 'sku', 'brand']),
  };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.user.role !== 'admin') filter.status = 'active';

  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name').populate('manufacturer', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  const marginsMap = await getMarginsMap();
  const purchasedProductIds = await resolvePurchasedProductIds(req.user);
  const data = await Promise.all(
    products.map(async (p) => {
      const decorated = await decorateProductForUser(
        p,
        req.user,
        marginsMap,
        null,
        purchasedProductIds
      );
      return attachAvailableStock(decorated, req.user);
    })
  );

  sendResponse(res, {
    data,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const listPublicProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {
    status: 'active',
    ...buildSearchFilter(req.query.search, ['name', 'sku', 'brand']),
  };
  if (req.query.category) filter.category = req.query.category;

  const marginsMap = await getMarginsMap();
  let priceAsUser = req.user || null;
  let onBehalf = false;
  if (req.user && req.query.buyerId) {
    const { buyer } = await resolveBuyer(req.user, req.query.buyerId);
    priceAsUser = buyer;
    onBehalf = String(req.user._id) !== String(buyer._id);
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name')
      .populate('manufacturer', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  // On-behalf (stockist→distributor): show all products with prices.
  // Stocked inventory items can be ordered; zero stock uses Interest + qty on the client.
  const purchasedProductIds = onBehalf ? null : await resolvePurchasedProductIds(priceAsUser);

  const data = await Promise.all(
    products.map(async (p) => {
      const card = await toPublicProductCard(
        p,
        req.user,
        marginsMap,
        priceAsUser,
        purchasedProductIds
      );
      const stockUser = resolveStockUser(req.user, priceAsUser);
      const availableStock = await getAvailableStock(p, stockUser);
      return { ...card, availableStock };
    })
  );

  sendResponse(res, {
    data,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name').populate('manufacturer', 'name');
  if (!product) throw new AppError('Product not found', 404);
  const marginsMap = await getMarginsMap();

  let priceAsUser = req.user || null;
  let onBehalf = false;
  if (req.user && req.query.buyerId) {
    const { buyer } = await resolveBuyer(req.user, req.query.buyerId);
    priceAsUser = buyer;
    onBehalf = String(req.user._id) !== String(buyer._id);
  }

  const purchasedProductIds = onBehalf ? null : await resolvePurchasedProductIds(priceAsUser);
  const decorated = await decorateProductForUser(
    product,
    req.user,
    marginsMap,
    priceAsUser,
    purchasedProductIds
  );
  sendResponse(res, { data: await attachAvailableStock(decorated, req.user, priceAsUser) });
});

const parseStockBatches = (value) => {
  const batches = JSON.parse(value);
  return batches
    .map((b) => ({
      cost: Number(b.cost) || 0,
      tax: Number(b.tax) || 0,
      mrp: Number(b.mrp) || 0,
      qty: Number(b.qty) || 0,
    }))
    .filter((b) => b.qty > 0);
};

const createProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (typeof payload.priceVisible === 'string') {
    payload.priceVisible = payload.priceVisible === 'true';
  }
  // cost/tax/netCost/mrp/customerPrice are derived from stockBatches — never accepted directly.
  delete payload.cost;
  delete payload.tax;
  delete payload.netCost;
  delete payload.mrp;
  delete payload.customerPrice;
  if (payload.stockBatches !== undefined) {
    payload.stockBatches = parseStockBatches(payload.stockBatches);
  }
  if (req.files?.length) {
    payload.images = await uploadProductImages(req.files);
  }
  if (payload.manufacturer === '') delete payload.manufacturer;
  if (payload.minQuantity !== undefined && payload.minQuantity !== '') {
    payload.minQuantity = Number(payload.minQuantity) || 1;
  }
  if (payload.moq !== undefined && payload.moq !== '') {
    payload.moq = Number(payload.moq) || 1;
  }
  const product = await Product.create(payload);
  await product.populate('category', 'name');
  await product.populate('manufacturer', 'name');
  const marginsMap = await getMarginsMap();
  sendResponse(res, {
    statusCode: 201,
    message: 'Product created',
    data: await decorateProductForUser(product, req.user, marginsMap),
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  const fields = [
    'name',
    'sku',
    'itemCode',
    'cbm',
    'brand',
    'manufacturer',
    'category',
    'description',
    'purchaseTax',
    'salesTax',
    'minQuantity',
    'moq',
    'status',
    'priceVisible',
  ];
  fields.forEach((key) => {
    if (req.body[key] !== undefined) {
      let value = req.body[key];
      if (key === 'priceVisible' && typeof value === 'string') value = value === 'true';
      if (key === 'manufacturer' && !value) value = null;
      if ((key === 'minQuantity' || key === 'moq') && value !== '' && value != null) {
        value = Number(value);
      }
      product[key] = value;
    }
  });

  if (req.body.stockBatches !== undefined) {
    product.stockBatches = parseStockBatches(req.body.stockBatches);
    product.markModified('stockBatches');
  }

  if (req.files?.length) {
    const newImages = await uploadProductImages(req.files);
    product.images = [...(product.images || []), ...newImages];
  }

  await product.save();
  await product.populate('category', 'name');
  await product.populate('manufacturer', 'name');
  const marginsMap = await getMarginsMap();
  sendResponse(res, {
    message: 'Product updated',
    data: await decorateProductForUser(product, req.user, marginsMap),
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  await deleteProductImages(product.images || []);
  sendResponse(res, { message: 'Product deleted' });
});

const togglePriceVisible = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  product.priceVisible = !product.priceVisible;
  await product.save();
  await product.populate('category', 'name');
  await product.populate('manufacturer', 'name');
  const marginsMap = await getMarginsMap();
  sendResponse(res, {
    message: `Price visibility ${product.priceVisible ? 'ON' : 'OFF'}`,
    data: await decorateProductForUser(product, req.user, marginsMap),
  });
});

/**
 * Resolve unit price for checkout.
 * skipPurchaseGate: stockist (or supplier) placing/editing on behalf of a distributor
 * for first-time SKUs — mirrors decorateProductForUser on-behalf pricing.
 */
const getDisplayPriceForOrder = async (product, user, { skipPurchaseGate = false } = {}) => {
  const marginsMap = await getMarginsMap();
  if (user.role === 'admin') return product.netCost;
  if (!product.priceVisible && user.role !== 'admin') {
    throw new AppError('Price is hidden for this product. Contact admin.', 400, 'PRICE_HIDDEN');
  }
  if (user.role === 'distributor' && !skipPurchaseGate) {
    const purchasedProductIds = await getPurchasedProductIds(user._id);
    if (!purchasedProductIds.has(String(product._id))) {
      throw new AppError(
        'You must purchase this product before ordering again. Express interest to get started.',
        400,
        'NOT_PURCHASED'
      );
    }
  }
  return getRolePrice(product, user, marginsMap);
};

module.exports = {
  listProducts,
  listPublicProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  togglePriceVisible,
  getDisplayPriceForOrder,
};
