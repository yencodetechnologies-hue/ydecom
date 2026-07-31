import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { clearAuthError, loginUser } from '../features/auth/authSlice';
import { fetchWishlistIds } from '../features/wishlist/wishlistSlice';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import AuthCard from '../components/auth/AuthCard';

const inputShell =
  'flex overflow-hidden rounded-[11px] border border-blush-line bg-white transition focus-within:border-plum focus-within:shadow-[0_0_0_3px_rgba(61,14,40,0.08)]';
const inputClass =
  'min-w-0 flex-1 border-0 bg-transparent px-3.5 py-3 font-inter text-[14.5px] text-wine outline-none placeholder:text-[#C9AEB8]';
const primaryBtn =
  'flex w-full items-center justify-center gap-2 rounded-[11px] bg-rose py-[13.5px] font-inter text-[14.5px] font-bold tracking-[0.2px] text-white shadow-[0_8px_18px_-8px_rgba(255,62,118,0.55)] transition hover:-translate-y-px hover:bg-rose-deep disabled:opacity-60';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [mode, setMode] = useState('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({
    otp: '',
    password: '',
    confirmPassword: '',
  });
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearAuthError());
    const identifier = form.identifier.trim();
    const payload = identifier.includes('@')
      ? { email: identifier.toLowerCase(), password: form.password }
      : { mobile: identifier.replace(/\D/g, ''), password: form.password };
    const result = await dispatch(loginUser(payload));
    if (loginUser.fulfilled.match(result)) {
      toast.success('Welcome back');
      dispatch(fetchWishlistIds());
      const from = location.state?.from;
      if (typeof from === 'string' && from.startsWith('/')) {
        navigate(from);
        return;
      }
      const role = result.payload?.user?.role;
      navigate(role === 'salesman' ? '/shop' : role === 'customer' ? '/' : '/dashboard');
      return;
    }
    if (result.payload?.code === 'PENDING_APPROVAL') {
      navigate('/pending-approval', {
        state: {
          source: 'login',
          identifier: form.identifier.trim(),
        },
      });
      return;
    }
    toast.error(result.payload?.message || 'Login failed');
  };

  const onForgotEmail = async (e) => {
    e.preventDefault();
    const email = forgotEmail.trim().toLowerCase();
    if (!email.includes('@')) {
      toast.error('Enter a valid email');
      return;
    }
    setBusy(true);
    try {
      const { data } = await authApi.forgotPassword({ email });
      toast.success(data.message || 'If the account exists, OTP was sent');
      setMode('forgot-reset');
      setResetForm({ otp: '', password: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  const onResetPassword = async (e) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(resetForm.otp.trim())) {
      toast.error('Enter the 6-digit OTP');
      return;
    }
    if (resetForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (resetForm.password !== resetForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const { data } = await authApi.resetPassword({
        email: forgotEmail.trim().toLowerCase(),
        otp: resetForm.otp.trim(),
        password: resetForm.password,
        confirmPassword: resetForm.confirmPassword,
      });
      toast.success(data.message || 'Password updated');
      setMode('login');
      setForm((prev) => ({
        ...prev,
        identifier: forgotEmail.trim().toLowerCase(),
        password: '',
      }));
      setForgotEmail('');
      setResetForm({ otp: '', password: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'forgot-email') {
    return (
      <AuthCard
        brand={
          <AuthBrandPanel
            title="Reset your password with an email OTP."
            subtitle="Enter the email on your account. We’ll send a one-time code if it exists."
          />
        }
      >
        <form onSubmit={onForgotEmail} className="w-full">
          <h2 className="m-0 font-display text-2xl font-semibold text-wine sm:text-[28px]">
            Forgot password
          </h2>
          <p className="mt-1.5 mb-7 text-[13.5px] text-mauve">
            We’ll email a 6-digit OTP to verify it’s you.
          </p>

          <div className="mb-[18px]">
            <label htmlFor="forgot-email" className="mb-1.5 block text-[12.5px] font-semibold text-wine">
              Email address
            </label>
            <div className={inputShell}>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className={inputClass}
              />
            </div>
          </div>

          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? 'Sending OTP...' : 'Send OTP'}
            {!busy ? <ArrowRight className="h-4 w-4" strokeWidth={2.2} /> : null}
          </button>

          <button
            type="button"
            className="mt-[18px] w-full text-center text-[13px] font-semibold text-plum hover:underline"
            onClick={() => setMode('login')}
          >
            Back to sign in
          </button>
        </form>
      </AuthCard>
    );
  }

  if (mode === 'forgot-reset') {
    return (
      <AuthCard
        brand={
          <AuthBrandPanel
            title="Enter the OTP and choose a new password."
            subtitle="Use the code from your email, then set password and confirm password."
          />
        }
      >
        <form onSubmit={onResetPassword} className="w-full">
          <h2 className="m-0 font-display text-2xl font-semibold text-wine sm:text-[28px]">
            Reset password
          </h2>
          <p className="mt-1.5 mb-7 text-[13.5px] text-mauve">
            OTP sent to <span className="font-semibold text-wine">{forgotEmail}</span>
          </p>

          <div className="mb-[18px]">
            <label htmlFor="reset-otp" className="mb-1.5 block text-[12.5px] font-semibold text-wine">
              OTP
            </label>
            <div className={inputShell}>
              <input
                id="reset-otp"
                value={resetForm.otp}
                onChange={(e) =>
                  setResetForm((p) => ({
                    ...p,
                    otp: e.target.value.replace(/\D/g, '').slice(0, 6),
                  }))
                }
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                className={`${inputClass} tracking-[0.35em]`}
              />
            </div>
          </div>

          <div className="mb-[18px]">
            <label htmlFor="reset-pass" className="mb-1.5 block text-[12.5px] font-semibold text-wine">
              New password
            </label>
            <div className={inputShell}>
              <input
                id="reset-pass"
                type={showNewPass ? 'text' : 'password'}
                value={resetForm.password}
                onChange={(e) => setResetForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Min 6 characters"
                autoComplete="new-password"
                required
                className={inputClass}
              />
              <button
                type="button"
                className="flex items-center justify-center px-3.5 text-mauve"
                aria-label={showNewPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowNewPass((v) => !v)}
              >
                {showNewPass ? (
                  <EyeOff className="h-[17px] w-[17px]" strokeWidth={1.8} />
                ) : (
                  <Eye className="h-[17px] w-[17px]" strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>

          <div className="mb-[22px]">
            <label
              htmlFor="reset-confirm"
              className="mb-1.5 block text-[12.5px] font-semibold text-wine"
            >
              Confirm password
            </label>
            <div className={inputShell}>
              <input
                id="reset-confirm"
                type={showConfirmPass ? 'text' : 'password'}
                value={resetForm.confirmPassword}
                onChange={(e) => setResetForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
                className={inputClass}
              />
              <button
                type="button"
                className="flex items-center justify-center px-3.5 text-mauve"
                aria-label={showConfirmPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowConfirmPass((v) => !v)}
              >
                {showConfirmPass ? (
                  <EyeOff className="h-[17px] w-[17px]" strokeWidth={1.8} />
                ) : (
                  <Eye className="h-[17px] w-[17px]" strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>

          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? 'Updating...' : 'Update password'}
            {!busy ? <ArrowRight className="h-4 w-4" strokeWidth={2.2} /> : null}
          </button>

          <div className="mt-[18px] flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <button
              type="button"
              disabled={busy}
              className="font-bold text-plum hover:underline disabled:opacity-60"
              onClick={async () => {
                setBusy(true);
                try {
                  await authApi.forgotPassword({ email: forgotEmail.trim().toLowerCase() });
                  toast.success('OTP resent');
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Could not resend OTP');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resend OTP
            </button>
            <button
              type="button"
              className="font-semibold text-mauve hover:underline"
              onClick={() => setMode('forgot-email')}
            >
              Change email
            </button>
          </div>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard brand={<AuthBrandPanel />}>
      <form onSubmit={onSubmit} className="w-full">
        <h2 className="m-0 font-display text-2xl font-semibold text-wine sm:text-[28px]">
          Sign in
        </h2>
        <p className="mt-1.5 mb-7 text-[13.5px] text-mauve">
          Enter your email or mobile number and password to continue.
        </p>

        <div className="mb-[18px]">
          <label htmlFor="login-identifier" className="mb-1.5 block text-[12.5px] font-semibold text-wine">
            Email or mobile number
          </label>
          <div className={inputShell}>
            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              placeholder="you@email.com or 10-digit mobile"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="mb-[18px]">
          <label htmlFor="login-pass" className="mb-1.5 block text-[12.5px] font-semibold text-wine">
            Password
          </label>
          <div className={inputShell}>
            <input
              id="login-pass"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Enter your password"
              required
              className={inputClass}
            />
            <button
              type="button"
              className="flex items-center justify-center px-3.5 text-mauve"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <EyeOff className="h-[17px] w-[17px]" strokeWidth={1.8} />
              ) : (
                <Eye className="h-[17px] w-[17px]" strokeWidth={1.8} />
              )}
            </button>
          </div>
        </div>

        <div className="-mt-1 mb-[22px] flex items-center justify-between text-[12.5px]">
          <label className="flex items-center gap-1.5 text-mauve">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 accent-plum"
            />
            Remember me
          </label>
          <button
            type="button"
            className="font-semibold text-plum no-underline hover:underline"
            onClick={() => {
              setForgotEmail(
                form.identifier.includes('@') ? form.identifier.trim().toLowerCase() : ''
              );
              setMode('forgot-email');
            }}
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? 'Signing in...' : 'Log in'}
          {!loading ? <ArrowRight className="h-4 w-4" strokeWidth={2.2} /> : null}
        </button>

        <p className="mt-[18px] text-center text-[13px] text-mauve">
          New here?{' '}
          <Link to="/register" className="font-bold text-plum no-underline hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
