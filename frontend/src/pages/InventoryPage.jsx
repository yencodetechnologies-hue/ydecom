import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { inventoryApi } from '../api';
import { PageHeader } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import Loader from '../components/ui/Loader';
import { getImageUrl } from '../utils/helpers';

function MinRackQtyInput({ row, onSaved }) {
  const [value, setValue] = useState(String(row.minRackQty ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(row.minRackQty ?? 0));
  }, [row._id, row.minRackQty]);

  const save = async () => {
    const next = Math.max(0, Math.floor(Number(value) || 0));
    if (next === Number(row.minRackQty || 0)) {
      setValue(String(next));
      return;
    }
    setSaving(true);
    try {
      const { data } = await inventoryApi.updateMinRackQty(row._id, next);
      onSaved(data.data);
      toast.success('Min rack qty saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save min rack qty');
      setValue(String(row.minRackQty ?? 0));
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="number"
      min={0}
      step={1}
      disabled={saving}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className="w-20 rounded-lg border border-sand bg-white px-2 py-1.5 text-sm text-wine outline-none focus:border-rose"
      aria-label={`Min rack qty for ${row.product?.name || 'product'}`}
    />
  );
}

export default function InventoryPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await inventoryApi.list({ search, page, limit });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, page, limit]);

  const columns = [
    {
      key: 'product',
      label: 'Product',
      render: (r) => (
        <div className="flex items-center gap-3">
          {r.product?.images?.[0] ? (
            <img
              src={getImageUrl(r.product.images[0])}
              alt=""
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-fog" />
          )}
          <div>
            <p className="font-semibold">{r.product?.name || '—'}</p>
            <p className="text-xs text-ink/50">{r.product?.sku || ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'stock',
      label: 'In stock',
      render: (r) => {
        const min = Number(r.minRackQty) || 0;
        const low = min > 0 && Number(r.stock) < min;
        return (
          <span className={low ? 'font-semibold text-danger' : undefined}>{r.stock ?? 0}</span>
        );
      },
    },
    {
      key: 'minRackQty',
      label: 'Min rack qty',
      render: (r) => (
        <MinRackQtyInput
          row={r}
          onSaved={(updated) => {
            setRows((prev) => prev.map((row) => (row._id === updated._id ? updated : row)));
          }}
        />
      ),
    },
    {
      key: 'status',
      label: 'Product status',
      render: (r) => r.product?.status || '—',
    },
    {
      key: 'updatedAt',
      label: 'Last updated',
      render: (r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'),
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Inventory"
        subtitle="Set min rack qty per product — you get a notification when stock goes below it"
      />
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by product name or SKU"
        />
      </div>
      {loading ? (
        <Loader />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-sand bg-fog/30 px-6 py-16 text-center text-sm text-ink/60">
          No inventory yet. Stock is added when your orders are marked Delivered (stockists from
          admin; distributors from their stockist).
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}
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
    </div>
  );
}
