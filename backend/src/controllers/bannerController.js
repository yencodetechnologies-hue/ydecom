const Banner = require('../models/Banner');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');
const { uploadBannerImage, deleteBannerImage } = require('../services/cloudinaryService');

const listBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find().sort({ order: 1, createdAt: -1 });
  sendResponse(res, { data: banners });
});

const listPublicBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find({ isActive: true })
    .sort({ order: 1, createdAt: -1 })
    .select('image link order');
  sendResponse(res, { data: banners });
});

const createBanner = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Banner image is required', 400);
  const image = await uploadBannerImage(req.file);
  const banner = await Banner.create({
    image,
    link: req.body.link || '',
    order: Number(req.body.order) || 0,
    isActive: req.body.isActive === undefined ? true : req.body.isActive === 'true' || req.body.isActive === true,
  });
  sendResponse(res, { statusCode: 201, message: 'Banner created', data: banner });
});

const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);

  if (req.body.link !== undefined) banner.link = req.body.link;
  if (req.body.order !== undefined) banner.order = Number(req.body.order) || 0;
  if (req.body.isActive !== undefined) {
    banner.isActive = req.body.isActive === 'true' || req.body.isActive === true;
  }

  if (req.file) {
    const previous = banner.image;
    banner.image = await uploadBannerImage(req.file);
    if (previous) await deleteBannerImage(previous);
  }

  await banner.save();
  sendResponse(res, { message: 'Banner updated', data: banner });
});

const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);
  if (banner.image) await deleteBannerImage(banner.image);
  sendResponse(res, { message: 'Banner deleted' });
});

const toggleActive = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);
  banner.isActive = !banner.isActive;
  await banner.save();
  sendResponse(res, {
    message: `Banner ${banner.isActive ? 'activated' : 'deactivated'}`,
    data: banner,
  });
});

module.exports = {
  listBanners,
  listPublicBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleActive,
};
