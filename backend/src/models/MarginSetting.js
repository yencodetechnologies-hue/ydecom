const mongoose = require('mongoose');

const MARGIN_ROLES = ['stockist', 'distributor', 'retailer', 'reseller'];

const marginSettingSchema = new mongoose.Schema(
  {
    role: { type: String, enum: MARGIN_ROLES, required: true, unique: true },
    type: { type: String, enum: ['fixed', 'percentage'], default: 'percentage' },
    basis: { type: String, enum: ['cost', 'mrp'], default: 'cost' },
    value: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MarginSetting', marginSettingSchema);
module.exports.MARGIN_ROLES = MARGIN_ROLES;
