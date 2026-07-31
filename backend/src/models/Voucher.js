const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, default: '', trim: true },
    /** Manual: customer types the code. Auto: unlocked once cumulative spend hits qualifyingPurchaseAmount. */
    voucherMode: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual',
    },
    /** Auto mode only: cumulative customer spend required to unlock this voucher. */
    qualifyingPurchaseAmount: { type: Number, min: 0, default: null },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    value: { type: Number, required: true, min: 0 },
    /** Max discount cap when type is percentage. */
    maxDiscount: { type: Number, min: 0, default: null },
    minOrderAmount: { type: Number, min: 0, default: 0 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    usageLimit: { type: Number, min: 0, default: null },
    usedCount: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    /** Roles allowed to use this voucher. Defaults to customers only. */
    applicableRoles: {
      type: [String],
      enum: ['customer', 'retailer', 'reseller', 'distributor', 'stockist'],
      default: ['customer'],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Voucher', voucherSchema);
