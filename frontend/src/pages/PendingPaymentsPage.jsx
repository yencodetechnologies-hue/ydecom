import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ordersApi } from '../api';
import { PageHeader } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import Loader from '../components/ui/Loader';
import StatusBadge from '../components/ui/StatusBadge';
import { useAppSelector } from '../app/hooks';
import { formatCurrency, formatDate } from '../utils/helpers';

const orderPayable = (order) =>
  Math.max(0, Math.round(((Number(order?.subtotal) || 0) - (Number(order?.voucherDiscount) || 0)) * 100) / 100);

const paymentLabel = (order) =>
  ({ pending: 'Pending', failed: 'Failed' })[order?.paymentStatus] || order?.paymentStatus || '—';

export default function PendingPaymentsPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const isDistributor = role === 'distributor';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await ordersApi.list({
          ...(isDistributor ? { retailerOrders: true } : { distributorOrders: true }),
          paymentStatus: 'unpaid',
          limit: 100,
        });
        setRows(data.data);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load pending payments');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isDistributor]);

  const total = rows.reduce((sum, r) => sum + orderPayable(r), 0);
  const buyerLabel = isDistributor ? 'Retailer' : 'Distributor';

  const columns = [
    { key: 'orderNumber', label: 'Order #' },
    { key: 'user', label: buyerLabel, render: (r) => r.user?.name || '—' },
    { key: 'subtotal', label: 'Amount Due', render: (r) => formatCurrency(orderPayable(r)) },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (r) => <StatusBadge status={r.paymentStatus} label={paymentLabel(r)} />,
    },
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="Pending Payments"
        subtitle={
          isDistributor
            ? 'Payments still owed by your retailers'
            : 'Payments still owed by your distributors'
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
          Total pending: <strong>{formatCurrency(total)}</strong> · Orders: <strong>{rows.length}</strong>
        </div>
      </div>
      {loading ? <Loader /> : <DataTable columns={columns} rows={rows} />}
    </div>
  );
}
