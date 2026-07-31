const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { getPagination, buildSearchFilter } = require('../utils/pagination');
const { uploadCategoryImage, deleteCategoryImage } = require('../services/cloudinaryService');

const parseIsActive = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

const listCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {
    ...buildSearchFilter(req.query.search, ['name', 'description']),
  };
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const [items, total] = await Promise.all([
    Category.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);

  sendResponse(res, {
    data: items,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const listPublicCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .select('name image')
    .sort({ name: 1 });
  sendResponse(res, { data: categories });
});

const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  sendResponse(res, { data: category });
});

const createCategory = asyncHandler(async (req, res) => {
  const payload = {
    name: req.body.name,
    description: req.body.description || '',
  };
  const isActive = parseIsActive(req.body.isActive);
  if (isActive !== undefined) payload.isActive = isActive;

  if (req.file) {
    payload.image = await uploadCategoryImage(req.file);
  }

  const category = await Category.create(payload);
  sendResponse(res, { statusCode: 201, message: 'Category created', data: category });
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);

  if (req.body.name !== undefined) category.name = req.body.name;
  if (req.body.description !== undefined) category.description = req.body.description;

  const isActive = parseIsActive(req.body.isActive);
  if (isActive !== undefined) category.isActive = isActive;

  const clearImage = req.body.clearImage === 'true' || req.body.clearImage === true;

  if (req.file) {
    const previous = category.image;
    category.image = await uploadCategoryImage(req.file);
    if (previous) await deleteCategoryImage(previous);
  } else if (clearImage && category.image) {
    await deleteCategoryImage(category.image);
    category.image = '';
  }

  await category.save();
  sendResponse(res, { message: 'Category updated', data: category });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  if (category.image) await deleteCategoryImage(category.image);
  sendResponse(res, { message: 'Category deleted' });
});

const toggleActive = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  category.isActive = !category.isActive;
  await category.save();
  sendResponse(res, {
    message: `Category ${category.isActive ? 'activated' : 'deactivated'}`,
    data: category,
  });
});

module.exports = {
  listCategories,
  listPublicCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleActive,
};
