const QRCode = require('qrcode');

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const truncateProductName = (value, maxLength = 12) =>
  String(value ?? '').slice(0, maxLength);

const formatDate = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const normalizeItem = (item) => {
  const product = item.product && typeof item.product === 'object' ? item.product : null;
  return {
    name: item.name || product?.name || '',
    qty: Number(item.qty) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    lineTotal: Number(item.lineTotal) || 0,
    itemCode: item.itemCode || product?.itemCode || '',
    image: item.image || product?.images?.[0] || '',
    mrp: Number(item.mrp ?? product?.mrp) || 0,
    cost: Number(item.cost ?? product?.cost) || 0,
    tax: Number(item.tax ?? product?.tax) || 0,
    netCost: Number(item.netCost ?? product?.netCost) || 0,
    salesTax: Number(item.salesTax ?? product?.salesTax) || 0,
  };
};

const computeTotals = (items, buyerRole, subtotal, shippingCost, voucherDiscount = 0) => {
  const normalized = items.map(normalizeItem);
  const itemsTotal = Number(subtotal) || 0;
  const taxTotal = normalized.reduce((sum, item) => {
    const salesTax = item.salesTax || 0;
    if (salesTax <= 0) return sum;
    const lineTax = item.lineTotal - item.lineTotal / (1 + salesTax / 100);
    return sum + lineTax;
  }, 0);
  const mrpTotal = normalized.reduce((sum, item) => sum + item.mrp * item.qty, 0);
  const discountTotal =
    buyerRole === 'customer' ? Math.max(0, Math.round((mrpTotal - itemsTotal) * 100) / 100) : 0;
  const voucherTotal = Math.max(0, Number(voucherDiscount) || 0);
  const shippingTotal = Number(shippingCost) || 0;
  const grandTotal = Math.round((itemsTotal - voucherTotal + shippingTotal) * 100) / 100;

  return {
    itemsTotal: Math.round(itemsTotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    discountTotal,
    voucherTotal: Math.round(voucherTotal * 100) / 100,
    shippingTotal: Math.round(shippingTotal * 100) / 100,
    grandTotal,
  };
};

const cell = (content, style = '') =>
  `<td style="padding:8px;border:1px solid #ddd;${style}">${content}</td>`;

const detailRow = (label, value) => `
  <div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${value}</span>
  </div>`;

const statusBadge = (label, variant) =>
  `<span class="badge badge-${variant}">${escapeHtml(label)}</span>`;

const buildCustomerDetailsCard = (order, buyer, invoiceId, qrDataUrl) => `
    <div class="invoice-card">
      <div class="invoice-details">
        ${detailRow('Customer Name', escapeHtml(buyer?.name || '—'))}
        ${detailRow('Order ID', escapeHtml(order.orderNumber || '—'))}
        ${detailRow('Phone Number', escapeHtml(buyer?.mobile || '—'))}
        ${detailRow('Address', escapeHtml(order.shippingAddress || 'N/A'))}
        ${detailRow('Ordered Date', escapeHtml(formatDate(order.createdAt)))}
      </div>
      <div class="invoice-qr">
        <img src="${qrDataUrl}" alt="Invoice QR code" />
        <p class="invoice-id">${escapeHtml(invoiceId)}</p>
        <p class="scan-hint">Scan to verify invoice</p>
      </div>
    </div>`;

const generateInvoiceHtml = async (order, buyer, { autoPrint = false } = {}) => {
  const isPaid = order.paymentStatus === 'paid';
  const docTitle = isPaid ? 'Invoice' : 'Order Summary';
  const paymentLabel =
    ({ paid: 'Paid', pending: 'Pending', failed: 'Failed' })[order.paymentStatus] ||
    order.paymentStatus ||
    '—';
  const paymentVariant =
    ({ paid: 'success', pending: 'warning', failed: 'danger' })[order.paymentStatus] || 'neutral';
  const fulfillmentLabel =
    ({ ordered: 'Ordered', order_packed: 'Packed', dispatched: 'Dispatched', delivered: 'Delivered' })[
      order.status
    ] || order.status;
  const buyerRole = buyer?.role || 'customer';
  const isCustomerOrder = buyerRole === 'customer';
  const normalizedItems = (order.items || []).map(normalizeItem);
  const totals = computeTotals(
    order.items || [],
    buyerRole,
    order.subtotal,
    order.shippingCost,
    order.voucherDiscount
  );

  const invoiceId = order.invoiceNumber || order.orderNumber;
  const qrDataUrl = await QRCode.toDataURL(invoiceId, { width: 120, margin: 1 });

  const headerCells = isCustomerOrder
    ? ['S.No', 'Image', 'Item Code', 'Item Name', 'Qty', 'Net Cost']
    : ['S.No', 'Image', 'Item Code', 'Item Name', 'Qty', 'Cost', 'Tax (%)', 'Net Cost'];

  const headerRow = headerCells
    .map(
      (label) =>
        `<th style="padding:8px;border:1px solid #ddd;text-align:${label === 'Qty' || label === 'Image' ? 'center' : label === 'S.No' ? 'center' : 'left'};background:#f3f4f6;">${label}</th>`
    )
    .join('');

  const rows = normalizedItems
    .map((item, index) => {
      const imageCell = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:4px;" />`
        : '—';
      const baseCells = [
        cell(index + 1, 'text-align:center;'),
        cell(imageCell, 'text-align:center;'),
        cell(escapeHtml(item.itemCode || '—')),
        cell(escapeHtml(truncateProductName(item.name))),
        cell(item.qty, 'text-align:center;'),
      ];

      if (isCustomerOrder) {
        baseCells.push(cell(formatMoney(item.unitPrice), 'text-align:right;'));
      } else {
        baseCells.push(
          cell(formatMoney(item.cost), 'text-align:right;'),
          cell(`${item.tax}%`, 'text-align:center;'),
          cell(formatMoney(item.netCost), 'text-align:right;')
        );
      }

      return `<tr>${baseCells.join('')}</tr>`;
    })
    .join('');

  const footerData = [
    ['Total', totals.itemsTotal],
    ['Tax', totals.taxTotal],
    ['Discount', totals.discountTotal],
    ...(totals.voucherTotal > 0
      ? [[`Voucher (${escapeHtml(order.voucherCode || 'applied')})`, -totals.voucherTotal]]
      : []),
    ['Shipping', totals.shippingTotal],
    ['Grand Total', totals.grandTotal],
  ];

  const footerRows = footerData
    .map(([label, amount], index) => {
      const isGrand = index === footerData.length - 1;
      const rowStyle = isGrand ? 'font-weight:bold;background:#f9fafb;' : '';
      return `
      <tr>
        <td colspan="${headerCells.length - 1}" style="padding:8px 12px;border:1px solid #ddd;text-align:right;${rowStyle}">
          ${label}:
        </td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;${rowStyle}">
          ${formatMoney(amount)}
        </td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${docTitle} ${escapeHtml(invoiceId)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      padding: 24px;
      color: #0f1c14;
      background: #fff;
      margin: 0;
    }
    .invoice-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #3d0e28;
      color: #fff;
      padding: 20px 24px;
      border-radius: 10px;
      margin-bottom: 24px;
    }
    .invoice-banner h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .invoice-banner .subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #ffd6e2;
      opacity: 0.9;
    }
    .badge-group { display: flex; gap: 8px; flex-wrap: wrap; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: capitalize;
    }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-neutral { background: #e5e7eb; color: #374151; }
    .badge-info { background: #ffd6e2; color: #3d0e28; }
    .invoice-card {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 24px;
      background: #fdf5f6;
      border: 1px solid #f1dce2;
      border-radius: 10px;
      padding: 24px;
    }
    .invoice-card-top {
      margin-bottom: 28px;
    }
    .invoice-details-page {
      margin-top: 48px;
      padding-top: 32px;
      border-top: 2px dashed #f1dce2;
    }
    .details-page-title {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 700;
      color: #3d0e28;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    .invoice-details { flex: 1; min-width: 0; }
    .invoice-qr {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 16px 20px;
      background: #fff;
      border: 1px solid #f1dce2;
      border-radius: 10px;
      min-width: 160px;
    }
    .invoice-qr img {
      width: 120px;
      height: 120px;
      display: block;
    }
    .invoice-qr .invoice-id {
      margin: 12px 0 4px;
      font-size: 15px;
      font-weight: 700;
      color: #3d0e28;
      word-break: break-all;
    }
    .invoice-qr .scan-hint {
      margin: 0;
      font-size: 11px;
      color: #8a6474;
    }
    .detail-row {
      display: flex;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f1dce2;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label {
      flex: 0 0 130px;
      font-size: 12px;
      font-weight: 600;
      color: #8a6474;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .detail-value {
      flex: 1;
      font-size: 14px;
      color: #2b1420;
      word-break: break-word;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
      .invoice-banner, .invoice-card { border-radius: 0; }
      .invoice-details-page {
        margin-top: 0;
        padding-top: 24px;
        border-top: none;
      }
    }
    @media (max-width: 600px) {
      .invoice-card { flex-direction: column; }
      .invoice-qr { align-self: center; }
      .detail-row { flex-direction: column; gap: 2px; }
      .detail-label { flex: none; }
    }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 12px; }
    td { font-size: 13px; vertical-align: middle; }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px;">
    <button type="button" onclick="window.print()" style="padding:8px 16px;border:1px solid #f1dce2;border-radius:6px;background:#fff;cursor:pointer;color:#3d0e28;font-weight:600;">
      Print
    </button>
  </div>

  <div class="invoice-banner">
    <div>
      <h1>YDecom ${docTitle}</h1>
      <p class="subtitle">Thank you for your order</p>
    </div>
    <div class="badge-group">
      ${statusBadge(fulfillmentLabel, 'info')}
      ${statusBadge(paymentLabel, paymentVariant)}
    </div>
  </div>

  <div class="invoice-card-top">
    ${buildCustomerDetailsCard(order, buyer, invoiceId, qrDataUrl)}
  </div>

  <table>
    <thead>
      <tr>${headerRow}</tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>${footerRows}</tfoot>
  </table>

  <div class="invoice-details-page page-break">
    <h2 class="details-page-title">Customer &amp; Delivery Details</h2>
    ${buildCustomerDetailsCard(order, buyer, invoiceId, qrDataUrl)}
  </div>
  ${autoPrint ? '<script>window.onload = () => window.print();</script>' : ''}
</body>
</html>`;
};

module.exports = { generateInvoiceHtml, normalizeItem, computeTotals };
