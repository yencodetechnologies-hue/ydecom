import UsersByRolePage from './UsersByRolePage';

export function CustomersPage() {
  return <UsersByRolePage key="customer" role="customer" title="Customers" />;
}
export function RetailersPage() {
  return <UsersByRolePage key="retailer" role="retailer" title="Retailers" />;
}
export function ResellersPage() {
  return <UsersByRolePage key="reseller" role="reseller" title="Resellers" />;
}
export function DistributorsPage() {
  return <UsersByRolePage key="distributor" role="distributor" title="Distributors" />;
}
export function StockistsPage() {
  return <UsersByRolePage key="stockist" role="stockist" title="Stockists" />;
}
