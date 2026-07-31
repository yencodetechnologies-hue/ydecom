const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');

const { resolveBuyer } = require('../services/networkService');

const normalizeAddress = (body) => ({
  label: ['Home', 'Work', 'Other'].includes(body.label) ? body.label : 'Home',
  fullName: String(body.fullName || '').trim(),
  mobile: String(body.mobile || '').trim(),
  address: String(body.address || '').trim(),
  city: String(body.city || '').trim(),
  state: String(body.state || '').trim(),
  pincode: String(body.pincode || '').trim(),
  isDefault: Boolean(body.isDefault),
});

const validateAddressFields = (addr) => {
  if (!addr.fullName) throw new AppError('Full name is required', 400);
  if (!/^[0-9]{10}$/.test(addr.mobile)) throw new AppError('Mobile must be 10 digits', 400);
  if (!addr.address) throw new AppError('Address is required', 400);
  if (!addr.city) throw new AppError('City is required', 400);
  if (!addr.state) throw new AppError('State is required', 400);
  if (!/^[0-9]{6}$/.test(addr.pincode)) throw new AppError('Pincode must be 6 digits', 400);
};

const clearDefaults = (user) => {
  user.addresses.forEach((a) => {
    a.isDefault = false;
  });
};

const listAddresses = asyncHandler(async (req, res) => {
  let user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  if (req.query.buyerId) {
    const { buyer } = await resolveBuyer(req.user, req.query.buyerId);
    user = buyer;
  }

  sendResponse(res, {
    data: user.addresses || [],
    meta: {
      buyer: {
        _id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        shopName: user.shopName || '',
        shopAddress: user.shopAddress || '',
        shopPhone: user.shopPhone || '',
        businessEmail: user.businessEmail || '',
        gstNumber: user.gstNumber || '',
        panNumber: user.panNumber || '',
        role: user.role,
      },
    },
  });
});

const createAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  const addr = normalizeAddress(req.body);
  validateAddressFields(addr);

  if (!user.addresses) user.addresses = [];
  if (addr.isDefault || user.addresses.length === 0) {
    clearDefaults(user);
    addr.isDefault = true;
  }

  user.addresses.push(addr);
  await user.save();

  const created = user.addresses[user.addresses.length - 1];
  sendResponse(res, {
    statusCode: 201,
    message: 'Address saved',
    data: created,
    meta: { addresses: user.addresses },
  });
});

const updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  const existing = user.addresses.id(req.params.id);
  if (!existing) throw new AppError('Address not found', 404);

  const addr = normalizeAddress({ ...existing.toObject(), ...req.body });
  validateAddressFields(addr);

  if (addr.isDefault) clearDefaults(user);

  existing.label = addr.label;
  existing.fullName = addr.fullName;
  existing.mobile = addr.mobile;
  existing.address = addr.address;
  existing.city = addr.city;
  existing.state = addr.state;
  existing.pincode = addr.pincode;
  existing.isDefault = addr.isDefault || existing.isDefault;

  if (!user.addresses.some((a) => a.isDefault)) {
    existing.isDefault = true;
  }

  await user.save();
  sendResponse(res, {
    message: 'Address updated',
    data: existing,
    meta: { addresses: user.addresses },
  });
});

const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  const existing = user.addresses.id(req.params.id);
  if (!existing) throw new AppError('Address not found', 404);

  const wasDefault = existing.isDefault;
  existing.deleteOne();

  if (wasDefault && user.addresses.length) {
    user.addresses[0].isDefault = true;
  }

  await user.save();
  sendResponse(res, {
    message: 'Address deleted',
    data: { id: req.params.id },
    meta: { addresses: user.addresses },
  });
});

const setDefaultAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  const existing = user.addresses.id(req.params.id);
  if (!existing) throw new AppError('Address not found', 404);

  clearDefaults(user);
  existing.isDefault = true;
  await user.save();

  sendResponse(res, {
    message: 'Default address updated',
    data: existing,
    meta: { addresses: user.addresses },
  });
});

module.exports = {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
