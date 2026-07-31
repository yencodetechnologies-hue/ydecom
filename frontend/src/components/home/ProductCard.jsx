import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Minus, Plus, ShoppingBasket, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { productsApi } from '../../api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  addToCart,
  removeFromCart,
  resolveOrderRules,
  selectCartItems,
  snapOrderQty,
  updateQty,
} from '../../features/cart/cartSlice';
import { selectSelectedBuyer, selectSelectedBuyerId } from '../../features/buyer/buyerContextSlice';
import { toggleWishlist } from '../../features/wishlist/wishlistSlice';
import ExpressInterestModal from '../products/ExpressInterestModal';
import { getImageUrl, formatCurrency, PRODUCT_INTEREST_ROLES } from '../../utils/helpers';

function ProductCartQty({ productId, qty, maxStock, minQuantity = 1, moq = 1 }) {
  const dispatch = useAppDispatch();
  const [value, setValue] = useState(String(qty));
  const { minQuantity: minQ, moq: step } = resolveOrderRules(minQuantity, moq);

  useEffect(() => {
    setValue(String(qty));
  }, [qty]);

  const applyQty = (next) => {
    if (next < minQ) {
      dispatch(removeFromCart(productId));
      return;
    }
    const snapped = snapOrderQty(next, minQ, step, maxStock);
    if (snapped == null) {
      dispatch(removeFromCart(productId));
      return;
    }
    if (maxStock != null && next > maxStock && snapped < next) {
      toast.error(`Only ${maxStock} available in stock`);
    }
    setValue(String(snapped));
    if (snapped !== qty) {
      dispatch(updateQty({ productId, qty: snapped }));
    }
  };

  const commitQty = () => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < minQ) {
      setValue(String(qty));
      return;
    }
    applyQty(parsed);
  };

  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const canIncrease = maxStock == null || qty + step <= maxStock;

  return (
    <div
      className="mt-3 flex w-full items-center justify-between gap-1 rounded-xl border border-home-leaf bg-home-mint/20 px-2 py-1.5"
      onClick={stop}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={(e) => {
          stop(e);
          applyQty(qty - step);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-home-forest transition hover:bg-white/80"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        min={minQ}
        step={step}
        max={maxStock ?? undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commitQty}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onClick={stop}
        className="w-12 min-w-0 flex-1 border-0 bg-transparent text-center text-sm font-semibold text-home-forest outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="Quantity"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={(e) => {
          stop(e);
          applyQty(qty + step);
        }}
        disabled={!canIncrease}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-home-forest transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ProductCard({
  product,
  interestedIds = [],
  interestQuantities = {},
  onInterestSubmitted,
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { token, user } = useAppSelector((s) => s.auth);
  const selectedBuyer = useAppSelector(selectSelectedBuyer);
  const selectedBuyerId = useAppSelector(selectSelectedBuyerId);
  const wishlistIds = useAppSelector((s) => s.wishlist.ids);
  const cartItems = useAppSelector(selectCartItems);
  const [submittingInterest, setSubmittingInterest] = useState(false);
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const {
    _id,
    name,
    category,
    price,
    mrp,
    images,
    discountPercent,
    availableStock,
    canExpressInterest,
    minQuantity,
    moq,
  } = product;
  const { minQuantity: minQ, moq: step } = resolveOrderRules(minQuantity, moq);
  const imageUrl = getImageUrl(images?.[0]);
  const selling = price != null ? Number(price) : null;
  const listMrp = mrp != null ? Number(mrp) : selling;
  const pct =
    discountPercent > 0
      ? Math.round(Number(discountPercent))
      : selling != null && listMrp != null && listMrp > selling
        ? Math.round(((listMrp - selling) / listMrp) * 100)
        : 0;
  const wishlisted = Boolean(token) && wishlistIds.includes(String(_id));
  const cartItem = cartItems.find((i) => String(i.productId) === String(_id));
  const inCart = Boolean(cartItem);
  const stock = availableStock != null ? Number(availableStock) : null;
  const outOfStock = stock !== null && stock <= 0;
  const effectiveRole = selectedBuyer?.role || user?.role;
  const isDistributor = effectiveRole === 'distributor';
  const isDownlineBuyer = effectiveRole === 'retailer' || effectiveRole === 'reseller';
  const isInterestRole = PRODUCT_INTEREST_ROLES.includes(effectiveRole);
  const showOutOfStockInterest = isInterestRole && outOfStock;
  const showInterestMode =
    (isDistributor || isDownlineBuyer) && canExpressInterest === true && !outOfStock;
  const alreadyInterested = interestedIds.includes(String(_id));
  const savedInterestQty = interestQuantities[String(_id)];
  const buyerId = selectedBuyerId || undefined;
  /** Stockist ordering for a distributor: stocked → cart; rest → Interest + qty. */
  const orderingForDistributor =
    user?.role === 'stockist' && selectedBuyer?.role === 'distributor';

  const requireLogin = (returnPath = '/') => {
    toast.error('Please log in to continue');
    navigate('/login', { state: { from: returnPath } });
  };

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      requireLogin('/cart');
      return;
    }
    if (outOfStock) {
      toast.error('Out of stock');
      return;
    }
    if (stock != null && stock < minQ) {
      toast.error(`Minimum order quantity is ${minQ}`);
      return;
    }
    if (selling == null) {
      toast.error('Price not available for this product');
      return;
    }
    dispatch(
      addToCart({
        productId: _id,
        name,
        image: images?.[0] || '',
        price: selling,
        mrp: listMrp ?? null,
        discountPercent: pct,
        qty: minQ,
        maxStock: stock,
        minQuantity: minQ,
        moq: step,
      })
    );
    toast.success('Added to cart');
  };

  const handleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      requireLogin('/wishlist');
      return;
    }
    try {
      const result = await dispatch(toggleWishlist(_id)).unwrap();
      toast.success(result.added ? 'Added to wishlist' : 'Removed from wishlist');
    } catch (err) {
      toast.error(err?.message || 'Wishlist update failed');
    }
  };

  const openInterestWithQty = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      requireLogin('/shop');
      return;
    }
    setInterestModalOpen(true);
  };

  const submitInterestWithQty = async (quantity) => {
    if (submittingInterest) return;
    setSubmittingInterest(true);
    try {
      await productsApi.expressInterest(_id, quantity, buyerId);
      toast.success(alreadyInterested ? 'Interest updated' : 'Interest submitted');
      onInterestSubmitted?.(_id, quantity);
      setInterestModalOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not submit interest');
    } finally {
      setSubmittingInterest(false);
    }
  };

  const hidePrice = showInterestMode && !orderingForDistributor;

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-home-line bg-white transition hover:shadow-md">
        <div className="relative flex h-44 items-center justify-center bg-home-sand/60">
          {pct > 0 && !hidePrice ? (
            <span className="absolute left-3 top-3 rounded-md bg-rose-600 px-2 py-1 text-xs font-bold text-white">
              -{pct}%
            </span>
          ) : null}

          <div className="absolute right-3 top-3">
            <button
              type="button"
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              onClick={handleWishlist}
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition ${
                wishlisted ? 'text-rose-600' : 'text-home-forest/60 hover:text-rose-600'
              }`}
            >
              <Heart className={`h-4 w-4 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>

          {imageUrl ? (
            <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <ShoppingBasket className="h-16 w-16 text-home-leaf/50" strokeWidth={1.4} />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-4">
          {category?.name ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-home-leaf/70">
              {category.name}
            </p>
          ) : null}

        <h3 className="truncate text-sm font-semibold text-home-forest">{name}</h3>

        {isInterestRole && stock != null ? (
          <p
            className={`text-xs font-medium ${outOfStock ? 'text-rose-600' : 'text-home-leaf/80'}`}
          >
            {outOfStock ? 'Out of stock (0 available)' : `${stock} in stock`}
          </p>
        ) : null}

        {!hidePrice &&
            (selling == null ? (
              <p className="mt-1 text-sm font-semibold text-home-forest/40">Price on request</p>
            ) : (
              <div className="mt-1 space-y-0.5">
                {listMrp != null && listMrp > selling ? (
                  <p className="text-xs text-home-forest/40 line-through">
                    MRP {formatCurrency(listMrp)}
                  </p>
                ) : null}
                <p className="text-sm font-bold text-home-forest">
                  Selling {formatCurrency(selling)}
                </p>
              </div>
            ))}

          {showInterestMode || showOutOfStockInterest ? (
            <button
              type="button"
              onClick={openInterestWithQty}
              disabled={submittingInterest}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-home-leaf px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-home-forest disabled:cursor-not-allowed disabled:opacity-60"
            >
              {alreadyInterested
                ? savedInterestQty
                  ? `Interest ✓ · Qty ${savedInterestQty}`
                  : 'Interest ✓ · Edit qty'
                : submittingInterest
                  ? 'Submitting…'
                  : 'Interest'}
            </button>
          ) : inCart ? (
            <ProductCartQty
              productId={_id}
              qty={cartItem.qty}
              maxStock={stock}
              minQuantity={cartItem.minQuantity ?? minQ}
              moq={cartItem.moq ?? step}
            />
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              disabled={selling == null || outOfStock}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-home-leaf px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-home-forest disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4" />
              {outOfStock ? 'Out of stock' : 'Add to Cart'}
            </button>
          )}
        </div>
      </div>

      <ExpressInterestModal
        open={interestModalOpen}
        productName={name}
        onClose={() => setInterestModalOpen(false)}
        onSubmit={submitInterestWithQty}
        submitting={submittingInterest}
        initialQuantity={savedInterestQty ?? 1}
        isEditing={alreadyInterested}
      />
    </>
  );
}
