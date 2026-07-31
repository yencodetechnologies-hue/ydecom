/**
 * Checks whether RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET work together.
 * Does not print secrets. Run: node src/scripts/checkRazorpay.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Razorpay = require('razorpay');

const key_id = String(process.env.RAZORPAY_KEY_ID || '').trim();
const key_secret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();

if (!key_id || !key_secret) {
  console.error('FAIL: Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in backend/.env');
  process.exit(1);
}

console.log(`Using Key ID: ${key_id}`);
console.log(`Secret length: ${key_secret.length} chars (value hidden)`);
console.log(`Mode: ${key_id.startsWith('rzp_test_') ? 'TEST' : key_id.startsWith('rzp_live_') ? 'LIVE' : 'UNKNOWN'}`);

const client = new Razorpay({ key_id, key_secret });

client.orders
  .create({
    amount: 100,
    currency: 'INR',
    receipt: `chk_${Date.now()}`,
  })
  .then((order) => {
    console.log('OK: Razorpay authentication succeeded. Order id:', order.id);
    process.exit(0);
  })
  .catch((err) => {
    const description = err?.error?.description || err?.message || String(err);
    console.error('FAIL:', description);
    console.error('');
    console.error('Fix:');
    console.error('1. Open https://dashboard.razorpay.com/app/keys');
    console.error('2. Ensure Test Mode is ON (for rzp_test_ keys)');
    console.error('3. Click Regenerate Key / Generate Test Key');
    console.error('4. Paste BOTH Key Id and Key Secret into backend/.env (same generation)');
    console.error('5. Restart backend: npm start');
    process.exit(1);
  });
