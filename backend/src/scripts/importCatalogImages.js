require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { uploadProductImages, uploadCategoryImage } = require('../services/cloudinaryService');

const XLSX_PATH = path.join(__dirname, '../../assts/product.xlsx');
const EXTRACT_DIR = path.join(__dirname, '../../../scratch_xlsx');
const MEDIA_DIR = path.join(EXTRACT_DIR, 'xl/media');

const CATEGORY_GROUPS = [
  { name: 'Birthday', nameCol: 0, imgCols: [0, 1] },
  { name: 'Household', nameCol: 2, imgCols: [2, 3] },
];

const toTitleCase = (str) =>
  str
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const parseRowHeights = () => {
  const sheetXml = fs.readFileSync(path.join(EXTRACT_DIR, 'xl/worksheets/sheet1.xml'), 'utf8');
  const rowHeights = {};
  const defaultHt = 15.0;
  [...sheetXml.matchAll(/<row r="(\d+)"([^>]*)>/g)].forEach((m) => {
    const idx = +m[1] - 1;
    const htMatch = m[2].match(/ht="([\d.]+)"/);
    rowHeights[idx] = (htMatch ? +htMatch[1] : defaultHt) * 12700;
  });
  return (row) => {
    let sum = 0;
    for (let i = 0; i < row; i += 1) sum += rowHeights[i] !== undefined ? rowHeights[i] : defaultHt * 12700;
    return sum;
  };
};

const parseAnchors = (cumHeight) => {
  const xml = fs.readFileSync(path.join(EXTRACT_DIR, 'xl/drawings/drawing1.xml'), 'utf8');
  const rels = fs.readFileSync(path.join(EXTRACT_DIR, 'xl/drawings/_rels/drawing1.xml.rels'), 'utf8');
  const relMap = {};
  [...rels.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="([^"]+)"/g)].forEach((m) => {
    relMap[m[1]] = m[2];
  });

  return [...xml.matchAll(/<xdr:(oneCellAnchor|twoCellAnchor)>.*?<\/xdr:\1>/gs)].map((a) => {
    const block = a[0];
    const from = (block.match(/<xdr:from>(.*?)<\/xdr:from>/s) || [, block])[1];
    const col = +(from.match(/<xdr:col>(\d+)<\/xdr:col>/) || [, 0])[1];
    const row = +(from.match(/<xdr:row>(\d+)<\/xdr:row>/) || [, 0])[1];
    const rowOff = +(from.match(/<xdr:rowOff>(\d+)<\/xdr:rowOff>/) || [, 0])[1];
    const rId = (block.match(/r:embed="(rId\d+)"/) || [, null])[1];
    return {
      col,
      abs: cumHeight(row) + rowOff,
      file: rId ? relMap[rId].replace('../media/', '') : null,
    };
  });
};

const run = async () => {
  await connectDB();

  const cumHeight = parseRowHeights();
  const anchors = parseAnchors(cumHeight);

  const wb = XLSX.readFile(XLSX_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

  let uploaded = 0;
  let notFound = 0;

  for (const group of CATEGORY_GROUPS) {
    const names = rows
      .slice(1)
      .map((r) => (r[group.nameCol] ?? '').toString().trim())
      .filter(Boolean);

    const sorted = anchors
      .filter((a) => group.imgCols.includes(a.col))
      .sort((a, b) => a.abs - b.abs);

    const headerImage = sorted[0];
    const productImages = sorted.slice(1, 1 + names.length); // drop header, cap to name count

    const category = await Category.findOne({ name: group.name });
    if (category && headerImage && !category.image) {
      const buffer = fs.readFileSync(path.join(MEDIA_DIR, headerImage.file));
      const url = await uploadCategoryImage({ buffer });
      category.image = url;
      await category.save();
      console.log(`Category image set: ${group.name}`);
    }

    for (let i = 0; i < names.length; i += 1) {
      const displayName = toTitleCase(names[i]);
      const imageEntry = productImages[i];
      if (!imageEntry) continue;

      const product = await Product.findOne({ name: displayName, category: category?._id });
      if (!product) {
        notFound += 1;
        continue;
      }
      if (product.images?.length) continue; // already has an image, skip

      const buffer = fs.readFileSync(path.join(MEDIA_DIR, imageEntry.file));
      const [url] = await uploadProductImages([{ buffer }]);
      product.images = [url];
      await product.save();
      uploaded += 1;
      console.log(`Uploaded ${uploaded}: ${displayName}`);
    }
  }

  console.log(`Done. Uploaded ${uploaded} product images, ${notFound} products not found.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Image import failed:', err);
  process.exit(1);
});
