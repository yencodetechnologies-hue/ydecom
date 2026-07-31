const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    stock: { type: Number, min: 0, default: 0 },
    /** Alert owner when stock drops below this. 0 = disabled. */
    minRackQty: { type: Number, min: 0, default: 0 },
    /** Prevents repeat low-stock alerts until stock recovers to >= minRackQty. */
    lowStockNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

inventorySchema.index({ owner: 1, product: 1 }, { unique: true });
inventorySchema.index({ owner: 1 });

inventorySchema.methods.credit = function credit(qty) {
  const amount = Number(qty) || 0;
  if (amount < 1) throw new Error('Invalid quantity');
  this.stock += amount;
};

inventorySchema.methods.deplete = function deplete(qty) {
  const amount = Number(qty) || 0;
  if (amount < 1) throw new Error('Invalid quantity');
  if (this.stock < amount) throw new Error('Insufficient stock');
  this.stock -= amount;
};

module.exports = mongoose.model('Inventory', inventorySchema);
