import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { productsApi, purchaseOrdersApi } from '../api';
import { PageHeader, Button, Input, TextArea, Select } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import Loader from '../components/ui/Loader';
import { useAppSelector } from '../app/hooks';
import { formatCurrency, formatDate } from '../utils/helpers';

const PO_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'received', label: 'Received' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusLabel = (value) => PO_STATUSES.find((s) => s.value === value)?.label || value;

const emptyLine = () => ({ product: '', qty: 1 });

export default function PurchaseOrdersPage() {
  const { user } = useAppSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';
  const isStockist = user?.role === 'stockist';
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [lines, setLines] = useState([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await purchaseOrdersApi.list({
        search,
        status: status || undefined,
        page,
        limit,
      });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data } = await productsApi.list({ status: 'active', limit: 200 });
      setProducts(data.data || []);
    } catch {
      setProducts([]);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, status, page, limit]);

  useEffect(() => {
    if (formOpen && isStockist) loadProducts();
  }, [formOpen, isStockist]);

  const openCreate = () => {
    setEditingId(null);
    setLines([emptyLine()]);
    setNotes('');
    setFormOpen(true);
  };

  const openEdit = (po) => {
    setEditingId(po._id);
    setLines(po.items.map((i) => ({ product: i.product?._id || i.product, qty: i.qty })));
    setNotes(po.notes || '');
    setFormOpen(true);
  };

  const savePo = async () => {
    const items = lines
      .filter((l) => l.product && Number(l.qty) > 0)
      .map((l) => ({ product: l.product, qty: Number(l.qty) }));
    if (!items.length) {
      toast.error('Add at least one product');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await purchaseOrdersApi.update(editingId, { items, notes });
        toast.success('Purchase order updated');
      } else {
        await purchaseOrdersApi.create({ items, notes });
        toast.success('Purchase order created');
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id, action, label) => {
    try {
      await purchaseOrdersApi[action](id, {});
      toast.success(label);
      load();
      if (detail?._id === id) {
        const { data } = await purchaseOrdersApi.get(id);
        setDetail(data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const columns = [
    { key: 'poNumber', label: 'PO #' },
    ...(isAdmin
      ? [{ key: 'stockist', label: 'Stockist', render: (r) => r.stockist?.shopName || r.stockist?.name || '—' }]
      : []),
    { key: 'subtotal', label: 'Amount', render: (r) => formatCurrency(r.subtotal) },
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
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setDetail(r)}>
            View
          </Button>
          {isStockist && r.status === 'draft' ? (
            <>
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openEdit(r)}>
                Edit
              </Button>
              <Button
                className="!px-2 !py-1 text-xs"
                onClick={() => runAction(r._id, 'submit', 'Submitted for approval')}
              >
                Submit
              </Button>
            </>
          ) : null}
          {isAdmin && r.status === 'submitted' ? (
            <>
              <Button
                className="!px-2 !py-1 text-xs"
                onClick={() => runAction(r._id, 'approve', 'Approved')}
              >
                Approve
              </Button>
              <Button
                variant="ghost"
                className="!px-2 !py-1 text-xs text-danger"
                onClick={() => runAction(r._id, 'reject', 'Rejected')}
              >
                Reject
              </Button>
            </>
          ) : null}
          {isAdmin && r.status === 'approved' ? (
            <Button
              className="!px-2 !py-1 text-xs"
              onClick={() => runAction(r._id, 'dispatch', 'Dispatched')}
            >
              Dispatch
            </Button>
          ) : null}
          {['dispatched', 'approved'].includes(r.status) ? (
            <Button
              variant="secondary"
              className="!px-2 !py-1 text-xs"
              onClick={() => runAction(r._id, 'receive', 'Stock received')}
            >
              Receive
            </Button>
          ) : null}
          {['draft', 'submitted'].includes(r.status) ? (
            <Button
              variant="ghost"
              className="!px-2 !py-1 text-xs"
              onClick={() => runAction(r._id, 'cancel', 'Cancelled')}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle={
          isAdmin
            ? 'Stockist procurement requests from admin warehouse'
            : 'Request stock from admin warehouse'
        }
        action={
          isStockist ? (
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> New PO
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search PO #"
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
          {PO_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
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
        open={formOpen}
        title={editingId ? 'Edit purchase order' : 'New purchase order'}
        onClose={() => setFormOpen(false)}
        wide
      >
        <div className="space-y-4">
          {lines.map((line, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <Select
                  label={idx === 0 ? 'Product' : undefined}
                  value={line.product}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], product: e.target.value };
                    setLines(next);
                  }}
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (warehouse: {p.availableStock ?? p.stock ?? 0})
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                label={idx === 0 ? 'Qty' : undefined}
                type="number"
                min={1}
                value={line.qty}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], qty: e.target.value };
                  setLines(next);
                }}
                className="w-24"
              />
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="rounded-lg p-2 text-danger hover:bg-fog"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
          <Button variant="secondary" onClick={() => setLines([...lines, emptyLine()])}>
            <Plus className="mr-1 h-4 w-4" /> Add line
          </Button>
          <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          <Button className="w-full" onClick={savePo} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update draft' : 'Save draft'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        title={`PO ${detail?.poNumber || ''}`}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <strong>Status:</strong>{' '}
                <StatusBadge status={detail.status} label={statusLabel(detail.status)} />
              </p>
              <p>
                <strong>Amount:</strong> {formatCurrency(detail.subtotal)}
              </p>
              {isAdmin ? (
                <p>
                  <strong>Stockist:</strong>{' '}
                  {detail.stockist?.shopName || detail.stockist?.name || '—'}
                </p>
              ) : null}
              <p>
                <strong>Date:</strong> {formatDate(detail.createdAt)}
              </p>
              {detail.notes ? (
                <p className="sm:col-span-2">
                  <strong>Notes:</strong> {detail.notes}
                </p>
              ) : null}
              {detail.adminNotes ? (
                <p className="sm:col-span-2">
                  <strong>Admin notes:</strong> {detail.adminNotes}
                </p>
              ) : null}
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
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
