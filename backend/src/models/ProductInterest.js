const mongoose = require('mongoose');

const productInterestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, min: 1, default: 1 },
    type: {
      type: String,
      enum: ['out_of_stock', 'first_purchase'],
      default: 'out_of_stock',
    },
    placedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

productInterestSchema.index({ user: 1, product: 1 }, { unique: true });
productInterestSchema.index({ user: 1 });
productInterestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ProductInterest', productInterestSchema);
