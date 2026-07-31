import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { manufacturersApi } from '../api';
import { PageHeader, Button } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/ui/StatusBadge';
import StatusToggle from '../components/ui/StatusToggle';
import Loader from '../components/ui/Loader';
import ManufacturerFormModal from '../components/ui/ManufacturerFormModal';
import { formatDate } from '../utils/helpers';
import { useAppSelector } from '../app/hooks';

export default function ManufacturersPage() {
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
      const { data } = await manufacturersApi.list({ search, page, limit });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load manufacturers');
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

  const onManufacturerSaved = () => {
    load();
  };

  const remove = async () => {
    try {
      await manufacturersApi.remove(removeId);
      toast.success('Manufacturer deleted');
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
      const { data } = await manufacturersApi.toggleActive(id);
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
      key: 'name',
      label: 'Manufacturer',
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
            title={r.isActive ? 'Deactivate manufacturer' : 'Activate manufacturer'}
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
        title="Manufacturers"
        subtitle="Manage product manufacturers and brands"
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Manufacturer
            </Button>
          ) : null
        }
      />

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

      <ManufacturerFormModal
        open={open}
        editing={editing}
        onClose={closeModal}
        onSuccess={onManufacturerSaved}
      />

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete manufacturer?"
        message="This action cannot be undone."
        onClose={() => setRemoveId(null)}
        onConfirm={remove}
        confirmLabel="Delete"
      />
    </div>
  );
}
