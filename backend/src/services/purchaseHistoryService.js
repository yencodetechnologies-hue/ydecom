const Order = require('../models/Order');

/**
 * Product IDs the distributor has purchased (paid orders only).
 * Returns a Set of string product IDs for O(1) lookup in list endpoints.
 */
const getPurchasedProductIds = async (userId) => {
  if (!userId) return new Set();

  const rows = await Order.aggregate([
    {
      $match: {
        user: userId,
        paymentStatus: 'paid',
      },
    },
    { $unwind: '$items' },
    { $group: { _id: '$items.product' } },
  ]);

  return new Set(rows.map((r) => String(r._id)));
};

module.exports = {
  getPurchasedProductIds,
};
