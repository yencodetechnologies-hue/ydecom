require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');

const run = async () => {
  await connectDB();

  const result = await Product.collection.updateMany(
    { basePrice: { $exists: true } },
    [
      {
        $set: {
          cost: '$basePrice',
          tax: 0,
          netCost: '$basePrice',
        },
      },
      { $unset: 'basePrice' },
    ]
  );

  console.log(`Migrated ${result.modifiedCount} product(s) from basePrice to cost/tax/netCost.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
