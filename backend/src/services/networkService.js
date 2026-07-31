const User = require('../models/User');
const AppError = require('../utils/AppError');

const NETWORK_SELECT =
  'name email mobile shopName shopAddress shopPhone businessEmail gstNumber panNumber role marginValue marginType marginBasis creditLimit creditUsed addresses';

/**
 * Verify requester may place orders as buyer.
 * stockist → distributor (assignedStockist = stockist)
 * distributor → retailer/reseller (assignedDistributor = distributor)
 * salesman → any id in assignedPartners
 */
const assertCanOrderAs = (parent, child) => {
  if (!parent || !child) throw new AppError('Buyer not found', 404);
  if (String(parent._id) === String(child._id)) return true;

  if (parent.role === 'salesman') {
    const partnerIds = (parent.assignedPartners || []).map((id) => String(id));
    if (!partnerIds.includes(String(child._id))) {
      throw new AppError('Buyer is not assigned to you', 403);
    }
    if (parent.assignmentPartnerType && child.role !== parent.assignmentPartnerType) {
      throw new AppError('Buyer role does not match your assignment', 403);
    }
    if (child.status !== 'approved' || !child.isActive) {
      throw new AppError('Selected buyer is not active', 400);
    }
    return true;
  }

  if (parent.role === 'stockist' && child.role === 'distributor') {
    if (String(child.assignedStockist) !== String(parent._id)) {
      throw new AppError('Distributor is not assigned to you', 403);
    }
    if (child.status !== 'approved' || !child.isActive) {
      throw new AppError('Selected distributor is not active', 400);
    }
    return true;
  }

  if (parent.role === 'distributor' && ['retailer', 'reseller'].includes(child.role)) {
    if (String(child.assignedDistributor) !== String(parent._id)) {
      throw new AppError('Buyer is not assigned to you', 403);
    }
    if (child.status !== 'approved' || !child.isActive) {
      throw new AppError('Selected buyer is not active', 400);
    }
    return true;
  }

  throw new AppError('You cannot place orders for this user', 403);
};

/**
 * Resolve buyer for pricing / order ownership.
 * buyerId omitted or equals self → req.user
 * Salesman must always order as an assigned partner (no self-order).
 */
const resolveBuyer = async (requester, buyerId) => {
  if (requester.role === 'salesman') {
    if (!buyerId || String(buyerId) === String(requester._id)) {
      throw new AppError('Select an assigned partner to place an order', 400, 'BUYER_REQUIRED');
    }
    const child = await User.findById(buyerId);
    if (!child) throw new AppError('Buyer not found', 404);
    assertCanOrderAs(requester, child);
    return { buyer: child, placedBy: requester._id };
  }

  if (!buyerId || String(buyerId) === String(requester._id)) {
    return { buyer: requester, placedBy: null };
  }

  const child = await User.findById(buyerId);
  if (!child) throw new AppError('Buyer not found', 404);
  assertCanOrderAs(requester, child);
  return { buyer: child, placedBy: requester._id };
};

const listNetworkChildren = async (user) => {
  if (user.role === 'salesman') {
    const ids = user.assignedPartners || [];
    if (!ids.length) return [];
    return User.find({
      _id: { $in: ids },
      status: 'approved',
      isActive: true,
      ...(user.assignmentPartnerType ? { role: user.assignmentPartnerType } : {}),
    })
      .select(NETWORK_SELECT)
      .sort({ name: 1 });
  }

  if (user.role === 'stockist') {
    return User.find({
      role: 'distributor',
      assignedStockist: user._id,
      status: 'approved',
      isActive: true,
    })
      .select(NETWORK_SELECT)
      .sort({ name: 1 });
  }
  if (user.role === 'distributor') {
    return User.find({
      role: { $in: ['retailer', 'reseller'] },
      assignedDistributor: user._id,
      status: 'approved',
      isActive: true,
    })
      .select(NETWORK_SELECT)
      .sort({ name: 1 });
  }
  return [];
};

module.exports = {
  assertCanOrderAs,
  resolveBuyer,
  listNetworkChildren,
};
