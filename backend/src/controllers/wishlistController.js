const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { getMarginsMap, toPublicProductCard } = require('../services/pricingService');
const { getPurchasedProductIds } = require('../services/purchaseHistoryService');

const listWishlist = asyncHandler(async (req, res) => {
  const entries = await Wishlist.find({ user: req.user._id })
    .populate({
      path: 'product',
      populate: { path: 'category', select: 'name' },
    })
    .sort({ createdAt: -1 });

  const marginsMap = await getMarginsMap();
  const purchasedProductIds =
    req.user.role === 'distributor' ? await getPurchasedProductIds(req.user._id) : null;
  const active = entries.filter((e) => e.product && e.product.status === 'active');
  const data = await Promise.all(
    active.map(async (e) => {
      const card = await toPublicProductCard(
        e.product,
        req.user,
        marginsMap,
        null,
        purchasedProductIds
      );
      return {
        wishlistId: e._id,
        productId: card._id,
        ...card,
        addedAt: e.createdAt,
      };
    })
  );

  sendResponse(res, { data });
});

const addToWishlist = asyncHandler(async (req, res) => {
  const productId = req.params.productId;
  const product = await Product.findById(productId);
  if (!product || product.status !== 'active') {
    throw new AppError('Product not found', 404);
  }

  const existing = await Wishlist.findOne({ user: req.user._id, product: productId });
  if (existing) {
    sendResponse(res, { message: 'Already in wishlist', data: { productId } });
    return;
  }

  await Wishlist.create({ user: req.user._id, product: productId });
  sendResponse(res, {
    statusCode: 201,
    message: 'Added to wishlist',
    data: { productId },
  });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const result = await Wishlist.findOneAndDelete({
    user: req.user._id,
    product: req.params.productId,
  });
  if (!result) throw new AppError('Wishlist item not found', 404);
  sendResponse(res, { message: 'Removed from wishlist', data: { productId: req.params.productId } });
});

const listWishlistIds = asyncHandler(async (req, res) => {
  const entries = await Wishlist.find({ user: req.user._id }).select('product');
  sendResponse(res, { data: entries.map((e) => String(e.product)) });
});

module.exports = {
  listWishlist,
  addToWishlist,
  removeFromWishlist,
  listWishlistIds,
};
