import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { vouchersApi } from '../api';
import { PageHeader, Button, Input, Select, TextArea } from '../components/ui/Form';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/ui/StatusBadge';
import StatusToggle from '../components/ui/StatusToggle';
import Loader from '../components/ui/Loader';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import { orderPayable } from '../components/orders/B2BOrderDetail';
import { formatCurrency, formatDate, getImageUrl } from '../utils/helpers';

const emptyForm = {
  code: '',
  description: '',
  voucherMode: 'manual',
  qualifyingPurchaseAmount: '',
  type: 'percentage',
  value: '',
  maxDiscount: '',
  minOrderAmount: '0',
  startDate: '',
  endDate: '',
  usageLimit: '',
  isActive: true,
};

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const customerLabel = (user) => {
  if (!user) return 'Unknown customer';
  const name = user.name || user.shopName || 'Customer';
  const contact = user.mobile || user.email || '';
  return contact ? `${name} · ${contact}` : name;
};

export default function VouchersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [removeId, setRemoveId] = useState(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageData, setUsageData] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await vouchersApi.list();
      setRows(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      code: row.code || '',
      description: row.description || '',
      voucherMode: row.voucherMode === 'auto' ? 'auto' : 'manual',
      qualifyingPurchaseAmount:
        row.qualifyingPurchaseAmount != null ? String(row.qualifyingPurchaseAmount) : '',
      type: row.type || 'percentage',
      value: String(row.value ?? ''),
      maxDiscount: row.maxDiscount != null ? String(row.maxDiscount) : '',
      minOrderAmount: String(row.minOrderAmount ?? 0),
      startDate: toDateInput(row.startDate),
      endDate: toDateInput(row.endDate),
      usageLimit: row.usageLimit != null ? String(row.usageLimit) : '',
      isActive: row.isActive !== false,
    });
    setOpen(true);
  };

  const openUsage = async (row) => {
    setUsageOpen(true);
    setUsageLoading(true);
    setUsageData(null);
    try {
      const { data } = await vouchersApi.usage(row._id);
      setUsageData(data.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load voucher usage');
      setUsageOpen(false);
    } finally {
      setUsageLoading(false);
    }
  };

  const closeUsage = () => {
    setUsageOpen(false);
    setUsageData(null);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast.error('Voucher code is required');
      return;
    }
    if (!(Number(form.value) >= 0)) {
      toast.error('Enter a valid discount value');
      return;
    }
    if (form.voucherMode === 'auto' && !(Number(form.qualifyingPurchaseAmount) > 0)) {
      toast.error('Enter a qualifying purchase amount for auto vouchers');
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      voucherMode: form.voucherMode,
      qualifyingPurchaseAmount:
        form.voucherMode === 'auto' ? Number(form.qualifyingPurchaseAmount) : null,
      type: form.type,
      value: Number(form.value),
      maxDiscount: form.maxDiscount !== '' ? Number(form.maxDiscount) : null,
      minOrderAmount: Number(form.minOrderAmount) || 0,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      usageLimit: form.usageLimit !== '' ? Number(form.usageLimit) : null,
      isActive: form.isActive,
      applicableRoles: ['customer'],
    };

    setSaving(true);
    try {
      if (editing) {
        await vouchersApi.update(editing._id, payload);
        toast.success('Voucher updated');
      } else {
        await vouchersApi.create(payload);
        toast.success('Voucher created');
      }
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await vouchersApi.remove(removeId);
      toast.success('Voucher deleted');
      setRemoveId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const toggleActive = async (id) => {
    const prev = rows.find((r) => r._id === id);
    if (!prev) return;
    setRows((list) => list.map((r) => (r._id === id ? { ...r, isActive: !r.isActive } : r)));
    try {
      const { data } = await vouchersApi.toggleActive(id);
      if (data?.data) {
        setRows((list) => list.map((r) => (r._id === id ? { ...r, ...data.data } : r)));
      }
      toast.success(data.message || 'Status updated');
    } catch (err) {
      setRows((list) => list.map((r) => (r._id === id ? { ...r, isActive: prev.isActive } : r)));
      toast.error(err.response?.data?.message || 'Toggle failed');
    }
  };

  const columns = [
    { key: 'code', label: 'Code', render: (r) => <span className="font-semibold">{r.code}</span> },
    {
      key: 'mode',
      label: 'Mode',
      render: (r) =>
        r.voucherMode === 'auto' ? (
          <span>
            Auto
            <span className="block text-xs text-ink/50">
              ≥ {formatCurrency(r.qualifyingPurchaseAmount || 0)} spend
            </span>
          </span>
        ) : (
          'Manual'
        ),
    },
    {
      key: 'discount',
      label: 'Discount',
      render: (r) =>
        r.type === 'percentage' ? `${r.value}%` : formatCurrency(r.value),
    },
    {
      key: 'minOrderAmount',
      label: 'Min order',
      render: (r) => formatCurrency(r.minOrderAmount || 0),
    },
    {
      key: 'usage',
      label: 'Usage',
      render: (r) =>
        r.usageLimit != null ? `${r.usedCount || 0} / ${r.usageLimit}` : `${r.usedCount || 0}`,
    },
    {
      key: 'validity',
      label: 'Validity',
      render: (r) => {
        const start = r.startDate ? formatDate(r.startDate) : '—';
        const end = r.endDate ? formatDate(r.endDate) : '—';
        return `${start} → ${end}`;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-fog"
            title="View usage"
            onClick={() => openUsage(r)}
          >
            <Eye className="h-4 w-4" />
          </button>
          <StatusToggle
            checked={r.isActive}
            onChange={() => toggleActive(r._id)}
            onLabel="ON"
            offLabel="OFF"
            size="sm"
          />
          <button type="button" className="rounded-lg p-2 hover:bg-fog" onClick={() => openEdit(r)}>
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-danger hover:bg-fog"
            onClick={() => setRemoveId(r._id)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const usageOrders = usageData?.orders || [];
  const usageTitle = usageData?.voucher?.code
    ? `Usage · ${usageData.voucher.code}`
    : 'Voucher usage';

  return (
    <div>
      <PageHeader
        title="Vouchers"
        subtitle="Create discount codes customers can apply at checkout"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Voucher
          </Button>
        }
      />

      {loading ? (
        <Loader />
      ) : (
        <DataTable columns={columns} rows={rows} emptyMessage="No vouchers yet." />
      )}

      <Modal
        open={open}
        title={editing ? 'Edit voucher' : 'Add voucher'}
        onClose={closeModal}
        wide
      >
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setField('code', e.target.value.toUpperCase())}
            placeholder="SAVE10"
            required
          />
          <Select
            label="Voucher mode"
            value={form.voucherMode}
            onChange={(e) => setField('voucherMode', e.target.value)}
          >
            <option value="manual">Manual (customer enters code)</option>
            <option value="auto">Auto (unlocked by purchase amount)</option>
          </Select>
          {form.voucherMode === 'auto' ? (
            <Input
              label="Qualifying purchase amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={form.qualifyingPurchaseAmount}
              onChange={(e) => setField('qualifyingPurchaseAmount', e.target.value)}
              placeholder="e.g. 1000"
              required
            />
          ) : (
            <div />
          )}
          <Select
            label="Discount type"
            value={form.type}
            onChange={(e) => setField('type', e.target.value)}
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed amount (₹)</option>
          </Select>
          <Input
            label={form.type === 'percentage' ? 'Discount %' : 'Discount amount (₹)'}
            type="number"
            min="0"
            step={form.type === 'percentage' ? '1' : '0.01'}
            value={form.value}
            onChange={(e) => setField('value', e.target.value)}
            required
          />
          {form.type === 'percentage' ? (
            <Input
              label="Max discount cap (₹, optional)"
              type="number"
              min="0"
              step="0.01"
              value={form.maxDiscount}
              onChange={(e) => setField('maxDiscount', e.target.value)}
            />
          ) : (
            <div />
          )}
          <Input
            label="Minimum order amount (₹)"
            type="number"
            min="0"
            step="0.01"
            value={form.minOrderAmount}
            onChange={(e) => setField('minOrderAmount', e.target.value)}
          />
          <Input
            label="Usage limit (optional)"
            type="number"
            min="1"
            value={form.usageLimit}
            onChange={(e) => setField('usageLimit', e.target.value)}
          />
          <Input
            label="Valid from"
            type="date"
            value={form.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
          />
          <Input
            label="Valid until"
            type="date"
            value={form.endDate}
            onChange={(e) => setField('endDate', e.target.value)}
          />
          <div className="sm:col-span-2">
            <TextArea
              label="Description (optional)"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={2}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink/80 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
            />
            Active (customers can use this voucher)
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update voucher' : 'Create voucher'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={usageOpen} title={usageTitle} onClose={closeUsage} wide>
        {usageLoading ? (
          <Loader />
        ) : !usageData ? (
          <p className="text-sm text-ink/60">No usage data.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-sand bg-fog/40 p-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/45">Total uses</p>
                <p className="mt-0.5 font-semibold text-wine">{usageData.totalUses || 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/45">Total discount given</p>
                <p className="mt-0.5 font-semibold text-wine">
                  {formatCurrency(usageData.totalDiscount || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/45">Counter</p>
                <p className="mt-0.5 font-semibold text-wine">
                  {usageData.voucher?.usageLimit != null
                    ? `${usageData.voucher.usedCount || 0} / ${usageData.voucher.usageLimit}`
                    : `${usageData.voucher?.usedCount || 0}`}
                </p>
              </div>
            </div>

            {usageOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink/55">
                No customers have used this voucher yet.
              </p>
            ) : (
              <div className="space-y-4">
                {usageOrders.map((order) => (
                  <div
                    key={order._id}
                    className="rounded-xl border border-sand bg-white p-4 shadow-sm"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-wine">{order.orderNumber}</p>
                        <p className="text-sm text-ink/70">{customerLabel(order.user)}</p>
                        {order.placedBy ? (
                          <p className="text-xs text-ink/45">
                            Placed by {customerLabel(order.placedBy)}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-ink/60">{formatDate(order.createdAt)}</p>
                        <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                          <StatusBadge status={order.status} />
                          <StatusBadge status={order.paymentStatus || 'pending'} />
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
                      <p>
                        <span className="text-ink/50">Subtotal:</span>{' '}
                        <span className="font-medium">{formatCurrency(order.subtotal || 0)}</span>
                      </p>
                      <p>
                        <span className="text-ink/50">Discount:</span>{' '}
                        <span className="font-medium text-rose">
                          −{formatCurrency(order.voucherDiscount || 0)}
                        </span>
                      </p>
                      <p>
                        <span className="text-ink/50">Payable:</span>{' '}
                        <span className="font-semibold">{formatCurrency(orderPayable(order))}</span>
                      </p>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-sand">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-fog text-xs uppercase text-ink/50">
                          <tr>
                            <th className="px-3 py-2">Product</th>
                            <th className="px-3 py-2">Code</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">Unit</th>
                            <th className="px-3 py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.items || []).map((item, idx) => (
                            <tr key={idx} className="border-t border-sand">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {item.image ? (
                                    <img
                                      src={getImageUrl(item.image)}
                                      alt=""
                                      className="h-8 w-8 rounded object-cover"
                                    />
                                  ) : null}
                                  <span>{item.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-ink/60">{item.itemCode || '—'}</td>
                              <td className="px-3 py-2">{item.qty}</td>
                              <td className="px-3 py-2">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-3 py-2">{formatCurrency(item.lineTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete voucher?"
        message="This voucher code will stop working immediately."
        onCancel={() => setRemoveId(null)}
        onConfirm={remove}
      />
    </div>
  );
}
