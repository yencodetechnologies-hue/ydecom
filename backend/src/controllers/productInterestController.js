const Product = require('../models/Product');
const ProductInterest = require('../models/ProductInterest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getAvailableStock, resolveStockUser } = require('../services/inventoryService');
const { resolveBuyer } = require('../services/networkService');
const { getPagination } = require('../utils/pagination');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');

const INTEREST_ROLES = ['stockist', 'distributor', 'retailer', 'reseller'];
const DOWNLINE_ROLES = ['distributor', 'retailer', 'reseller'];

const parseQuantity = (value, { required = false } = {}) => {
  if (value == null || value === '') {
    if (required) throw new AppError('Quantity is required', 400);
    return 1;
  }
  const qty = Number.parseInt(value, 10);
  if (!Number.isFinite(qty) || qty < 1) {
    throw new AppError('Quantity must be at least 1', 400);
  }
  return qty;
};

const formatPartyLabel = (user) => {
  const name = user?.name || 'Unknown';
  const shop = user?.shopName ? ` · ${user.shopName}` : '';
  const role = user?.role ? ` (${user.role})` : '';
  return `${name}${shop}${role}`;
};

const buildInterestMessage = ({ user, product, quantity, type, placedBy, isUpdate = false }) => {
  const action = isUpdate ? 'updated interest for' : 'expressed interest in';
  const qtyPart = quantity > 1 ? `${quantity} units of ` : '';
  const skuPart = product?.sku ? ` [SKU: ${product.sku}]` : '';
  const typePart =
    type === 'first_purchase' ? ' (first purchase request)' : ' (out of stock request)';
  const placedByPart = placedBy
    ? ` — submitted by ${placedBy.name || 'staff'}${placedBy.shopName ? ` · ${placedBy.shopName}` : ''}`
    : '';
  return `${formatPartyLabel(user)} ${action} ${qtyPart}${product.name}${skuPart}${typePart}${placedByPart}`;
};

const notifyUsers = async (userIds, title, message) => {
  const uniqueIds = [...new Set(userIds.map(String))];
  if (!uniqueIds.length) return;
  await Notification.insertMany(
    uniqueIds.map((userId) => ({
      user: userId,
      title,
      message,
    }))
  );
};

const getAdminIds = async () => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  return admins.map((a) => a._id);
};

const interestTitleForRole = (role) => {
  const map = {
    stockist: 'Stockist product interest',
    distributor: 'Distributor product interest',
    retailer: 'Retailer product interest',
    reseller: 'Reseller product interest',
  };
  return map[role] || 'Product interest';
};

const notifyInterest = async ({
  user,
  product,
  quantity,
  type,
  placedBy = null,
  isUpdate = false,
}) => {
  const message = buildInterestMessage({ user, product, quantity, type, placedBy, isUpdate });
  const title = interestTitleForRole(user.role);
  const recipients = await getAdminIds();

  if (user.role === 'distributor' && user.assignedStockist) {
    recipients.push(user.assignedStockist);
  }

  if (user.role === 'retailer' || user.role === 'reseller') {
    if (user.assignedDistributor) {
      recipients.push(user.assignedDistributor);
      const distributor = await User.findById(user.assignedDistributor).select('assignedStockist');
      if (distributor?.assignedStockist) {
        recipients.push(distributor.assignedStockist);
      }
    }
  }

  await notifyUsers(recipients, title, message);
};

const resolveInterestContext = async (viewer, buyerId) => {
  if (!buyerId) {
    return { interestOwner: viewer, stockUser: viewer, roleUser: viewer, placedBy: null };
  }
  const { buyer, placedBy } = await resolveBuyer(viewer, buyerId);
  const stockUser = resolveStockUser(viewer, buyer);
  let placedByUser = null;
  if (placedBy) {
    placedByUser = await User.findById(placedBy).select('name shopName role');
  }
  return {
    interestOwner: buyer,
    stockUser,
    roleUser: buyer,
    placedBy: placedByUser,
  };
};

const serializeInterest = (row) => {
  const obj = row.toObject ? row.toObject() : row;
  return {
    _id: obj._id,
    quantity: obj.quantity,
    type: obj.type,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    user: obj.user
      ? {
          _id: obj.user._id,
          name: obj.user.name,
          shopName: obj.user.shopName,
          email: obj.user.email,
          mobile: obj.user.mobile,
          role: obj.user.role,
        }
      : null,
    product: obj.product
      ? {
          _id: obj.product._id,
          name: obj.product.name,
          sku: obj.product.sku,
          brand: obj.product.brand,
          images: obj.product.images,
        }
      : null,
    placedBy: obj.placedBy
      ? {
          _id: obj.placedBy._id,
          name: obj.placedBy.name,
          shopName: obj.placedBy.shopName,
          role: obj.placedBy.role,
        }
      : null,
  };
};

const buildListFilterForViewer = async (viewer) => {
  if (viewer.role === 'admin') {
    return {};
  }

  if (viewer.role === 'stockist') {
    const distributors = await User.find({
      role: 'distributor',
      assignedStockist: viewer._id,
    }).select('_id');
    const distributorIds = distributors.map((d) => d._id);
    const downline = await User.find({
      role: { $in: ['retailer', 'reseller'] },
      assignedDistributor: { $in: distributorIds },
    }).select('_id');
    const userIds = [
      viewer._id,
      ...distributorIds,
      ...downline.map((u) => u._id),
    ];
    return { user: { $in: userIds } };
  }

  if (viewer.role === 'distributor') {
    const downline = await User.find({
      role: { $in: ['retailer', 'reseller'] },
      assignedDistributor: viewer._id,
    }).select('_id');
    const userIds = [viewer._id, ...downline.map((u) => u._id)];
    return { user: { $in: userIds } };
  }

  return null;
};

const listInterestIds = asyncHandler(async (req, res) => {
  if (!INTEREST_ROLES.includes(req.user.role)) {
    return sendResponse(res, { data: [] });
  }

  const { interestOwner } = await resolveInterestContext(req.user, req.query.buyerId);
  const rows = await ProductInterest.find({ user: interestOwner._id }).select('product quantity');
  sendResponse(res, {
    data: rows.map((r) => ({
      productId: String(r.product),
      quantity: r.quantity ?? 1,
    })),
  });
});

const listInterests = asyncHandler(async (req, res) => {
  if (!['admin', 'stockist', 'distributor'].includes(req.user.role)) {
    throw new AppError('Not authorized to view product interests', 403);
  }

  const { page, limit, skip } = getPagination(req.query);
  const filter = await buildListFilterForViewer(req.user);
  if (filter === null) {
    throw new AppError('Not authorized to view product interests', 403);
  }

  const [rows, total] = await Promise.all([
    ProductInterest.find(filter)
      .populate('user', 'name shopName email mobile role assignedStockist assignedDistributor')
      .populate('product', 'name sku brand images category')
      .populate('placedBy', 'name shopName role')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    ProductInterest.countDocuments(filter),
  ]);

  sendResponse(res, {
    data: rows.map(serializeInterest),
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

const expressInterest = asyncHandler(async (req, res) => {
  if (!INTEREST_ROLES.includes(req.user.role)) {
    throw new AppError('Only stockists, distributors, retailers and resellers can express interest', 403);
  }

  const product = await Product.findById(req.params.productId);
  if (!product) throw new AppError('Product not found', 404);
  if (product.status !== 'active') throw new AppError('Product is not available', 400);

  const { interestOwner, stockUser, roleUser, placedBy } = await resolveInterestContext(
    req.user,
    req.body?.buyerId
  );

  const availableStock = await getAvailableStock(product, stockUser);
  const isOutOfStock = availableStock <= 0;
  const role = roleUser.role;

  if (role === 'stockist') {
    if (!isOutOfStock) {
      throw new AppError('Interest can only be submitted when the product is out of stock', 400);
    }
  }

  const quantity = isOutOfStock
    ? parseQuantity(req.body?.quantity, { required: true })
    : parseQuantity(req.body?.quantity);

  const placedById = placedBy?._id || null;

  if (DOWNLINE_ROLES.includes(role) && !isOutOfStock) {
    const existing = await ProductInterest.findOne({
      user: interestOwner._id,
      product: product._id,
    });

    if (!existing) {
      await ProductInterest.create({
        user: interestOwner._id,
        product: product._id,
        quantity: 1,
        type: 'first_purchase',
        placedBy: placedById,
      });
      await notifyInterest({
        user: interestOwner,
        product,
        quantity: 1,
        type: 'first_purchase',
        placedBy,
      });
    }

    return sendResponse(res, {
      message: 'Interest submitted',
      data: { productId: String(product._id) },
    });
  }

  const existing = await ProductInterest.findOne({
    user: interestOwner._id,
    product: product._id,
  });

  const isNew = !existing;
  const prevQty = existing?.quantity;

  if (existing) {
    existing.quantity = quantity;
    existing.type = 'out_of_stock';
    if (placedById) existing.placedBy = placedById;
    await existing.save();
  } else {
    await ProductInterest.create({
      user: interestOwner._id,
      product: product._id,
      quantity,
      type: 'out_of_stock',
      placedBy: placedById,
    });
  }

  if (isNew || prevQty !== quantity) {
    await notifyInterest({
      user: interestOwner,
      product,
      quantity,
      type: 'out_of_stock',
      placedBy,
      isUpdate: !isNew,
    });
  }

  sendResponse(res, {
    message: 'Interest submitted',
    data: { productId: String(product._id), quantity },
  });
});

module.exports = {
  listInterestIds,
  listInterests,
  expressInterest,
};
