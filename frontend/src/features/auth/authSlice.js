import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../api';

const storedUser = (() => {
  try {
    return JSON.parse(localStorage.getItem('ydecom_user') || 'null');
  } catch {
    return null;
  }
})();

export const loginUser = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await authApi.login(payload);
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Login failed', code: 'ERROR' });
  }
});

export const registerUser = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await authApi.register(payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Registration failed' });
  }
});

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authApi.me();
    return data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: 'Session expired' });
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser,
    token: localStorage.getItem('ydecom_token'),
    loading: false,
    error: null,
    pendingApproval: false,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.pendingApproval = false;
      localStorage.removeItem('ydecom_token');
      localStorage.removeItem('ydecom_user');
    },
    clearAuthError: (state) => {
      state.error = null;
      state.pendingApproval = false;
    },
    setUserAddresses: (state, action) => {
      if (!state.user) return;
      state.user = { ...state.user, addresses: action.payload || [] };
      localStorage.setItem('ydecom_user', JSON.stringify(state.user));
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.pendingApproval = false;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem('ydecom_token', action.payload.token);
        localStorage.setItem('ydecom_user', JSON.stringify(action.payload.user));
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Login failed';
        state.pendingApproval = action.payload?.code === 'PENDING_APPROVAL';
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Registration failed';
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        localStorage.setItem('ydecom_user', JSON.stringify(action.payload));
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.token = null;
        localStorage.removeItem('ydecom_token');
        localStorage.removeItem('ydecom_user');
      });
  },
});

export const { logout, clearAuthError, setUserAddresses } = authSlice.actions;
export default authSlice.reducer;
