const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    itemCode: { type: String, default: '' },
    image: { type: String, default: '' },
    mrp: { type: Number, min: 0, default: 0 },
    cost: { type: Number, min: 0, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    netCost: { type: Number, min: 0, default: 0 },
    salesTax: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    voucher: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', default: null },
    voucherCode: { type: String, default: '' },
    voucherDiscount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'ordered', 'order_packed', 'dispatched', 'delivered', 'cancelled'],
      default: 'ordered',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'paid', 'failed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'credit', 'cash', 'card', 'cheque', 'neft'],
      default: 'razorpay',
    },
    paymentProofImage: { type: String, default: '' },
    paymentReference: { type: String, default: '' },
    paymentNote: { type: String, default: '' },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    shippingAddress: { type: String, default: '' },
    shippingCost: { type: Number, min: 0, default: 0 },
    invoiceNumber: { type: String, default: '' },
    invoiceFinalized: { type: Boolean, default: false },
    invoiceGeneratedAt: { type: Date, default: null },
    /** When a stockist/distributor places an order for a child, this is the placer. */
    placedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    supplySource: {
      type: String,
      enum: ['admin', 'stockist', 'distributor'],
      default: 'admin',
    },
    /** User whose inventory is depleted (stockist for distributor orders, distributor for retailer). */
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Buyer Inventory credited on delivery (stockist/distributor). */
    inventoryCredited: { type: Boolean, default: false },
    /** Set when status becomes delivered — used for return window. */
    deliveredAt: { type: Date, default: null },
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

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ placedBy: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ razorpayOrderId: 1 });
orderSchema.index({ voucher: 1, createdAt: -1 });
orderSchema.index({ voucherCode: 1 });

module.exports = mongoose.model('Order', orderSchema);
