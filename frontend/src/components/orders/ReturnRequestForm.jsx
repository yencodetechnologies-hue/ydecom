import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Minus, Plus, Upload, X } from 'lucide-react';
import { returnsApi } from '../../api';
import { Button, Input, Select, TextArea } from '../ui/Form';
import { formatCurrency } from '../../utils/helpers';

export const ISSUE_TYPES = [
  { value: 'damaged', label: 'Damaged in transit' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'expired', label: 'Expired / near expiry' },
  { value: 'quality_issue', label: 'Quality issue' },
  { value: 'other', label: 'Other' },
];

const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const B2B_RETURN_ROLES = ['stockist', 'distributor', 'retailer', 'reseller'];

export const resolveDeliveredAt = (order) => {
  if (order?.deliveredAt) return new Date(order.deliveredAt);
  const entry = [...(order?.statusHistory || [])].reverse().find((h) => h.status === 'delivered');
  return entry?.changedAt ? new Date(entry.changedAt) : null;
};

export const canRequestReturn = (order, user) => {
  if (!order || !user) return false;
  if (!B2B_RETURN_ROLES.includes(user.role)) return false;
  const buyerId = order.user?._id || order.user;
  if (String(buyerId) !== String(user._id)) return false;
  if (order.status !== 'delivered' || order.paymentStatus !== 'paid') return false;
  const deliveredAt = resolveDeliveredAt(order);
  if (!deliveredAt) return false;
  return Date.now() - deliveredAt.getTime() <= RETURN_WINDOW_MS;
};

/**
 * Modal to request a partial B2B return within 7 days of delivery.
 */
export default function ReturnRequestForm({ order, onDone, onCancel }) {
  const [lines, setLines] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLines(
      (order.items || []).map((item) => ({
        product: item.product?._id || item.product,
        name: item.name,
        maxQty: Number(item.qty) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        selected: false,
        qty: 1,
        issueType: 'damaged',
        issueNote: '',
      }))
    );
  }, [order._id, order.items]);

  const selected = useMemo(() => lines.filter((l) => l.selected && l.qty > 0), [lines]);
  const creditPreview = selected.reduce(
    (sum, l) => sum + Math.round(l.unitPrice * l.qty * 100) / 100,
    0
  );

  const updateLine = (index, patch) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview('');
  };

  const submit = async () => {
    if (!selected.length) {
      toast.error('Select at least one product');
      return;
    }
    for (const line of selected) {
      if (line.issueType === 'other' && !line.issueNote.trim()) {
        toast.error(`Describe the issue for ${line.name}`);
        return;
      }
    }
    if (!imageFile) {
      toast.error('Upload an image of the product issue');
      return;
    }

    const fd = new FormData();
    fd.append('orderId', order._id);
    fd.append(
      'items',
      JSON.stringify(
        selected.map((l) => ({
          product: l.product,
          qty: l.qty,
          issueType: l.issueType,
          issueNote: l.issueNote.trim(),
        }))
      )
    );
    fd.append('image', imageFile);

    setSubmitting(true);
    try {
      await returnsApi.create(fd);
      toast.success('Return requested — await supplier approval');
      clearImage();
      onDone?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-ink/70">
        Select products and quantities to return within 7 days of delivery. After pickup is
        completed, the amount is credited to your wallet.
      </p>

      <div className="max-h-72 space-y-3 overflow-y-auto">
        {lines.map((line, idx) => (
          <div
            key={String(line.product)}
            className={`rounded-xl border px-3 py-3 ${
              line.selected ? 'border-leaf bg-mint/15' : 'border-sand'
            }`}
          >
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={line.selected}
                onChange={(e) => updateLine(idx, { selected: e.target.checked })}
              />
              <span className="flex-1">
                <span className="font-semibold text-ink">{line.name}</span>
                <span className="mt-0.5 block text-xs text-ink/50">
                  Ordered {line.maxQty} · {formatCurrency(line.unitPrice)} each
                </span>
              </span>
            </label>

            {line.selected ? (
              <div className="mt-3 space-y-2 pl-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-ink/50">Qty</span>
                  <button
                    type="button"
                    className="rounded border border-sand p-1 hover:bg-fog"
                    onClick={() => updateLine(idx, { qty: Math.max(1, line.qty - 1) })}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[1.5rem] text-center font-semibold">{line.qty}</span>
                  <button
                    type="button"
                    className="rounded border border-sand p-1 hover:bg-fog"
                    onClick={() =>
                      updateLine(idx, { qty: Math.min(line.maxQty, line.qty + 1) })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Select
                  label="Issue type"
                  value={line.issueType}
                  onChange={(e) => updateLine(idx, { issueType: e.target.value })}
                >
                  {ISSUE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                {line.issueType === 'other' ? (
                  <TextArea
                    label="Describe the issue"
                    rows={2}
                    value={line.issueNote}
                    onChange={(e) => updateLine(idx, { issueNote: e.target.value })}
                  />
                ) : (
                  <Input
                    label="Note (optional)"
                    value={line.issueNote}
                    onChange={(e) => updateLine(idx, { issueNote: e.target.value })}
                  />
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-ink/50">Issue photo</p>
        {imagePreview ? (
          <div className="relative overflow-hidden rounded-xl border border-sand">
            <img src={imagePreview} alt="Return proof" className="max-h-40 w-full object-cover" />
            <button
              type="button"
              onClick={clearImage}
              className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-sand px-4 py-6 text-center">
            <Upload className="h-6 w-6 text-leaf" />
            <span>Upload image</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand pt-3">
        <p className="font-semibold text-wine">Credit preview: {formatCurrency(creditPreview)}</p>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          ) : null}
          <Button type="button" onClick={submit} disabled={submitting || !selected.length}>
            {submitting ? 'Submitting…' : 'Submit return'}
          </Button>
        </div>
      </div>
    </div>
  );
}
