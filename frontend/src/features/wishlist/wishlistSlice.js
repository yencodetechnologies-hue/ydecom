import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { wishlistApi } from '../../api';
import { logout } from '../auth/authSlice';

export const fetchWishlistIds = createAsyncThunk(
  'wishlist/fetchIds',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await wishlistApi.ids();
      return (data.data || []).map(String);
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: 'Failed to load wishlist' });
    }
  }
);

export const toggleWishlist = createAsyncThunk(
  'wishlist/toggle',
  async (productId, { getState, rejectWithValue }) => {
    const id = String(productId);
    const ids = getState().wishlist.ids;
    try {
      if (ids.includes(id)) {
        await wishlistApi.remove(id);
        return { productId: id, added: false };
      }
      await wishlistApi.add(id);
      return { productId: id, added: true };
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: 'Wishlist update failed' });
    }
  }
);

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: {
    ids: [],
    loading: false,
  },
  reducers: {
    clearWishlist: (state) => {
      state.ids = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlistIds.fulfilled, (state, action) => {
        state.ids = action.payload;
        state.loading = false;
      })
      .addCase(fetchWishlistIds.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWishlistIds.rejected, (state) => {
        state.loading = false;
      })
      .addCase(toggleWishlist.fulfilled, (state, action) => {
        const { productId, added } = action.payload;
        if (added) {
          if (!state.ids.includes(productId)) state.ids.push(productId);
        } else {
          state.ids = state.ids.filter((id) => id !== productId);
        }
      })
      .addCase(logout, (state) => {
        state.ids = [];
      });
  },
});

export const { clearWishlist } = wishlistSlice.actions;
export const selectWishlistIds = (s) => s.wishlist.ids;
export const selectWishlistCount = (s) => s.wishlist.ids.length;
export default wishlistSlice.reducer;
