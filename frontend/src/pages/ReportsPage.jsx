import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ordersApi } from '../api';
import { PageHeader, Button, Select } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import Loader from '../components/ui/Loader';
import StatusBadge from '../components/ui/StatusBadge';
import { useAppSelector } from '../app/hooks';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function ReportsPage() {
  const { user } = useAppSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await ordersApi.list({ status: status || undefined, limit: 100 });
      setRows(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const exportCsv = () => {
    const header = isAdmin
      ? ['OrderNumber', 'Customer', 'Status', 'Amount', 'Date']
      : ['OrderNumber', 'Status', 'Amount', 'Date'];
    const lines = rows.map((r) =>
      (isAdmin
        ? [r.orderNumber, r.user?.name || '', r.status, r.subtotal, formatDate(r.createdAt)]
        : [r.orderNumber, r.status, r.subtotal, formatDate(r.createdAt)])
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ydecom-orders-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = rows.reduce((s, r) => s + (r.subtotal || 0), 0);

  const columns = [
    { key: 'orderNumber', label: 'Order #' },
    ...(isAdmin ? [{ key: 'user', label: 'Customer', render: (r) => r.user?.name || '—' }] : []),
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'subtotal', label: 'Amount', render: (r) => formatCurrency(r.subtotal) },
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Order reports with export"
        actions={<Button onClick={exportCsv}>Export CSV</Button>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-xs">
          <option value="">All</option>
          {['ordered', 'order_packed', 'dispatched', 'delivered'].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <div className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
          Total: <strong>{formatCurrency(total)}</strong> · Orders: <strong>{rows.length}</strong>
        </div>
      </div>
      {loading ? <Loader /> : <DataTable columns={columns} rows={rows} />}
    </div>
  );
}
