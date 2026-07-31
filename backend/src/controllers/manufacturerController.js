const Manufacturer = require('../models/Manufacturer');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { getPagination, buildSearchFilter } = require('../utils/pagination');
const { uploadManufacturerImage, deleteManufacturerImage } = require('../services/cloudinaryService');

const parseIsActive = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

const listManufacturers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {
    ...buildSearchFilter(req.query.search, ['name', 'description']),
  };
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const [items, total] = await Promise.all([
    Manufacturer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Manufacturer.countDocuments(filter),
  ]);

  sendResponse(res, {
    data: items,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const listPublicManufacturers = asyncHandler(async (req, res) => {
  const manufacturers = await Manufacturer.find({ isActive: true })
    .select('name image')
    .sort({ name: 1 });
  sendResponse(res, { data: manufacturers });
});

const getManufacturer = asyncHandler(async (req, res) => {
  const manufacturer = await Manufacturer.findById(req.params.id);
  if (!manufacturer) throw new AppError('Manufacturer not found', 404);
  sendResponse(res, { data: manufacturer });
});

const createManufacturer = asyncHandler(async (req, res) => {
  const payload = {
    name: req.body.name,
    description: req.body.description || '',
  };
  const isActive = parseIsActive(req.body.isActive);
  if (isActive !== undefined) payload.isActive = isActive;

  if (req.file) {
    payload.image = await uploadManufacturerImage(req.file);
  }

  const manufacturer = await Manufacturer.create(payload);
  sendResponse(res, { statusCode: 201, message: 'Manufacturer created', data: manufacturer });
});

const updateManufacturer = asyncHandler(async (req, res) => {
  const manufacturer = await Manufacturer.findById(req.params.id);
  if (!manufacturer) throw new AppError('Manufacturer not found', 404);

  if (req.body.name !== undefined) manufacturer.name = req.body.name;
  if (req.body.description !== undefined) manufacturer.description = req.body.description;

  const isActive = parseIsActive(req.body.isActive);
  if (isActive !== undefined) manufacturer.isActive = isActive;

  const clearImage = req.body.clearImage === 'true' || req.body.clearImage === true;

  if (req.file) {
    const previous = manufacturer.image;
    manufacturer.image = await uploadManufacturerImage(req.file);
    if (previous) await deleteManufacturerImage(previous);
  } else if (clearImage && manufacturer.image) {
    await deleteManufacturerImage(manufacturer.image);
    manufacturer.image = '';
  }

  await manufacturer.save();
  sendResponse(res, { message: 'Manufacturer updated', data: manufacturer });
});

const deleteManufacturer = asyncHandler(async (req, res) => {
  const manufacturer = await Manufacturer.findByIdAndDelete(req.params.id);
  if (!manufacturer) throw new AppError('Manufacturer not found', 404);
  if (manufacturer.image) await deleteManufacturerImage(manufacturer.image);
  sendResponse(res, { message: 'Manufacturer deleted' });
});

const toggleActive = asyncHandler(async (req, res) => {
  const manufacturer = await Manufacturer.findById(req.params.id);
  if (!manufacturer) throw new AppError('Manufacturer not found', 404);
  manufacturer.isActive = !manufacturer.isActive;
  await manufacturer.save();
  sendResponse(res, {
    message: `Manufacturer ${manufacturer.isActive ? 'activated' : 'deactivated'}`,
    data: manufacturer,
  });
});

module.exports = {
  listManufacturers,
  listPublicManufacturers,
  getManufacturer,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
  toggleActive,
};
