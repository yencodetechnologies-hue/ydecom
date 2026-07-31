const nodemailer = require('nodemailer');
const AppError = require('../utils/AppError');

const readEmailConfig = () => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT || 587);
  const secure =
    String(process.env.EMAIL_SECURE || 'false').toLowerCase() === 'true' || port === 465;
  const user = (process.env.EMAIL_USER || '').trim();
  // Gmail app passwords are often pasted with spaces — strip them.
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  return { host, port, secure, user, pass };
};

const getTransporter = () => {
  const { host, port, secure, user, pass } = readEmailConfig();
  if (!user || !pass) {
    throw new AppError(
      'Email is not configured. Set EMAIL_USER and EMAIL_PASS in backend .env',
      500,
      'EMAIL_NOT_CONFIGURED'
    );
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const sendMail = async ({ to, subject, text, html }) => {
  const { user } = readEmailConfig();
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"YDecom" <${user}>`,
    to,
    subject,
    text,
    html,
  });
};

const sendOtpEmail = async ({ to, otp, purpose }) => {
  const isReset = purpose === 'reset_password';
  const subject = isReset ? 'YDecom password reset OTP' : 'YDecom email verification OTP';
  const action = isReset ? 'reset your password' : 'verify your email and complete registration';
  const text = `Your YDecom OTP is ${otp}. It expires in 10 minutes. Use it to ${action}.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#3d0e28">
      <h2 style="margin:0 0 12px">YDecom</h2>
      <p style="margin:0 0 16px;color:#8a6474">Use this one-time code to ${action}.</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 16px">${otp}</p>
      <p style="margin:0;font-size:13px;color:#8a6474">This code expires in 10 minutes. If you did not request it, ignore this email.</p>
    </div>
  `;
  await sendMail({ to, subject, text, html });
};

module.exports = { sendMail, sendOtpEmail, readEmailConfig };
