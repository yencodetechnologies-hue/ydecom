const cloudinary = require('../config/cloudinary');
const AppError = require('../utils/AppError');

const PRODUCT_FOLDER = 'ydecom/products';
const CATEGORY_FOLDER = 'ydecom/categories';
const MANUFACTURER_FOLDER = 'ydecom/manufacturers';
const BANNER_FOLDER = 'ydecom/banners';
const PAYMENT_FOLDER = 'ydecom/payments';
const KYC_FOLDER = 'ydecom/kyc';

const ensureConfigured = () => {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new AppError('Cloudinary is not configured', 500, 'CLOUDINARY_CONFIG');
  }
};

const uploadBuffer = (file, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });

const uploadImages = async (files = [], folder) => {
  if (!files.length) return [];
  ensureConfigured();
  try {
    const results = await Promise.all(files.map((file) => uploadBuffer(file, folder)));
    return results.map((r) => r.secure_url);
  } catch (err) {
    throw new AppError(
      err.message || 'Failed to upload image to Cloudinary',
      500,
      'CLOUDINARY_UPLOAD'
    );
  }
};

/** Upload multer memory files; returns Cloudinary secure URLs. */
const uploadProductImages = async (files = []) => uploadImages(files, PRODUCT_FOLDER);

/** Upload a single category image; returns Cloudinary secure URL or null. */
const uploadCategoryImage = async (file) => {
  if (!file) return null;
  const [url] = await uploadImages([file], CATEGORY_FOLDER);
  return url || null;
};

/** Upload a single manufacturer image; returns Cloudinary secure URL or null. */
const uploadManufacturerImage = async (file) => {
  if (!file) return null;
  const [url] = await uploadImages([file], MANUFACTURER_FOLDER);
  return url || null;
};

/** Upload a single banner image; returns Cloudinary secure URL or null. */
const uploadBannerImage = async (file) => {
  if (!file) return null;
  const [url] = await uploadImages([file], BANNER_FOLDER);
  return url || null;
};

const publicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
};

/** Best-effort delete of Cloudinary assets (ignores failures). */
const deleteImages = async (urls = []) => {
  const ids = urls.map(publicIdFromUrl).filter(Boolean);
  if (!ids.length) return;
  try {
    await Promise.all(ids.map((id) => cloudinary.uploader.destroy(id)));
  } catch {
    // ignore cleanup errors
  }
};

const deleteProductImages = async (urls = []) => deleteImages(urls);

const deleteCategoryImage = async (url) => {
  if (!url) return;
  await deleteImages([url]);
};

const deleteBannerImage = async (url) => {
  if (!url) return;
  await deleteImages([url]);
};

const deleteManufacturerImage = async (url) => {
  if (!url) return;
  await deleteImages([url]);
};

/** Upload stockist payment proof (cheque / cash / NEFT receipt). */
const uploadPaymentProof = async (file) => {
  if (!file) return null;
  const [url] = await uploadImages([file], PAYMENT_FOLDER);
  return url || null;
};

const RETURN_FOLDER = 'ydecom/returns';

/** Upload return proof image. */
const uploadReturnImage = async (file) => {
  if (!file) return null;
  const [url] = await uploadImages([file], RETURN_FOLDER);
  return url || null;
};

/** Upload a single KYC document image (PAN / Aadhaar); returns Cloudinary secure URL or null. */
const uploadKycImage = async (file) => {
  if (!file) return null;
  const [url] = await uploadImages([file], KYC_FOLDER);
  return url || null;
};

module.exports = {
  uploadProductImages,
  deleteProductImages,
  uploadCategoryImage,
  deleteCategoryImage,
  uploadManufacturerImage,
  deleteManufacturerImage,
  uploadBannerImage,
  deleteBannerImage,
  uploadPaymentProof,
  uploadReturnImage,
  uploadKycImage,
};
