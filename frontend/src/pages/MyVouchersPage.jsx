import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TicketPercent, Lock, Unlock, ShoppingBag } from 'lucide-react';
import { vouchersApi } from '../api';
import { PageHeader, Button } from '../components/ui/Form';
import Loader from '../components/ui/Loader';
import { formatCurrency, formatDate } from '../utils/helpers';

function discountLabel(voucher) {
  if (voucher.type === 'percentage') {
    const cap =
      voucher.maxDiscount != null && voucher.maxDiscount > 0
        ? ` (max ${formatCurrency(voucher.maxDiscount)})`
        : '';
    return `${voucher.value}% off${cap}`;
  }
  return `${formatCurrency(voucher.value)} off`;
}

function VoucherCard({ voucher }) {
  const unlocked = Boolean(voucher.unlocked);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm ${
        unlocked ? 'border-emerald-200' : 'border-blush-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                unlocked
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : 'bg-ink/5 text-ink/55'
              }`}
            >
              {unlocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {unlocked ? 'Unlocked' : 'Locked'}
            </span>
            <span className="rounded-full bg-rose-soft px-2.5 py-1 text-[11px] font-semibold text-rose-deep">
              {discountLabel(voucher)}
            </span>
          </div>
          <p className="mt-3 font-display text-2xl tracking-wide text-wine">{voucher.code}</p>
          {voucher.description ? (
            <p className="mt-1 text-sm text-ink/60">{voucher.description}</p>
          ) : null}
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            unlocked ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blush text-mauve'
          }`}
        >
          <TicketPercent className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 space-y-1.5 text-xs text-ink/55">
        {voucher.minOrderAmount > 0 ? (
          <p>Min. order: {formatCurrency(voucher.minOrderAmount)}</p>
        ) : null}
        <p>Unlock at: {formatCurrency(voucher.qualifyingPurchaseAmount)} total spend</p>
        {voucher.endDate ? <p>Valid until: {formatDate(voucher.endDate)}</p> : null}
      </div>

      {!unlocked ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-ink/60">Progress</span>
            <span className="font-semibold text-wine">
              {voucher.progress}% · {formatCurrency(voucher.remaining)} to go
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-blush">
            <div
              className="h-full rounded-full bg-rose transition-all"
              style={{ width: `${Math.min(100, voucher.progress || 0)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Link to="/cart">
            <Button variant="secondary" className="w-full sm:w-auto">
              <ShoppingBag className="h-4 w-4" /> Use at checkout
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MyVouchersPage() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await vouchersApi.mine();
        if (!cancelled) setWallet(data.data || { vouchers: [], totalSpend: 0, unlockedCount: 0 });
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || 'Failed to load vouchers');
          setWallet({ vouchers: [], totalSpend: 0, unlockedCount: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const vouchers = wallet?.vouchers || [];
  const unlocked = vouchers.filter((v) => v.unlocked);
  const locked = vouchers.filter((v) => !v.unlocked);

  return (
    <div>
      <PageHeader
        title="My Vouchers"
        subtitle="Rewards unlocked from your purchases — use them at checkout"
      />

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
                Your total spend
              </p>
              <p className="mt-1 font-display text-2xl text-wine">
                {formatCurrency(wallet?.totalSpend)}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
                Unlocked vouchers
              </p>
              <p className="mt-1 font-display text-2xl text-wine">
                {wallet?.unlockedCount ?? unlocked.length}
              </p>
            </div>
          </div>

          {!vouchers.length ? (
            <div className="rounded-2xl border border-dashed border-blush-line bg-white px-6 py-14 text-center">
              <TicketPercent className="mx-auto h-10 w-10 text-mauve" />
              <p className="mt-3 font-semibold text-wine">No vouchers yet</p>
              <p className="mt-1 text-sm text-ink/55">
                Keep shopping to unlock auto rewards based on your purchase total.
              </p>
              <Link to="/shop" className="mt-5 inline-block">
                <Button>Browse shop</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {unlocked.length ? (
                <section>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
                    Ready to use
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {unlocked.map((v) => (
                      <VoucherCard key={v._id} voucher={v} />
                    ))}
                  </div>
                </section>
              ) : null}

              {locked.length ? (
                <section>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
                    Keep shopping to unlock
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {locked.map((v) => (
                      <VoucherCard key={v._id} voucher={v} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
