require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');

const FILE_PATH = path.join(__dirname, '../../assts/product.xlsx');

// { category name, source column index in the sheet }
const CATEGORY_COLUMNS = [
  { name: 'Birthday', col: 0 },
  { name: 'Household', col: 2 },
];

const toTitleCase = (str) =>
  str
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const skuPrefix = (name) =>
  name
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 4)
    .toUpperCase() || 'PRD';

// Deterministic-looking "dummy" price spread so re-runs are stable per product name.
const dummyCost = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return 20 + (hash % 480); // 20 - 499
};

const run = async () => {
  await connectDB();

  const wb = XLSX.readFile(FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let created = 0;
  let skipped = 0;

  for (const { name: categoryName, col } of CATEGORY_COLUMNS) {
    const category = await Category.findOneAndUpdate(
      { name: categoryName },
      { $setOnInsert: { name: categoryName, isActive: true } },
      { upsert: true, new: true }
    );

    const productNames = rows
      .slice(1)
      .map((r) => (r[col] ?? '').toString().trim())
      .filter(Boolean);

    const uniqueNames = [...new Set(productNames)];

    for (let i = 0; i < uniqueNames.length; i += 1) {
      const rawName = uniqueNames[i];
      const displayName = toTitleCase(rawName);
      const sku = `${skuPrefix(categoryName)}-${skuPrefix(rawName)}-${String(i + 1).padStart(3, '0')}`;

      const exists = await Product.findOne({ sku });
      if (exists) {
        skipped += 1;
        continue;
      }

      const cost = dummyCost(rawName);
      const mrp = Math.round(cost * 1.2 * 100) / 100;

      await Product.create({
        name: displayName,
        sku,
        category: category._id,
        description: '',
        images: [],
        cost,
        tax: 0,
        mrp,
        customerPrice: mrp,
        stock: 50,
        status: 'active',
        priceVisible: true,
      });
      created += 1;
    }
  }

  console.log(`Imported ${created} products, skipped ${skipped} already-existing.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
