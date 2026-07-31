import { createSlice } from '@reduxjs/toolkit';
import { logout } from '../auth/authSlice';

const STORAGE_KEY = 'ydecom_buyer_context';

const summarizeBuyer = (buyer) => {
  if (!buyer) return null;
  return {
    _id: buyer._id,
    name: buyer.name,
    mobile: buyer.mobile || '',
    email: buyer.email || '',
    shopName: buyer.shopName || '',
    shopAddress: buyer.shopAddress || '',
    shopPhone: buyer.shopPhone || '',
    businessEmail: buyer.businessEmail || '',
    gstNumber: buyer.gstNumber || '',
    panNumber: buyer.panNumber || '',
    role: buyer.role,
    marginValue: buyer.marginValue,
  };
};

const load = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { selectedBuyerId: null, selectedBuyer: null };
    const parsed = JSON.parse(raw);
    return {
      selectedBuyerId: parsed.selectedBuyerId || null,
      selectedBuyer: parsed.selectedBuyer || null,
    };
  } catch {
    return { selectedBuyerId: null, selectedBuyer: null };
  }
};

const persist = (state) => {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      selectedBuyerId: state.selectedBuyerId,
      selectedBuyer: state.selectedBuyer,
    })
  );
};

const initial = load();

const buyerContextSlice = createSlice({
  name: 'buyerContext',
  initialState: {
    selectedBuyerId: initial.selectedBuyerId,
    selectedBuyer: initial.selectedBuyer,
    network: [],
    networkLoaded: false,
  },
  reducers: {
    setNetwork: (state, action) => {
      state.network = action.payload || [];
      state.networkLoaded = true;
      // Drop stale selection if child no longer in network
      if (
        state.selectedBuyerId &&
        !state.network.some((u) => String(u._id) === String(state.selectedBuyerId))
      ) {
        state.selectedBuyerId = null;
        state.selectedBuyer = null;
        persist(state);
      } else if (state.selectedBuyerId) {
        // Refresh selected buyer details from network (shop address, etc.)
        const fresh = state.network.find((u) => String(u._id) === String(state.selectedBuyerId));
        if (fresh) {
          state.selectedBuyer = summarizeBuyer(fresh);
          persist(state);
        }
      }
    },
    setSelectedBuyer: (state, action) => {
      const buyer = action.payload;
      if (!buyer) {
        state.selectedBuyerId = null;
        state.selectedBuyer = null;
      } else {
        state.selectedBuyerId = buyer._id;
        state.selectedBuyer = summarizeBuyer(buyer);
      }
      persist(state);
    },
    clearBuyerContext: (state) => {
      state.selectedBuyerId = null;
      state.selectedBuyer = null;
      state.network = [];
      state.networkLoaded = false;
      sessionStorage.removeItem(STORAGE_KEY);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, (state) => {
      state.selectedBuyerId = null;
      state.selectedBuyer = null;
      state.network = [];
      state.networkLoaded = false;
      sessionStorage.removeItem(STORAGE_KEY);
    });
  },
});

export const { setNetwork, setSelectedBuyer, clearBuyerContext } = buyerContextSlice.actions;

export const selectSelectedBuyerId = (s) => s.buyerContext.selectedBuyerId;
export const selectSelectedBuyer = (s) => s.buyerContext.selectedBuyer;
export const selectNetwork = (s) => s.buyerContext.network;

export default buyerContextSlice.reducer;
