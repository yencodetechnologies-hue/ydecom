const crypto = require('crypto');
const Otp = require('../models/Otp');
const AppError = require('../utils/AppError');
const { sendOtpEmail } = require('./emailService');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Creates/replaces an OTP for email+purpose and emails the plain code.
 * @returns {{ email: string, expiresInMinutes: number }}
 */
const issueOtp = async ({ email, purpose, payload = null }) => {
  const normalized = String(email).trim().toLowerCase();
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await Otp.findOneAndUpdate(
    { email: normalized, purpose },
    {
      email: normalized,
      purpose,
      codeHash: hashOtp(code),
      expiresAt,
      attempts: 0,
      payload,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await sendOtpEmail({ to: normalized, otp: code, purpose });

  return { email: normalized, expiresInMinutes: 10 };
};

/**
 * Validates OTP. On success deletes the record and returns payload (if any).
 */
const consumeOtp = async ({ email, purpose, otp }) => {
  const normalized = String(email).trim().toLowerCase();
  const record = await Otp.findOne({ email: normalized, purpose });
  if (!record) {
    throw new AppError('OTP expired or not found. Request a new one.', 400, 'OTP_NOT_FOUND');
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ _id: record._id });
    throw new AppError('OTP expired. Request a new one.', 400, 'OTP_EXPIRED');
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    throw new AppError('Too many invalid OTP attempts. Request a new one.', 400, 'OTP_LOCKED');
  }

  if (record.codeHash !== hashOtp(otp)) {
    record.attempts += 1;
    await record.save();
    const left = MAX_ATTEMPTS - record.attempts;
    throw new AppError(
      left > 0 ? `Invalid OTP. ${left} attempt(s) left.` : 'Invalid OTP. Request a new one.',
      400,
      'OTP_INVALID'
    );
  }

  const payload = record.payload;
  await Otp.deleteOne({ _id: record._id });
  return { email: normalized, payload };
};

module.exports = { issueOtp, consumeOtp, OTP_TTL_MS };
