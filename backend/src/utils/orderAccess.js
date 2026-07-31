/**
 * Populate-safe supplier id from an order document.
 */
const orderSupplierId = (order) => {
  if (!order?.supplier) return null;
  return order.supplier._id || order.supplier;
};

/**
 * Admin on admin channel, or stockist who is the order's supplier on stockist channel.
 */
const isOrderSupplier = (order, user) => {
  if (!order || !user) return false;
  const supplySource = order.supplySource || 'admin';
  if (user.role === 'admin' && supplySource === 'admin') return true;
  const supplierId = orderSupplierId(order);
  if (
    user.role === 'stockist' &&
    supplySource === 'stockist' &&
    supplierId &&
    String(supplierId) === String(user._id)
  ) {
    return true;
  }
  return false;
};

module.exports = {
  orderSupplierId,
  isOrderSupplier,
};
