import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Printer } from 'lucide-react';
import { ordersApi, paymentsApi } from '../api';
import { PageHeader, Button, Select } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import Loader from '../components/ui/Loader';
import B2BOrderDetail, { orderPayable, CONFIRM_PAYMENT_METHODS } from '../components/orders/B2BOrderDetail';
import OrderTracker from '../components/orders/OrderTracker';
import { useAppSelector } from '../app/hooks';
import { formatCurrency, formatDate, getImageUrl, paymentMethodLabel } from '../utils/helpers';

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'order_packed', label: 'Order Packed' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label || value;

const paymentStatusLabel = (order) => {
  const value = typeof order === 'object' ? order?.paymentStatus : order;
  return ({ paid: 'Paid', pending: 'Pending', failed: 'Failed', unpaid: 'Unpaid' })[value] || value || '—';
};

export default function OrdersPage() {
  const { user, token } = useAppSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [orderScope, setOrderScope] = useState('customer');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailMode, setDetailMode] = useState('manage');
  const [approving, setApproving] = useState(false);
  const [confirmMethod, setConfirmMethod] = useState('cash');
  const [performNote, setPerformNote] = useState('');
  const [fulfillmentStatus, setFulfillmentStatus] = useState('ordered');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await ordersApi.list({
        search,
        status: status || undefined,
        paymentStatus: isAdmin ? paymentStatus || undefined : undefined,
        customerOrders: isAdmin && orderScope === 'customer' ? true : undefined,
        page,
        limit,
      });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, status, paymentStatus, orderScope, page, limit]);

  const updateStatus = async (id, nextStatus, note = '') => {
    setUpdatingStatus(true);
    try {
      await ordersApi.updateStatus(id, { status: nextStatus, note: note.trim() || undefined });
      toast.success('Order status updated');
      setPerformNote('');
      load();
      if (detail?._id === id) {
        const { data } = await ordersApi.get(id);
        setDetail(data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const approvePayment = async (orderId) => {
    setApproving(true);
    try {
      await paymentsApi.approve(orderId, { paymentMethod: confirmMethod });
      toast.success('Payment approved — stock released');
      load();
      const { data } = await ordersApi.get(orderId);
      setDetail(data.data);
      setFulfillmentStatus(data.data.status || 'ordered');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const refreshDetail = async () => {
    if (!detail?._id) return;
    const { data } = await ordersApi.get(detail._id);
    setDetail(data.data);
    load();
  };

  const isB2BOrder = (order) => {
    if (order?.supplySource && order.supplySource !== 'admin') return true;
    if (
      ['stockist', 'distributor', 'retailer', 'reseller'].includes(order?.user?.role) ||
      (order?.status === 'delivered' &&
        ['stockist', 'distributor', 'retailer', 'reseller'].includes(user?.role) &&
        String(order?.user?._id || order?.user) === String(user?._id))
    ) {
      return (
        order?.status === 'pending' ||
        order?.invoiceFinalized ||
        order?.status === 'delivered' ||
        (order?.status === 'ordered' &&
          ['unpaid', 'failed', 'pending', 'paid'].includes(order?.paymentStatus))
      );
    }
    return (
      order?.status === 'pending' ||
      (order?.status === 'ordered' &&
        ['unpaid', 'failed', 'pending'].includes(order?.paymentStatus))
    );
  };

  const openDetail = async (row, mode = 'manage') => {
    setDetailMode(mode);
    setPerformNote('');
    try {
      const { data } = await ordersApi.get(row._id);
      const order = data.data;
      setDetail(order);
      setFulfillmentStatus(order.status || 'ordered');
      const method = order.paymentMethod;
      const allowed = CONFIRM_PAYMENT_METHODS.some((m) => m.value === method);
      setConfirmMethod(allowed ? method : 'cash');
    } catch {
      setDetail(row);
      setFulfillmentStatus(row.status || 'ordered');
      const method = row.paymentMethod;
      const allowed = CONFIRM_PAYMENT_METHODS.some((m) => m.value === method);
      setConfirmMethod(allowed ? method : 'cash');
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailMode('manage');
  };

  const openOrderDocument = async (id, { print = false } = {}) => {
    try {
      const url = print ? ordersApi.printUrl(id) : ordersApi.invoiceUrl(id);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Could not open ${print ? 'print view' : 'invoice'}`);
      }
      const html = await res.text();
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } catch (err) {
      toast.error(err.message || `Could not open ${print ? 'print view' : 'invoice'}`);
    }
  };

  const modalTitle = detail
    ? detailMode === 'payment'
      ? `Payment · ${detail.orderNumber}`
      : detailMode === 'status'
        ? `Status · ${detail.orderNumber}`
        : `Manage order · ${detail.orderNumber}`
    : '';

  const OrderSummaryStrip = ({ order }) => (
    <div className="grid gap-3 rounded-xl border border-blush-line bg-blush/20 p-4 sm:grid-cols-4 text-sm">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-mauve">Date</p>
        <p className="font-semibold text-wine">{formatDate(order.createdAt)}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-mauve">Order ID</p>
        <p className="font-semibold text-wine">{order.orderNumber}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-mauve">Customer</p>
        <p className="font-semibold text-wine">{order.user?.name || user?.name || '—'}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-mauve">Amount</p>
        <p className="font-semibold text-wine">{formatCurrency(orderPayable(order))}</p>
      </div>
    </div>
  );

  const PaymentPanel = ({ order }) => (
    <div className="space-y-4 rounded-xl border border-sand bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase text-ink/50">Payment status</span>
        <StatusBadge
          status={order.paymentStatus || 'paid'}
          label={paymentStatusLabel(order)}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <p><strong>Method:</strong> {paymentMethodLabel(order.paymentMethod)}</p>
        {order.paymentReference ? (
          <p><strong>Reference:</strong> {order.paymentReference}</p>
        ) : null}
        {order.paymentNote ? (
          <p className="sm:col-span-2"><strong>Note:</strong> {order.paymentNote}</p>
        ) : null}
        {order.razorpayPaymentId ? (
          <p className="sm:col-span-2"><strong>Payment ID:</strong> {order.razorpayPaymentId}</p>
        ) : null}
      </div>
      {order.paymentProofImage ? (
        <div>
          <p className="mb-2 text-sm font-semibold">Payment proof</p>
          <img
            src={getImageUrl(order.paymentProofImage)}
            alt="Payment proof"
            className="max-h-48 rounded-xl border border-sand object-contain"
          />
        </div>
      ) : null}
      {isAdmin && order.paymentStatus === 'pending' ? (
        <div className="space-y-3 border-t border-sand pt-4">
          <Select
            label="Confirm payment method"
            value={confirmMethod}
            onChange={(e) => setConfirmMethod(e.target.value)}
            className="max-w-xs"
          >
            {CONFIRM_PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          <Button onClick={() => approvePayment(order._id)} disabled={approving}>
            {approving ? 'Updating…' : 'Mark payment as paid'}
          </Button>
        </div>
      ) : null}
      {isAdmin &&
      order.paymentStatus !== 'paid' &&
      order.paymentStatus !== 'pending' &&
      (order.invoiceFinalized || order.status === 'ordered') ? (
        <div className="space-y-3 border-t border-sand pt-4">
          <Select
            label="Record payment method"
            value={confirmMethod}
            onChange={(e) => setConfirmMethod(e.target.value)}
            className="max-w-xs"
          >
            {CONFIRM_PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          <Button onClick={() => approvePayment(order._id)} disabled={approving}>
            {approving ? 'Recording…' : 'Record payment as paid'}
          </Button>
        </div>
      ) : null}
      {isAdmin && order.paymentStatus === 'paid' ? (
        <p className="text-sm text-ink/55">Payment is complete. Use Status to update fulfillment.</p>
      ) : null}
    </div>
  );

  const StatusPanel = ({ order }) => (
    <div className="space-y-4">
      <OrderTracker status={order.status} statusHistory={order.statusHistory} />
      {isAdmin && order.paymentStatus === 'paid' ? (
        <div className="space-y-3 rounded-xl border border-sand bg-white p-4">
          <span className="text-xs font-semibold uppercase text-ink/50">Update fulfillment status</span>
          <Select
            label="Order status"
            value={fulfillmentStatus}
            onChange={(e) => setFulfillmentStatus(e.target.value)}
            className="max-w-xs"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <textarea
            className="w-full rounded-lg border border-sand px-3 py-2 text-sm"
            rows={2}
            placeholder="Optional note (e.g. tracking ID)"
            value={performNote}
            onChange={(e) => setPerformNote(e.target.value)}
          />
          <Button
            onClick={() => updateStatus(order._id, fulfillmentStatus, performNote)}
            disabled={updatingStatus || fulfillmentStatus === order.status}
          >
            {updatingStatus ? 'Updating…' : 'Update status'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink/55">
          Fulfillment status can be updated after payment is marked paid.
        </p>
      )}
    </div>
  );

  const columns = [
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'orderNumber', label: 'Order #' },
    ...(isAdmin
      ? [{ key: 'user', label: 'Customer', render: (r) => r.user?.name || '—' }]
      : []),
    { key: 'subtotal', label: 'Amount', render: (r) => formatCurrency(orderPayable(r)) },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (r) =>
        isAdmin ? (
          <button
            type="button"
            className="rounded-lg transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/30"
            onClick={() => openDetail(r, 'payment')}
            title="Update payment"
          >
            <StatusBadge status={r.paymentStatus || 'paid'} label={paymentStatusLabel(r)} />
          </button>
        ) : (
          <StatusBadge status={r.paymentStatus || 'paid'} label={paymentStatusLabel(r)} />
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) =>
        isAdmin ? (
          <button
            type="button"
            className="rounded-lg transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/30"
            onClick={() => openDetail(r, 'status')}
            title="Update status"
          >
            <StatusBadge status={r.status} label={statusLabel(r.status)} />
          </button>
        ) : (
          <StatusBadge status={r.status} label={statusLabel(r.status)} />
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => openDetail(r, 'manage')}>
            Manage
          </Button>
          <Button
            variant="ghost"
            className="!px-2 !py-1 text-xs"
            onClick={() => openOrderDocument(r._id, { print: true })}
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          {(r.paymentStatus === 'paid' || !r.paymentStatus) && (
            <Button
              variant="ghost"
              className="!px-2 !py-1 text-xs"
              onClick={() => openOrderDocument(r._id)}
            >
              <FileText className="h-3.5 w-3.5" /> Invoice
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={isAdmin ? 'Manage orders, payments and tracking' : 'Track your orders'}
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
        {isAdmin ? (
          <>
            <Select
              value={orderScope}
              onChange={(e) => {
                setOrderScope(e.target.value);
                setPage(1);
              }}
              className="max-w-[180px]"
            >
              <option value="customer">Customer orders</option>
              <option value="all">All admin orders</option>
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
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </Select>
          </>
        ) : null}
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

      <Modal open={Boolean(detail)} title={modalTitle} onClose={closeDetail} wide>
        {detail ? (
          isB2BOrder(detail) ? (
            <B2BOrderDetail
              order={detail}
              onRefresh={refreshDetail}
              showFulfillment={isAdmin}
            />
          ) : detailMode === 'payment' ? (
            <div className="space-y-4 text-sm">
              <OrderSummaryStrip order={detail} />
              <PaymentPanel order={detail} />
            </div>
          ) : detailMode === 'status' ? (
            <div className="space-y-4 text-sm">
              <OrderSummaryStrip order={detail} />
              <StatusPanel order={detail} />
            </div>
          ) : (
          <div className="space-y-5 text-sm">
            <OrderSummaryStrip order={detail} />
            <OrderTracker status={detail.status} statusHistory={detail.statusHistory} />

            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <strong>Fulfillment:</strong>{' '}
                <StatusBadge status={detail.status} label={statusLabel(detail.status)} />
              </p>
              <p>
                <strong>Payment:</strong>{' '}
                <StatusBadge
                  status={detail.paymentStatus || 'paid'}
                  label={paymentStatusLabel(detail)}
                />
              </p>
              {detail.voucherDiscount > 0 ? (
                <p>
                  <strong>Voucher:</strong> {detail.voucherCode} (−{formatCurrency(detail.voucherDiscount)})
                </p>
              ) : null}
              <p>
                <strong>Payment method:</strong> {paymentMethodLabel(detail.paymentMethod)}
              </p>
              {detail.paymentReference ? (
                <p>
                  <strong>Reference:</strong> {detail.paymentReference}
                </p>
              ) : null}
              {detail.paymentNote ? (
                <p className="sm:col-span-2">
                  <strong>Payment note:</strong> {detail.paymentNote}
                </p>
              ) : null}
              {detail.paymentProofImage ? (
                <div className="sm:col-span-2">
                  <strong>Payment proof:</strong>
                  <img
                    src={getImageUrl(detail.paymentProofImage)}
                    alt="Payment proof"
                    className="mt-2 max-h-48 rounded-xl border border-sand object-contain"
                  />
                </div>
              ) : null}
              <p>
                <strong>Invoice:</strong> {detail.invoiceNumber || '—'}
              </p>
              {detail.razorpayPaymentId ? (
                <p className="sm:col-span-2">
                  <strong>Payment ID:</strong> {detail.razorpayPaymentId}
                </p>
              ) : null}
              <p className="sm:col-span-2 whitespace-pre-line">
                <strong>Shipping:</strong>
                <br />
                {detail.shippingAddress || '—'}
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-sand">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-fog text-xs uppercase text-ink/50">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item, idx) => (
                    <tr key={idx} className="border-t border-sand">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{item.qty}</td>
                      <td className="px-3 py-2">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-right text-base font-semibold">
              Total: {formatCurrency(orderPayable(detail))}
            </p>

            {detail.statusHistory?.length ? (
              <div>
                <h4 className="mb-2 font-semibold">Activity</h4>
                <ul className="space-y-1 text-xs text-ink/60">
                  {detail.statusHistory.map((h, i) => (
                    <li key={i}>
                      {h.note || statusLabel(h.status)} · {formatDate(h.changedAt)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-sand pt-4">
              {isAdmin ? (
                <>
                  <Button variant="secondary" onClick={() => setDetailMode('payment')}>
                    Update payment
                  </Button>
                  <Button variant="secondary" onClick={() => setDetailMode('status')}>
                    Update status
                  </Button>
                </>
              ) : null}
              <Button variant="secondary" onClick={() => openOrderDocument(detail._id, { print: true })}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              {(detail.paymentStatus === 'paid' || !detail.paymentStatus) && (
                <Button variant="ghost" onClick={() => openOrderDocument(detail._id)}>
                  <FileText className="h-4 w-4" /> Invoice
                </Button>
              )}
            </div>
          </div>
          )
        ) : null}
      </Modal>
    </div>
  );
}
