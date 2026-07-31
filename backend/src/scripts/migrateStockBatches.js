require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');

const run = async () => {
  await connectDB();

  const products = await Product.find({
    $or: [{ stockBatches: { $exists: false } }, { stockBatches: { $size: 0 } }],
  });

  let migrated = 0;
  for (const product of products) {
    product.stockBatches = [{ qty: product.stock || 0, createdAt: product.createdAt || new Date() }];
    product.markModified('stockBatches');
    await product.save();
    migrated += 1;
  }

  console.log(`Migrated ${migrated} product(s) into a single stock batch.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
