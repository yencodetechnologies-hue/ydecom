require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');

const run = async () => {
  await connectDB();

  const products = await Product.find({});
  let migrated = 0;

  for (const product of products) {
    const needsBackfill = (product.stockBatches || []).some((b) => b.cost === undefined);
    if (!needsBackfill) continue;

    product.stockBatches = (product.stockBatches || []).map((b) => ({
      cost: product.cost || 0,
      tax: product.tax || 0,
      mrp: product.mrp || 0,
      qty: b.qty,
      createdAt: b.createdAt,
    }));
    product.markModified('stockBatches');
    await product.save();
    migrated += 1;
  }

  console.log(`Backfilled batch pricing on ${migrated} product(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
