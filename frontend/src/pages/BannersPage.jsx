import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { bannersApi } from '../api';
import { PageHeader, Button } from '../components/ui/Form';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/ui/StatusBadge';
import StatusToggle from '../components/ui/StatusToggle';
import Loader from '../components/ui/Loader';
import BannerFormModal from '../components/ui/BannerFormModal';
import { getImageUrl } from '../utils/helpers';

export default function BannersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [removeId, setRemoveId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await bannersApi.list();
      setRows(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  const remove = async () => {
    try {
      await bannersApi.remove(removeId);
      toast.success('Banner deleted');
      setRemoveId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const toggleActive = async (id) => {
    const prev = rows.find((r) => r._id === id);
    if (!prev) return;
    setRows((list) => list.map((r) => (r._id === id ? { ...r, isActive: !r.isActive } : r)));
    try {
      const { data } = await bannersApi.toggleActive(id);
      if (data?.data) {
        setRows((list) => list.map((r) => (r._id === id ? { ...r, ...data.data } : r)));
      }
      toast.success(data.message || 'Status updated');
    } catch (err) {
      setRows((list) => list.map((r) => (r._id === id ? { ...r, isActive: prev.isActive } : r)));
      toast.error(err.response?.data?.message || 'Toggle failed');
    }
  };

  return (
    <div>
      <PageHeader
        title="Banners"
        subtitle="Manage the hero banners shown on the customer home page"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Banner
          </Button>
        }
      />

      {loading ? (
        <Loader />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-sand bg-white p-8 text-center text-sm text-ink/60">
          No banners yet. Add one to show it on the home page.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row._id} className="overflow-hidden rounded-2xl border border-sand bg-white shadow-sm">
              <div className="aspect-[16/7] w-full bg-fog">
                <img src={getImageUrl(row.image)} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink/50">Order: {row.order ?? 0}</span>
                  <StatusBadge status={row.isActive ? 'active' : 'inactive'} />
                </div>
                {row.link ? (
                  <p className="truncate text-xs text-ink/60">Link: {row.link}</p>
                ) : null}
                <div className="flex items-center justify-between pt-1">
                  <StatusToggle
                    checked={row.isActive}
                    onChange={() => toggleActive(row._id)}
                    onLabel="ON"
                    offLabel="OFF"
                    size="sm"
                    title={row.isActive ? 'Deactivate banner' : 'Activate banner'}
                  />
                  <div className="flex gap-1">
                    <button type="button" className="rounded-lg p-1.5 hover:bg-fog" onClick={() => openEdit(row)}>
                      <Pencil className="h-4 w-4 text-rose-deep" />
                    </button>
                    <button type="button" className="rounded-lg p-1.5 hover:bg-fog" onClick={() => setRemoveId(row._id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BannerFormModal open={open} editing={editing} onClose={closeModal} onSuccess={load} />

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete banner?"
        message="This will permanently remove the banner."
        onClose={() => setRemoveId(null)}
        onConfirm={remove}
        confirmLabel="Delete"
      />
    </div>
  );
}
