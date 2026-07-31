import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, PrivateRoute, RoleRoute } from './routes/ProtectedRoutes';
import DashboardLayout from './components/layout/DashboardLayout';
import PublicLayout from './components/layout/PublicLayout';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishlistPage';
import TermsPage from './pages/TermsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import DashboardPage from './pages/DashboardPage';
import CategoriesPage from './pages/CategoriesPage';
import ManufacturersPage from './pages/ManufacturersPage';
import BannersPage from './pages/BannersPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import StockistOrdersPage from './pages/StockistOrdersPage';
import DistributorOrdersPage from './pages/DistributorOrdersPage';
import RetailerOrdersPage from './pages/RetailerOrdersPage';
import PaymentsPage from './pages/PaymentsPage';
import PendingPaymentsPage from './pages/PendingPaymentsPage';
import SalesmanPage from './pages/SalesmanPage';
import StockistDistributorsPage from './pages/StockistDistributorsPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import InventoryPage from './pages/InventoryPage';
import ReturnsPage from './pages/ReturnsPage';
import {
  CustomersPage,
  RetailersPage,
  ResellersPage,
  DistributorsPage,
  StockistsPage,
} from './pages/RoleUserPages';
import VouchersPage from './pages/VouchersPage';
import MyVouchersPage from './pages/MyVouchersPage';
import ReportsPage from './pages/ReportsPage';
import ProductInterestsPage from './pages/ProductInterestsPage';
import SettingsPage from './pages/SettingsPage';
import WishlistBootstrap from './components/WishlistBootstrap';
import { useAppSelector } from './app/hooks';

function DistributorsRoutePage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  if (role === 'stockist') return <StockistDistributorsPage />;
  return <DistributorsPage />;
}

function RetailersRoutePage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  if (role === 'distributor') return <StockistDistributorsPage />;
  return <RetailersPage />;
}

export default function App() {
  return (
    <>
      <WishlistBootstrap />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/shop" element={<ShopPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/terms" element={<TermsPage />} />

      <Route element={<PublicLayout />}>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route path="/pending-approval" element={<PendingApprovalPage />} />
      </Route>

      <Route element={<PrivateRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route element={<RoleRoute roles={['customer']} />}>
            <Route path="/my-vouchers" element={<MyVouchersPage />} />
          </Route>

          <Route
            element={
              <RoleRoute roles={['admin', 'stockist', 'distributor', 'retailer', 'reseller']} />
            }
          >
            <Route path="/returns" element={<ReturnsPage />} />
          </Route>

          <Route element={<RoleRoute roles={['stockist']} />}>
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/distributor-orders" element={<DistributorOrdersPage />} />
          </Route>

          <Route element={<RoleRoute roles={['stockist', 'distributor']} />}>
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/pending-payments" element={<PendingPaymentsPage />} />
          </Route>

          <Route element={<RoleRoute roles={['admin', 'distributor']} />}>
            <Route path="/retailers" element={<RetailersRoutePage />} />
          </Route>

          <Route element={<RoleRoute roles={['distributor']} />}>
            <Route path="/retailer-orders" element={<RetailerOrdersPage />} />
          </Route>

          <Route element={<RoleRoute roles={['admin', 'stockist', 'distributor']} />}>
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/product-interests" element={<ProductInterestsPage />} />
          </Route>

          <Route element={<RoleRoute roles={['admin', 'stockist']} />}>
            <Route path="/distributors" element={<DistributorsRoutePage />} />
          </Route>

          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/stockist-orders" element={<StockistOrdersPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/manufacturers" element={<ManufacturersPage />} />
            <Route path="/banners" element={<BannersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/resellers" element={<ResellersPage />} />
            <Route path="/stockists" element={<StockistsPage />} />
            <Route path="/salesman" element={<SalesmanPage />} />
            <Route path="/vouchers" element={<VouchersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
