import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { categoriesApi } from '../../api';
import { Button, Input } from './Form';
import Modal from './Modal';
import StatusToggle from './StatusToggle';
import CategoryImageUploader from './CategoryImageUploader';
import { getImageUrl } from '../../utils/helpers';

const empty = { name: '', isActive: true };

export default function CategoryFormModal({
  open,
  onClose,
  editing = null,
  onSuccess,
  className = '',
}) {
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [clearImage, setClearImage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name || '',
        isActive: editing.isActive !== false,
      });
      setFile(null);
      setPreviewUrl(getImageUrl(editing.image) || null);
      setClearImage(false);
    } else {
      setForm(empty);
      setFile(null);
      setPreviewUrl(null);
      setClearImage(false);
    }
  }, [open, editing]);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSelectImage = (nextFile) => {
    setFile(nextFile);
    setClearImage(false);
  };

  const handleClearImage = () => {
    setFile(null);
    setPreviewUrl(null);
    setClearImage(true);
  };

  const buildPayload = () => {
    if (file) {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('isActive', String(form.isActive));
      fd.append('image', file);
      return fd;
    }
    return {
      name: form.name.trim(),
      isActive: form.isActive,
      ...(clearImage ? { clearImage: true } : {}),
    };
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const { data } = editing
        ? await categoriesApi.update(editing._id, payload)
        : await categoriesApi.create(payload);
      toast.success(editing ? 'Category updated' : 'Category created');
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
    <Modal
      open={open}
      title={editing ? 'Edit Category' : 'Add Category'}
      onClose={onClose}
      className={className}
    >
      <form onSubmit={save} className="space-y-4">
        <CategoryImageUploader
          previewUrl={previewUrl}
          fileName={file?.name}
          onSelect={handleSelectImage}
          onClear={handleClearImage}
        />
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="e.g. Skincare"
        />
        <div className="flex items-center justify-between rounded-xl border border-blush-line bg-blush/40 px-3 py-2.5">
          <span className="text-sm font-medium text-wine">Active category</span>
          <StatusToggle
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
            onLabel="ON"
            offLabel="OFF"
            size="sm"
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Update category' : 'Create category'}
        </Button>
      </form>
    </Modal>
  );
}
