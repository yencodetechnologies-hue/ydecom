import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil } from 'lucide-react';
import { usersApi } from '../api';
import { PageHeader, Button, Input } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Modal from '../components/ui/Modal';
import Loader from '../components/ui/Loader';
import { formatCurrency } from '../utils/helpers';
import { useAppSelector } from '../app/hooks';

const creditAvailable = (user) =>
  Math.max(0, (Number(user?.creditLimit) || 0) - (Number(user?.creditUsed) || 0));

export default function StockistDistributorsPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const isDistributor = role === 'distributor';
  const childLabel = isDistributor ? 'Retailer' : 'Distributor';
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creditLimit, setCreditLimit] = useState('0');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await usersApi.network();
      setRows(res.data?.data || []);
    } catch (err) {
      setRows([]);
      toast.error(err.response?.data?.message || `Failed to load ${childLabel.toLowerCase()}s`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.shopName, r.email, r.mobile, r.role].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const openCredit = (row) => {
    setEditing(row);
    setCreditLimit(String(row.creditLimit ?? 0));
  };

  const saveCredit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    const next = Math.max(0, Number(creditLimit) || 0);
    const used = Number(editing.creditUsed) || 0;
    if (next < used) {
      toast.error('Credit limit cannot be less than credit already used');
      return;
    }
    setSaving(true);
    try {
      const { data } = await usersApi.update(editing._id, { creditLimit: next });
      const updated = data.data;
      setRows((list) => list.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)));
      toast.success('Credit limit updated');
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update credit');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Name' },
    ...(isDistributor
      ? [{ key: 'role', label: 'Role', render: (r) => r.role || '—' }]
      : []),
    { key: 'shopName', label: 'Shop', render: (r) => r.shopName || '—' },
    { key: 'mobile', label: 'Mobile', render: (r) => r.mobile || '—' },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      render: (r) => formatCurrency(r.creditLimit || 0),
    },
    {
      key: 'creditUsed',
      label: 'Credit Used',
      render: (r) => formatCurrency(r.creditUsed || 0),
    },
    {
      key: 'creditAvailable',
      label: 'Available',
      render: (r) => formatCurrency(creditAvailable(r)),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <Button
          type="button"
          variant="secondary"
          className="!px-2 !py-1 text-xs"
          onClick={() => openCredit(r)}
        >
          <Pencil className="mr-1 inline h-3.5 w-3.5" />
          Set credit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={isDistributor ? 'Retailers & Resellers' : 'Distributors'}
        subtitle={`Assign credit limits so ${childLabel.toLowerCase()}s can pay orders on credit and receive return credits`}
      />
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${childLabel.toLowerCase()}s`}
        />
      </div>
      {loading ? <Loader /> : <DataTable columns={columns} rows={filtered} />}

      <Modal
        open={Boolean(editing)}
        onClose={() => !saving && setEditing(null)}
        title={editing ? `Credit — ${editing.name}` : 'Credit'}
      >
        {editing ? (
          <form onSubmit={saveCredit} className="space-y-4">
            {editing.shopName ? (
              <p className="text-sm text-home-forest/60">{editing.shopName}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-home-sand/50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-home-forest/45">
                  Used
                </p>
                <p className="font-semibold text-home-forest">
                  {formatCurrency(editing.creditUsed || 0)}
                </p>
              </div>
              <div className="rounded-xl bg-home-sand/50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-home-forest/45">
                  Available
                </p>
                <p className="font-semibold text-home-forest">
                  {formatCurrency(
                    creditAvailable({ ...editing, creditLimit: Number(creditLimit) || 0 })
                  )}
                </p>
              </div>
            </div>
            <Input
              label="Credit limit"
              type="number"
              min="0"
              step="0.01"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save credit'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
