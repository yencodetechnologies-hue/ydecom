const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const manufacturerRoutes = require('./routes/manufacturerRoutes');
const productRoutes = require('./routes/productRoutes');
const marginRoutes = require('./routes/marginRoutes');
const orderRoutes = require('./routes/orderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser / same-origin requests (no Origin header)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.set('etag', false);
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'YDecom API running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/manufacturers', manufacturerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/margins', marginRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/addresses', require('./routes/addressRoutes'));
app.use('/api/vouchers', require('./routes/voucherRoutes'));
app.use('/api/purchase-orders', require('./routes/purchaseOrderRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/returns', require('./routes/returnRoutes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
