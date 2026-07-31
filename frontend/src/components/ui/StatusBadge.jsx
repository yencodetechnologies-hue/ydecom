export default function StatusBadge({ status, label }) {
  const map = {
    pending: 'bg-amber/15 text-amber',
    ordered: 'bg-amber/15 text-amber',
    approved: 'bg-leaf/15 text-leaf',
    rejected: 'bg-danger/15 text-danger',
    active: 'bg-leaf/15 text-leaf',
    inactive: 'bg-ink/10 text-ink/60',
    processing: 'bg-sky-100 text-sky-700',
    order_packed: 'bg-sky-100 text-sky-700',
    shipped: 'bg-indigo-100 text-indigo-700',
    dispatched: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-leaf/15 text-leaf',
    cancelled: 'bg-danger/15 text-danger',
    paid: 'bg-leaf/15 text-leaf',
    failed: 'bg-danger/15 text-danger',
  };
  const key = String(status || '').toLowerCase();
  const display =
    label ||
    String(status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    '—';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${map[key] || 'bg-ink/10 text-ink/70'}`}>
      {display}
    </span>
  );
}
