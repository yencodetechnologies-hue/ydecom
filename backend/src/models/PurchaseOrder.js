const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    stockist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [poItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'dispatched', 'received', 'rejected', 'cancelled'],
      default: 'draft',
    },
    notes: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    statusHistory: [
      {
        status: String,
        note: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ stockist: 1, createdAt: -1 });
purchaseOrderSchema.index({ status: 1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
