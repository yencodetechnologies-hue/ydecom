import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { bannersApi } from '../../api';
import { Button, Input } from './Form';
import Modal from './Modal';
import StatusToggle from './StatusToggle';
import CategoryImageUploader from './CategoryImageUploader';
import { getImageUrl } from '../../utils/helpers';

const empty = { link: '', order: 0, isActive: true };

export default function BannerFormModal({ open, onClose, editing = null, onSuccess }) {
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        link: editing.link || '',
        order: editing.order ?? 0,
        isActive: editing.isActive !== false,
      });
      setFile(null);
      setPreviewUrl(getImageUrl(editing.image) || null);
    } else {
      setForm(empty);
      setFile(null);
      setPreviewUrl(null);
    }
  }, [open, editing]);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSelectImage = (nextFile) => setFile(nextFile);
  const handleClearImage = () => {
    setFile(null);
    setPreviewUrl(null);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!editing && !file) {
      toast.error('Banner image is required');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('link', form.link.trim());
      fd.append('order', String(form.order));
      fd.append('isActive', String(form.isActive));
      if (file) fd.append('image', file);

      const { data } = editing
        ? await bannersApi.update(editing._id, fd)
        : await bannersApi.create(fd);
      toast.success(editing ? 'Banner updated' : 'Banner created');
      onSuccess?.(data.data);
      onClose();
    } catch (err) {
      const details = err.response?.data?.errors;
      const detailMsg = Array.isArray(details) && details[0]?.message;
      toast.error(detailMsg || err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={editing ? 'Edit Banner' : 'Add Banner'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <CategoryImageUploader
          label="Banner image"
          previewUrl={previewUrl}
          fileName={file?.name}
          onSelect={handleSelectImage}
          onClear={handleClearImage}
        />
        <Input
          label="Link (optional)"
          value={form.link}
          onChange={(e) => setForm({ ...form, link: e.target.value })}
          placeholder="e.g. /shop?category=..."
        />
        <Input
          label="Display Order"
          type="number"
          value={form.order}
          onChange={(e) => setForm({ ...form, order: e.target.value })}
        />
        <div className="flex items-center justify-between rounded-xl border border-blush-line bg-blush/40 px-3 py-2.5">
          <span className="text-sm font-medium text-wine">Active banner</span>
          <StatusToggle
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
            onLabel="ON"
            offLabel="OFF"
            size="sm"
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Update banner' : 'Create banner'}
        </Button>
      </form>
    </Modal>
  );
}
