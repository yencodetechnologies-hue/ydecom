import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { manufacturersApi } from '../../api';
import { Button, Input } from './Form';
import Modal from './Modal';
import StatusToggle from './StatusToggle';

const empty = { name: '', isActive: true };

export default function ManufacturerFormModal({
  open,
  onClose,
  editing = null,
  onSuccess,
  className = '',
}) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name || '',
        isActive: editing.isActive !== false,
      });
    } else {
      setForm(empty);
    }
  }, [open, editing]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Manufacturer name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        isActive: form.isActive,
      };
      const { data } = editing
        ? await manufacturersApi.update(editing._id, payload)
        : await manufacturersApi.create(payload);
      toast.success(editing ? 'Manufacturer updated' : 'Manufacturer created');
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
      title={editing ? 'Edit Manufacturer' : 'Add Manufacturer'}
      onClose={onClose}
      className={className}
    >
      <form onSubmit={save} className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="e.g. Acme Corp"
        />
        <div className="flex items-center justify-between rounded-xl border border-blush-line bg-blush/40 px-3 py-2.5">
          <span className="text-sm font-medium text-wine">Active manufacturer</span>
          <StatusToggle
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
            onLabel="ON"
            offLabel="OFF"
            size="sm"
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Update manufacturer' : 'Create manufacturer'}
        </Button>
      </form>
    </Modal>
  );
}
