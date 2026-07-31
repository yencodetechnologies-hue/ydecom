import { Check } from 'lucide-react';
import { formatDate } from '../../utils/helpers';

const STEPS = [
  { key: 'ordered', label: 'Ordered' },
  { key: 'order_packed', label: 'Packed' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
];

const stepIndex = (status) => {
  const i = STEPS.findIndex((s) => s.key === status);
  return i >= 0 ? i : 0;
};

const historyTime = (statusHistory, key) => {
  if (!Array.isArray(statusHistory)) return null;
  const match = [...statusHistory].reverse().find((h) => h.status === key);
  return match?.changedAt || null;
};

/** Flipkart-style horizontal order tracking stepper. */
export default function OrderTracker({ status, statusHistory, title = 'Manage order' }) {
  const current = stepIndex(status);

  return (
    <div className="rounded-2xl border border-sand bg-fog/40 px-3 py-5 sm:px-6">
      <h4 className="mb-5 text-sm font-semibold text-wine">{title}</h4>
      <div className="flex items-start">
        {STEPS.map((step, index) => {
          const done = index <= current;
          const active = index === current;
          const at = historyTime(statusHistory, step.key);
          return (
            <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <div
                  className={`h-0.5 flex-1 ${index === 0 ? 'bg-transparent' : index <= current ? 'bg-leaf' : 'bg-sand'}`}
                />
                <span
                  className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    done ? 'border-leaf bg-leaf text-white' : 'border-sand bg-white text-ink/40'
                  } ${active ? 'ring-4 ring-leaf/20' : ''}`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                </span>
                <div
                  className={`h-0.5 flex-1 ${
                    index === STEPS.length - 1
                      ? 'bg-transparent'
                      : index < current
                        ? 'bg-leaf'
                        : 'bg-sand'
                  }`}
                />
              </div>
              <span className={`mt-2 text-xs font-semibold ${done ? 'text-wine' : 'text-ink/40'}`}>
                {step.label}
              </span>
              <span className={`mt-0.5 text-[10px] ${at ? 'text-ink/45' : 'text-transparent'}`}>
                {at ? formatDate(at) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
