export const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || '';

export const formatCurrency = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

export const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const roleLabel = (role) =>
  ({
    admin: 'Admin',
    customer: 'Customer',
    retailer: 'Retailer',
    reseller: 'Reseller',
    distributor: 'Distributor',
    stockist: 'Stockist',
    salesman: 'Salesman',
  })[role] || role;

/** Roles that can express product interest (shop + admin list). */
export const PRODUCT_INTEREST_ROLES = ['stockist', 'distributor', 'retailer', 'reseller'];

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${UPLOAD_URL}${path}`;
};

export const paymentMethodLabel = (method) =>
  ({
    razorpay: 'Online (Razorpay)',
    credit: 'Credit Account',
    cash: 'Cash',
    card: 'Card',
    cheque: 'Cheque',
    neft: 'NEFT / Bank Transfer',
  })[method] || method || '—';

/** Normalize GET /products/interest/ids response into ids + quantity map. */
export const parseInterestResponse = (items = []) => {
  const ids = [];
  const quantities = {};
  items.forEach((item) => {
    if (typeof item === 'string') {
      ids.push(item);
      quantities[item] = 1;
      return;
    }
    const id = String(item.productId);
    ids.push(id);
    quantities[id] = item.quantity ?? 1;
  });
  return { ids, quantities };
};
