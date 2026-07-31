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

export default function PaymentsPage() {
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
          paymentStatus: 'paid',
          limit: 100,
        });
        setRows(data.data);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load payments');
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
    { key: 'subtotal', label: 'Amount', render: (r) => formatCurrency(orderPayable(r)) },
    {
      key: 'paymentMethod',
      label: 'Method',
      render: (r) => (r.paymentMethod === 'credit' ? 'Credit' : 'Razorpay'),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={
          isDistributor
            ? 'Payments received from your retailers'
            : 'Payments received from your distributors'
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
          Total received: <strong>{formatCurrency(total)}</strong> · Orders: <strong>{rows.length}</strong>
        </div>
      </div>
      {loading ? <Loader /> : <DataTable columns={columns} rows={rows} />}
    </div>
  );
}
