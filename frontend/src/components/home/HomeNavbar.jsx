import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Heart, Menu, Search, ShoppingCart, User } from 'lucide-react';
import { categoriesApi, usersApi } from '../../api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectCartCount } from '../../features/cart/cartSlice';
import { clearCart } from '../../features/cart/cartSlice';
import { selectWishlistCount } from '../../features/wishlist/wishlistSlice';
import {
  selectNetwork,
  selectSelectedBuyer,
  selectSelectedBuyerId,
  setNetwork,
  setSelectedBuyer,
} from '../../features/buyer/buyerContextSlice';
import NotificationDropdown from '../ui/NotificationDropdown';
import { roleLabel } from '../../utils/helpers';

const PARENT_ROLES = ['stockist', 'distributor', 'salesman'];
const B2B_SHOP_ROLES = ['stockist', 'distributor', 'retailer', 'reseller', 'salesman'];

export default function HomeNavbar({ onMenu, compact = false }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [catOpen, setCatOpen] = useState(false);
  const [buyerOpen, setBuyerOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const cartCount = useAppSelector(selectCartCount);
  const wishlistCount = useAppSelector(selectWishlistCount);
  const { token, user } = useAppSelector((s) => s.auth);
  const network = useAppSelector(selectNetwork);
  const selectedBuyer = useAppSelector(selectSelectedBuyer);
  const selectedBuyerId = useAppSelector(selectSelectedBuyerId);
  const showBuyerSelector = token && PARENT_ROLES.includes(user?.role);
  const isSalesman = user?.role === 'salesman';
  const isB2BShop = B2B_SHOP_ROLES.includes(user?.role);
  const homeHref = isB2BShop ? '/shop' : '/';
  const childLabel = (() => {
    if (user?.role === 'salesman') {
      const t = user?.assignmentPartnerType;
      if (t) return roleLabel(t);
      return 'Partner';
    }
    if (user?.role === 'stockist') return 'Distributor';
    return 'Retailer / Reseller';
  })();
  const accountPath = !token
    ? '/login'
    : user?.role === 'customer'
      ? '/orders'
      : user?.role === 'salesman'
        ? '/shop'
        : '/dashboard';

  useEffect(() => {
    if (location.pathname === '/shop') {
      setSearchQuery(searchParams.get('search') || '');
    }
  }, [location.pathname, searchParams]);

  const submitSearch = (e) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    const next = new URLSearchParams();
    if (location.pathname === '/shop') {
      const category = searchParams.get('category');
      if (category) next.set('category', category);
    }
    if (q) next.set('search', q);
    const qs = next.toString();
    navigate(qs ? `/shop?${qs}` : '/shop');
  };

  useEffect(() => {
    let active = true;
    categoriesApi
      .listPublic()
      .then((res) => {
        if (active) setCategories(res.data?.data || []);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showBuyerSelector) return undefined;
    let active = true;
    usersApi
      .network()
      .then((res) => {
        if (active) dispatch(setNetwork(res.data?.data || []));
      })
      .catch(() => {
        if (active) dispatch(setNetwork([]));
      });
    return () => {
      active = false;
    };
  }, [showBuyerSelector, user?._id, dispatch]);

  const pickBuyer = (buyer) => {
    if (isSalesman && !buyer) return;
    const nextId = buyer?._id || null;
    const prevId = selectedBuyerId || null;
    if (String(nextId) !== String(prevId)) {
      dispatch(clearCart());
    }
    dispatch(setSelectedBuyer(buyer));
    setBuyerOpen(false);
  };

  const buyerButtonLabel = selectedBuyer
    ? `${selectedBuyer.name}${selectedBuyer.shopName ? ` · ${selectedBuyer.shopName}` : ''}`
    : isSalesman
      ? `Select ${childLabel.toLowerCase()}`
      : `Myself (${user?.role})`;

  return (
    <header className="sticky top-0 z-20 border-b border-home-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3.5 sm:gap-4 sm:px-8">
        {onMenu ? (
          <button
            type="button"
            onClick={onMenu}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-home-line text-home-forest hover:bg-home-sand lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}

        <Link to={homeHref} className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-home-leaf font-display text-sm font-bold text-white">
            Y
          </span>
          <span className="font-display text-lg font-bold text-home-forest">YDecom</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-6 md:flex">
          {!compact ? (
            isB2BShop ? (
              <Link to="/shop" className="text-sm font-semibold text-home-forest">
                Shop
              </Link>
            ) : (
              <>
                <Link to="/" className="text-sm font-semibold text-home-forest">
                  Home
                </Link>
                <Link to="/shop" className="text-sm font-semibold text-home-forest/80 hover:text-home-forest">
                  Shop
                </Link>
              </>
            )
          ) : null}
          <div
            className="relative"
            onMouseEnter={() => setCatOpen(true)}
            onMouseLeave={() => setCatOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-semibold text-home-forest/80 hover:text-home-forest"
            >
              Categories
              <ChevronDown className="h-4 w-4" />
            </button>
            {catOpen && (
              <div className="absolute left-0 top-full max-h-80 w-56 overflow-y-auto rounded-xl border border-home-line bg-white p-2 shadow-lg">
                <Link
                  to="/shop"
                  className="block rounded-lg px-3 py-2 text-sm font-semibold text-home-forest hover:bg-home-mint/20"
                >
                  All products
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c._id}
                    to={`/shop?category=${c._id}`}
                    className="block rounded-lg px-3 py-2 text-sm text-home-forest/80 hover:bg-home-mint/20 hover:text-home-forest"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {showBuyerSelector ? (
          <div className="relative hidden min-w-[12rem] max-w-xs sm:block">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-home-forest/50">
              Order as
            </p>
            <button
              type="button"
              onClick={() => setBuyerOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-home-line bg-home-sand/50 px-3 py-2 text-left text-sm font-medium text-home-forest"
            >
              <span className="truncate">{buyerButtonLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </button>
            {buyerOpen ? (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-home-line bg-white p-1.5 shadow-lg">
                {!isSalesman ? (
                  <button
                    type="button"
                    onClick={() => pickBuyer(null)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-home-mint/20 ${
                      !selectedBuyerId ? 'font-semibold text-home-leaf' : 'text-home-forest'
                    }`}
                  >
                    Myself ({user?.role})
                  </button>
                ) : null}
                {network.length ? (
                  <>
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase text-home-forest/40">
                      {childLabel}s
                    </p>
                    {network.map((child) => (
                      <button
                        key={child._id}
                        type="button"
                        onClick={() => pickBuyer(child)}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-home-mint/20 ${
                          String(selectedBuyerId) === String(child._id)
                            ? 'font-semibold text-home-leaf'
                            : 'text-home-forest'
                        }`}
                      >
                        <span className="block truncate">{child.name}</span>
                        {child.shopName ? (
                          <span className="block truncate text-xs text-home-forest/50">
                            {child.shopName}
                            {child.marginValue != null ? ` · ${child.marginValue}%` : ''}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="px-3 py-2 text-xs text-home-forest/60">
                    No assigned {childLabel.toLowerCase()}s.
                    {isSalesman
                      ? ' Ask admin to assign partners to your account.'
                      : user?.role === 'stockist'
                        ? ' Ask admin to assign distributors to your account.'
                        : ' Ask your stockist/admin to assign buyers.'}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <form
          onSubmit={submitSearch}
          className="flex min-w-0 flex-1 items-center rounded-lg bg-home-sand/70 px-3 py-2 sm:px-4 sm:py-2.5"
          role="search"
        >
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for Products"
            aria-label="Search for products"
            className="min-w-0 w-full bg-transparent text-sm text-home-forest placeholder:text-home-forest/50 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 text-home-leaf hover:text-home-forest"
            aria-label="Search"
          >
            <Search className="h-4.5 w-4.5" />
          </button>
        </form>

        <div className="ml-auto flex items-center gap-3.5 sm:gap-4">
          {compact && token ? <NotificationDropdown tone="home" /> : null}
          {!isSalesman ? (
            <Link
              to={token ? '/wishlist' : '/login'}
              state={token ? undefined : { from: '/wishlist' }}
              aria-label="Wishlist"
              className="relative text-home-forest/60 hover:text-home-leaf"
            >
              <Heart className="h-5.5 w-5.5" />
              {token && wishlistCount > 0 ? (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {wishlistCount > 99 ? '99+' : wishlistCount}
                </span>
              ) : null}
            </Link>
          ) : null}
          <Link
            to={token ? '/cart' : '/login'}
            state={token ? undefined : { from: '/cart' }}
            aria-label="Cart"
            className="relative text-home-forest/60 hover:text-home-leaf"
          >
            <ShoppingCart className="h-5.5 w-5.5" />
            {cartCount > 0 ? (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-home-leaf px-1 text-[10px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </Link>
          <Link
            to={accountPath}
            aria-label="Account"
            className="text-home-forest/60 hover:text-home-leaf"
          >
            <User className="h-5.5 w-5.5" />
          </Link>
        </div>
      </div>

      {showBuyerSelector ? (
        <div className="border-t border-home-line bg-home-sand/40 px-5 py-2 sm:hidden">
          <label className="mb-1 block text-[10px] font-semibold uppercase text-home-forest/50">
            Order as
          </label>
          <select
            className="w-full rounded-lg border border-home-line bg-white px-3 py-2 text-sm text-home-forest"
            value={selectedBuyerId || ''}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                if (!isSalesman) pickBuyer(null);
                return;
              }
              const child = network.find((n) => String(n._id) === id);
              if (child) pickBuyer(child);
            }}
          >
            {!isSalesman ? <option value="">Myself ({user?.role})</option> : (
              <option value="" disabled>
                Select {childLabel.toLowerCase()}
              </option>
            )}
            {network.map((child) => (
              <option key={child._id} value={child._id}>
                {child.name}
                {child.shopName ? ` · ${child.shopName}` : ''}
              </option>
            ))}
          </select>
          {network.length === 0 ? (
            <p className="mt-1 text-[11px] text-home-forest/55">
              {isSalesman
                ? 'No partners assigned — ask admin to assign them to your account.'
                : user?.role === 'stockist'
                  ? 'No distributors assigned — ask admin to assign them to your account.'
                  : 'No assigned buyers yet.'}
            </p>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
