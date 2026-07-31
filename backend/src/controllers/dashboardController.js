const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const Manufacturer = require('../models/Manufacturer');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');

const STATUS_KEYS = ['pending', 'approved', 'rejected'];
const ORDER_STATUS_KEYS = ['ordered', 'order_packed', 'dispatched', 'delivered'];
/** Stockist dashboard: pending includes open review + ordered-not-yet-packed. */
const STOCKIST_ORDER_STATUS_KEYS = ['pending', 'order_packed', 'dispatched', 'delivered'];
const PARTNER_ROLES = ['stockist', 'distributor', 'retailer', 'reseller', 'salesman', 'customer'];

const emptyStatusCounts = () => ({ pending: 0, approved: 0, rejected: 0 });
const emptyOrderStatusCounts = () =>
  Object.fromEntries(ORDER_STATUS_KEYS.map((key) => [key, 0]));
const emptyStockistOrderStatusCounts = () =>
  Object.fromEntries(STOCKIST_ORDER_STATUS_KEYS.map((key) => [key, 0]));

const buildStatusMap = (aggRows) => {
  const byRole = Object.fromEntries(PARTNER_ROLES.map((role) => [role, emptyStatusCounts()]));
  for (const row of aggRows) {
    const role = row._id?.role;
    const status = row._id?.status;
    if (byRole[role] && STATUS_KEYS.includes(status)) {
      byRole[role][status] = row.count;
    }
  }
  return byRole;
};

const totalFromStatus = (byStatus) =>
  STATUS_KEYS.reduce((sum, key) => sum + (byStatus?.[key] || 0), 0);

const fillStockistOrderStatusCounts = (aggRows) => {
  const byStatus = emptyStockistOrderStatusCounts();
  let total = 0;
  for (const row of aggRows) {
    total += row.count;
    if (row._id === 'pending' || row._id === 'ordered') {
      byStatus.pending += row.count;
    } else if (STOCKIST_ORDER_STATUS_KEYS.includes(row._id)) {
      byStatus[row._id] = row.count;
    }
  }
  return { byStatus, total };
};

const getStats = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';

  if (req.user.role === 'stockist') {
    const userId = req.user._id;
    const myOrdersMatch = { user: userId };
    const distributorOrdersMatch = { supplier: userId, supplySource: 'stockist' };

    const [
      inventoryProducts,
      myOrderStatusAgg,
      distributorOrderStatusAgg,
      outstandingAgg,
      recentOrders,
    ] = await Promise.all([
      Inventory.countDocuments({ owner: userId }),
      Order.aggregate([
        { $match: myOrdersMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: distributorOrdersMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $match: {
            ...distributorOrdersMatch,
            paymentStatus: { $in: ['unpaid', 'pending', 'failed'] },
          },
        },
        {
          $group: {
            _id: null,
            amount: {
              $sum: { $subtract: ['$subtotal', { $ifNull: ['$voucherDiscount', 0] }] },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Order.find(myOrdersMatch).sort({ createdAt: -1 }).limit(10),
    ]);

    const myOrders = fillStockistOrderStatusCounts(myOrderStatusAgg);
    const distributorOrders = fillStockistOrderStatusCounts(distributorOrderStatusAgg);
    const outstanding = outstandingAgg[0] || { amount: 0, count: 0 };

    return sendResponse(res, {
      data: {
        inventoryProducts,
        myOrdersTotal: myOrders.total,
        myOrdersByStatus: myOrders.byStatus,
        distributorOrdersTotal: distributorOrders.total,
        distributorOrdersByStatus: distributorOrders.byStatus,
        outstandingAmount: Math.max(0, Math.round((outstanding.amount || 0) * 100) / 100),
        outstandingOrders: outstanding.count || 0,
        recentOrders,
      },
    });
  }

  if (!isAdmin) {
    const myOrders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10);
    const orderStats = await Order.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$subtotal' } } },
    ]);
    const totalOrders = await Order.countDocuments({ user: req.user._id });
    const totalSpent = myOrders.reduce((s, o) => s + o.subtotal, 0);

    return sendResponse(res, {
      data: {
        totalOrders,
        totalSpent,
        orderStats,
        recentOrders: myOrders,
        totalProducts: await Product.countDocuments({ status: 'active' }),
      },
    });
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  // Admin dashboard tracks admin-fulfilled orders only (not stockist→distributor).
  const adminOrderFilter = { supplySource: 'admin' };

  const [
    recentOrders,
    usersByRole,
    monthlySales,
    partnersStatusAgg,
    manufacturerAgg,
    productStatusAgg,
    categoryStatusAgg,
    orderStatusAgg,
  ] = await Promise.all([
    Order.find(adminOrderFilter).populate('user', 'name mobile role').sort({ createdAt: -1 }).limit(8),
    User.aggregate([
      { $match: { role: { $ne: 'admin' } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...adminOrderFilter, createdAt: { $gte: startOfYear } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          sales: { $sum: '$subtotal' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $match: { role: { $in: PARTNER_ROLES } } },
      { $group: { _id: { role: '$role', status: '$status' }, count: { $sum: 1 } } },
    ]),
    Manufacturer.aggregate([{ $group: { _id: '$isActive', count: { $sum: 1 } } }]),
    Product.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Category.aggregate([{ $group: { _id: '$isActive', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: adminOrderFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const byRole = buildStatusMap(partnersStatusAgg);

  const manufacturersByStatus = emptyStatusCounts();
  let totalManufacturers = 0;
  for (const row of manufacturerAgg) {
    totalManufacturers += row.count;
    if (row._id === true) manufacturersByStatus.approved = row.count;
    else manufacturersByStatus.rejected = row.count;
  }

  const productsByStatus = { active: 0, inactive: 0 };
  let totalProducts = 0;
  for (const row of productStatusAgg) {
    totalProducts += row.count;
    if (row._id === 'active') productsByStatus.active = row.count;
    else if (row._id === 'inactive') productsByStatus.inactive = row.count;
  }

  const categoriesByStatus = { active: 0, inactive: 0 };
  let totalCategories = 0;
  for (const row of categoryStatusAgg) {
    totalCategories += row.count;
    if (row._id === true) categoriesByStatus.active = row.count;
    else categoriesByStatus.inactive = row.count;
  }

  const ordersByStatus = emptyOrderStatusCounts();
  let totalOrders = 0;
  for (const row of orderStatusAgg) {
    totalOrders += row.count;
    if (ORDER_STATUS_KEYS.includes(row._id)) {
      ordersByStatus[row._id] = row.count;
    }
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthly = monthNames.map((name, idx) => {
    const found = monthlySales.find((m) => m._id === idx + 1);
    return { month: name, sales: found?.sales || 0, orders: found?.orders || 0 };
  });

  const thisMonth = monthly[now.getMonth()];

  sendResponse(res, {
    data: {
      totalManufacturers,
      manufacturersByStatus,
      totalStockists: totalFromStatus(byRole.stockist),
      stockistsByStatus: byRole.stockist,
      totalDistributors: totalFromStatus(byRole.distributor),
      distributorsByStatus: byRole.distributor,
      totalRetailers: totalFromStatus(byRole.retailer),
      retailersByStatus: byRole.retailer,
      totalResellers: totalFromStatus(byRole.reseller),
      resellersByStatus: byRole.reseller,
      totalSalesmen: totalFromStatus(byRole.salesman),
      salesmenByStatus: byRole.salesman,
      totalCustomers: totalFromStatus(byRole.customer),
      customersByStatus: byRole.customer,
      totalProducts,
      productsByStatus,
      totalCategories,
      categoriesByStatus,
      totalOrders,
      ordersByStatus,
      monthlySalesAmount: thisMonth.sales,
      recentOrders,
      usersByRole,
      monthlySales: monthly,
    },
  });
});

module.exports = { getStats };
