import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { returnsApi } from '../api';
import { PageHeader, Button, Select, TextArea } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import Loader from '../components/ui/Loader';
import { formatCurrency, formatDate, getImageUrl } from '../utils/helpers';
import { ISSUE_TYPES } from '../components/orders/ReturnRequestForm';
import { useAppSelector } from '../app/hooks';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'pickup_done', label: 'Pickup done' },
  { value: 'rejected', label: 'Rejected' },
];

const issueLabel = (value) => ISSUE_TYPES.find((t) => t.value === value)?.label || value;

export default function ReturnsPage() {
  const { user } = useAppSelector((s) => s.auth);
  const isBuyerOnly = ['retailer', 'reseller'].includes(user?.role);
  const [asSupplier, setAsSupplier] = useState(!isBuyerOnly);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await returnsApi.list({
        asSupplier: asSupplier ? 'true' : undefined,
        status: status || undefined,
        page,
        limit,
      });
      let list = data.data || [];
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (r) =>
            String(r.returnNumber || '').toLowerCase().includes(q) ||
            String(r.order?.orderNumber || '').toLowerCase().includes(q) ||
            String(r.buyer?.name || '').toLowerCase().includes(q)
        );
      }
      setRows(list);
      setMeta(data.meta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [asSupplier, status, page, limit, search]);

  const openDetail = async (row) => {
    try {
      const { data } = await returnsApi.get(row._id);
      setDetail(data.data);
      setRejectNote('');
    } catch {
      setDetail(row);
    }
  };

  const act = async (fn, successMsg) => {
    if (!detail?._id) return;
    setActing(true);
    try {
      await fn();
      toast.success(successMsg);
      const { data } = await returnsApi.get(detail._id);
      setDetail(data.data);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const canManage =
    detail &&
    asSupplier &&
    (user?.role === 'admin'
      ? detail.supplySource === 'admin'
      : String(detail.supplier?._id || detail.supplier) === String(user?._id));

  const columns = [
    { key: 'returnNumber', label: 'Return #' },
    {
      key: 'order',
      label: 'Order',
      render: (r) => r.order?.orderNumber || '—',
    },
    {
      key: 'buyer',
      label: 'Buyer',
      render: (r) => r.buyer?.name || '—',
    },
    {
      key: 'creditAmount',
      label: 'Amount',
      render: (r) => formatCurrency(r.creditAmount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <StatusBadge status={r.status} label={String(r.status || '').replace('_', ' ')} />
      ),
    },
    { key: 'createdAt', label: 'Requested', render: (r) => formatDate(r.createdAt) },
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
        title="Returns"
        subtitle={
          asSupplier
            ? 'Approve pickup and credit buyers after return collection'
            : 'Track your return requests'
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        {!isBuyerOnly ? (
          <Select
            value={asSupplier ? 'supplier' : 'mine'}
            onChange={(e) => {
              setAsSupplier(e.target.value === 'supplier');
              setPage(1);
            }}
            className="max-w-[200px]"
          >
            <option value="supplier">Inbound returns</option>
            <option value="mine">My return requests</option>
          </Select>
        ) : null}
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search return / order #"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="max-w-[180px]"
        >
          {STATUSES.map((s) => (
            <option key={s.value || 'all'} value={s.value}>
              {s.label}
            </option>
          ))}
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
        title={`Return ${detail?.returnNumber || ''}`}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <strong>Order:</strong> {detail.order?.orderNumber || '—'}
              </p>
              <p>
                <strong>Buyer:</strong> {detail.buyer?.name || '—'}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                <StatusBadge
                  status={detail.status}
                  label={String(detail.status || '').replace('_', ' ')}
                />
              </p>
              <p>
                <strong>Credit:</strong> {formatCurrency(detail.creditAmount)}
                {detail.creditApplied ? ' (applied)' : ''}
              </p>
              <p>
                <strong>Requested:</strong> {formatDate(detail.requestedAt || detail.createdAt)}
              </p>
              {detail.note ? (
                <p className="sm:col-span-2">
                  <strong>Note:</strong> {detail.note}
                </p>
              ) : null}
            </div>

            {detail.image ? (
              <div>
                <strong>Issue photo</strong>
                <img
                  src={getImageUrl(detail.image)}
                  alt="Return"
                  className="mt-2 max-h-56 rounded-xl border border-sand object-contain"
                />
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-sand">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-fog text-xs uppercase text-ink/50">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Issue</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((item, idx) => (
                    <tr key={idx} className="border-t border-sand">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{item.qty}</td>
                      <td className="px-3 py-2">
                        {issueLabel(item.issueType)}
                        {item.issueNote ? (
                          <span className="mt-0.5 block text-xs text-ink/55">{item.issueNote}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canManage && detail.status === 'requested' ? (
              <div className="flex flex-wrap gap-2 border-t border-sand pt-4">
                <Button
                  disabled={acting}
                  onClick={() => act(() => returnsApi.approve(detail._id), 'Return approved')}
                >
                  Approve & schedule pickup
                </Button>
                <div className="w-full space-y-2 sm:w-auto sm:min-w-[16rem] sm:flex-1">
                  <TextArea
                    label="Reject reason"
                    rows={2}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    disabled={acting || !rejectNote.trim()}
                    onClick={() =>
                      act(
                        () => returnsApi.reject(detail._id, { note: rejectNote.trim() }),
                        'Return rejected'
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}

            {canManage && detail.status === 'approved' ? (
              <div className="flex flex-wrap gap-2 border-t border-sand pt-4">
                <Button
                  disabled={acting}
                  onClick={() =>
                    act(
                      () => returnsApi.pickupDone(detail._id),
                      'Pickup done — credit applied'
                    )
                  }
                >
                  Mark pickup done & credit buyer
                </Button>
                <div className="w-full space-y-2 sm:w-auto sm:min-w-[16rem] sm:flex-1">
                  <TextArea
                    label="Reject reason"
                    rows={2}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    disabled={acting || !rejectNote.trim()}
                    onClick={() =>
                      act(
                        () => returnsApi.reject(detail._id, { note: rejectNote.trim() }),
                        'Return rejected'
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
