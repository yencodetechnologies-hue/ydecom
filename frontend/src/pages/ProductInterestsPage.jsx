import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { productsApi } from '../api';
import { PageHeader } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import Loader from '../components/ui/Loader';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import StatusBadge from '../components/ui/StatusBadge';
import { formatDate, getImageUrl, roleLabel } from '../utils/helpers';

const typeLabel = {
  out_of_stock: 'Out of stock',
  first_purchase: 'First purchase',
};

export default function ProductInterestsPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    productsApi
      .listInterests({ page, limit })
      .then((res) => {
        if (!active) return;
        setRows(res.data?.data || []);
        setMeta(res.data?.meta || { page: 1, pages: 1, total: 0 });
      })
      .catch((err) => {
        if (!active) return;
        toast.error(err.response?.data?.message || 'Failed to load product interests');
        setRows([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, limit]);

  const columns = [
    {
      key: 'product',
      label: 'Product',
      render: (r) => {
        const img = getImageUrl(r.product?.images?.[0]);
        return (
          <div className="flex items-center gap-3">
            {img ? (
              <img src={img} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-fog text-xs text-ink/40">
                —
              </span>
            )}
            <div>
              <p className="font-medium text-ink">{r.product?.name || '—'}</p>
              <p className="text-xs text-ink/50">SKU: {r.product?.sku || '—'}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'quantity',
      label: 'Qty requested',
      render: (r) => <strong>{r.quantity ?? 1}</strong>,
    },
    {
      key: 'user',
      label: 'Requested by',
      render: (r) => (
        <div>
          <p className="font-medium text-wine">{r.user?.name || '—'}</p>
          {r.user?.shopName ? (
            <p className="text-xs text-mauve">{r.user.shopName}</p>
          ) : null}
          {r.user?.role ? (
            <span className="mt-1 inline-flex rounded-full bg-blush px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-deep">
              {roleLabel(r.user.role)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (r) => (
        <div className="text-sm">
          <p>{r.user?.email || '—'}</p>
          <p className="text-ink/55">{r.user?.mobile || '—'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (r) => (
        <StatusBadge
          status={r.type === 'first_purchase' ? 'pending' : 'ordered'}
          label={typeLabel[r.type] || r.type}
        />
      ),
    },
    {
      key: 'placedBy',
      label: 'Submitted by',
      render: (r) =>
        r.placedBy ? (
          <div>
            <p>{r.placedBy.name}</p>
            {r.placedBy.shopName ? (
              <p className="text-xs text-ink/55">{r.placedBy.shopName}</p>
            ) : null}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'updatedAt',
      label: 'Last updated',
      render: (r) => formatDate(r.updatedAt || r.createdAt),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Product interests"
        subtitle="Interest requests from stockists, distributors, retailers and resellers with requested quantities"
      />
      <div className="mb-4 rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
        Total requests: <strong>{meta.total ?? rows.length}</strong>
      </div>
      {loading ? (
        <Loader />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} empty="No product interests yet." />
          <Pagination
            page={page}
            pages={meta.pages || 1}
            onPageChange={setPage}
            limit={limit}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
