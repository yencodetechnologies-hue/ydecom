const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    itemCode: { type: String, trim: true, default: '' },
    cbm: { type: String, trim: true, default: '' },
    brand: { type: String, trim: true, default: '' },
    manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, default: '' },
    images: [{ type: String }],
    purchaseTax: { type: Number, min: 0, default: 0 },
    salesTax: { type: Number, min: 0, default: 0 },
    // Each batch carries its own purchase economics + quantity (oldest first = FIFO).
    // Top-level cost/tax/netCost/mrp/customerPrice/stock below are always derived
    // from these batches on save — never set them directly.
    stockBatches: [
      {
        cost: { type: Number, required: true, min: 0 },
        tax: { type: Number, min: 0, default: 0 },
        netCost: { type: Number, min: 0 },
        mrp: { type: Number, required: true, min: 0 },
        qty: { type: Number, required: true, min: 0 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    cost: { type: Number, min: 0, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    netCost: { type: Number, min: 0, default: 0 },
    mrp: { type: Number, min: 0, default: 0 },
    customerPrice: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    minQuantity: { type: Number, min: 1, default: 1 },
    moq: { type: Number, min: 1, default: 1 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    priceVisible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', brand: 'text', sku: 'text' });

// Recomputes per-batch netCost, drops exhausted batches, resums stock, and syncs
// the product-level cost/tax/netCost/mrp/customerPrice from the oldest remaining
// batch (the one currently being sold — FIFO front).
productSchema.pre('save', function syncFromBatches() {
  if (!this.isModified('stockBatches') && !this.isNew) return;

  this.stockBatches = (this.stockBatches || [])
    .map((b) => {
      const cost = Number(b.cost) || 0;
      const tax = Number(b.tax) || 0;
      const netCost = Math.round(cost * (1 + tax / 100) * 100) / 100;
      return {
        _id: b._id,
        cost,
        tax,
        netCost,
        mrp: Number(b.mrp) || 0,
        qty: Number(b.qty) || 0,
        createdAt: b.createdAt || new Date(),
      };
    })
    .filter((b) => b.qty > 0);

  this.stock = this.stockBatches.reduce((sum, b) => sum + b.qty, 0);

  const active = this.stockBatches[0];
  if (active) {
    this.cost = active.cost;
    this.tax = active.tax;
    this.netCost = active.netCost;
    this.mrp = active.mrp;
    this.customerPrice = active.mrp;
  }
});

/** Depletes the oldest batches first; throws if total stock is insufficient. */
productSchema.methods.depleteStock = function depleteStock(qty) {
  let remaining = qty;
  const batches = [...(this.stockBatches || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.qty, remaining);
    batch.qty -= take;
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error('Insufficient stock');
  }
  this.stockBatches = batches;
  this.markModified('stockBatches');
};

module.exports = mongoose.model('Product', productSchema);
