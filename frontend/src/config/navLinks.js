import {
  LayoutDashboard,
  Tags,
  Factory,
  Package,
  ShoppingCart,
  Users,
  Store,
  Truck,
  Warehouse,
  BarChart3,
  Settings,
  Image,
  Heart,
  Home,
  TicketPercent,
  ClipboardList,
  Boxes,
  Wallet,
  AlertCircle,
  UserCog,
  HeartHandshake,
  RotateCcw,
  Network,
} from 'lucide-react';

const shopLink = { to: '/shop', label: 'Shop', icon: Package };

export const adminLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Partners',
    icon: Network,
    children: [
      { to: '/manufacturers', label: 'Manufacturers', icon: Factory },
      { to: '/stockists', label: 'Stockists', icon: Warehouse },
      { to: '/distributors', label: 'Distributors', icon: Truck },
      { to: '/retailers', label: 'Retailers', icon: Store },
      { to: '/resellers', label: 'Resellers', icon: Store },
      { to: '/salesman', label: 'Salesmen', icon: UserCog },
      { to: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    label: 'Catalog',
    icon: Package,
    children: [
      { to: '/categories', label: 'Categories', icon: Tags },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/product-interests', label: 'Product Interests', icon: HeartHandshake },
    ],
  },
  {
    label: 'Orders',
    icon: ShoppingCart,
    children: [
      { to: '/orders', label: 'Orders', icon: ShoppingCart },
      { to: '/stockist-orders', label: 'Stockist Orders', icon: Warehouse },
      { to: '/returns', label: 'Returns', icon: RotateCcw },
    ],
  },
  { to: '/banners', label: 'Banners', icon: Image },
  { to: '/vouchers', label: 'Vouchers', icon: TicketPercent },
  { to: '/', label: 'Storefront', icon: Home },
  shopLink,
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const customerLinks = [
  { to: '/', label: 'Home', icon: Home },
  shopLink,
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/my-vouchers', label: 'My Vouchers', icon: TicketPercent },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const stockistLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  shopLink,
  { to: '/distributors', label: 'Distributors', icon: Users },
  { to: '/inventory', label: 'My Inventory', icon: Boxes },
  { to: '/orders', label: 'My Orders', icon: ShoppingCart },
  { to: '/product-interests', label: 'Product Interests', icon: HeartHandshake },
  { to: '/returns', label: 'Returns', icon: RotateCcw },
  { to: '/distributor-orders', label: 'Distributor Orders', icon: Truck },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/pending-payments', label: 'Pending Payments', icon: AlertCircle },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const distributorLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  shopLink,
  { to: '/retailer-orders', label: 'Retailer Orders', icon: Store },
  { to: '/retailers', label: 'Retailers', icon: Users },
  { to: '/returns', label: 'Returns', icon: RotateCcw },
  { to: '/product-interests', label: 'Product Interests', icon: HeartHandshake },
  { to: '/orders', label: 'My Orders', icon: ShoppingCart },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/pending-payments', label: 'Pending Payments', icon: AlertCircle },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/inventory', label: 'My Inventory', icon: Boxes },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const salesmanLinks = [
  { to: '/shop', label: 'Shop', icon: Package },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const businessLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  shopLink,
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/returns', label: 'Returns', icon: RotateCcw },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function getNavLinks(role) {
  if (role === 'admin') return adminLinks;
  if (role === 'customer') return customerLinks;
  if (role === 'stockist') return stockistLinks;
  if (role === 'distributor') return distributorLinks;
  if (role === 'salesman') return salesmanLinks;
  return businessLinks;
}

export function groupNavLinks(links) {
  const storePaths = ['/', '/shop'];
  const store = links.filter((l) => l.to && storePaths.includes(l.to));
  const business = links.filter((l) => !l.to || !storePaths.includes(l.to));
  return { store, business };
}
