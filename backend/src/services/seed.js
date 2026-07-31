const path = require('path');
// Only load .env when this file is run directly (npm run seed). App startup already loads .env.
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Order = require('../models/Order');
const MarginSetting = require('../models/MarginSetting');
const { MARGIN_ROLES } = require('../models/MarginSetting');

const STATUS_MAP = {
  pending: 'ordered',
  processing: 'order_packed',
  shipped: 'dispatched',
  cancelled: 'ordered',
};

const migrateOrderStatuses = async () => {
  // B2B stockist/distributor orders awaiting supplier review use status "pending"
  // with paymentStatus "unpaid" — do not migrate those to "ordered".
  const restoreReviewOrders = await Order.updateMany(
    {
      status: 'ordered',
      paymentStatus: 'unpaid',
      invoiceFinalized: { $ne: true },
    },
    { $set: { status: 'pending' } }
  );
  if (restoreReviewOrders.modifiedCount) {
    console.log(
      `Restored ${restoreReviewOrders.modifiedCount} B2B order(s) to pending review status`
    );
  }

  const ops = [
    Order.updateMany(
      { status: 'pending', paymentStatus: { $ne: 'unpaid' } },
      { $set: { status: 'ordered' } }
    ),
    Order.updateMany({ status: 'processing' }, { $set: { status: 'order_packed' } }),
    Order.updateMany({ status: 'shipped' }, { $set: { status: 'dispatched' } }),
    Order.updateMany({ status: 'cancelled' }, { $set: { status: 'ordered' } }),
  ];
  const results = await Promise.all(ops);
  const modified = results.reduce((sum, r) => sum + (r.modifiedCount || 0), 0);
  if (modified) {
    console.log(`Migrated ${modified} order status(es) to new pipeline`);
  }

  // One-time: legacy paid orders already got inventory at payment time (field absent on old docs).
  const credited = await Order.updateMany(
    { paymentStatus: 'paid', inventoryCredited: { $exists: false } },
    { $set: { inventoryCredited: true } }
  );
  if (credited.modifiedCount) {
    console.log(
      `Marked ${credited.modifiedCount} legacy paid order(s) as inventoryCredited`
    );
  }

  for (const [from, to] of Object.entries(STATUS_MAP)) {
    await Order.updateMany(
      { 'statusHistory.status': from },
      { $set: { 'statusHistory.$[elem].status': to } },
      { arrayFilters: [{ 'elem.status': from }] }
    );
  }
};

const seedAdminAndMargins = async () => {
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (!existingAdmin) {
    await User.create({
      name: 'Admin',
      mobile: '9999999999',
      email: 'admin@gmail.com',
      password: '123456',
      role: 'admin',
      status: 'approved',
      emailVerified: true,
      isActive: true,
    });
    console.log('Default admin created: admin@gmail.com / 123456');
  }

  for (const role of MARGIN_ROLES) {
    const exists = await MarginSetting.findOne({ role });
    if (!exists) {
      await MarginSetting.create({ role, type: 'percentage', value: 0 });
    }
  }

  await seedDummyBusinessUsers();
  await migrateOrderStatuses();
};

const DUMMY_PASSWORD = '123456';

const upsertDummyUser = async (email, data) => {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, password: DUMMY_PASSWORD, ...data });
    console.log(`Dummy ${data.role} created: ${email} / ${DUMMY_PASSWORD}`);
  }
  return user;
};

const seedDummyBusinessUsers = async () => {
  const stockists = [];
  for (let i = 1; i <= 3; i += 1) {
    const email = `stockist${i}@ydecom.test`;
    const user = await upsertDummyUser(email, {
      name: `Stockist ${i}`,
      mobile: `910000000${i}`,
      role: 'stockist',
      status: 'approved',
      emailVerified: true,
      isActive: true,
      gstNumber: `29AABCS000${i}A1Z${i}`,
      panNumber: `AABCS000${i}A`,
      shopName: `Stockist Shop ${i}`,
      shopAddress: `${i} Stockist Market Road, City`,
      shopPhone: `910000000${i}`,
      businessEmail: email,
      marginType: 'percentage',
      marginBasis: 'cost',
      marginValue: 5 + i,
      creditLimit: 500000,
      stockAllocationPercent: 100,
    });
    stockists.push(user);
  }

  const distributors = [];
  for (let i = 1; i <= 3; i += 1) {
    const email = `distributor${i}@ydecom.test`;
    const user = await upsertDummyUser(email, {
      name: `Distributor ${i}`,
      mobile: `920000000${i}`,
      role: 'distributor',
      status: 'approved',
      emailVerified: true,
      isActive: true,
      gstNumber: `29AABCD000${i}A1Z${i}`,
      panNumber: `AABCD000${i}A`,
      shopName: `Distributor Hub ${i}`,
      shopAddress: `${i} Distributor Trade Lane, City`,
      shopPhone: `920000000${i}`,
      businessEmail: email,
      marginType: 'percentage',
      marginBasis: 'cost',
      marginValue: 10 + i,
      creditLimit: 200000,
      assignedStockist: stockists[i - 1]._id,
    });
    distributors.push(user);
  }

  const retailers = [];
  for (let i = 1; i <= 3; i += 1) {
    const email = `retailer${i}@ydecom.test`;
    const user = await upsertDummyUser(email, {
      name: `Retailer ${i}`,
      mobile: `930000000${i}`,
      role: 'retailer',
      status: 'approved',
      emailVerified: true,
      isActive: true,
      gstNumber: `29AABCR000${i}A1Z${i}`,
      panNumber: `AABCR000${i}A`,
      shopName: `Retail Store ${i}`,
      shopAddress: `${i} Retail Main Street, City`,
      shopPhone: `930000000${i}`,
      businessEmail: email,
      marginType: 'percentage',
      marginBasis: 'cost',
      marginValue: 15 + i,
      creditLimit: 50000,
      assignedDistributor: distributors[i - 1]._id,
    });
    retailers.push(user);
  }

  for (let i = 1; i <= 3; i += 1) {
    const email = `reseller${i}@ydecom.test`;
    await upsertDummyUser(email, {
      name: `Reseller ${i}`,
      mobile: `940000000${i}`,
      role: 'reseller',
      status: 'approved',
      emailVerified: true,
      isActive: true,
      panNumber: `AABCE000${i}A`,
      aadhaarNumber: `12345678901${i}`,
      shopName: `Reseller Stall ${i}`,
      shopAddress: `${i} Reseller Lane, City`,
      shopPhone: `940000000${i}`,
      businessEmail: email,
      marginType: 'percentage',
      marginBasis: 'cost',
      marginValue: 12 + i,
      creditLimit: 25000,
      assignedDistributor: distributors[i - 1]._id,
    });
  }

  for (let i = 1; i <= 3; i += 1) {
    const email = `salesman${i}@ydecom.test`;
    const partnerType = i === 1 ? 'distributor' : i === 2 ? 'retailer' : 'stockist';
    const partners =
      partnerType === 'distributor'
        ? [distributors[0]._id, distributors[1]._id]
        : partnerType === 'retailer'
          ? [retailers[0]._id, retailers[1]._id]
          : [stockists[0]._id];

    await upsertDummyUser(email, {
      name: `Salesman ${i}`,
      mobile: `950000000${i}`,
      role: 'salesman',
      status: 'approved',
      emailVerified: true,
      isActive: true,
      panNumber: `AABCM000${i}A`,
      aadhaarNumber: `98765432109${i}`,
      drivingLicenseNumber: `DL0${i}20240000${i}`,
      aadhaarFrontUrl: 'https://placehold.co/400x250?text=Aadhaar+Front',
      aadhaarBackUrl: 'https://placehold.co/400x250?text=Aadhaar+Back',
      panFrontUrl: 'https://placehold.co/400x250?text=PAN',
      drivingLicenseFrontUrl: 'https://placehold.co/400x250?text=DL+Front',
      drivingLicenseBackUrl: 'https://placehold.co/400x250?text=DL+Back',
      assignmentPartnerType: partnerType,
      assignedPartners: partners,
    });
  }
};

const runSeed = async () => {
  await connectDB();
  await seedAdminAndMargins();
  await mongoose.connection.close();
  console.log('Seed completed');
};

if (require.main === module) {
  runSeed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = seedAdminAndMargins;
