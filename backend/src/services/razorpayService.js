const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const AppError = require('../utils/AppError');

const ENV_PATH = path.join(__dirname, '../../.env');

/** Always read Razorpay keys from backend/.env so a stale process.env cannot break payments. */
const getCredentials = () => {
  let fromFile = {};
  try {
    if (fs.existsSync(ENV_PATH)) {
      fromFile = dotenv.parse(fs.readFileSync(ENV_PATH));
    }
  } catch {
    fromFile = {};
  }

  const key_id = String(fromFile.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = String(
    fromFile.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || ''
  ).trim();

  if (!key_id || !key_secret || key_id.includes('xxxxxxxx') || key_secret.includes('xxxxxxxx')) {
    throw new AppError(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env',
      503,
      'RAZORPAY_NOT_CONFIGURED'
    );
  }
  return { key_id, key_secret };
};

const getClient = () => {
  const { key_id, key_secret } = getCredentials();
  return new Razorpay({ key_id, key_secret });
};

const getKeyId = () => getCredentials().key_id;

const createRazorpayOrder = async ({ amountPaise, receipt, notes }) => {
  const client = getClient();
  try {
    return await client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: String(receipt || `rcpt_${Date.now()}`).slice(0, 40),
      notes: notes || {},
    });
  } catch (err) {
    const description = err?.error?.description || err?.message || 'Razorpay order failed';
    console.error('Razorpay orders.create failed:', {
      description,
      code: err?.error?.code,
      statusCode: err?.statusCode,
      keyPrefix: getCredentials().key_id.slice(0, 12),
    });
    if (String(description).toLowerCase().includes('authentication')) {
      throw new AppError(
        'Razorpay authentication failed. Key Id and Secret in backend/.env do not match. Regenerate both in Razorpay Dashboard (Test Mode), save .env, restart server, then run: npm run check:razorpay',
        502,
        'RAZORPAY_AUTH_FAILED'
      );
    }
    throw new AppError(description, 502, 'RAZORPAY_ERROR');
  }
};

const verifyPaymentSignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const { key_secret } = getCredentials();
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac('sha256', key_secret).update(body).digest('hex');
  return expected === razorpaySignature;
};

module.exports = {
  getKeyId,
  createRazorpayOrder,
  verifyPaymentSignature,
};
