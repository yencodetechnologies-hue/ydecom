/**
 * Removes seeded dummy B2B users and all orders/inventory/POs.
 * Keeps products (and catalog). Does not delete real partner registrations
 * unless they use *@ydecom.test emails.
 *
 * Usage: node src/scripts/clearDummyBusinessData.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const PurchaseOrder = require('../models/PurchaseOrder');
const OrderReturn = require('../models/OrderReturn');
const Notification = require('../models/Notification');
const Wishlist = require('../models/Wishlist');
const ProductInterest = require('../models/ProductInterest');

const run = async () => {
  await connectDB();

  const dummyUsers = await User.find({
    email: /@ydecom\.test$/i,
  }).select('_id email role name');

  const dummyIds = dummyUsers.map((u) => u._id);

  console.log(`Found ${dummyUsers.length} seeded dummy user(s) to remove:`);
  dummyUsers.forEach((u) => console.log(`  - ${u.role}: ${u.email}`));

  const [orders, inventory, pos, returns, notifications, wishlists, interests, users] =
    await Promise.all([
      Order.deleteMany({}),
      Inventory.deleteMany({}),
      PurchaseOrder.deleteMany({}),
      OrderReturn.deleteMany({}),
      dummyIds.length
        ? Notification.deleteMany({ user: { $in: dummyIds } })
        : Promise.resolve({ deletedCount: 0 }),
      dummyIds.length
        ? Wishlist.deleteMany({ user: { $in: dummyIds } })
        : Promise.resolve({ deletedCount: 0 }),
      dummyIds.length
        ? ProductInterest.deleteMany({ user: { $in: dummyIds } })
        : Promise.resolve({ deletedCount: 0 }),
      dummyIds.length
        ? User.deleteMany({ _id: { $in: dummyIds } })
        : Promise.resolve({ deletedCount: 0 }),
    ]);

  if (dummyIds.length) {
    await User.updateMany(
      { assignedStockist: { $in: dummyIds } },
      { $unset: { assignedStockist: 1 } }
    );
    await User.updateMany(
      { assignedDistributor: { $in: dummyIds } },
      { $unset: { assignedDistributor: 1 } }
    );
    await User.updateMany(
      { assignedPartners: { $in: dummyIds } },
      { $pullAll: { assignedPartners: dummyIds } }
    );
  }

  console.log('Cleanup complete (products kept):');
  console.log(`  Orders: ${orders.deletedCount}`);
  console.log(`  Inventory: ${inventory.deletedCount}`);
  console.log(`  Purchase orders: ${pos.deletedCount}`);
  console.log(`  Order returns: ${returns.deletedCount}`);
  console.log(`  Notifications: ${notifications.deletedCount}`);
  console.log(`  Wishlists: ${wishlists.deletedCount}`);
  console.log(`  Product interests: ${interests.deletedCount}`);
  console.log(`  Users: ${users.deletedCount}`);

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
