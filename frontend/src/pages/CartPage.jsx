import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Briefcase,
  CheckCircle2,
  CreditCard,
  Home,
  Lock,
  MapPin,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { addressesApi, ordersApi, paymentsApi, productsApi, vouchersApi } from '../api';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setUserAddresses } from '../features/auth/authSlice';
import {
  clearCart,
  clearVoucher,
  removeFromCart,
  resolveOrderRules,
  selectCartItems,
  selectCartSubtotal,
  selectCartTotal,
  selectCartVoucher,
  selectCartVoucherDiscount,
  setVoucher,
  snapOrderQty,
  syncStockLevels,
  updateQty,
} from '../features/cart/cartSlice';
import HomeNavbar from '../components/home/HomeNavbar';
import AppShell from '../components/layout/AppShell';
import SiteFooter from '../components/layout/SiteFooter';
import Modal from '../components/ui/Modal';
import { Button, Input, TextArea, Select } from '../components/ui/Form';
import { formatCurrency, getImageUrl } from '../utils/helpers';
import { openRazorpayCheckout } from '../utils/razorpay';

const emptyForm = {
  label: 'Home',
  fullName: '',
  mobile: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
};

const composeShippingAddress = (a) =>
  [
    a.fullName.trim(),
    `Mobile: ${a.mobile.trim()}`,
    a.address.trim(),
    `${a.city.trim()}, ${a.state.trim()} - ${a.pincode.trim()}`,
  ].join('\n');

function CartLineQty({ item, onUpdate }) {
  const [value, setValue] = useState(String(item.qty));
  const { minQuantity: minQ, moq: step } = resolveOrderRules(item.minQuantity, item.moq);

  useEffect(() => {
    setValue(String(item.qty));
  }, [item.qty]);

  const commitQty = () => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < minQ) {
      setValue(String(item.qty));
      return;
    }
    const max = item.maxStock != null ? Number(item.maxStock) : null;
    const next = snapOrderQty(parsed, minQ, step, max);
    if (next == null) {
      setValue(String(item.qty));
      return;
    }
    if (max != null && parsed > max) {
      toast.error(`Only ${max} available in stock`);
    }
    setValue(String(next));
    if (next !== item.qty) onUpdate(next);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-home-forest/60">Qty</label>
      <input
        type="number"
        min={minQ}
        step={step}
        max={item.maxStock ?? undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commitQty}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-20 rounded-lg border border-home-line bg-white px-2 py-1.5 text-center text-sm font-semibold text-home-forest outline-none ring-home-leaf/30 focus:ring-2"
        aria-label={`Quantity for ${item.name}`}
      />
    </div>
  );
}

const LabelIcon = ({ label }) => {
  if (label === 'Work') return <Briefcase className="h-4 w-4" />;
  if (label === 'Other') return <MapPin className="h-4 w-4" />;
  return <Home className="h-4 w-4" />;
};

export default function CartPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const items = useAppSelector(selectCartItems);
  const subtotal = useAppSelector(selectCartSubtotal);
  const voucher = useAppSelector(selectCartVoucher);
  const voucherDiscount = useAppSelector(selectCartVoucherDiscount);
  const total = useAppSelector(selectCartTotal);
  const { user, token } = useAppSelector((s) => s.auth);
  const selectedBuyer = useAppSelector((s) => s.buyerContext.selectedBuyer);
  const selectedBuyerId = useAppSelector((s) => s.buyerContext.selectedBuyerId);
  const network = useAppSelector((s) => s.buyerContext.network);
  const showVoucher = user?.role === 'customer' && !selectedBuyer;
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [voucherInput, setVoucherInput] = useState('');
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [eligibleVouchers, setEligibleVouchers] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [stockRefreshing, setStockRefreshing] = useState(false);
  const [buyerProfile, setBuyerProfile] = useState(null);
  const cartProductIds = items.map((i) => i.productId).join(',');

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: '/cart' }, replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token || items.length === 0) return;

    let cancelled = false;

    const refreshStock = async () => {
      setStockRefreshing(true);
      try {
        const updates = await Promise.all(
          items.map(async (item) => {
            try {
              const { data } = await productsApi.get(
                item.productId,
                selectedBuyerId ? { buyerId: selectedBuyerId } : undefined
              );
              const product = data.data;
              return {
                productId: item.productId,
                maxStock: product?.availableStock ?? product?.stock ?? null,
                minQuantity: product?.minQuantity,
                moq: product?.moq,
              };
            } catch {
              return { productId: item.productId, maxStock: item.maxStock };
            }
          })
        );
        if (cancelled) return;
        const removed = updates.filter((u) => u.maxStock != null && u.maxStock <= 0).length;
        dispatch(syncStockLevels(updates));
        if (removed > 0) {
          toast.error(
            removed === 1
              ? 'An item was removed — no longer in stock'
              : `${removed} items were removed — no longer in stock`
          );
        }
      } finally {
        if (!cancelled) setStockRefreshing(false);
      }
    };

    refreshStock();
    return () => {
      cancelled = true;
    };
  }, [token, dispatch, cartProductIds, selectedBuyerId]);

  const syncAddresses = (list, { preferShopProfile = false } = {}) => {
    const rows = Array.isArray(list) ? list : [];
    setAddresses(rows);
    if (!selectedBuyerId) {
      dispatch(setUserAddresses(rows));
    }
    if (preferShopProfile) {
      setSelectedId(null);
      return;
    }
    const preferred =
      rows.find((a) => a.isDefault) ||
      rows.find((a) => String(a._id) === String(selectedId)) ||
      rows[0];
    setSelectedId(preferred ? preferred._id : null);
  };

  const loadAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const { data } = await addressesApi.list(
        selectedBuyerId ? { buyerId: selectedBuyerId } : undefined
      );
      const buyerMeta = selectedBuyerId ? data.meta?.buyer : null;
      if (selectedBuyerId && buyerMeta) {
        setBuyerProfile(buyerMeta);
      } else {
        setBuyerProfile(null);
      }
      const preferShop = Boolean(selectedBuyerId && buyerMeta?.shopAddress?.trim());
      syncAddresses(data.data || [], { preferShopProfile: preferShop });
    } catch {
      if (selectedBuyerId) {
        setBuyerProfile(selectedBuyer);
        syncAddresses(selectedBuyer?.addresses || [], {
          preferShopProfile: Boolean(selectedBuyer?.shopAddress?.trim()),
        });
      } else {
        setBuyerProfile(null);
        syncAddresses(user?.addresses || []);
      }
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (user?.role === 'stockist' && !selectedBuyerId) {
      setLoadingAddresses(false);
      setBuyerProfile(null);
      setAddresses([]);
      setSelectedId(null);
      return;
    }
    loadAddresses();
  }, [token, user?.role, selectedBuyerId]);

  useEffect(() => {
    if (!showVoucher || !voucher?.code || !items.length) return;
    const revalidate = async () => {
      try {
        const { data } = await vouchersApi.validate({ code: voucher.code, subtotal });
        dispatch(setVoucher(data.data));
      } catch {
        dispatch(clearVoucher());
      }
    };
    revalidate();
  }, [subtotal, items.length, showVoucher, voucher?.code, dispatch]);

  useEffect(() => {
    if (!showVoucher) return;
    let cancelled = false;
    vouchersApi
      .eligible()
      .then(({ data }) => {
        if (!cancelled) setEligibleVouchers(data.data || []);
      })
      .catch(() => {
        if (!cancelled) setEligibleVouchers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showVoucher]);

  if (!token) return null;

  const selected = addresses.find((a) => String(a._id) === String(selectedId));

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const openAddForm = () => {
    setForm({
      ...emptyForm,
      fullName: user?.name || '',
      mobile: user?.mobile || '',
      isDefault: addresses.length === 0,
    });
    setErrors({});
    setFormOpen(true);
  };

  const validateForm = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = 'Full name is required';
    if (!/^[0-9]{10}$/.test(form.mobile.trim())) next.mobile = 'Enter a valid 10-digit mobile';
    if (!form.address.trim()) next.address = 'Address is required';
    if (!form.city.trim()) next.city = 'City is required';
    if (!form.state.trim()) next.state = 'State is required';
    if (!/^[0-9]{6}$/.test(form.pincode.trim())) next.pincode = 'Enter a valid 6-digit pincode';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveAddress = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSavingAddress(true);
    try {
      const { data } = await addressesApi.create({
        ...form,
        fullName: form.fullName.trim(),
        mobile: form.mobile.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
      });
      const list = data.meta?.addresses || [...addresses, data.data];
      syncAddresses(list);
      if (data.data?._id) setSelectedId(data.data._id);
      setFormOpen(false);
      toast.success('Address saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const removeAddress = async (id, e) => {
    e.stopPropagation();
    try {
      const { data } = await addressesApi.remove(id);
      syncAddresses(data.meta?.addresses || addresses.filter((a) => String(a._id) !== String(id)));
      toast.success('Address removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove address');
    }
  };

  const applyVoucherCode = async (code) => {
    setApplyingVoucher(true);
    try {
      const { data } = await vouchersApi.validate({ code, subtotal });
      dispatch(setVoucher(data.data));
      setVoucherInput('');
      toast.success('Voucher applied');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid voucher');
    } finally {
      setApplyingVoucher(false);
    }
  };

  const applyVoucher = async () => {
    const code = voucherInput.trim();
    if (!code) {
      toast.error('Enter a voucher code');
      return;
    }
    await applyVoucherCode(code);
  };

  const removeVoucher = () => {
    dispatch(clearVoucher());
    setVoucherInput('');
    toast.success('Voucher removed');
  };

  const isStockist = user?.role === 'stockist';
  const isDistributor = user?.role === 'distributor';
  const isSalesman = user?.role === 'salesman';
  const isOrderingForBuyer = Boolean(selectedBuyerId && selectedBuyer);
  const isStockistProcurement = isStockist && !selectedBuyerId;
  const isB2BProcurement = (isStockist || isDistributor) && !selectedBuyerId;
  /** Self procurement OR ordering for assigned B2B partner — review/invoice flow. */
  const isB2BChannelCheckout =
    isB2BProcurement ||
    (isStockist && isOrderingForBuyer) ||
    (isSalesman &&
      isOrderingForBuyer &&
      ['stockist', 'distributor'].includes(selectedBuyer?.role));

  const hasStockWarning = items.some(
    (item) => item.maxStock != null && item.qty >= Number(item.maxStock)
  );

  const deliveryProfile = isOrderingForBuyer ? buyerProfile || selectedBuyer : user;

  const shopAddressText = (profile = deliveryProfile) =>
    [
      profile?.name,
      profile?.shopName,
      profile?.shopAddress,
      profile?.mobile ? `Mobile: ${profile.mobile}` : '',
      profile?.shopPhone ? `Shop phone: ${profile.shopPhone}` : '',
      profile?.gstNumber ? `GST: ${profile.gstNumber}` : '',
      profile?.email || profile?.businessEmail
        ? `Email: ${profile.businessEmail || profile.email}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

  const resolveShippingAddress = () => {
    if (selected) return composeShippingAddress(selected);
    if ((isB2BProcurement || isOrderingForBuyer) && shopAddressText()) {
      return shopAddressText();
    }
    return null;
  };

  const validateCheckout = () => {
    if (!items.length) {
      toast.error('Your cart is empty');
      return false;
    }
    if (isSalesman && !selectedBuyerId) {
      toast.error('Select a partner from Order as before placing an order');
      return false;
    }
    const shipping = resolveShippingAddress();
    if (!shipping) {
      if (isStockistProcurement) {
        toast.error('Shop address is missing. Update it in Settings.');
      } else if (isOrderingForBuyer) {
        toast.error(
          `${selectedBuyer?.role === 'distributor' ? 'Distributor' : 'Buyer'} shop address is missing. Ask them to update Settings.`
        );
      } else {
        toast.error('Please select or add a delivery address');
      }
      return false;
    }
    if (!acceptTerms) {
      toast.error('Accept Terms & Conditions to continue');
      return false;
    }
    return true;
  };

  const placeB2BOrder = async () => {
    if (!validateCheckout()) return;
    setPlacing(true);
    try {
      await ordersApi.create({
        items: items.map((i) => ({ product: i.productId, qty: i.qty })),
        shippingAddress: resolveShippingAddress(),
        ...(selectedBuyerId ? { buyerId: selectedBuyerId } : {}),
      });
      dispatch(clearCart());
      toast.success(
        isOrderingForBuyer
          ? isStockist
            ? 'Order placed — review it under Distributor Orders'
            : 'Order placed — awaiting supplier review'
          : 'Order placed — pending supplier review'
      );
      navigate(isStockist && isOrderingForBuyer ? '/distributor-orders' : '/orders');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  const buildPaymentPayload = () => ({
    items: items.map((i) => ({ product: i.productId, qty: i.qty })),
    shippingAddress: resolveShippingAddress(),
    ...(selectedBuyerId ? { buyerId: selectedBuyerId } : {}),
    ...(voucher?.code ? { voucherCode: voucher.code } : {}),
  });

  const payNow = async () => {
    if (!validateCheckout()) return;

    const shippingAddress = resolveShippingAddress();
    setPlacing(true);
    let pendingOrderId = null;

    try {
      const { data } = await paymentsApi.create({
        ...buildPaymentPayload(),
        shippingAddress,
        paymentMethod: 'razorpay',
      });
      const pay = data.data;
      pendingOrderId = pay.orderId;

      const paymentResponse = await openRazorpayCheckout({
        key: pay.key,
        amount: pay.amount,
        currency: pay.currency || 'INR',
        name: 'YDecom',
        description: `Order ${pay.orderNumber}`,
        order_id: pay.razorpayOrderId,
        prefill: {
          name: selected.fullName || pay.prefill?.name || '',
          email: pay.prefill?.email || user?.email || '',
          contact: selected.mobile || pay.prefill?.contact || '',
        },
        notes: {
          orderId: String(pay.orderId),
          orderNumber: pay.orderNumber,
        },
        theme: { color: '#2f6b4f' },
      });

      await paymentsApi.verify({
        orderId: pay.orderId,
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      });

      dispatch(clearCart());
      toast.success('Payment successful! Order placed.');
      navigate('/orders');
    } catch (err) {
      if (pendingOrderId) {
        try {
          await paymentsApi.fail({ orderId: pendingOrderId });
        } catch {
          /* ignore */
        }
      }
      const message =
        err.response?.data?.message || err.message || 'Payment failed. Please try again.';
      if (message !== 'Payment cancelled') {
        toast.error(message);
      } else {
        toast('Payment cancelled');
      }
    } finally {
      setPlacing(false);
    }
  };

  const cartMainClass = 'mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8';

  const cartContent = (
    <>
        <p className="text-xs font-semibold uppercase tracking-wide text-home-leaf/70">
          <Link to="/" className="hover:underline">
            Home
          </Link>
          {' / '}
          Cart
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-home-forest">Your Cart</h1>

        {selectedBuyer ? (
          <div className="mt-4 rounded-xl border border-home-leaf/30 bg-home-mint/20 px-4 py-3 text-sm text-home-forest">
            Ordering for{' '}
            <strong>
              {selectedBuyer.name}
              {selectedBuyer.shopName ? ` (${selectedBuyer.shopName})` : ''}
            </strong>
            {isSalesman ? (
              <span className="text-home-forest/60"> · placing order on behalf of this partner</span>
            ) : (
              <span className="text-home-forest/60">
                {' '}
                · stock is from your inventory · place order for review under Distributor Orders
              </span>
            )}
          </div>
        ) : isSalesman ? (
          <div className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-home-forest">
            Select a partner from <strong>Order as</strong> in the header before placing an order.
          </div>
        ) : isB2BProcurement ? (
          <div className="mt-4 rounded-xl border border-home-leaf/30 bg-home-mint/20 px-4 py-3 text-sm text-home-forest">
            {isStockist ? (
              <>
                Procuring from <strong>admin warehouse</strong> — your order will be reviewed and invoiced
                before payment.
                {network.length === 0 ? (
                  <span className="mt-1 block text-home-forest/70">
                    No distributors assigned yet. Ask admin to assign distributors so you can order on
                    their behalf.
                  </span>
                ) : null}
              </>
            ) : (
              <>
                Procuring from <strong>your stockist</strong> — order will be reviewed and invoiced before
                payment.
              </>
            )}
          </div>
        ) : ['stockist', 'distributor'].includes(user?.role) ? (
          <div className="mt-4 rounded-xl border border-home-line bg-home-sand/50 px-4 py-3 text-sm text-home-forest/80">
            Ordering as yourself at your stacked price. Use <strong>Order as</strong> in the header to
            place an order for an assigned{' '}
            {user?.role === 'stockist' ? 'distributor' : 'retailer or reseller'}.
            {user?.role === 'stockist' && network.length === 0 ? (
              <span className="mt-1 block">
                No distributors assigned — ask admin to assign distributors to your account.
              </span>
            ) : null}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-home-line bg-home-sand/40 px-6 py-16 text-center">
            <p className="font-display text-lg font-semibold text-home-forest">Cart is empty</p>
            <Link
              to="/shop"
              className="mt-4 inline-block text-sm font-semibold text-home-leaf hover:underline"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            {stockRefreshing ? (
              <p className="text-sm text-home-forest/60 lg:col-span-2">Checking latest stock…</p>
            ) : null}
            {hasStockWarning ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:col-span-2">
                Some items are at the maximum available stock. Quantities were adjusted to match
                current inventory.
              </div>
            ) : null}
            <div className="space-y-6">
              <ul className="space-y-4">
                {items.map((item) => (
                  <li
                    key={item.productId}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-home-line bg-white p-4"
                  >
                    <div className="h-20 w-20 overflow-hidden rounded-xl bg-home-sand/60">
                      {item.image ? (
                        <img
                          src={getImageUrl(item.image)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-home-forest">{item.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-baseline gap-2 text-sm">
                        {item.price == null ? (
                          <span className="text-home-forest/60">Price on request</span>
                        ) : (
                          <>
                            {item.mrp != null && Number(item.mrp) > Number(item.price) ? (
                              <span className="text-home-forest/35 line-through">
                                {formatCurrency(item.mrp)}
                              </span>
                            ) : null}
                            <span className="font-semibold text-home-forest">
                              {formatCurrency(item.price)}
                            </span>
                            {item.discountPercent > 0 ? (
                              <span className="text-xs font-medium text-rose-600">
                                −{Math.round(item.discountPercent)}%
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                      {item.maxStock != null && item.qty >= Number(item.maxStock) ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Only {item.maxStock} available in stock
                        </p>
                      ) : null}
                    </div>
                    <CartLineQty
                      item={item}
                      onUpdate={(qty) =>
                        dispatch(updateQty({ productId: item.productId, qty }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded-lg p-2 text-danger hover:bg-fog"
                      onClick={() => dispatch(removeFromCart(item.productId))}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <section className="rounded-2xl border border-home-line bg-white p-5">
                {isStockistProcurement || isOrderingForBuyer ? (
                  <>
                    <h2 className="font-display text-lg font-bold text-home-forest">
                      {isOrderingForBuyer ? 'Delivery details' : 'Shop address'}
                    </h2>
                    <p className="mt-1 text-sm text-home-forest/60">
                      {isOrderingForBuyer
                        ? `Auto-filled from ${selectedBuyer?.name || 'selected buyer'} — used for this order`
                        : 'Address from your registration — used for this order and cannot be changed here'}
                    </p>
                    {loadingAddresses && isOrderingForBuyer ? (
                      <p className="mt-5 text-sm text-home-forest/50">Loading delivery details…</p>
                    ) : deliveryProfile?.shopAddress?.trim() || addresses.length > 0 ? (
                      <div className="mt-5 space-y-3">
                        {deliveryProfile?.shopAddress?.trim() ? (
                          <div className="rounded-2xl border border-home-leaf/40 bg-home-mint/15 p-4 ring-1 ring-home-leaf/20">
                            <p className="text-xs font-semibold uppercase tracking-wide text-home-leaf">
                              Shop profile
                            </p>
                            {deliveryProfile.shopName ? (
                              <p className="mt-2 text-sm font-bold text-home-forest">
                                {deliveryProfile.shopName}
                              </p>
                            ) : null}
                            <p className="mt-1 text-sm font-semibold text-home-forest">
                              {deliveryProfile.name}
                            </p>
                            {deliveryProfile.mobile ? (
                              <p className="mt-1 text-sm text-home-forest/70">
                                Mobile: {deliveryProfile.mobile}
                              </p>
                            ) : null}
                            {deliveryProfile.shopPhone ? (
                              <p className="mt-1 text-sm text-home-forest/70">
                                Shop phone: {deliveryProfile.shopPhone}
                              </p>
                            ) : null}
                            {deliveryProfile.gstNumber ? (
                              <p className="mt-1 text-sm text-home-forest/70">
                                GST: {deliveryProfile.gstNumber}
                              </p>
                            ) : null}
                            {(deliveryProfile.businessEmail || deliveryProfile.email) && (
                              <p className="mt-1 text-sm text-home-forest/70">
                                Email: {deliveryProfile.businessEmail || deliveryProfile.email}
                              </p>
                            )}
                            <p className="mt-2 whitespace-pre-line text-sm text-home-forest/80">
                              {deliveryProfile.shopAddress}
                            </p>
                            {!selectedId ? (
                              <p className="mt-3 text-xs font-semibold text-home-leaf">
                                Using this address for delivery
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {isOrderingForBuyer && addresses.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-home-forest/50">
                              Saved addresses (optional)
                            </p>
                            <ul className="space-y-2">
                              {addresses.map((addr) => {
                                const active = String(addr._id) === String(selectedId);
                                return (
                                  <li key={addr._id}>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedId(addr._id)}
                                      className={`w-full rounded-2xl border p-3 text-left text-sm transition ${
                                        active
                                          ? 'border-home-leaf bg-home-mint/15 ring-1 ring-home-leaf/30'
                                          : 'border-home-line bg-white hover:border-home-leaf/40'
                                      }`}
                                    >
                                      <p className="font-semibold text-home-forest">{addr.fullName}</p>
                                      <p className="mt-0.5 text-home-forest/70">
                                        {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                                      </p>
                                      <p className="mt-0.5 text-home-forest/60">Mobile: {addr.mobile}</p>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                            {selectedId && deliveryProfile?.shopAddress?.trim() ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-home-leaf hover:underline"
                                onClick={() => setSelectedId(null)}
                              >
                                Use shop profile address instead
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-5 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-center">
                        <p className="text-sm font-semibold text-amber-900">No shop address on file</p>
                        <p className="mt-1 text-xs text-amber-800/80">
                          {isOrderingForBuyer
                            ? 'Ask the selected buyer to add their shop address in Settings.'
                            : 'Add your shop address in Settings before placing an order.'}
                        </p>
                        {!isOrderingForBuyer ? (
                          <Link
                            to="/settings"
                            className="mt-3 inline-block text-sm font-semibold text-home-leaf underline"
                          >
                            Go to Settings
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-home-forest">
                      Delivery address
                    </h2>
                    <p className="mt-1 text-sm text-home-forest/60">
                      Choose a saved address or add a new one
                    </p>
                  </div>
                  <Button type="button" variant="secondary" onClick={openAddForm}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add address
                  </Button>
                </div>

                {loadingAddresses ? (
                  <p className="mt-6 text-sm text-home-forest/50">Loading addresses…</p>
                ) : addresses.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-home-line bg-home-sand/30 px-4 py-8 text-center">
                    <MapPin className="mx-auto h-8 w-8 text-home-leaf/50" />
                    <p className="mt-2 text-sm font-semibold text-home-forest">No saved addresses</p>
                    <p className="mt-1 text-xs text-home-forest/55">
                      Add an address to continue checkout
                    </p>
                    <Button type="button" className="mt-4" onClick={openAddForm}>
                      Add new address
                    </Button>
                  </div>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {addresses.map((addr) => {
                      const active = String(addr._id) === String(selectedId);
                      return (
                        <li key={addr._id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(addr._id)}
                            className={`w-full rounded-2xl border p-4 text-left transition ${
                              active
                                ? 'border-home-leaf bg-home-mint/15 shadow-sm ring-1 ring-home-leaf/30'
                                : 'border-home-line bg-white hover:border-home-leaf/40'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                  active
                                    ? 'bg-home-leaf text-white'
                                    : 'bg-home-sand text-home-forest/60'
                                }`}
                              >
                                <LabelIcon label={addr.label} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-home-forest">
                                    {addr.label || 'Home'}
                                  </span>
                                  {addr.isDefault ? (
                                    <span className="rounded-md bg-home-leaf/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-home-leaf">
                                      Default
                                    </span>
                                  ) : null}
                                  {active ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-home-leaf">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm font-semibold text-home-forest">
                                  {addr.fullName} · {addr.mobile}
                                </p>
                                <p className="mt-0.5 text-sm text-home-forest/65">
                                  {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-home-forest/40 hover:bg-fog hover:text-danger"
                                onClick={(e) => removeAddress(addr._id, e)}
                                aria-label="Delete address"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                  </>
                )}
              </section>
            </div>

            <aside className="h-fit overflow-hidden rounded-2xl border border-home-line bg-white shadow-sm">
              <div className="bg-gradient-to-br from-home-leaf to-home-forest px-5 py-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  Amount payable
                </p>
                <p className="mt-1 font-display text-3xl font-bold">{formatCurrency(total)}</p>
                <p className="mt-1 text-xs text-white/75">Inclusive of applicable taxes</p>
              </div>

              <div className="space-y-4 p-5">
                {selected && !isStockistProcurement ? (
                  <div className="rounded-xl bg-home-sand/40 px-3 py-2.5 text-xs text-home-forest/75">
                    <p className="font-semibold text-home-forest">Delivering to {selected.label}</p>
                    <p className="mt-0.5 line-clamp-2">
                      {selected.fullName}, {selected.address}, {selected.city}
                    </p>
                  </div>
                ) : isStockistProcurement && user?.shopAddress?.trim() ? (
                  <div className="rounded-xl bg-home-sand/40 px-3 py-2.5 text-xs text-home-forest/75">
                    <p className="font-semibold text-home-forest">Delivering to your shop</p>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-line">{shopAddressText()}</p>
                  </div>
                ) : isB2BProcurement && shopAddressText() ? (
                  <div className="rounded-xl bg-home-sand/40 px-3 py-2.5 text-xs text-home-forest/75">
                    <p className="font-semibold text-home-forest">Delivering to your shop</p>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-line">{shopAddressText()}</p>
                  </div>
                ) : (
                  <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    Select a delivery address to continue
                  </p>
                )}

                {showVoucher ? (
                  <div className="rounded-xl border border-home-line bg-home-sand/30 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-home-forest">
                      <Tag className="h-4 w-4 text-home-leaf" />
                      Voucher
                    </div>
                    {voucher?.code ? (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-home-mint/20 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-home-forest">
                            {voucher.code}
                          </p>
                          {voucher.description ? (
                            <p className="truncate text-xs text-home-forest/60">
                              {voucher.description}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-home-forest/50 hover:bg-white hover:text-danger"
                          onClick={removeVoucher}
                          aria-label="Remove voucher"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {eligibleVouchers.length ? (
                          <div className="mt-2 space-y-1.5">
                            {eligibleVouchers.map((v) => (
                              <div
                                key={v._id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-home-mint/20 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-home-forest">
                                    {v.code} — unlocked
                                  </p>
                                  {v.description ? (
                                    <p className="truncate text-xs text-home-forest/60">
                                      {v.description}
                                    </p>
                                  ) : null}
                                </div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="shrink-0 !py-1.5 text-xs"
                                  onClick={() => applyVoucherCode(v.code)}
                                  disabled={applyingVoucher}
                                >
                                  Claim
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-2 flex gap-2">
                          <Input
                            value={voucherInput}
                            onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                            placeholder="Enter code"
                            className="!py-2 text-sm"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            className="shrink-0"
                            onClick={applyVoucher}
                            disabled={applyingVoucher}
                          >
                            {applyingVoucher ? '…' : 'Apply'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                <div className="flex items-center justify-between text-sm text-home-forest/70">
                  <span>Items ({items.reduce((n, i) => n + i.qty, 0)})</span>
                  <span className="font-semibold text-home-forest">{formatCurrency(subtotal)}</span>
                </div>
                {voucherDiscount > 0 ? (
                  <div className="flex items-center justify-between text-sm text-rose-600">
                    <span>Voucher discount</span>
                    <span className="font-semibold">−{formatCurrency(voucherDiscount)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-home-line pt-3 text-sm font-bold text-home-forest">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                {isB2BChannelCheckout ? (
                  <p className="rounded-xl border border-home-line bg-home-sand/30 px-3 py-2.5 text-xs text-home-forest/75">
                    {isOrderingForBuyer
                      ? 'Order goes to Distributor Orders for review and invoice. The distributor pays after the invoice is ready.'
                      : 'Payment is collected after your supplier reviews the order and generates an invoice.'}
                  </p>
                ) : null}

                <label className="flex items-start gap-2 text-sm text-home-forest/80">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span>
                    I agree to the{' '}
                    <Link to="/terms" className="font-semibold text-home-leaf underline">
                      Terms &amp; Conditions
                    </Link>
                  </span>
                </label>

                {isB2BChannelCheckout ? (
                  <Button
                    className="flex w-full items-center justify-center gap-2 !py-3 text-base"
                    onClick={placeB2BOrder}
                    disabled={placing || !resolveShippingAddress()}
                  >
                    {placing ? 'Placing order…' : `Place order · ${formatCurrency(total)}`}
                  </Button>
                ) : (
                  <Button
                    className="flex w-full items-center justify-center gap-2 !py-3 text-base"
                    onClick={payNow}
                    disabled={placing || !resolveShippingAddress()}
                  >
                    {placing ? (
                      'Processing…'
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5" />
                        Pay {formatCurrency(total)}
                      </>
                    )}
                  </Button>
                )}

                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-home-forest/50">
                  <Lock className="h-3.5 w-3.5" />
                  {isB2BChannelCheckout
                    ? isOrderingForBuyer
                      ? 'Review & invoice in Distributor Orders, then distributor pays'
                      : 'Order is reviewed and invoiced before payment'
                    : isStockist
                      ? 'Pay on credit or use Razorpay · UPI, cards & netbanking'
                      : 'Secured by Razorpay · UPI, cards & netbanking'}
                </p>
              </div>
            </aside>
          </div>
        )}
    </>
  );

  if (isStockist) {
    return (
      <AppShell showFooter mainClassName={cartMainClass}>
        {cartContent}
        <Modal open={formOpen} title="Add new address" onClose={() => setFormOpen(false)} wide>
        <form onSubmit={saveAddress} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Select
              label="Save as"
              value={form.label}
              onChange={(e) => setField('label', e.target.value)}
            >
              <option value="Home">Home</option>
              <option value="Work">Work</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <Input
            label="Full name"
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            error={errors.fullName}
            required
          />
          <Input
            label="Mobile"
            value={form.mobile}
            onChange={(e) => setField('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
            error={errors.mobile}
            maxLength={10}
            required
          />
          <div className="sm:col-span-2">
            <TextArea
              label="Address"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              error={errors.address}
              rows={3}
              required
            />
          </div>
          <Input
            label="City"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            error={errors.city}
            required
          />
          <Input
            label="State"
            value={form.state}
            onChange={(e) => setField('state', e.target.value)}
            error={errors.state}
            required
          />
          <Input
            label="Pincode"
            value={form.pincode}
            onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={errors.pincode}
            maxLength={6}
            required
          />
          <label className="flex items-center gap-2 self-end text-sm text-home-forest/80 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setField('isDefault', e.target.checked)}
            />
            Set as default address
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" disabled={savingAddress}>
              {savingAddress ? 'Saving…' : 'Save address'}
            </Button>
          </div>
        </form>
      </Modal>
      </AppShell>
    );
  }

  return (
    <div className="home-theme flex min-h-screen flex-col bg-white">
      <HomeNavbar />
      <main className={cartMainClass}>{cartContent}</main>
      <SiteFooter />
      <Modal open={formOpen} title="Add new address" onClose={() => setFormOpen(false)} wide>
        <form onSubmit={saveAddress} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Select
              label="Save as"
              value={form.label}
              onChange={(e) => setField('label', e.target.value)}
            >
              <option value="Home">Home</option>
              <option value="Work">Work</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <Input
            label="Full name"
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            error={errors.fullName}
            required
          />
          <Input
            label="Mobile"
            value={form.mobile}
            onChange={(e) => setField('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
            error={errors.mobile}
            maxLength={10}
            required
          />
          <div className="sm:col-span-2">
            <TextArea
              label="Address"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              error={errors.address}
              rows={3}
              required
            />
          </div>
          <Input
            label="City"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            error={errors.city}
            required
          />
          <Input
            label="State"
            value={form.state}
            onChange={(e) => setField('state', e.target.value)}
            error={errors.state}
            required
          />
          <Input
            label="Pincode"
            value={form.pincode}
            onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={errors.pincode}
            maxLength={6}
            required
          />
          <label className="flex items-center gap-2 self-end text-sm text-home-forest/80 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setField('isDefault', e.target.checked)}
            />
            Set as default address
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" disabled={savingAddress}>
              {savingAddress ? 'Saving…' : 'Save address'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
