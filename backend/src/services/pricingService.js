const MarginSetting = require('../models/MarginSetting');
const User = require('../models/User');

const applyMargin = (product, margin) => {
  const netCost = Number(product?.netCost) || 0;
  if (!margin || margin.value == null) return netCost;
  const base = margin.basis === 'mrp' ? Number(product?.mrp) || 0 : netCost;
  if (margin.type === 'fixed') {
    return Math.round((base + Number(margin.value)) * 100) / 100;
  }
  return Math.round(base * (1 + Number(margin.value) / 100) * 100) / 100;
};

/** Apply a margin onto an already-computed previous selling price (compound tier). */
const applyMarginOnPrice = (previousPrice, margin) => {
  const base = Number(previousPrice) || 0;
  if (!margin || margin.value == null) return base;
  if (margin.type === 'fixed') {
    return Math.round((base + Number(margin.value)) * 100) / 100;
  }
  return Math.round(base * (1 + Number(margin.value) / 100) * 100) / 100;
};

const marginFromUserOrGlobal = (user, marginsMap) => {
  if (!user) return null;
  if (user.marginValue != null) {
    return {
      type: user.marginType || 'percentage',
      basis: user.marginBasis || 'cost',
      value: user.marginValue,
    };
  }
  return marginsMap?.[user.role] || null;
};

const getMarginsMap = async () => {
  const margins = await MarginSetting.find();
  const map = {};
  margins.forEach((m) => {
    map[m.role] = { type: m.type, basis: m.basis, value: m.value };
  });
  return map;
};

const applyCustomerDiscount = (product, user) => {
  const mrp = Number(product?.mrp) || Number(product?.customerPrice) || 0;
  const pct = Number(user?.discountPercent) || 0;
  if (pct <= 0) return mrp;
  return Math.round(mrp * (1 - pct / 100) * 100) / 100;
};

/**
 * Resolve hierarchy margin chain for a B2B user (stockist → distributor → retailer/reseller).
 * Returns users ordered from top of chain to the target.
 */
const resolveMarginChain = async (targetUser) => {
  if (!targetUser || !['stockist', 'distributor', 'retailer', 'reseller'].includes(targetUser.role)) {
    return [];
  }

  if (targetUser.role === 'stockist') {
    return [targetUser];
  }

  if (targetUser.role === 'distributor') {
    let stockist = null;
    if (targetUser.assignedStockist) {
      stockist = await User.findById(targetUser.assignedStockist);
    }
    return stockist ? [stockist, targetUser] : [targetUser];
  }

  // retailer / reseller (both assigned to a distributor)
  let distributor = null;
  let stockist = null;
  if (targetUser.assignedDistributor) {
    distributor = await User.findById(targetUser.assignedDistributor);
  }
  if (distributor?.assignedStockist) {
    stockist = await User.findById(distributor.assignedStockist);
  }
  const chain = [];
  if (stockist) chain.push(stockist);
  if (distributor) chain.push(distributor);
  chain.push(targetUser);
  return chain;
};

/**
 * Compound stacked price along the hierarchy chain.
 * First tier uses product cost/mrp via marginBasis; later tiers compound on previous price.
 */
const getStackedPrice = (product, chain, marginsMap) => {
  if (!chain?.length) {
    return Number(product?.netCost) || 0;
  }

  const firstMargin = marginFromUserOrGlobal(chain[0], marginsMap);
  let price = applyMargin(product, firstMargin);

  for (let i = 1; i < chain.length; i += 1) {
    const margin = marginFromUserOrGlobal(chain[i], marginsMap);
    price = applyMarginOnPrice(price, margin);
  }

  return price;
};

/** Sync helper when chain is already loaded. */
const getStackedPriceSync = getStackedPrice;

const getRolePrice = async (product, user, marginsMap) => {
  const role = user?.role || 'customer';
  if (role === 'admin') return product.netCost;
  if (role === 'customer') return applyCustomerDiscount(product, user);
  if (['stockist', 'distributor', 'retailer', 'reseller'].includes(role)) {
    const chain = await resolveMarginChain(user);
    return getStackedPrice(product, chain, marginsMap);
  }
  return product.customerPrice;
};

/** Illustrative stacked globals for admin product detail. */
const buildStackedRolePrices = (product, marginsMap) => {
  const stockistM = marginsMap.stockist;
  const distributorM = marginsMap.distributor;
  const retailerM = marginsMap.retailer;
  const resellerM = marginsMap.reseller;
  const stockist = applyMargin(product, stockistM);
  const distributor = applyMarginOnPrice(stockist, distributorM);
  const retailer = applyMarginOnPrice(distributor, retailerM);
  const reseller = applyMarginOnPrice(distributor, resellerM);
  return {
    stockist,
    distributor,
    retailer,
    reseller,
    customer: applyCustomerDiscount(product, { role: 'customer', discountPercent: 0 }),
  };
};

const stripCostFields = (obj) => ({
  ...obj,
  cost: undefined,
  tax: undefined,
  netCost: undefined,
  mrp: undefined,
  customerPrice: undefined,
});

const isDistributorPurchased = (productId, purchasedProductIds) => {
  if (!purchasedProductIds) return true;
  return purchasedProductIds.has(String(productId));
};

const hiddenPriceResult = (obj, { hasPurchased = false, canExpressInterest = false } = {}) => ({
  ...stripCostFields(obj),
  displayPrice: null,
  rolePrices: null,
  priceHidden: true,
  hasPurchased,
  canExpressInterest,
  discountPercent: 0,
  discountAmount: 0,
});

const decorateProductForUser = async (
  product,
  user,
  marginsMap,
  priceAsUser = null,
  purchasedProductIds = null
) => {
  const obj = typeof product.toObject === 'function' ? product.toObject() : { ...product };
  const role = user?.role || 'customer';
  const isAdmin = role === 'admin';
  const pricingUser = priceAsUser || user;

  const rolePrices = buildStackedRolePrices(obj, marginsMap);

  if (isAdmin && !priceAsUser) {
    return {
      ...obj,
      displayPrice: obj.netCost,
      rolePrices,
      priceHidden: false,
      hasPurchased: true,
      canExpressInterest: false,
      discountPercent: 0,
      discountAmount: 0,
    };
  }

  if (!obj.priceVisible || pricingUser?.priceVisible === false) {
    return hiddenPriceResult(obj);
  }

  const pricingRole = pricingUser?.role || role;
  const isOnBehalfOrder =
    Boolean(user && priceAsUser) &&
    String(user._id) !== String(priceAsUser._id) &&
    (user.role === 'stockist' || user.role === 'distributor');

  if (
    pricingRole === 'distributor' &&
    purchasedProductIds &&
    !isDistributorPurchased(obj._id, purchasedProductIds) &&
    !isOnBehalfOrder
  ) {
    return hiddenPriceResult(obj, { hasPurchased: false, canExpressInterest: true });
  }

  const displayPrice = await getRolePrice(obj, pricingUser, marginsMap);
  const mrp = Number(obj.mrp) || Number(obj.customerPrice) || 0;
  const discountPercent =
    pricingRole === 'customer'
      ? Math.max(0, Math.min(100, Number(pricingUser?.discountPercent) || 0))
      : 0;
  const discountAmount =
    pricingRole === 'customer' && mrp > displayPrice
      ? Math.round((mrp - displayPrice) * 100) / 100
      : 0;

  return {
    ...obj,
    cost: undefined,
    tax: undefined,
    netCost: undefined,
    customerPrice: pricingRole === 'customer' ? obj.customerPrice : undefined,
    mrp,
    displayPrice,
    rolePrices: isAdmin ? rolePrices : null,
    priceHidden: false,
    hasPurchased: pricingRole === 'distributor' ? true : undefined,
    canExpressInterest: false,
    discountPercent,
    discountAmount,
  };
};

const toPublicCardBase = (obj, extra = {}) => ({
  _id: obj._id,
  name: obj.name,
  images: obj.images,
  category: obj.category,
  minQuantity: Math.max(1, Number(obj.minQuantity) || 1),
  moq: Math.max(1, Number(obj.moq) || 1),
  ...extra,
});

/** Normalize storefront card fields (public list / guest + logged-in). */
const toPublicProductCard = async (
  product,
  user,
  marginsMap,
  priceAsUser = null,
  purchasedProductIds = null
) => {
  const obj = typeof product.toObject === 'function' ? product.toObject() : { ...product };

  if (!obj.priceVisible) {
    return toPublicCardBase(obj, {
      price: null,
      mrp: null,
      discountPercent: 0,
      discountAmount: 0,
    });
  }

  const mrp = Number(obj.mrp) || Number(obj.customerPrice) || 0;
  const pricingUser = priceAsUser || user;

  if (!pricingUser) {
    return toPublicCardBase(obj, {
      price: mrp,
      mrp,
      discountPercent: 0,
      discountAmount: 0,
    });
  }

  if (pricingUser.priceVisible === false) {
    return toPublicCardBase(obj, {
      price: null,
      mrp: null,
      discountPercent: 0,
      discountAmount: 0,
    });
  }

  // Guests already handled; logged-in customers + B2B get role/stacked price.
  if (
    !['customer', 'stockist', 'distributor', 'retailer', 'reseller'].includes(pricingUser.role)
  ) {
    return toPublicCardBase(obj, {
      price: mrp,
      mrp,
      discountPercent: 0,
      discountAmount: 0,
    });
  }

  const decorated = await decorateProductForUser(
    obj,
    user,
    marginsMap,
    pricingUser,
    purchasedProductIds
  );
  return toPublicCardBase(obj, {
    price: decorated.displayPrice,
    mrp: decorated.mrp,
    discountPercent: decorated.discountPercent,
    discountAmount: decorated.discountAmount,
    hasPurchased: decorated.hasPurchased,
    canExpressInterest: decorated.canExpressInterest,
  });
};

module.exports = {
  applyMargin,
  applyMarginOnPrice,
  getMarginsMap,
  getRolePrice,
  getStackedPrice,
  getStackedPriceSync,
  resolveMarginChain,
  decorateProductForUser,
  toPublicProductCard,
  applyCustomerDiscount,
  buildStackedRolePrices,
  marginFromUserOrGlobal,
};
