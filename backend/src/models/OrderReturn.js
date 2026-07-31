const mongoose = require('mongoose');

const ISSUE_TYPES = ['damaged', 'wrong_item', 'expired', 'quality_issue', 'other'];
const RETURN_STATUSES = ['requested', 'approved', 'pickup_done', 'rejected', 'cancelled'];

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    issueType: { type: String, enum: ISSUE_TYPES, required: true },
    issueNote: { type: String, default: '' },
  },
  { _id: false }
);

const orderReturnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    supplySource: {
      type: String,
      enum: ['admin', 'stockist', 'distributor'],
      required: true,
    },
    items: { type: [returnItemSchema], required: true },
    image: { type: String, default: '' },
    status: {
      type: String,
      enum: RETURN_STATUSES,
      default: 'requested',
    },
    creditAmount: { type: Number, min: 0, default: 0 },
    creditApplied: { type: Boolean, default: false },
    note: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    pickupDoneAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    statusHistory: [
      {
        status: String,
        note: { type: String, default: '' },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

orderReturnSchema.index({ buyer: 1, createdAt: -1 });
orderReturnSchema.index({ supplier: 1, createdAt: -1 });
orderReturnSchema.index({ order: 1 });
orderReturnSchema.index({ status: 1 });

module.exports = mongoose.model('OrderReturn', orderReturnSchema);
module.exports.ISSUE_TYPES = ISSUE_TYPES;
module.exports.RETURN_STATUSES = RETURN_STATUSES;
