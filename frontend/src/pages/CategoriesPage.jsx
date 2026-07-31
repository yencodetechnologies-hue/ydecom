import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { categoriesApi } from '../api';
import { PageHeader, Button } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/ui/StatusBadge';
import StatusToggle from '../components/ui/StatusToggle';
import Loader from '../components/ui/Loader';
import CategoryFormModal from '../components/ui/CategoryFormModal';
import { formatDate, getImageUrl } from '../utils/helpers';
import { useAppSelector } from '../app/hooks';

function CategoryThumb({ src, name, size = 'md' }) {
  const sizes = {
    sm: 'h-11 w-11 rounded-xl',
    md: 'h-14 w-14 rounded-2xl',
    lg: 'h-28 w-full rounded-2xl',
  };
  const url = getImageUrl(src);
  if (url) {
    return (
      <img
        src={url}
        alt={name || 'Category'}
        className={`${sizes[size]} object-cover shadow-sm ring-1 ring-blush-line`}
      />
    );
  }
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <span
      className={`${sizes[size]} flex items-center justify-center bg-gradient-to-br from-rose-soft to-sand font-display text-lg font-semibold text-wine shadow-sm ring-1 ring-blush-line`}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export default function CategoriesPage() {
  const { user } = useAppSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [removeId, setRemoveId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await categoriesApi.list({ search, page, limit });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, page, limit]);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
  };

  const onCategorySaved = () => {
    load();
  };

  const remove = async () => {
    try {
      await categoriesApi.remove(removeId);
      toast.success('Category deleted');
      setRemoveId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const toggleActive = async (id) => {
    const prev = rows.find((r) => r._id === id);
    if (!prev) return;
    setRows((list) =>
      list.map((r) => (r._id === id ? { ...r, isActive: !r.isActive } : r))
    );
    try {
      const { data } = await categoriesApi.toggleActive(id);
      if (data?.data) {
        setRows((list) =>
          list.map((r) => (r._id === id ? { ...r, ...data.data } : r))
        );
      }
      toast.success(data.message || 'Status updated');
    } catch (err) {
      setRows((list) =>
        list.map((r) => (r._id === id ? { ...r, isActive: prev.isActive } : r))
      );
      toast.error(err.response?.data?.message || 'Toggle failed');
    }
  };

  const columns = [
    {
      key: 'sno',
      label: 'S.No',
      render: (_r, index) => (meta.page - 1) * limit + index + 1,
    },
    {
      key: 'image',
      label: 'Image',
      render: (r) => <CategoryThumb src={r.image} name={r.name} size="sm" />,
    },
    {
      key: 'name',
      label: 'Category',
      render: (r) => (
        <div>
          <p className="font-semibold text-wine">{r.name}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-mauve">{r.description || 'No description'}</p>
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (r) =>
        isAdmin ? (
          <StatusToggle
            checked={r.isActive}
            onChange={() => toggleActive(r._id)}
            onLabel="Active"
            offLabel="Off"
            title={r.isActive ? 'Deactivate category' : 'Activate category'}
          />
        ) : (
          <StatusBadge status={r.isActive ? 'active' : 'inactive'} />
        ),
    },
    { key: 'createdAt', label: 'Created', render: (r) => formatDate(r.createdAt) },
  ];

  if (isAdmin) {
    columns.push({
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <button type="button" className="rounded-lg p-1.5 hover:bg-fog" onClick={() => openEdit(r)}>
            <Pencil className="h-4 w-4 text-rose-deep" />
          </button>
          <button type="button" className="rounded-lg p-1.5 hover:bg-fog" onClick={() => setRemoveId(r._id)}>
            <Trash2 className="h-4 w-4 text-danger" />
          </button>
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organize your catalog with clear names and visuals"
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Category
            </Button>
          ) : null
        }
      />

      {!loading && rows.length > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.slice(0, 5).map((row) => (
            <button
              key={row._id}
              type="button"
              onClick={() => isAdmin && openEdit(row)}
              className="group relative overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-blush-line transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-[4/3] overflow-hidden bg-blush">
                {getImageUrl(row.image) ? (
                  <img
                    src={getImageUrl(row.image)}
                    alt={row.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-soft via-blush to-sand">
                    <span className="font-display text-3xl font-semibold text-wine/70">
                      {row.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-wine/70 via-wine/10 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="truncate font-display text-sm font-semibold text-white">{row.name}</p>
                <p className="mt-0.5 text-[11px] font-medium text-white/75">
                  {row.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
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

      <CategoryFormModal
        open={open}
        editing={editing}
        onClose={closeModal}
        onSuccess={onCategorySaved}
      />

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete category?"
        message="This action cannot be undone."
        onClose={() => setRemoveId(null)}
        onConfirm={remove}
        confirmLabel="Delete"
      />
    </div>
  );
}
