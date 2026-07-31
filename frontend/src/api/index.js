import api from './axios';

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data, config = {}) => api.post('/auth/register', data, config),
  verifyRegisterOtp: (data) => api.post('/auth/verify-register-otp', data),
  resendRegisterOtp: (data) => api.post('/auth/resend-register-otp', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  me: () => api.get('/auth/me'),
};

export const usersApi = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return api.post('/users', data);
    }
    return api.post('/users', data);
  },
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
  setStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
  setActive: (id, isActive) => api.patch(`/users/${id}/active`, { isActive }),
  setPriceVisible: (id, priceVisible) => api.patch(`/users/${id}/price-visible`, { priceVisible }),
  setAssignment: (id, data) => api.patch(`/users/${id}/assignment`, data),
  network: () => api.get('/users/network'),
};

export const categoriesApi = {
  listPublic: () => api.get('/categories/public'),
  list: (params) => api.get('/categories', { params }),
  get: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  toggleActive: (id) => api.post(`/categories/${id}/toggle-active`, {}),
  remove: (id) => api.delete(`/categories/${id}`),
};

export const manufacturersApi = {
  listPublic: () => api.get('/manufacturers/public'),
  list: (params) => api.get('/manufacturers', { params }),
  get: (id) => api.get(`/manufacturers/${id}`),
  create: (data) => api.post('/manufacturers', data),
  update: (id, data) => api.put(`/manufacturers/${id}`, data),
  toggleActive: (id) => api.post(`/manufacturers/${id}/toggle-active`, {}),
  remove: (id) => api.delete(`/manufacturers/${id}`),
};

export const productsApi = {
  listPublic: (params) => api.get('/products/public', { params }),
  list: (params) => api.get('/products', { params }),
  get: (id, params) => api.get(`/products/${id}`, { params }),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  remove: (id) => api.delete(`/products/${id}`),
  togglePrice: (id) => api.post(`/products/${id}/toggle-price`, {}),
  listInterestIds: (buyerId) =>
    api.get('/products/interest/ids', { params: buyerId ? { buyerId } : {} }),
  listInterests: (params) => api.get('/products/interest', { params }),
  expressInterest: (productId, quantity, buyerId) =>
    api.post(`/products/${productId}/interest`, {
      ...(quantity != null ? { quantity } : {}),
      ...(buyerId ? { buyerId } : {}),
    }),
};

export const paymentsApi = {
  create: (data) => api.post('/payments/create', data),
  verify: (data) => api.post('/payments/verify', data),
  fail: (data) => api.post('/payments/fail', data),
  approve: (orderId, data) => api.post(`/payments/${orderId}/approve`, data || {}),
};

export const ordersApi = {
  list: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
  updateItems: (id, data) => api.patch(`/orders/${id}/items`, data),
  generateInvoice: (id) => api.post(`/orders/${id}/generate-invoice`),
  pay: (id, data) => {
    if (data instanceof FormData) {
      return api.post(`/orders/${id}/pay`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post(`/orders/${id}/pay`, data);
  },
  invoiceUrl: (id) => `${import.meta.env.VITE_API_URL || '/api'}/orders/${id}/invoice`,
  printUrl: (id) => `${import.meta.env.VITE_API_URL || '/api'}/orders/${id}/print`,
};

export const bannersApi = {
  listPublic: () => api.get('/banners/public'),
  list: () => api.get('/banners'),
  create: (data) => api.post('/banners', data),
  update: (id, data) => api.put(`/banners/${id}`, data),
  toggleActive: (id) => api.post(`/banners/${id}/toggle-active`, {}),
  remove: (id) => api.delete(`/banners/${id}`),
};

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const wishlistApi = {
  list: () => api.get('/wishlist'),
  ids: () => api.get('/wishlist/ids'),
  add: (productId) => api.post(`/wishlist/${productId}`),
  remove: (productId) => api.delete(`/wishlist/${productId}`),
};

export const addressesApi = {
  list: (params) => api.get('/addresses', { params }),
  create: (data) => api.post('/addresses', data),
  update: (id, data) => api.put(`/addresses/${id}`, data),
  remove: (id) => api.delete(`/addresses/${id}`),
  setDefault: (id) => api.patch(`/addresses/${id}/default`),
};

export const vouchersApi = {
  list: () => api.get('/vouchers'),
  get: (id) => api.get(`/vouchers/${id}`),
  usage: (id) => api.get(`/vouchers/${id}/usage`),
  create: (data) => api.post('/vouchers', data),
  update: (id, data) => api.put(`/vouchers/${id}`, data),
  remove: (id) => api.delete(`/vouchers/${id}`),
  toggleActive: (id) => api.post(`/vouchers/${id}/toggle-active`),
  validate: (data) => api.post('/vouchers/validate', data),
  eligible: (params) => api.get('/vouchers/eligible', { params }),
  mine: (params) => api.get('/vouchers/mine', { params }),
};

export const purchaseOrdersApi = {
  list: (params) => api.get('/purchase-orders', { params }),
  get: (id) => api.get(`/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  submit: (id, data) => api.post(`/purchase-orders/${id}/submit`, data || {}),
  approve: (id, data) => api.post(`/purchase-orders/${id}/approve`, data || {}),
  dispatch: (id, data) => api.post(`/purchase-orders/${id}/dispatch`, data || {}),
  receive: (id, data) => api.post(`/purchase-orders/${id}/receive`, data || {}),
  reject: (id, data) => api.post(`/purchase-orders/${id}/reject`, data || {}),
  cancel: (id, data) => api.post(`/purchase-orders/${id}/cancel`, data || {}),
};

export const inventoryApi = {
  list: (params) => api.get('/inventory', { params }),
  updateMinRackQty: (id, minRackQty) =>
    api.patch(`/inventory/${id}/min-rack-qty`, { minRackQty }),
};

export const returnsApi = {
  list: (params) => api.get('/returns', { params }),
  get: (id) => api.get(`/returns/${id}`),
  eligibility: (orderId) => api.get(`/returns/eligibility/${orderId}`),
  create: (formData) =>
    api.post('/returns', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  approve: (id, data) => api.patch(`/returns/${id}/approve`, data || {}),
  reject: (id, data) => api.patch(`/returns/${id}/reject`, data || {}),
  pickupDone: (id, data) => api.patch(`/returns/${id}/pickup-done`, data || {}),
};
