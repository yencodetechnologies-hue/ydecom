const path = require('path');
// Always load backend/.env (not process cwd), so keys work no matter where npm is started.
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = require('./app');
const connectDB = require('./config/db');
const seedAdminAndMargins = require('./services/seed');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    await seedAdminAndMargins();

    const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keyId || !keySecret || keyId.includes('xxxxxxxx')) {
      console.warn(
        'Razorpay: NOT configured (set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in backend/.env)'
      );
    } else {
      const mode = keyId.startsWith('rzp_test_')
        ? 'TEST'
        : keyId.startsWith('rzp_live_')
          ? 'LIVE'
          : 'UNKNOWN';
      console.log(`Razorpay: loaded key ${keyId.slice(0, 12)}… (${mode} mode)`);
    }

    app.listen(PORT, () => {
      console.log(`YDecom API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();
