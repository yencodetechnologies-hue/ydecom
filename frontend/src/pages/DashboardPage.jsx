import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  Store,
  Truck,
  Warehouse,
  Package,
  Tags,
  ShoppingCart,
  Wallet,
  ArrowUpRight,
  Sparkles,
  Factory,
  UserCog,
  Boxes,
  AlertCircle,
} from 'lucide-react';
import { dashboardApi } from '../api';
import Loader from '../components/ui/Loader';
import { StatCard } from '../components/ui/Form';
import StatusBadge from '../components/ui/StatusBadge';
import { useAppSelector } from '../app/hooks';
import { formatCurrency, formatDate } from '../utils/helpers';

const COLORS = ['#ff3e76', '#3d0e28', '#8a6474', '#ffd6e2', '#e01f58'];

const statusDot = {
  pending: 'bg-amber',
  ordered: 'bg-amber',
  approved: 'bg-emerald-500',
  active: 'bg-emerald-500',
  delivered: 'bg-emerald-500',
  processing: 'bg-sky-500',
  order_packed: 'bg-sky-500',
  shipped: 'bg-indigo-500',
  dispatched: 'bg-indigo-500',
  rejected: 'bg-danger',
  cancelled: 'bg-danger',
};

const toneChip = {
  rose: 'bg-rose-soft text-rose-deep',
  plum: 'bg-plum/10 text-plum',
  mauve: 'bg-mauve/15 text-mauve',
  amber: 'bg-amber/15 text-amber',
  wine: 'bg-wine/10 text-wine',
};

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function BreakdownChip({ label, value, className = '' }) {
  return (
    <div className={`min-w-0 rounded-lg px-1 py-1.5 text-center ${className}`}>
      <p className="truncate text-[9px] font-semibold uppercase leading-tight tracking-wide">{label}</p>
      <p className="mt-0.5 font-display text-sm leading-none text-wine">{value ?? 0}</p>
    </div>
  );
}

function DashboardStatCard({ label, total, icon: Icon, tone = 'rose', children }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl bg-white p-3.5 shadow-sm transition hover:shadow-md sm:p-4">
      <div className="flex items-start gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneChip[tone] || toneChip.rose}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium leading-tight text-ink/70">{label}</p>
          <p className="mt-0.5 font-display text-lg leading-tight text-wine sm:text-xl">{total ?? 0}</p>
        </div>
      </div>
      {children ? <div className="mt-2.5">{children}</div> : null}
      <span className="pointer-events-none absolute -bottom-5 -right-5 h-16 w-16 rounded-full bg-rose-soft/40" />
    </div>
  );
}

function StatusStatCard({ label, total, byStatus, icon, tone = 'rose' }) {
  return (
    <DashboardStatCard label={label} total={total} icon={icon} tone={tone}>
      <div className="grid grid-cols-3 gap-1">
        <BreakdownChip label="Pending" value={byStatus?.pending} className="bg-amber/10 text-amber" />
        <BreakdownChip label="Approved" value={byStatus?.approved} className="bg-emerald-500/10 text-emerald-600" />
        <BreakdownChip label="Rejected" value={byStatus?.rejected} className="bg-danger/10 text-danger" />
      </div>
    </DashboardStatCard>
  );
}

function ActiveInactiveStatCard({ label, total, byStatus, icon, tone = 'rose' }) {
  return (
    <DashboardStatCard label={label} total={total} icon={icon} tone={tone}>
      <div className="grid grid-cols-2 gap-1">
        <BreakdownChip label="Active" value={byStatus?.active} className="bg-emerald-500/10 text-emerald-600" />
        <BreakdownChip label="Inactive" value={byStatus?.inactive} className="bg-ink/5 text-ink/50" />
      </div>
    </DashboardStatCard>
  );
}

const ORDER_STATUS_LABELS = {
  ordered: 'Ordered',
  order_packed: 'Packed',
  dispatched: 'Dispatch',
  delivered: 'Delivered',
};

const STOCKIST_ORDER_STATUS_LABELS = {
  pending: 'Pending',
  order_packed: 'Packed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
};

const orderStatusTone = {
  pending: 'bg-amber/10 text-amber',
  ordered: 'bg-amber/10 text-amber',
  order_packed: 'bg-sky-500/10 text-sky-600',
  dispatched: 'bg-indigo-500/10 text-indigo-600',
  delivered: 'bg-emerald-500/10 text-emerald-600',
};

function OrderStatCard({ label, total, byStatus, icon, tone = 'rose', statusLabels = ORDER_STATUS_LABELS }) {
  return (
    <DashboardStatCard label={label} total={total} icon={icon} tone={tone}>
      <div className="grid grid-cols-2 gap-1">
        {Object.entries(statusLabels).map(([key, statusLabel]) => (
          <BreakdownChip
            key={key}
            label={statusLabel}
            value={byStatus?.[key]}
            className={orderStatusTone[key]}
          />
        ))}
      </div>
    </DashboardStatCard>
  );
}

function CompactStatCard({ label, value, icon: Icon, tone = 'rose' }) {
  return (
    <DashboardStatCard label={label} total={value} icon={Icon} tone={tone} />
  );
}

export default function DashboardPage() {
  const { user } = useAppSelector((s) => s.auth);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'customer') return;
    (async () => {
      try {
        const { data } = await dashboardApi.stats();
        setStats(data.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.role]);

  if (user?.role === 'customer') {
    return <Navigate to="/" replace />;
  }

  if (user?.role === 'salesman') {
    return <Navigate to="/shop" replace />;
  }

  if (loading) return <Loader />;
  if (!stats) return <p>Failed to load dashboard</p>;

  const isAdmin = user?.role === 'admin';
  const isStockist = user?.role === 'stockist';
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-rose via-rose-deep to-wine p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10 blur-xl" />
        <div className="relative max-w-lg">
          <p className="flex items-center gap-1.5 text-sm font-medium text-rose-soft">
            <Sparkles className="h-4 w-4" /> Let's grow your business today
          </p>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl">Hi, {firstName}</h1>
          <p className="mt-2 text-sm text-white/80">
            {isAdmin
              ? 'Track orders, manage inventory and keep an eye on your storefront — all from one place.'
              : isStockist
                ? 'Track inventory, your orders, distributor orders, and outstanding payments.'
                : 'Here is a quick snapshot of your orders and account activity.'}
          </p>
          <Link
            to={isStockist ? '/distributor-orders' : '/orders'}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-rose-deep transition hover:bg-blush"
          >
            {isStockist ? 'Distributor Orders' : 'View Orders'} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {isAdmin ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StatusStatCard
              label="Total Manufacturers"
              total={stats.totalManufacturers}
              byStatus={stats.manufacturersByStatus}
              icon={Factory}
              tone="plum"
            />
            <StatusStatCard
              label="Total Stockists"
              total={stats.totalStockists}
              byStatus={stats.stockistsByStatus}
              icon={Warehouse}
              tone="mauve"
            />
            <StatusStatCard
              label="Total Distributors"
              total={stats.totalDistributors}
              byStatus={stats.distributorsByStatus}
              icon={Truck}
              tone="plum"
            />
            <StatusStatCard
              label="Total Retailers"
              total={stats.totalRetailers}
              byStatus={stats.retailersByStatus}
              icon={Store}
              tone="amber"
            />
            <StatusStatCard
              label="Total Resellers"
              total={stats.totalResellers}
              byStatus={stats.resellersByStatus}
              icon={Store}
              tone="amber"
            />
            <StatusStatCard
              label="Total Salesmen"
              total={stats.totalSalesmen}
              byStatus={stats.salesmenByStatus}
              icon={UserCog}
              tone="wine"
            />
            <StatusStatCard
              label="Total Customers"
              total={stats.totalCustomers}
              byStatus={stats.customersByStatus}
              icon={Users}
              tone="rose"
            />
            <ActiveInactiveStatCard
              label="Total Products"
              total={stats.totalProducts}
              byStatus={stats.productsByStatus}
              icon={Package}
              tone="plum"
            />
            <ActiveInactiveStatCard
              label="Total Categories"
              total={stats.totalCategories}
              byStatus={stats.categoriesByStatus}
              icon={Tags}
              tone="mauve"
            />
            <OrderStatCard
              label="Total Orders"
              total={stats.totalOrders}
              byStatus={stats.ordersByStatus}
              icon={ShoppingCart}
              tone="rose"
            />
            <CompactStatCard
              label="Month Sales"
              value={formatCurrency(stats.monthlySalesAmount)}
              icon={Wallet}
              tone="wine"
            />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <div className="rounded-3xl bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-wine">Sales Overview</h3>
                  <p className="font-display text-2xl text-wine">
                    {formatCurrency(stats.monthlySalesAmount)}
                  </p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.monthlySales || []}>
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff3e76" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#ff3e76" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1dce2" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8a6474' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#8a6474' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #f1dce2' }}
                      formatter={(value) => [formatCurrency(value), 'Sales']}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#e01f58"
                      strokeWidth={2.5}
                      fill="url(#salesFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-wine">Users by Role</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(stats.usersByRole || []).map((u) => ({ name: u._id, value: u.count }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      label
                    >
                      {(stats.usersByRole || []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : isStockist ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CompactStatCard
            label="My Inventory Products"
            value={stats.inventoryProducts}
            icon={Boxes}
            tone="plum"
          />
          <OrderStatCard
            label="My Orders"
            total={stats.myOrdersTotal}
            byStatus={stats.myOrdersByStatus}
            icon={ShoppingCart}
            tone="rose"
            statusLabels={STOCKIST_ORDER_STATUS_LABELS}
          />
          <OrderStatCard
            label="Distributor Orders"
            total={stats.distributorOrdersTotal}
            byStatus={stats.distributorOrdersByStatus}
            icon={Truck}
            tone="mauve"
            statusLabels={STOCKIST_ORDER_STATUS_LABELS}
          />
          <CompactStatCard
            label="Outstanding Amount"
            value={formatCurrency(stats.outstandingAmount)}
            icon={AlertCircle}
            tone="wine"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="My Orders" value={stats.totalOrders} icon={ShoppingCart} tone="rose" />
          <StatCard label="Active Products" value={stats.totalProducts} icon={Package} tone="plum" />
          <StatCard
            label="Order Value"
            value={formatCurrency(
              (stats.orderStats || []).reduce((s, o) => s + (o.total || 0), 0)
            )}
            icon={Wallet}
            tone="wine"
          />
        </div>
      )}

      <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-wine">
            Recent Orders{' '}
            <span className="ml-1 text-sm font-normal text-mauve">
              ({stats.recentOrders?.length || 0})
            </span>
          </h3>
          <Link to="/orders" className="text-xs font-semibold text-rose-deep hover:underline">
            View all
          </Link>
        </div>
        <div className="space-y-1.5">
          {(stats.recentOrders || []).map((order) => (
            <div
              key={order._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-blush/50"
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot[order.status] || 'bg-ink/20'}`} />
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush text-[11px] font-semibold text-rose-deep">
                  {initials(order.user?.name || 'You')}
                </span>
                <div>
                  <p className="text-sm font-semibold text-wine">{order.orderNumber}</p>
                  <p className="text-xs text-ink/50">
                    {order.user?.name || 'You'} · {formatDate(order.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{formatCurrency(order.subtotal)}</span>
                <StatusBadge status={order.status} />
              </div>
            </div>
          ))}
          {!stats.recentOrders?.length ? (
            <p className="py-6 text-center text-sm text-ink/50">No recent orders</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
