import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ordersApi } from '../api';
import { PageHeader, Select, Button } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import Loader from '../components/ui/Loader';
import B2BOrderDetail, { orderPayable } from '../components/orders/B2BOrderDetail';
import { formatCurrency, formatDate } from '../utils/helpers';

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'order_packed', label: 'Order Packed' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
];

const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label || value;

const paymentStatusLabel = (order) =>
  ({ paid: 'Paid', pending: 'Pending', failed: 'Failed', unpaid: 'Unpaid' })[order?.paymentStatus] ||
  '—';

export default function RetailerOrdersPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await ordersApi.list({
        retailerOrders: true,
        search,
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        page,
        limit,
      });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load retailer orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, status, paymentStatus, page, limit]);

  const refreshDetail = async () => {
    if (!detail?._id) return;
    const { data } = await ordersApi.get(detail._id);
    setDetail(data.data);
    load();
  };

  const openDetail = async (row) => {
    try {
      const { data } = await ordersApi.get(row._id);
      setDetail(data.data);
    } catch {
      setDetail(row);
    }
  };

  const columns = [
    { key: 'orderNumber', label: 'Order #' },
    { key: 'user', label: 'Retailer', render: (r) => r.user?.name || '—' },
    { key: 'placedBy', label: 'Placed By', render: (r) => r.placedBy?.name || '—' },
    { key: 'subtotal', label: 'Amount', render: (r) => formatCurrency(orderPayable(r)) },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (r) => <StatusBadge status={r.paymentStatus || 'paid'} label={paymentStatusLabel(r)} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} label={statusLabel(r.status)} />,
    },
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => openDetail(r)}>
          Manage
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Retailer Orders"
        subtitle="Orders placed by your retailers against your inventory"
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search order #"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
        >
          <option value="">All payments</option>
          <option value="unpaid">Unpaid / Pending</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </Select>
      </div>
      {loading ? <Loader /> : <DataTable columns={columns} rows={rows} />}
      <Pagination
        page={meta.page}
        pages={meta.pages}
        total={meta.total}
        limit={limit}
        onLimitChange={(next) => {
          setLimit(next);
          setPage(1);
        }}
        onChange={setPage}
        alwaysShow
      />

      <Modal
        open={Boolean(detail)}
        title={`Order ${detail?.orderNumber || ''}`}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          <B2BOrderDetail order={detail} onRefresh={refreshDetail} showFulfillment />
        ) : null}
      </Modal>
    </div>
  );
}
