import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  CreditCard,
  FileText,
  Minus,
  Plus,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { ordersApi, paymentsApi, returnsApi } from '../../api';
import { Button, Input, Select, TextArea } from '../ui/Form';
import StatusBadge from '../ui/StatusBadge';
import Modal from '../ui/Modal';
import OrderTracker from './OrderTracker';
import ReturnRequestForm, { canRequestReturn } from './ReturnRequestForm';
import { formatCurrency, formatDate, getImageUrl, paymentMethodLabel } from '../../utils/helpers';
import { openRazorpayCheckout } from '../../utils/razorpay';
import { useAppSelector } from '../../app/hooks';

const FULFILLMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'order_packed', label: 'Order Packed' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Methods supplier/admin can record when confirming payment. */
export const CONFIRM_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'neft', label: 'NEFT' },
  { value: 'credit', label: 'Credit' },
  { value: 'razorpay', label: 'Online' },
];

const statusLabel = (value) =>
  FULFILLMENT_STATUSES.find((s) => s.value === value)?.label || value;

export const orderPayable = (order) =>
  Math.max(
    0,
    Math.round(((Number(order?.subtotal) || 0) - (Number(order?.voucherDiscount) || 0)) * 100) / 100
  );

/** B2B orders the supplier can still edit (before payment is submitted or completed). */
export const canSupplierEditOrder = (order) =>
  ['unpaid', 'failed'].includes(order?.paymentStatus) &&
  (order?.status === 'pending' || order?.status === 'ordered');

/** @deprecated use canSupplierEditOrder — kept for imports */
export const isAwaitingSupplierReview = (order) =>
  canSupplierEditOrder(order) && !order?.invoiceFinalized;

const paymentStatusLabel = (order) =>
  ({ unpaid: 'Unpaid', paid: 'Paid', pending: 'Pending', failed: 'Failed' })[order?.paymentStatus] ||
  order?.paymentStatus ||
  '—';

const b2bStageLabel = (order) => {
  const open = order.status === 'pending' || order.status === 'ordered';
  if (!open) return null;
  if (order.paymentStatus === 'failed') return 'Payment failed — retry payment';
  if (order.paymentStatus === 'pending' && order.paymentMethod === 'razorpay') {
    return 'Online payment incomplete — you can retry';
  }
  if (order.paymentStatus === 'pending') return 'Payment submitted — awaiting confirmation';
  if (order.invoiceFinalized && order.paymentStatus === 'unpaid') return 'Invoice ready — payment due';
  if (canSupplierEditOrder(order) && !order.invoiceFinalized) return 'Awaiting supplier review';
  return null;
};

export default function B2BOrderDetail({ order, onRefresh, showFulfillment = false }) {
  const { user, token } = useAppSelector((s) => s.auth);
  const [editItems, setEditItems] = useState([]);
  const [savingItems, setSavingItems] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [approving, setApproving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(
    ['stockist', 'distributor', 'retailer', 'reseller'].includes(user?.role) ? 'credit' : 'razorpay'
  );
  const [confirmMethod, setConfirmMethod] = useState(order.paymentMethod || 'cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const [performNote, setPerformNote] = useState('');
  const [fulfillmentStatus, setFulfillmentStatus] = useState(order.status || 'ordered');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [orderReturns, setOrderReturns] = useState([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  const buyerId = order.user?._id || order.user;
  const supplierId = order.supplier?._id || order.supplier;
  const isBuyer = String(buyerId) === String(user?._id);
  const supplySource = order.supplySource || 'admin';
  const isAdminSupplier = user?.role === 'admin' && supplySource === 'admin';
  const isStockistSupplier =
    user?.role === 'stockist' && supplySource === 'stockist' && String(supplierId) === String(user?._id);
  const isSupplier = isAdminSupplier || isStockistSupplier;
  const canManageItems = isSupplier && canSupplierEditOrder(order);
  const canGenerateInvoice = canManageItems && !order.invoiceFinalized;
  const canConfirmPayment =
    isSupplier &&
    order.paymentStatus === 'pending' &&
    order.paymentMethod !== 'razorpay';
  const openForPayment = order.status === 'pending' || order.status === 'ordered';
  const canRecordPayment =
    isSupplier &&
    openForPayment &&
    order.invoiceFinalized &&
    ['unpaid', 'failed'].includes(order.paymentStatus);
  const canPay =
    isBuyer &&
    openForPayment &&
    (order.invoiceFinalized || order.status === 'ordered') &&
    (['unpaid', 'failed'].includes(order.paymentStatus) ||
      (order.paymentStatus === 'pending' && order.paymentMethod === 'razorpay'));

  const canFulfill =
    showFulfillment && order.paymentStatus === 'paid' && isSupplier;

  const buyerCreditLimit = Number(order.user?.creditLimit) || 0;
  const buyerCreditUsed = Number(order.user?.creditUsed) || 0;
  const buyerCreditAvailable = Math.max(0, buyerCreditLimit - buyerCreditUsed);
  const creditLimit = Number(user?.creditLimit) || 0;
  const creditUsed = Number(user?.creditUsed) || 0;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const payable = orderPayable(order);
  const isCreditBuyer = ['stockist', 'distributor', 'retailer', 'reseller'].includes(user?.role);
  const canPayOnCredit = isCreditBuyer && creditAvailable >= payable && payable > 0;
  const canRecordOnCredit =
    ['stockist', 'distributor', 'retailer', 'reseller'].includes(order.user?.role) &&
    buyerCreditAvailable >= payable &&
    payable > 0;

  useEffect(() => {
    setEditItems(
      (order.items || []).map((item) => ({
        product: item.product?._id || item.product,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      }))
    );
  }, [order._id, order.items]);

  useEffect(() => {
    const method = order.paymentMethod;
    const allowed = CONFIRM_PAYMENT_METHODS.some((m) => m.value === method);
    setConfirmMethod(allowed ? method : 'cash');
    setFulfillmentStatus(order.status || 'ordered');
  }, [order._id, order.paymentMethod, order.status]);

  useEffect(() => {
    let cancelled = false;
    const loadReturns = async () => {
      if (!order?._id) return;
      setLoadingReturns(true);
      try {
        const { data } = await returnsApi.list({ orderId: order._id, limit: 20 });
        if (!cancelled) setOrderReturns(data.data || []);
      } catch {
        if (!cancelled) setOrderReturns([]);
      } finally {
        if (!cancelled) setLoadingReturns(false);
      }
    };
    loadReturns();
    return () => {
      cancelled = true;
    };
  }, [order._id]);

  const showReturnRequest = canRequestReturn(order, user);

  const recalcLine = (item) => ({
    ...item,
    lineTotal: Math.round(Number(item.unitPrice) * Number(item.qty) * 100) / 100,
  });

  const adjustQty = (index, delta) => {
    setEditItems((prev) =>
      prev
        .map((item, i) => {
          if (i !== index) return item;
          const nextQty = Math.max(1, Number(item.qty) + delta);
          return recalcLine({ ...item, qty: nextQty });
        })
        .filter((item) => item.qty > 0)
    );
  };

  const updateUnitPrice = (index, value) => {
    setEditItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const parsed = Number.parseFloat(value);
        const unitPrice = Number.isFinite(parsed) ? Math.max(0, parsed) : item.unitPrice;
        return recalcLine({ ...item, unitPrice });
      })
    );
  };

  const editSubtotal = editItems.reduce(
    (sum, item) => sum + (Number(item.lineTotal) || Number(item.unitPrice) * Number(item.qty) || 0),
    0
  );

  const saveItems = async () => {
    if (!editItems.length) {
      toast.error('Order must have at least one item');
      return;
    }
    setSavingItems(true);
    try {
      await ordersApi.updateItems(order._id, {
        items: editItems.map((i) => ({
          product: i.product,
          qty: i.qty,
          unitPrice: i.unitPrice,
        })),
      });
      toast.success('Order items updated');
      await onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update items');
    } finally {
      setSavingItems(false);
    }
  };

  const generateInvoice = async () => {
    setGeneratingInvoice(true);
    try {
      await ordersApi.generateInvoice(order._id);
      toast.success('Invoice generated');
      await onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not generate invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const confirmPayment = async () => {
    if (canRecordPayment && confirmMethod === 'credit' && !canRecordOnCredit) {
      toast.error('Buyer has insufficient credit balance');
      return;
    }
    setApproving(true);
    try {
      await paymentsApi.approve(order._id, {
        paymentMethod: confirmMethod,
        paymentReference: paymentReference.trim() || undefined,
        note: paymentNote.trim() || undefined,
      });
      toast.success(
        canRecordPayment
          ? 'Payment recorded — stock released'
          : 'Payment confirmed — stock released'
      );
      setPaymentReference('');
      setPaymentNote('');
      await onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Confirmation failed');
    } finally {
      setApproving(false);
    }
  };

  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const clearProof = () => {
    setProofFile(null);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview('');
  };

  const submitPayment = async () => {
    if (paymentMethod === 'credit' && !canPayOnCredit) {
      toast.error('Insufficient credit balance');
      return;
    }
    if (['cheque', 'neft'].includes(paymentMethod)) {
      if (!proofFile) {
        toast.error('Upload payment proof image');
        return;
      }
      if (!paymentReference.trim()) {
        toast.error(paymentMethod === 'cheque' ? 'Enter cheque number' : 'Enter UTR reference');
        return;
      }
    }

    setPaying(true);
    let pendingOrderId = order._id;

    try {
      if (['cheque', 'neft'].includes(paymentMethod)) {
        const fd = new FormData();
        fd.append('paymentMethod', paymentMethod);
        fd.append('paymentReference', paymentReference.trim());
        if (paymentNote.trim()) fd.append('paymentNote', paymentNote.trim());
        fd.append('paymentProof', proofFile);
        await ordersApi.pay(order._id, fd);
        toast.success('Payment submitted for approval');
        clearProof();
        await onRefresh?.();
        return;
      }

      if (paymentMethod === 'razorpay') {
        const { data } = await ordersApi.pay(order._id, { paymentMethod: 'razorpay' });
        const pay = data.data;
        pendingOrderId = pay.orderId;

        const paymentResponse = await openRazorpayCheckout({
          key: pay.key,
          amount: pay.amount,
          currency: pay.currency || 'INR',
          name: 'YDecom',
          description: `Order ${pay.orderNumber}`,
          order_id: pay.razorpayOrderId,
          prefill: pay.prefill || {},
          theme: { color: '#2f6b4f' },
        });

        await paymentsApi.verify({
          orderId: pay.orderId,
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
        });
        toast.success('Payment successful');
        await onRefresh?.();
        return;
      }

      await ordersApi.pay(order._id, {
        paymentMethod,
        paymentNote: paymentNote.trim() || undefined,
      });
      toast.success('Payment submitted for approval');
      await onRefresh?.();
    } catch (err) {
      if (paymentMethod === 'razorpay' && pendingOrderId) {
        try {
          await paymentsApi.fail({ orderId: pendingOrderId });
        } catch {
          /* ignore */
        }
      }
      const message = err.response?.data?.message || err.message || 'Payment failed';
      if (message !== 'Payment cancelled') toast.error(message);
    } finally {
      setPaying(false);
    }
  };

  const updateStatus = async (nextStatus, note = '') => {
    setUpdatingStatus(true);
    try {
      await ordersApi.updateStatus(order._id, { status: nextStatus, note: note.trim() || undefined });
      toast.success('Order status updated');
      setPerformNote('');
      await onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openOrderDocument = async (id, { print = false } = {}) => {
    try {
      const url = print ? ordersApi.printUrl(id) : ordersApi.invoiceUrl(id);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not open document');
      }
      const html = await res.text();
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } catch (err) {
      toast.error(err.message || 'Could not open document');
    }
  };

  const displayItems = canManageItems ? editItems : order.items || [];
  const stage = b2bStageLabel(order);

  return (
    <div className="space-y-5 text-sm">
      {(order.status === 'pending' || order.status === 'ordered') && order.paymentStatus !== 'paid' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-semibold text-amber-900">B2B order — {stage || 'In progress'}</p>
          {order.invoiceFinalized ? (
            <p className="mt-1 text-xs text-amber-800">
              Invoice {order.invoiceNumber} · {formatCurrency(payable)} due
            </p>
          ) : null}
        </div>
      ) : order.paymentStatus === 'paid' ? (
        <OrderTracker status={order.status} statusHistory={order.statusHistory} />
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <p>
          <strong>Fulfillment:</strong>{' '}
          <StatusBadge status={order.status} label={statusLabel(order.status)} />
        </p>
        <p>
          <strong>Payment:</strong>{' '}
          <StatusBadge status={order.paymentStatus || 'paid'} label={paymentStatusLabel(order)} />
        </p>
        {order.paymentMethod ? (
          <p>
            <strong>Payment method:</strong> {paymentMethodLabel(order.paymentMethod)}
          </p>
        ) : null}
        <p>
          <strong>Amount:</strong> {formatCurrency(payable)}
        </p>
        <p>
          <strong>Buyer:</strong> {order.user?.name || '—'}
        </p>
        <p>
          <strong>Date:</strong> {formatDate(order.createdAt)}
        </p>
        <p>
          <strong>Invoice:</strong> {order.invoiceNumber || '—'}
        </p>
        {order.paymentReference ? (
          <p>
            <strong>Reference:</strong> {order.paymentReference}
          </p>
        ) : null}
        {order.paymentProofImage ? (
          <div className="sm:col-span-2">
            <strong>Payment proof:</strong>
            <img
              src={getImageUrl(order.paymentProofImage)}
              alt="Payment proof"
              className="mt-2 max-h-48 rounded-xl border border-sand object-contain"
            />
          </div>
        ) : null}
        <p className="sm:col-span-2 whitespace-pre-line">
          <strong>Shipping:</strong>
          <br />
          {order.shippingAddress || '—'}
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
            {displayItems.map((item, idx) => (
              <tr key={idx} className="border-t border-sand">
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2">
                  {canManageItems ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded border border-sand p-1 hover:bg-fog"
                        onClick={() => adjustQty(idx, -1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[2rem] text-center">{item.qty}</span>
                      <button
                        type="button"
                        className="rounded border border-sand p-1 hover:bg-fog"
                        onClick={() => adjustQty(idx, 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    item.qty
                  )}
                </td>
                <td className="px-3 py-2">
                  {canManageItems ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateUnitPrice(idx, e.target.value)}
                      className="!w-28 !py-1.5 text-sm"
                      aria-label={`Unit price for ${item.name}`}
                    />
                  ) : (
                    formatCurrency(item.unitPrice)
                  )}
                </td>
                <td className="px-3 py-2">
                  {formatCurrency(item.lineTotal || item.unitPrice * item.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManageItems ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand bg-fog/40 px-4 py-3 text-sm">
          <p className="text-ink/70">
            {order.invoiceFinalized
              ? 'Invoice is issued — you can still adjust quantities or prices. Saving clears the invoice; generate it again before the buyer pays.'
              : 'Adjust quantities or reduce unit prices, then save. Generate the invoice when ready.'}
          </p>
          <p className="font-semibold text-wine">
            Revised total: {formatCurrency(Math.round(editSubtotal * 100) / 100)}
          </p>
        </div>
      ) : null}

      {canManageItems ? (
        <div className="flex flex-wrap gap-2 border-t border-sand pt-4">
          <Button onClick={saveItems} disabled={savingItems}>
            {savingItems ? 'Saving…' : 'Save item changes'}
          </Button>
          {canGenerateInvoice ? (
            <Button variant="secondary" onClick={generateInvoice} disabled={generatingInvoice}>
              {generatingInvoice ? 'Generating…' : 'Generate invoice'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {canConfirmPayment || canRecordPayment ? (
        <div className="space-y-3 border-t border-sand pt-4">
          <p className="font-semibold text-ink">
            {canRecordPayment ? 'Record payment' : 'Confirm payment'}
          </p>
          {canRecordPayment ? (
            <p className="text-sm text-ink/70">
              Record cash or offline payment collected from the buyer, then release stock from your
              inventory.
            </p>
          ) : null}
          <Select
            label="Payment method"
            value={confirmMethod}
            onChange={(e) => setConfirmMethod(e.target.value)}
            className="max-w-xs"
          >
            {CONFIRM_PAYMENT_METHODS.filter((m) => m.value !== 'razorpay').map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          {canRecordPayment && confirmMethod === 'credit' ? (
            <div className="rounded-xl border border-leaf/30 bg-mint/20 px-4 py-3 text-sm">
              <p className="font-semibold">
                Buyer credit available: {formatCurrency(buyerCreditAvailable)}
              </p>
            </div>
          ) : null}
          {canRecordPayment && ['cheque', 'neft'].includes(confirmMethod) ? (
            <Input
              label={confirmMethod === 'cheque' ? 'Cheque number' : 'UTR / Transaction reference'}
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
          ) : null}
          {canRecordPayment ? (
            <TextArea
              label="Note (optional)"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              rows={2}
            />
          ) : null}
          <Button
            onClick={confirmPayment}
            disabled={
              approving ||
              (canRecordPayment && confirmMethod === 'credit' && !canRecordOnCredit) ||
              (canRecordPayment &&
                ['cheque', 'neft'].includes(confirmMethod) &&
                !paymentReference.trim())
            }
          >
            {approving
              ? canRecordPayment
                ? 'Recording…'
                : 'Confirming…'
              : canRecordPayment
                ? 'Record payment & release stock'
                : 'Confirm payment & release stock'}
          </Button>
        </div>
      ) : null}

      {canPay ? (
        <div className="space-y-3 border-t border-sand pt-4">
          <p className="font-semibold text-ink">Pay now</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { id: 'credit', label: 'Credit', icon: Wallet, show: isCreditBuyer },
              { id: 'cheque', label: 'Cheque', icon: FileText, show: true },
              { id: 'neft', label: 'NEFT', icon: Building2, show: true },
              { id: 'razorpay', label: 'Online', icon: CreditCard, show: true },
            ]
              .filter((m) => m.show)
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentMethod(id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    paymentMethod === id
                      ? 'border-leaf bg-mint/25 text-wine ring-1 ring-leaf/40'
                      : 'border-sand bg-white text-ink/70 hover:border-leaf/40'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-leaf" />
                  {label}
                </button>
              ))}
          </div>

          {paymentMethod === 'credit' ? (
            <div className="rounded-xl border border-leaf/30 bg-mint/20 px-4 py-3 text-sm">
              <p className="font-semibold">Credit available: {formatCurrency(creditAvailable)}</p>
            </div>
          ) : null}

          {['cheque', 'neft'].includes(paymentMethod) ? (
            <>
              <Input
                label={paymentMethod === 'cheque' ? 'Cheque number' : 'UTR / Transaction reference'}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
              {proofPreview ? (
                <div className="relative overflow-hidden rounded-xl border border-sand">
                  <img src={proofPreview} alt="Proof" className="max-h-40 w-full object-cover" />
                  <button
                    type="button"
                    onClick={clearProof}
                    className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-sand px-4 py-6 text-center text-sm">
                  <Upload className="h-6 w-6 text-leaf" />
                  <span>Upload payment proof</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleProofChange} />
                </label>
              )}
            </>
          ) : null}

          <TextArea
            label="Note (optional)"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            rows={2}
          />

          <Button
            onClick={submitPayment}
            disabled={
              paying ||
              (paymentMethod === 'credit' && !canPayOnCredit) ||
              (['cheque', 'neft'].includes(paymentMethod) && (!proofFile || !paymentReference.trim()))
            }
          >
            {paying ? 'Processing…' : `Submit payment · ${formatCurrency(payable)}`}
          </Button>
        </div>
      ) : null}

      {canFulfill ? (
        <div className="space-y-3 border-t border-sand pt-4">
          <span className="text-xs font-semibold uppercase text-ink/50">Fulfillment status</span>
          <Select
            label="Order status"
            value={fulfillmentStatus}
            onChange={(e) => setFulfillmentStatus(e.target.value)}
            className="max-w-xs"
          >
            {FULFILLMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <textarea
            className="w-full rounded-lg border border-sand px-3 py-2 text-sm"
            rows={2}
            placeholder="Optional note for this update"
            value={performNote}
            onChange={(e) => setPerformNote(e.target.value)}
          />
          <Button
            onClick={() => updateStatus(fulfillmentStatus, performNote)}
            disabled={updatingStatus || fulfillmentStatus === order.status}
          >
            {updatingStatus ? 'Updating…' : 'Update status'}
          </Button>
        </div>
      ) : null}

      {(order.invoiceFinalized || order.paymentStatus === 'paid') && (
        <div className="flex flex-wrap gap-2 border-t border-sand pt-4">
          <Button variant="secondary" onClick={() => openOrderDocument(order._id, { print: true })}>
            Print
          </Button>
          <Button variant="ghost" onClick={() => openOrderDocument(order._id)}>
            View invoice
          </Button>
        </div>
      )}

      {(showReturnRequest || orderReturns.length > 0) && (
        <div className="space-y-3 border-t border-sand pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase text-ink/50">Returns</span>
            {showReturnRequest ? (
              <Button
                type="button"
                variant="secondary"
                className="!px-3 !py-1.5 text-xs"
                onClick={() => setReturnOpen(true)}
              >
                Request return
              </Button>
            ) : null}
          </div>
          {loadingReturns ? (
            <p className="text-xs text-ink/50">Loading returns…</p>
          ) : orderReturns.length ? (
            <ul className="space-y-2 text-sm">
              {orderReturns.map((r) => (
                <li
                  key={r._id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sand px-3 py-2"
                >
                  <span>
                    <span className="font-semibold">{r.returnNumber}</span>
                    <span className="ml-2 text-ink/60">{formatCurrency(r.creditAmount)}</span>
                  </span>
                  <StatusBadge status={r.status} label={r.status?.replace('_', ' ')} />
                </li>
              ))}
            </ul>
          ) : showReturnRequest ? (
            <p className="text-xs text-ink/60">You can return products within 7 days of delivery.</p>
          ) : null}
        </div>
      )}

      <Modal
        open={returnOpen}
        title={`Return — ${order.orderNumber || ''}`}
        onClose={() => setReturnOpen(false)}
        wide
      >
        <ReturnRequestForm
          order={order}
          onCancel={() => setReturnOpen(false)}
          onDone={async () => {
            setReturnOpen(false);
            try {
              const { data } = await returnsApi.list({ orderId: order._id, limit: 20 });
              setOrderReturns(data.data || []);
            } catch {
              /* ignore */
            }
            await onRefresh?.();
          }}
        />
      </Modal>
    </div>
  );
}
