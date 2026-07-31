require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { generateCustomerId, seedCountersFromExisting } = require('../services/customerIdService');

const run = async () => {
  await connectDB();

  await seedCountersFromExisting();

  const customers = await User.find({
    role: 'customer',
    $or: [{ customerId: { $exists: false } }, { customerId: '' }, { customerId: null }],
  }).sort({ createdAt: 1 });

  let migrated = 0;

  for (const customer of customers) {
    customer.customerId = await generateCustomerId(customer.name);
    await customer.save();
    migrated += 1;
    console.log(`Assigned ${customer.customerId} to ${customer.name}`);
  }

  console.log(`Backfilled customer IDs for ${migrated} customer(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
