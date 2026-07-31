const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['admin', 'customer', 'retailer', 'reseller', 'distributor', 'stockist', 'salesman'];
const STATUSES = ['pending', 'approved', 'rejected'];
const ASSIGNMENT_PARTNER_TYPES = ['stockist', 'distributor', 'retailer'];

const addressSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home',
    },
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: STATUSES, default: 'pending' },
    /** Set true after email OTP verification (existing accounts default true). */
    emailVerified: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    /** When false, this user cannot see product prices (admin-controlled per account). */
    priceVisible: { type: Boolean, default: true },
    /** Customer-only: auto-generated 8-char ID (e.g. JEY00001). */
    customerId: { type: String, trim: true, uppercase: true },
    /** Customer-only: % off MRP applied to selling price when this user is logged in. */
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    gstNumber: { type: String, trim: true, default: '' },
    panNumber: { type: String, trim: true, default: '' },
    shopName: { type: String, trim: true, default: '' },
    shopAddress: { type: String, trim: true, default: '' },
    shopPhone: { type: String, trim: true, default: '' },
    businessEmail: { type: String, trim: true, lowercase: true, default: '' },
    /** Salesman KYC */
    aadhaarNumber: { type: String, trim: true, default: '' },
    aadhaarFrontUrl: { type: String, trim: true, default: '' },
    aadhaarBackUrl: { type: String, trim: true, default: '' },
    panFrontUrl: { type: String, trim: true, default: '' },
    drivingLicenseNumber: { type: String, trim: true, default: '' },
    drivingLicenseFrontUrl: { type: String, trim: true, default: '' },
    drivingLicenseBackUrl: { type: String, trim: true, default: '' },
    /**
     * Salesman territory: one partner type, many partners of that type.
     * Admin sets after approval; salesman places orders as these buyers.
     */
    assignmentPartnerType: {
      type: String,
      enum: [...ASSIGNMENT_PARTNER_TYPES, null],
      default: null,
    },
    assignedPartners: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** Saved delivery addresses (Swiggy-style address book). */
    addresses: { type: [addressSchema], default: [] },
    // Per-user margin override (required for stockist/distributor/retailer accounts).
    marginType: { type: String, enum: ['fixed', 'percentage'] },
    marginBasis: { type: String, enum: ['cost', 'mrp'] },
    marginValue: { type: Number, min: 0 },
    /**
     * Credit wallet: stockist (admin-set), distributor (stockist-set),
     * retailer/reseller (distributor-set). creditUsed may go negative when returns
     * add available credit after cash/online payments.
     */
    creditLimit: { type: Number, min: 0, default: 0 },
    creditUsed: { type: Number, default: 0 },
    /** Stockist-only: % of admin warehouse stock visible/orderable (0–100). */
    stockAllocationPercent: { type: Number, min: 0, max: 100, default: 100 },
    // Hierarchy: retailer -> distributor -> stockist -> admin.
    assignedDistributor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedStockist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ customerId: 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  // Already a bcrypt hash (e.g. pre-hashed register OTP payload).
  if (/^\$2[aby]\$\d{2}\$/.test(this.password)) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.STATUSES = STATUSES;
module.exports.ASSIGNMENT_PARTNER_TYPES = ASSIGNMENT_PARTNER_TYPES;
