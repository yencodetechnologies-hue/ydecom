import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'ydecom_cart';
const VOUCHER_KEY = 'ydecom_voucher';

const loadCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadVoucher = () => {
  try {
    const raw = localStorage.getItem(VOUCHER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.code ? parsed : null;
  } catch {
    return null;
  }
};

const persist = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const persistVoucher = (voucher) => {
  if (!voucher) {
    localStorage.removeItem(VOUCHER_KEY);
    return;
  }
  localStorage.setItem(VOUCHER_KEY, JSON.stringify(voucher));
};

/** Normalize product min/step; missing values default to 1. */
export const resolveOrderRules = (minQuantity, moq) => ({
  minQuantity: Math.max(1, Number(minQuantity) || 1),
  moq: Math.max(1, Number(moq) || 1),
});

/**
 * Snap a typed quantity to a valid value (>= min, congruent mod moq, <= maxStock).
 * Returns null when the result would fall below minQuantity.
 */
export const snapOrderQty = (raw, minQuantity, moq, maxStock = null) => {
  const { minQuantity: minQ, moq: step } = resolveOrderRules(minQuantity, moq);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  let q = Math.round(parsed);
  if (q < minQ) return null;

  const offset = (q - minQ) % step;
  if (offset !== 0) {
    const down = q - offset;
    const up = down + step;
    q = q - down <= up - q ? down : up;
    if (q < minQ) q = minQ;
  }

  const cap = maxStock != null ? Number(maxStock) : null;
  if (cap != null && q > cap) {
    let capped = Math.floor(cap);
    const off = (capped - minQ) % step;
    if (off !== 0) capped -= off;
    if (capped < minQ) return null;
    q = capped;
  }

  return q;
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: loadCart(),
    voucher: loadVoucher(),
  },
  reducers: {
    addToCart: (state, action) => {
      const {
        productId,
        name,
        image,
        price,
        mrp = null,
        discountPercent = 0,
        qty = 1,
        maxStock = null,
        minQuantity = 1,
        moq = 1,
      } = action.payload;
      const { minQuantity: minQ, moq: step } = resolveOrderRules(minQuantity, moq);
      const existing = state.items.find((i) => i.productId === productId);
      const cap = maxStock != null ? Number(maxStock) : null;

      if (existing) {
        const snapped = snapOrderQty(existing.qty + step, minQ, step, cap);
        if (snapped != null && snapped > existing.qty) {
          existing.qty = snapped;
        }
        existing.price = price ?? existing.price;
        if (mrp != null) existing.mrp = mrp;
        if (discountPercent != null) existing.discountPercent = discountPercent;
        if (cap != null) existing.maxStock = cap;
        existing.minQuantity = minQ;
        existing.moq = step;
      } else {
        let nextQty = Number(qty);
        if (!Number.isFinite(nextQty) || nextQty < minQ) nextQty = minQ;
        const snapped = snapOrderQty(nextQty, minQ, step, cap);
        if (snapped == null) {
          persist(state.items);
          return;
        }
        state.items.push({
          productId,
          name,
          image: image || '',
          price: price ?? null,
          mrp: mrp ?? null,
          discountPercent: discountPercent || 0,
          qty: snapped,
          maxStock: cap,
          minQuantity: minQ,
          moq: step,
        });
      }
      persist(state.items);
    },
    updateQty: (state, action) => {
      const { productId, qty } = action.payload;
      const item = state.items.find((i) => i.productId === productId);
      if (!item) return;

      const { minQuantity: minQ, moq: step } = resolveOrderRules(item.minQuantity, item.moq);
      const cap = item.maxStock != null ? Number(item.maxStock) : null;
      const nextQty = snapOrderQty(qty, minQ, step, cap);

      if (nextQty == null) {
        state.items = state.items.filter((i) => i.productId !== productId);
        persist(state.items);
        return;
      }

      item.qty = nextQty;
      persist(state.items);
    },
    removeFromCart: (state, action) => {
      state.items = state.items.filter((i) => i.productId !== action.payload);
      persist(state.items);
    },
    clearCart: (state) => {
      state.items = [];
      state.voucher = null;
      persist(state.items);
      persistVoucher(null);
    },
    setVoucher: (state, action) => {
      state.voucher = action.payload || null;
      persistVoucher(state.voucher);
    },
    clearVoucher: (state) => {
      state.voucher = null;
      persistVoucher(null);
    },
    syncStockLevels: (state, action) => {
      const updates = Array.isArray(action.payload) ? action.payload : [];
      for (const { productId, maxStock, minQuantity, moq } of updates) {
        const item = state.items.find((i) => String(i.productId) === String(productId));
        if (!item) continue;
        const cap = maxStock != null ? Number(maxStock) : null;
        item.maxStock = cap;
        if (minQuantity != null) {
          item.minQuantity = Math.max(1, Number(minQuantity) || 1);
        }
        if (moq != null) {
          item.moq = Math.max(1, Number(moq) || 1);
        }
        const { minQuantity: minQ, moq: step } = resolveOrderRules(item.minQuantity, item.moq);
        const snapped = snapOrderQty(item.qty, minQ, step, cap);
        if (snapped == null) {
          item.qty = 0;
        } else {
          item.qty = snapped;
        }
      }
      state.items = state.items.filter(
        (i) => i.qty > 0 && (i.maxStock == null || i.maxStock > 0)
      );
      persist(state.items);
    },
  },
});

export const {
  addToCart,
  updateQty,
  removeFromCart,
  clearCart,
  setVoucher,
  clearVoucher,
  syncStockLevels,
} = cartSlice.actions;

export const selectCartItems = (s) => s.cart.items;
export const selectCartCount = (s) => s.cart.items.length;
export const selectCartSubtotal = (s) =>
  s.cart.items.reduce((sum, i) => sum + (Number(i.price) || 0) * i.qty, 0);
export const selectCartVoucher = (s) => s.cart.voucher;
export const selectCartVoucherDiscount = (s) => Number(s.cart.voucher?.discount) || 0;
export const selectCartTotal = (s) => {
  const subtotal = selectCartSubtotal(s);
  const discount = selectCartVoucherDiscount(s);
  return Math.max(0, Math.round((subtotal - discount) * 100) / 100);
};

export default cartSlice.reducer;
