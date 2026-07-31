import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Eye, EyeOff, Info } from 'lucide-react';
import { authApi } from '../api';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { registerUser } from '../features/auth/authSlice';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import AuthCard from '../components/auth/AuthCard';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^[0-9]{12}$/;

const empty = {
  role: 'customer',
  firstName: '',
  lastName: '',
  sellerName: '',
  mobile: '',
  email: '',
  password: '',
  confirmPassword: '',
  gstNumber: '',
  panNumber: '',
  aadhaarNumber: '',
  drivingLicenseNumber: '',
  shopName: '',
  shopAddress: '',
  shopPhone: '',
  businessEmail: '',
};

const emptyFiles = {
  panFront: null,
  aadhaarFront: null,
  aadhaarBack: null,
  drivingLicenseFront: null,
  drivingLicenseBack: null,
};

function Field({ label, error, children }) {
  return (
    <div className="mb-[18px]">
      {label ? (
        <label className="mb-1.5 block text-[12.5px] font-semibold text-wine">{label}</label>
      ) : null}
      {children}
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="flex overflow-hidden rounded-[11px] border border-blush-line bg-white transition focus-within:border-plum focus-within:shadow-[0_0_0_3px_rgba(61,14,40,0.08)]">
      {children}
    </div>
  );
}

const inputClass =
  'min-w-0 flex-1 border-0 bg-transparent px-3.5 py-3 font-inter text-[14.5px] text-wine outline-none placeholder:text-[#C9AEB8]';

const fileInputClass =
  'w-full rounded-[11px] border border-blush-line bg-white px-3.5 py-2.5 font-inter text-[13px] text-wine file:mr-3 file:rounded-md file:border-0 file:bg-fog file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-wine';

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState(emptyFiles);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState('form');
  const [otp, setOtp] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  const isReseller = form.role === 'reseller';
  const isSalesman = form.role === 'salesman';
  const isShopBusiness = useMemo(
    () => ['retailer', 'distributor', 'stockist'].includes(form.role),
    [form.role]
  );

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setFile = (key, file) => setFiles((prev) => ({ ...prev, [key]: file || null }));

  const displayName = () =>
    isReseller ? form.sellerName.trim() : `${form.firstName} ${form.lastName}`.trim();

  const validate = () => {
    const next = {};
    const password = form.password;
    const confirmPassword = form.confirmPassword;
    if (!form.role) next.role = 'Select register type';

    if (isReseller) {
      if (!form.sellerName.trim()) next.sellerName = 'Seller name is required';
    } else {
      if (!form.firstName.trim()) next.firstName = 'First name is required';
      if (!form.lastName.trim()) next.lastName = 'Last name is required';
    }

    if (!/^[0-9]{10}$/.test(form.mobile.replace(/\D/g, ''))) {
      next.mobile = 'Enter valid 10-digit mobile';
    }
    if (!form.email.includes('@')) next.email = 'Valid email required';
    if (password.length < 6) next.password = 'Min 6 characters';
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';

    if (isShopBusiness) {
      if (!form.gstNumber) next.gstNumber = 'Required';
      if (!form.panNumber) next.panNumber = 'Required';
      if (!form.shopName) next.shopName = 'Required';
      if (!form.shopAddress) next.shopAddress = 'Required';
      if (!form.shopPhone) next.shopPhone = 'Required';
      if (!form.businessEmail) next.businessEmail = 'Required';
    }

    if (isReseller || isSalesman) {
      const pan = form.panNumber.trim().toUpperCase();
      const aadhaar = form.aadhaarNumber.replace(/\D/g, '');
      if (!PAN_RE.test(pan)) next.panNumber = 'Enter valid PAN (e.g. ABCDE1234F)';
      if (!AADHAAR_RE.test(aadhaar)) next.aadhaarNumber = 'Aadhaar must be 12 digits';
      if (!files.panFront) next.panFront = 'PAN card image is required';
      if (!files.aadhaarFront) next.aadhaarFront = 'Aadhaar front image is required';
      if (!files.aadhaarBack) next.aadhaarBack = 'Aadhaar back image is required';
    }

    if (isSalesman) {
      if (!form.drivingLicenseNumber.trim()) {
        next.drivingLicenseNumber = 'Driving license number is required';
      }
      if (!files.drivingLicenseFront) {
        next.drivingLicenseFront = 'Driving license front image is required';
      }
      if (!files.drivingLicenseBack) {
        next.drivingLicenseBack = 'Driving license back image is required';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const name = displayName();
    const email = form.email.trim().toLowerCase();
    const mobile = form.mobile.replace(/\D/g, '');

    let payload;
    if (isReseller || isSalesman) {
      payload = new FormData();
      payload.append('role', form.role);
      payload.append('name', name);
      payload.append('mobile', mobile);
      payload.append('email', email);
      payload.append('password', form.password);
      payload.append('confirmPassword', form.confirmPassword);
      payload.append('panNumber', form.panNumber.trim().toUpperCase());
      payload.append('aadhaarNumber', form.aadhaarNumber.replace(/\D/g, ''));
      payload.append('panFront', files.panFront);
      payload.append('aadhaarFront', files.aadhaarFront);
      payload.append('aadhaarBack', files.aadhaarBack);
      if (isSalesman) {
        payload.append('drivingLicenseNumber', form.drivingLicenseNumber.trim().toUpperCase());
        payload.append('drivingLicenseFront', files.drivingLicenseFront);
        payload.append('drivingLicenseBack', files.drivingLicenseBack);
      }
    } else {
      payload = {
        role: form.role,
        name,
        mobile,
        email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        ...(isShopBusiness
          ? {
              gstNumber: form.gstNumber,
              panNumber: form.panNumber,
              shopName: form.shopName,
              shopAddress: form.shopAddress,
              shopPhone: form.shopPhone,
              businessEmail: form.businessEmail,
            }
          : {}),
      };
    }

    const result = await dispatch(registerUser(payload));
    if (registerUser.fulfilled.match(result)) {
      const resolvedEmail = result.payload?.data?.email || email;
      setPendingEmail(resolvedEmail);
      setStep('otp');
      setOtp('');
      toast.success(result.payload?.message || 'OTP sent to your email');
      return;
    }
    const msg = result.payload?.message || 'Registration failed';
    const fieldErrors = result.payload?.errors;
    if (fieldErrors?.length) {
      const mapped = {};
      fieldErrors.forEach((err) => {
        mapped[err.field] = err.message;
      });
      setErrors(mapped);
    }
    toast.error(msg);
  };

  const onVerifyOtp = async (e) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(otp.trim())) {
      toast.error('Enter the 6-digit OTP from your email');
      return;
    }
    setOtpBusy(true);
    try {
      const { data } = await authApi.verifyRegisterOtp({
        email: pendingEmail,
        otp: otp.trim(),
      });
      toast.success(data.message || 'Email verified');
      navigate('/pending-approval', {
        state: {
          source: 'register',
          name: displayName(),
          email: pendingEmail,
        },
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setOtpBusy(false);
    }
  };

  const onResendOtp = async () => {
    setOtpBusy(true);
    try {
      const { data } = await authApi.resendRegisterOtp({ email: pendingEmail });
      toast.success(data.message || 'OTP resent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend OTP');
    } finally {
      setOtpBusy(false);
    }
  };

  if (step === 'otp') {
    return (
      <AuthCard
        brand={
          <AuthBrandPanel
            title="Verify your email to finish creating your account."
            subtitle="We sent a 6-digit OTP to your inbox. Enter it below to complete registration."
          />
        }
      >
        <form onSubmit={onVerifyOtp} className="w-full">
          <h2 className="m-0 font-display text-2xl font-semibold text-wine sm:text-[28px]">
            Verify email
          </h2>
          <p className="mt-1.5 mb-7 text-[13.5px] text-mauve">
            OTP sent to <span className="font-semibold text-wine">{pendingEmail}</span>
          </p>

          <Field label="Enter OTP">
            <Shell>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                className={`${inputClass} tracking-[0.35em]`}
              />
            </Shell>
          </Field>

          <button
            type="submit"
            disabled={otpBusy}
            className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-rose py-[13.5px] font-inter text-[14.5px] font-bold tracking-[0.2px] text-white shadow-[0_8px_18px_-8px_rgba(255,62,118,0.55)] transition hover:-translate-y-px hover:bg-rose-deep disabled:opacity-60"
          >
            {otpBusy ? 'Verifying...' : 'Verify & continue'}
            {!otpBusy ? <ArrowRight className="h-4 w-4" strokeWidth={2.2} /> : null}
          </button>

          <div className="mt-[18px] flex flex-wrap items-center justify-between gap-2 text-[13px] text-mauve">
            <button
              type="button"
              disabled={otpBusy}
              onClick={onResendOtp}
              className="font-bold text-plum hover:underline disabled:opacity-60"
            >
              Resend OTP
            </button>
            <button
              type="button"
              disabled={otpBusy}
              onClick={() => setStep('form')}
              className="font-semibold text-mauve hover:underline disabled:opacity-60"
            >
              Back to form
            </button>
          </div>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      brand={
        <AuthBrandPanel
          title="Join the network as a stockist, distributor, retailer or customer."
          subtitle="Create your account once — verify your email with OTP, then admin unlocks access after approval."
        />
      }
    >
      <form onSubmit={onSubmit} className="w-full">
        <h2 className="m-0 font-display text-2xl font-semibold text-wine sm:text-[28px]">
          Create account
        </h2>
        <p className="mt-1.5 mb-7 text-[13.5px] text-mauve">
          Fill in your details to get started on YDecom.
        </p>

        <Field label="Register type" error={errors.role}>
          <Shell>
            <select
              value={form.role}
              onChange={(e) => {
                set('role', e.target.value);
                setFiles(emptyFiles);
                setErrors({});
              }}
              className={`${inputClass} appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-10`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A6474' stroke-width='2.2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              }}
            >
              <option value="">Select register type</option>
              <option value="customer">Customer</option>
              <option value="retailer">Retailer</option>
              <option value="reseller">Reseller</option>
              <option value="distributor">Distributor</option>
              <option value="stockist">Stockist</option>
              <option value="salesman">Salesman</option>
            </select>
          </Shell>
        </Field>

        {form.role ? (
          <>
            {isReseller ? (
              <Field label="Seller name" error={errors.sellerName || errors.name}>
                <Shell>
                  <input
                    value={form.sellerName}
                    onChange={(e) => set('sellerName', e.target.value)}
                    placeholder="Seller / business name"
                    autoComplete="name"
                    className={inputClass}
                  />
                </Shell>
              </Field>
            ) : (
              <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
                <Field label="First name" error={errors.firstName || errors.name}>
                  <Shell>
                    <input
                      value={form.firstName}
                      onChange={(e) => set('firstName', e.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                      className={inputClass}
                    />
                  </Shell>
                </Field>
                <Field label="Last name" error={errors.lastName}>
                  <Shell>
                    <input
                      value={form.lastName}
                      onChange={(e) => set('lastName', e.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                      className={inputClass}
                    />
                  </Shell>
                </Field>
              </div>
            )}

            <Field label="Email address" error={errors.email}>
              <Shell>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  className={inputClass}
                />
              </Shell>
            </Field>

            <Field label="Mobile number" error={errors.mobile}>
              <Shell>
                <input
                  value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                  inputMode="numeric"
                  className={inputClass}
                />
              </Shell>
            </Field>

            <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
              <Field label="Password" error={errors.password}>
                <Shell>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => {
                      set('password', e.target.value);
                      if (errors.password || errors.confirmPassword) {
                        setErrors((prev) => ({
                          ...prev,
                          password: undefined,
                          confirmPassword: undefined,
                        }));
                      }
                    }}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
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
                </Shell>
              </Field>
              <Field label="Confirm password" error={errors.confirmPassword}>
                <Shell>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => {
                      set('confirmPassword', e.target.value);
                      if (errors.confirmPassword) {
                        setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }
                    }}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    className="flex items-center justify-center px-3.5 text-mauve"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-[17px] w-[17px]" strokeWidth={1.8} />
                    ) : (
                      <Eye className="h-[17px] w-[17px]" strokeWidth={1.8} />
                    )}
                  </button>
                </Shell>
              </Field>
            </div>

            {isReseller || isSalesman ? (
              <div className="mb-[18px] rounded-[11px] border border-dashed border-blush-line bg-[#FFFAFB] p-3.5">
                <p className="mb-3 text-[10.5px] font-semibold tracking-[1.2px] text-mauve uppercase">
                  KYC documents
                </p>
                <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
                  <Field label="PAN number" error={errors.panNumber}>
                    <Shell>
                      <input
                        value={form.panNumber}
                        onChange={(e) => set('panNumber', e.target.value.toUpperCase())}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        className={inputClass}
                      />
                    </Shell>
                  </Field>
                  <Field label="Aadhaar number" error={errors.aadhaarNumber}>
                    <Shell>
                      <input
                        value={form.aadhaarNumber}
                        onChange={(e) =>
                          set('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))
                        }
                        placeholder="12-digit Aadhaar"
                        inputMode="numeric"
                        maxLength={12}
                        className={inputClass}
                      />
                    </Shell>
                  </Field>
                  {isSalesman ? (
                    <div className="sm:col-span-2">
                      <Field label="Driving license number" error={errors.drivingLicenseNumber}>
                        <Shell>
                          <input
                            value={form.drivingLicenseNumber}
                            onChange={(e) =>
                              set('drivingLicenseNumber', e.target.value.toUpperCase())
                            }
                            placeholder="Driving license number"
                            className={inputClass}
                          />
                        </Shell>
                      </Field>
                    </div>
                  ) : null}
                </div>
                <Field label="PAN card image" error={errors.panFront}>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className={fileInputClass}
                    onChange={(e) => setFile('panFront', e.target.files?.[0])}
                  />
                </Field>
                <Field label="Aadhaar card (front)" error={errors.aadhaarFront}>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className={fileInputClass}
                    onChange={(e) => setFile('aadhaarFront', e.target.files?.[0])}
                  />
                </Field>
                <Field label="Aadhaar card (back)" error={errors.aadhaarBack}>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className={fileInputClass}
                    onChange={(e) => setFile('aadhaarBack', e.target.files?.[0])}
                  />
                </Field>
                {isSalesman ? (
                  <>
                    <Field label="Driving license (front)" error={errors.drivingLicenseFront}>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        className={fileInputClass}
                        onChange={(e) => setFile('drivingLicenseFront', e.target.files?.[0])}
                      />
                    </Field>
                    <Field label="Driving license (back)" error={errors.drivingLicenseBack}>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        className={fileInputClass}
                        onChange={(e) => setFile('drivingLicenseBack', e.target.files?.[0])}
                      />
                    </Field>
                  </>
                ) : null}
              </div>
            ) : null}

            {isShopBusiness ? (
              <div className="mb-[18px] rounded-[11px] border border-dashed border-blush-line bg-[#FFFAFB] p-3.5">
                <p className="mb-3 text-[10.5px] font-semibold tracking-[1.2px] text-mauve uppercase">
                  Business details
                </p>
                <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
                  <Field label="GST number" error={errors.gstNumber}>
                    <Shell>
                      <input
                        value={form.gstNumber}
                        onChange={(e) => set('gstNumber', e.target.value)}
                        className={inputClass}
                      />
                    </Shell>
                  </Field>
                  <Field label="PAN number" error={errors.panNumber}>
                    <Shell>
                      <input
                        value={form.panNumber}
                        onChange={(e) => set('panNumber', e.target.value)}
                        className={inputClass}
                      />
                    </Shell>
                  </Field>
                  <Field label="Shop name" error={errors.shopName}>
                    <Shell>
                      <input
                        value={form.shopName}
                        onChange={(e) => set('shopName', e.target.value)}
                        className={inputClass}
                      />
                    </Shell>
                  </Field>
                  <Field label="Shop phone" error={errors.shopPhone}>
                    <Shell>
                      <input
                        value={form.shopPhone}
                        onChange={(e) => set('shopPhone', e.target.value)}
                        className={inputClass}
                      />
                    </Shell>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Business email" error={errors.businessEmail}>
                      <Shell>
                        <input
                          type="email"
                          value={form.businessEmail}
                          onChange={(e) => set('businessEmail', e.target.value)}
                          className={inputClass}
                        />
                      </Shell>
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Shop address" error={errors.shopAddress}>
                      <Shell>
                        <textarea
                          value={form.shopAddress}
                          onChange={(e) => set('shopAddress', e.target.value)}
                          rows={3}
                          className={`${inputClass} resize-none`}
                        />
                      </Shell>
                    </Field>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-rose py-[13.5px] font-inter text-[14.5px] font-bold tracking-[0.2px] text-white shadow-[0_8px_18px_-8px_rgba(255,62,118,0.55)] transition hover:-translate-y-px hover:bg-rose-deep disabled:opacity-60"
            >
              {loading ? 'Sending OTP...' : 'Continue with email OTP'}
              {!loading ? <ArrowRight className="h-4 w-4" strokeWidth={2.2} /> : null}
            </button>

            <p className="mt-[18px] text-center text-[13px] text-mauve">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-plum no-underline hover:underline">
                Sign in
              </Link>
            </p>

            <div className="mt-[22px] flex items-center gap-2 rounded-[10px] border border-dashed border-blush-line bg-[#FFFAFB] px-3 py-2.5 text-[11.5px] text-mauve">
              <Info className="h-[13px] w-[13px] shrink-0" strokeWidth={2} />
              <span>We email a 6-digit OTP to verify your address, then admin approval unlocks sign-in.</span>
            </div>
          </>
        ) : null}
      </form>
    </AuthCard>
  );
}
