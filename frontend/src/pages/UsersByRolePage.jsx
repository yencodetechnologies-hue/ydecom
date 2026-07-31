import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, Mail, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react';
import { ordersApi, usersApi } from '../api';
import { PageHeader, Button, Input, Select, TextArea } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/ui/StatusBadge';
import StatusToggle from '../components/ui/StatusToggle';
import Loader from '../components/ui/Loader';
import { formatCurrency, formatDate } from '../utils/helpers';

const BUSINESS_ROLES = ['retailer', 'reseller', 'distributor', 'stockist'];
const SHOP_BUSINESS_ROLES = ['retailer', 'distributor', 'stockist'];
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^[0-9]{12}$/;

const emptyCreateForm = {
  name: '',
  mobile: '',
  email: '',
  password: '',
  confirmPassword: '',
  gstNumber: '',
  panNumber: '',
  aadhaarNumber: '',
  shopName: '',
  shopPhone: '',
  businessEmail: '',
  shopAddress: '',
  marginType: 'percentage',
  marginBasis: 'cost',
  marginValue: '',
  discountPercent: '0',
  assignedDistributor: '',
  assignedStockist: '',
  creditLimit: '0',
  stockAllocationPercent: '100',
  panFront: null,
  aadhaarFront: null,
  aadhaarBack: null,
};

// retailer/reseller -> assign a distributor; distributor -> assign a stockist; stockist has no parent.
const PARENT_ROLE_OF = { retailer: 'distributor', reseller: 'distributor', distributor: 'stockist' };
const PARENT_FIELD_OF = {
  retailer: 'assignedDistributor',
  reseller: 'assignedDistributor',
  distributor: 'assignedStockist',
};

const creditAvailable = (user) =>
  Math.max(0, (Number(user?.creditLimit) || 0) - (Number(user?.creditUsed) || 0));

const userInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

function UserAvatarCell({ user, subtitle }) {
  return (
    <div className="flex min-w-[10rem] items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-soft to-blush text-xs font-bold text-rose-deep shadow-sm ring-1 ring-blush-line/80">
        {userInitials(user.name)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-wine">{user.name}</p>
        {subtitle ? <p className="truncate text-xs text-mauve">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function MetricPill({ label, value, tone = 'default' }) {
  const tones = {
    default: 'bg-blush/50 text-wine',
    success: 'bg-emerald-500/10 text-emerald-700',
    warning: 'bg-amber/10 text-amber',
    danger: 'bg-danger/10 text-danger',
  };
  return (
    <div className={`rounded-lg px-2.5 py-1.5 text-center ${tones[tone] || tones.default}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-xs font-bold tabular-nums">{value}</p>
    </div>
  );
}

function CreditMetrics({ user }) {
  const limit = Number(user.creditLimit) || 0;
  const used = Number(user.creditUsed) || 0;
  const available = creditAvailable(user);
  const usagePct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const usedTone = usagePct >= 90 ? 'danger' : usagePct >= 70 ? 'warning' : 'default';

  return (
    <div className="min-w-[11rem] space-y-2">
      <div className="grid grid-cols-3 gap-1">
        <MetricPill label="Limit" value={formatCurrency(limit)} />
        <MetricPill label="Used" value={formatCurrency(used)} tone={usedTone} />
        <MetricPill label="Avail" value={formatCurrency(available)} tone="success" />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-blush/80">
        <div
          className={`h-full rounded-full transition-all ${
            usagePct >= 90 ? 'bg-danger' : usagePct >= 70 ? 'bg-amber' : 'bg-emerald-500'
          }`}
          style={{ width: `${usagePct}%` }}
        />
      </div>
    </div>
  );
}

function ActionButtons({ onView, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-blush-line/80 bg-blush/30 p-1">
      <button
        type="button"
        className="rounded-lg p-2 text-mauve transition hover:bg-white hover:text-wine hover:shadow-sm"
        onClick={onView}
        title="View"
      >
        <Eye className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="rounded-lg p-2 text-rose-deep transition hover:bg-white hover:shadow-sm"
        onClick={onEdit}
        title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="rounded-lg p-2 text-danger transition hover:bg-white hover:shadow-sm"
        onClick={onDelete}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

const orderPayable = (order) =>
  Math.max(0, Math.round(((Number(order?.subtotal) || 0) - (Number(order?.voucherDiscount) || 0)) * 100) / 100);

export default function UsersByRolePage({ role, title }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0, limit: DEFAULT_PAGE_SIZE });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removeId, setRemoveId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [saving, setSaving] = useState(false);
  const [parentOptions, setParentOptions] = useState([]);
  const [detailOrders, setDetailOrders] = useState([]);
  const [loadingDetailOrders, setLoadingDetailOrders] = useState(false);

  const isBusiness = BUSINESS_ROLES.includes(role);
  const isReseller = role === 'reseller';
  const isShopBusiness = SHOP_BUSINESS_ROLES.includes(role);
  const isStockist = role === 'stockist';
  const hasCredit = ['stockist', 'distributor', 'retailer', 'reseller'].includes(role);
  const parentRole = PARENT_ROLE_OF[role];
  const parentField = PARENT_FIELD_OF[role];

  useEffect(() => {
    if (!parentRole) {
      setParentOptions([]);
      return;
    }
    usersApi
      .list({ role: parentRole, limit: 200 })
      .then(({ data }) => setParentOptions(data.data || []))
      .catch(() => setParentOptions([]));
  }, [parentRole]);
  const singular = title.endsWith('s') ? title.slice(0, -1) : title;
  const params = useMemo(
    () => ({ role, search, page, limit }),
    [role, search, page, limit]
  );

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.list(params);
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [params]);

  useEffect(() => {
    if (!detail || !isStockist) {
      setDetailOrders([]);
      return;
    }
    setLoadingDetailOrders(true);
    ordersApi
      .list({ stockistId: detail._id, limit: 10 })
      .then(({ data }) => setDetailOrders(data.data || []))
      .catch(() => setDetailOrders([]))
      .finally(() => setLoadingDetailOrders(false));
  }, [detail?._id, isStockist]);

  const act = async (fn, success) => {
    try {
      await fn();
      toast.success(success);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const toggleActive = async (row) => {
    const next = !row.isActive;
    setRows((list) => list.map((r) => (r._id === row._id ? { ...r, isActive: next } : r)));
    try {
      await usersApi.setActive(row._id, next);
      toast.success(next ? 'Activated' : 'Deactivated');
    } catch (err) {
      setRows((list) => list.map((r) => (r._id === row._id ? { ...r, isActive: row.isActive } : r)));
      toast.error(err.response?.data?.message || 'Toggle failed');
    }
  };

  const toggleApproval = async (row) => {
    const nextStatus = row.status === 'approved' ? 'rejected' : 'approved';
    setRows((list) => list.map((r) => (r._id === row._id ? { ...r, status: nextStatus } : r)));
    try {
      await usersApi.setStatus(row._id, nextStatus);
      toast.success(nextStatus === 'approved' ? 'Approved' : 'Rejected');
    } catch (err) {
      setRows((list) => list.map((r) => (r._id === row._id ? { ...r, status: row.status } : r)));
      toast.error(err.response?.data?.message || 'Toggle failed');
    }
  };

  const togglePrice = async (row) => {
    const next = !(row.priceVisible !== false);
    setRows((list) => list.map((r) => (r._id === row._id ? { ...r, priceVisible: next } : r)));
    try {
      await usersApi.setPriceVisible(row._id, next);
      toast.success(next ? 'Show price ON' : 'Show price OFF');
    } catch (err) {
      setRows((list) =>
        list.map((r) => (r._id === row._id ? { ...r, priceVisible: row.priceVisible !== false } : r))
      );
      toast.error(err.response?.data?.message || 'Toggle failed');
    }
  };

  const openCreate = () => {
    setCreateForm(emptyCreateForm);
    setCreateOpen(true);
  };

  const setCreateField = (key, value) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveCreate = async (e) => {
    e.preventDefault();
    if (createForm.password !== createForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (isShopBusiness) {
      const missing = [
        ['gstNumber', 'GST Number'],
        ['panNumber', 'PAN Number'],
        ['shopName', 'Shop Name'],
        ['shopAddress', 'Shop Address'],
        ['shopPhone', 'Shop Phone'],
        ['businessEmail', 'Business Email'],
        ['marginValue', 'Margin Value'],
      ].find(([key]) => !String(createForm[key] ?? '').trim());
      if (missing) {
        toast.error(`${missing[1]} is required`);
        return;
      }
      if (parentField && !createForm[parentField]) {
        toast.error(`Assigned ${parentRole} is required`);
        return;
      }
    }
    if (isReseller) {
      const pan = createForm.panNumber.trim().toUpperCase();
      const aadhaar = createForm.aadhaarNumber.replace(/\D/g, '');
      if (!PAN_RE.test(pan)) {
        toast.error('Enter a valid PAN number (e.g. ABCDE1234F)');
        return;
      }
      if (!AADHAAR_RE.test(aadhaar)) {
        toast.error('Aadhaar number must be 12 digits');
        return;
      }
      if (!createForm.panFront || !createForm.aadhaarFront || !createForm.aadhaarBack) {
        toast.error('PAN and Aadhaar (front & back) images are required');
        return;
      }
      if (!String(createForm.marginValue ?? '').trim()) {
        toast.error('Margin Value is required');
        return;
      }
      if (parentField && !createForm[parentField]) {
        toast.error(`Assigned ${parentRole} is required`);
        return;
      }
    }

    setSaving(true);
    try {
      if (isReseller) {
        const fd = new FormData();
        fd.append('role', role);
        fd.append('name', createForm.name.trim());
        fd.append('mobile', createForm.mobile.trim());
        fd.append('email', createForm.email.trim());
        fd.append('password', createForm.password);
        fd.append('confirmPassword', createForm.confirmPassword);
        fd.append('panNumber', createForm.panNumber.trim().toUpperCase());
        fd.append('aadhaarNumber', createForm.aadhaarNumber.replace(/\D/g, ''));
        fd.append('panFront', createForm.panFront);
        fd.append('aadhaarFront', createForm.aadhaarFront);
        fd.append('aadhaarBack', createForm.aadhaarBack);
        fd.append('marginType', createForm.marginType);
        fd.append('marginBasis', createForm.marginBasis);
        fd.append('marginValue', createForm.marginValue);
        if (createForm.assignedDistributor) {
          fd.append('assignedDistributor', createForm.assignedDistributor);
        }
        fd.append('creditLimit', String(Number(createForm.creditLimit) || 0));
        fd.append('status', 'approved');
        await usersApi.create(fd);
      } else {
        await usersApi.create({
          role,
          name: createForm.name.trim(),
          mobile: createForm.mobile.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          confirmPassword: createForm.confirmPassword,
          gstNumber: createForm.gstNumber.trim(),
          panNumber: createForm.panNumber.trim(),
          shopName: createForm.shopName.trim(),
          shopAddress: createForm.shopAddress.trim(),
          shopPhone: createForm.shopPhone.trim(),
          businessEmail: createForm.businessEmail.trim(),
          marginType: createForm.marginType,
          marginBasis: createForm.marginBasis,
          marginValue: createForm.marginValue,
          discountPercent: role === 'customer' ? Number(createForm.discountPercent) || 0 : undefined,
          assignedDistributor: role === 'retailer' ? createForm.assignedDistributor : undefined,
          assignedStockist: role === 'distributor' ? createForm.assignedStockist : undefined,
          creditLimit: hasCredit ? Number(createForm.creditLimit) || 0 : undefined,
          stockAllocationPercent:
            role === 'stockist' ? Number(createForm.stockAllocationPercent) || 100 : undefined,
          status: 'approved',
        });
      }
      toast.success(`${singular} added`);
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      setPage(1);
      load();
    } catch (err) {
      const details = err.response?.data?.errors;
      const firstDetail = Array.isArray(details) ? details[0]?.message : null;
      toast.error(firstDetail || err.response?.data?.message || 'Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (isBusiness) {
      if (!String(editing.marginValue ?? '').trim()) {
        toast.error('Margin Value is required');
        return;
      }
      if (parentField && !editing[parentField]) {
        toast.error(`Assigned ${parentRole} is required`);
        return;
      }
    }
    const payload = isBusiness ? { ...editing, marginType: 'percentage' } : editing;
    await act(() => usersApi.update(editing._id, payload), 'User updated');
    setEditing(null);
  };

  const pageLimit = limit;
  const serialBase = ((meta.page || page) - 1) * pageLimit;

  const columns = [
    {
      key: 'sno',
      label: '#',
      align: 'center',
      render: (_r, index) => (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blush/60 text-xs font-bold text-mauve">
          {serialBase + index + 1}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Account',
      render: (r) =>
        isBusiness
          ? <UserAvatarCell user={r} subtitle={isReseller ? r.aadhaarNumber || 'Reseller' : r.shopName || '—'} />
          : <UserAvatarCell user={r} subtitle={r.customerId || 'Customer'} />,
    },
    ...(!isBusiness
      ? [
          {
            key: 'discountPercent',
            label: 'Discount',
            align: 'center',
            render: (r) => (
              <span className="inline-flex rounded-full bg-amber/10 px-2.5 py-1 text-xs font-bold text-amber">
                {r.discountPercent != null && r.discountPercent !== ''
                  ? `${Number(r.discountPercent)}%`
                  : '0%'}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'contact',
      label: 'Contact',
      render: (r) => (
        <div className="min-w-[10rem] space-y-1">
          <p className="flex items-center gap-1.5 text-sm">
            <Phone className="h-3.5 w-3.5 shrink-0 text-mauve" />
            <span>{r.mobile}</span>
          </p>
          <p className="flex items-center gap-1.5 text-xs text-mauve">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[12rem]">{r.email}</span>
          </p>
        </div>
      ),
    },
    ...(isBusiness
      ? [
          {
            key: 'marginValue',
            label: 'Margin',
            align: 'center',
            render: (r) =>
              r.marginValue != null && r.marginValue !== ''
                ? (
                    <span className="inline-flex rounded-full bg-plum/10 px-2.5 py-1 text-xs font-bold text-plum">
                      {Number(r.marginValue)}%
                    </span>
                  )
                : <span className="text-mauve">—</span>,
          },
          ...(hasCredit
            ? [
                {
                  key: 'credit',
                  label: 'Credit wallet',
                  render: (r) => <CreditMetrics user={r} />,
                },
              ]
            : []),
          {
            key: 'tax',
            label: 'Tax IDs',
            render: (r) => (
              <div className="space-y-1 text-xs">
                <p>
                  <span className="font-semibold text-mauve">GST </span>
                  <span className="font-mono text-wine/80">{r.gstNumber || '—'}</span>
                </p>
                <p>
                  <span className="font-semibold text-mauve">PAN </span>
                  <span className="font-mono text-wine/80">{r.panNumber || '—'}</span>
                </p>
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'createdAt',
      label: 'Registered',
      render: (r) => (
        <span className="text-sm text-ink/70">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Approval',
      align: 'center',
      render: (r) => (
        <div className="flex flex-col items-center gap-2">
          <StatusBadge status={r.status} />
          <StatusToggle
            checked={r.status === 'approved'}
            onChange={() => toggleApproval(r)}
            onLabel="ON"
            offLabel="OFF"
            title={r.status === 'approved' ? 'Reject' : 'Approve'}
            size="sm"
            showLabel={false}
          />
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      align: 'center',
      render: (r) => (
        <StatusToggle
          checked={Boolean(r.isActive)}
          onChange={() => toggleActive(r)}
          onLabel="ON"
          offLabel="OFF"
          title={r.isActive ? 'Deactivate' : 'Activate'}
          size="sm"
          showLabel={false}
        />
      ),
    },
    {
      key: 'priceVisible',
      label: 'Price',
      align: 'center',
      render: (r) => (
        <StatusToggle
          checked={r.priceVisible !== false}
          onChange={() => togglePrice(r)}
          onLabel="ON"
          offLabel="OFF"
          title={r.priceVisible !== false ? 'Hide price for this account' : 'Show price for this account'}
          size="sm"
          showLabel={false}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'center',
      render: (r) => (
        <ActionButtons
          onView={() => setDetail(r)}
          onEdit={() => setEditing({ ...r })}
          onDelete={() => setRemoveId(r._id)}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={`Manage registered ${title.toLowerCase()}`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add {singular}
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 rounded-2xl border border-blush-line/80 bg-white px-4 py-3 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-soft text-rose-deep">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mauve">Total {title}</p>
            <p className="font-display text-2xl text-wine">{meta.total ?? rows.length}</p>
          </div>
        </div>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={`Search ${title.toLowerCase()}…`}
        />
      </div>
      {loading ? <Loader /> : <DataTable columns={columns} rows={rows} empty={`No ${title.toLowerCase()} found`} />}
      <Pagination
        page={meta.page || page}
        pages={Math.max(meta.pages || 1, 1)}
        total={meta.total}
        limit={limit}
        onLimitChange={(next) => {
          setLimit(next);
          setPage(1);
        }}
        onChange={setPage}
        alwaysShow
      />

      <Modal open={createOpen} title={`Add ${singular}`} onClose={() => setCreateOpen(false)} wide>
        <form onSubmit={saveCreate} className="space-y-3">
          {isBusiness ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Name"
                  value={createForm.name}
                  onChange={(e) => setCreateField('name', e.target.value)}
                  required
                />
                <Input
                  label="Mobile"
                  value={createForm.mobile}
                  onChange={(e) => setCreateField('mobile', e.target.value)}
                  required
                  maxLength={10}
                />
                <Input
                  label="Email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateField('email', e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateField('password', e.target.value)}
                  required
                  minLength={6}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={createForm.confirmPassword}
                  onChange={(e) => setCreateField('confirmPassword', e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {isShopBusiness ? (
                  <>
                    <Input
                      label="GST"
                      value={createForm.gstNumber}
                      onChange={(e) => setCreateField('gstNumber', e.target.value)}
                      required
                    />
                    <Input
                      label="PAN"
                      value={createForm.panNumber}
                      onChange={(e) => setCreateField('panNumber', e.target.value)}
                      required
                    />
                    <Input
                      label="Shop Name"
                      value={createForm.shopName}
                      onChange={(e) => setCreateField('shopName', e.target.value)}
                      required
                    />
                    <Input
                      label="Shop Phone"
                      value={createForm.shopPhone}
                      onChange={(e) => setCreateField('shopPhone', e.target.value)}
                      required
                    />
                    <Input
                      label="Business Email"
                      type="email"
                      value={createForm.businessEmail}
                      onChange={(e) => setCreateField('businessEmail', e.target.value)}
                      required
                    />
                  </>
                ) : null}
                {isReseller ? (
                  <>
                    <Input
                      label="PAN Number"
                      value={createForm.panNumber}
                      onChange={(e) => setCreateField('panNumber', e.target.value.toUpperCase())}
                      required
                      maxLength={10}
                      placeholder="ABCDE1234F"
                    />
                    <Input
                      label="Aadhaar Number"
                      value={createForm.aadhaarNumber}
                      onChange={(e) =>
                        setCreateField('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))
                      }
                      required
                      maxLength={12}
                      placeholder="12-digit Aadhaar"
                    />
                  </>
                ) : null}
              </div>
              {isShopBusiness ? (
                <TextArea
                  label="Shop Address"
                  value={createForm.shopAddress}
                  onChange={(e) => setCreateField('shopAddress', e.target.value)}
                  required
                />
              ) : null}
              {isReseller ? (
                <div className="grid gap-3 rounded-xl border border-dashed border-blush-line p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">KYC documents</p>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-ink/80">PAN card image</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      className="w-full text-sm"
                      onChange={(e) => setCreateField('panFront', e.target.files?.[0] || null)}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-ink/80">Aadhaar front</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      className="w-full text-sm"
                      onChange={(e) => setCreateField('aadhaarFront', e.target.files?.[0] || null)}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-ink/80">Aadhaar back</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      className="w-full text-sm"
                      onChange={(e) => setCreateField('aadhaarBack', e.target.files?.[0] || null)}
                      required
                    />
                  </label>
                </div>
              ) : null}

              <div className="rounded-xl border border-blush-line p-3">
                <div className="mb-2 space-y-1.5">
                  <span className="text-sm font-medium text-ink/80">Margin Applies On</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-ink/70">
                      <input
                        type="checkbox"
                        checked={createForm.marginBasis === 'cost'}
                        onChange={() => setCreateField('marginBasis', 'cost')}
                      />
                      Cost
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ink/70">
                      <input
                        type="checkbox"
                        checked={createForm.marginBasis === 'mrp'}
                        onChange={() => setCreateField('marginBasis', 'mrp')}
                      />
                      MRP
                    </label>
                  </div>
                </div>
                <Input
                  label="Percentage Value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.marginValue}
                  onChange={(e) => setCreateField('marginValue', e.target.value)}
                  required
                />
              </div>

              {parentField ? (
                <Select
                  label={`Assign ${parentRole}`}
                  value={createForm[parentField]}
                  onChange={(e) => setCreateField(parentField, e.target.value)}
                  required
                >
                  <option value="">Select {parentRole}</option>
                  {parentOptions.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.mobile})
                    </option>
                  ))}
                </Select>
              ) : null}

              {hasCredit ? (
                <>
                <Input
                  label="Credit Limit"
                  type="number"
                  min="0"
                  step="1"
                  value={createForm.creditLimit}
                  onChange={(e) => setCreateField('creditLimit', e.target.value)}
                />
                {isStockist ? (
                <Input
                  label="Stock allocation %"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={createForm.stockAllocationPercent}
                  onChange={(e) => setCreateField('stockAllocationPercent', e.target.value)}
                />
                ) : null}
                </>
              ) : null}
            </>
          ) : (
            <div className="grid gap-3">
              <Input
                label="Name"
                value={createForm.name}
                onChange={(e) => setCreateField('name', e.target.value)}
                required
              />
              <Input
                label="Mobile"
                value={createForm.mobile}
                onChange={(e) => setCreateField('mobile', e.target.value)}
                required
                maxLength={10}
              />
              <Input
                label="Email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateField('email', e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateField('password', e.target.value)}
                required
                minLength={6}
              />
              <Input
                label="Confirm Password"
                type="password"
                value={createForm.confirmPassword}
                onChange={(e) => setCreateField('confirmPassword', e.target.value)}
                required
                minLength={6}
              />
              <Input
                label="Discount %"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={createForm.discountPercent}
                onChange={(e) => setCreateField('discountPercent', e.target.value)}
              />
              <p className="text-xs text-ink/60">
                Customer ID will be auto-generated on save (e.g. JEY00001).
              </p>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : `Add ${singular}`}
          </Button>
        </form>
      </Modal>

      <Modal open={Boolean(detail)} title="User Details" onClose={() => setDetail(null)} wide>
        {detail ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              ['Name', detail.name],
              ...(!isBusiness ? [['Customer ID', detail.customerId || '—']] : []),
              ['Mobile', detail.mobile],
              ['Email', detail.email],
              ['Role', detail.role],
              ['Status', detail.status],
              ['Active', detail.isActive ? 'Yes' : 'No'],
              ['Show Price', detail.priceVisible !== false ? 'ON' : 'OFF'],
              ...(!isBusiness
                ? [['Discount %', detail.discountPercent != null ? `${detail.discountPercent}%` : '0%']]
                : []),
              ...(isBusiness
                ? [
                    [
                      'Percentage',
                      detail.marginValue != null && detail.marginValue !== ''
                        ? `${Number(detail.marginValue)}%`
                        : '—',
                    ],
                    ['Margin Basis', detail.marginBasis || '—'],
                    ...(isShopBusiness
                      ? [
                          ['GST', detail.gstNumber || '—'],
                          ['PAN', detail.panNumber || '—'],
                          ['Shop Name', detail.shopName || '—'],
                          ['Shop Phone', detail.shopPhone || '—'],
                          ['Business Email', detail.businessEmail || '—'],
                        ]
                      : []),
                    ...(isReseller
                      ? [
                          ['PAN', detail.panNumber || '—'],
                          ['Aadhaar', detail.aadhaarNumber || '—'],
                        ]
                      : []),
                  ]
                : []),
              ...(hasCredit
                ? [
                    ['Credit Limit', formatCurrency(detail.creditLimit || 0)],
                    ['Credit Used', formatCurrency(detail.creditUsed || 0)],
                    ['Credit Available', formatCurrency(creditAvailable(detail))],
                    ...(isStockist
                      ? [
                          [
                            'Stock allocation',
                            `${detail.stockAllocationPercent ?? 100}% of admin warehouse`,
                          ],
                        ]
                      : []),
                  ]
                : []),
              ['Registered', formatDate(detail.createdAt)],
            ].map(([k, v]) => (
              <p key={k}>
                <strong>{k}:</strong> {v}
              </p>
            ))}
            {isShopBusiness ? (
              <p className="sm:col-span-2">
                <strong>Shop Address:</strong> {detail.shopAddress || '—'}
              </p>
            ) : null}
            {isReseller ? (
              <div className="sm:col-span-2 mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  ['PAN card', detail.panFrontUrl],
                  ['Aadhaar front', detail.aadhaarFrontUrl],
                  ['Aadhaar back', detail.aadhaarBackUrl],
                ].map(([label, url]) => (
                  <p key={label}>
                    <strong>{label}:</strong>{' '}
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-plum underline"
                      >
                        View
                      </a>
                    ) : (
                      '—'
                    )}
                  </p>
                ))}
              </div>
            ) : null}

            {isStockist ? (
              <div className="sm:col-span-2 mt-4 border-t border-blush-line pt-4">
                <h4 className="mb-3 font-semibold">Recent Orders</h4>
                {loadingDetailOrders ? (
                  <Loader />
                ) : detailOrders.length === 0 ? (
                  <p className="text-ink/60">No orders yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-blush-line">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-fog text-xs uppercase text-ink/50">
                        <tr>
                          <th className="px-3 py-2">Order #</th>
                          <th className="px-3 py-2">Buyer</th>
                          <th className="px-3 py-2">Placed By</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Payment</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailOrders.map((order) => (
                          <tr key={order._id} className="border-t border-blush-line">
                            <td className="px-3 py-2">{order.orderNumber}</td>
                            <td className="px-3 py-2">{order.user?.name || '—'}</td>
                            <td className="px-3 py-2">{order.placedBy?.name || '—'}</td>
                            <td className="px-3 py-2">{formatCurrency(orderPayable(order))}</td>
                            <td className="px-3 py-2">
                              {order.paymentMethod === 'credit' ? 'Credit' : order.paymentStatus || '—'}
                            </td>
                            <td className="px-3 py-2">{order.status}</td>
                            <td className="px-3 py-2">{formatDate(order.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(editing)} title="Edit User" onClose={() => setEditing(null)} wide>
        {editing ? (
          <form onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2">
            <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Input label="Mobile" value={editing.mobile} onChange={(e) => setEditing({ ...editing, mobile: e.target.value })} />
            <Input label="Email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            {isBusiness ? (
              <>
                {isShopBusiness ? (
                  <>
                    <Input label="GST" value={editing.gstNumber || ''} onChange={(e) => setEditing({ ...editing, gstNumber: e.target.value })} />
                    <Input label="PAN" value={editing.panNumber || ''} onChange={(e) => setEditing({ ...editing, panNumber: e.target.value })} />
                    <Input label="Shop Name" value={editing.shopName || ''} onChange={(e) => setEditing({ ...editing, shopName: e.target.value })} />
                    <Input label="Shop Phone" value={editing.shopPhone || ''} onChange={(e) => setEditing({ ...editing, shopPhone: e.target.value })} />
                    <Input
                      label="Business Email"
                      value={editing.businessEmail || ''}
                      onChange={(e) => setEditing({ ...editing, businessEmail: e.target.value })}
                    />
                    <div className="sm:col-span-2">
                      <TextArea
                        label="Shop Address"
                        value={editing.shopAddress || ''}
                        onChange={(e) => setEditing({ ...editing, shopAddress: e.target.value })}
                      />
                    </div>
                  </>
                ) : null}
                {isReseller ? (
                  <>
                    <Input
                      label="PAN Number"
                      value={editing.panNumber || ''}
                      onChange={(e) => setEditing({ ...editing, panNumber: e.target.value.toUpperCase() })}
                      maxLength={10}
                    />
                    <Input
                      label="Aadhaar Number"
                      value={editing.aadhaarNumber || ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12),
                        })
                      }
                      maxLength={12}
                    />
                  </>
                ) : null}

                <div className="sm:col-span-2 rounded-xl border border-blush-line p-3">
                  <div className="mb-2 space-y-1.5">
                    <span className="text-sm font-medium text-ink/80">Margin Applies On</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-ink/70">
                        <input
                          type="checkbox"
                          checked={(editing.marginBasis || 'cost') === 'cost'}
                          onChange={() => setEditing({ ...editing, marginBasis: 'cost' })}
                        />
                        Cost
                      </label>
                      <label className="flex items-center gap-2 text-sm text-ink/70">
                        <input
                          type="checkbox"
                          checked={editing.marginBasis === 'mrp'}
                          onChange={() => setEditing({ ...editing, marginBasis: 'mrp' })}
                        />
                        MRP
                      </label>
                    </div>
                  </div>
                  <Input
                    label="Percentage Value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.marginValue ?? ''}
                    onChange={(e) => setEditing({ ...editing, marginValue: e.target.value })}
                    required
                  />
                </div>

                {parentField ? (
                  <div className="sm:col-span-2">
                    <Select
                      label={`Assign ${parentRole}`}
                      value={editing[parentField] || ''}
                      onChange={(e) => setEditing({ ...editing, [parentField]: e.target.value })}
                      required
                    >
                      <option value="">Select {parentRole}</option>
                      {parentOptions.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.mobile})
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}

                {hasCredit ? (
                  <div className="sm:col-span-2 rounded-xl border border-blush-line p-3">
                    <Input
                      label="Credit Limit"
                      type="number"
                      min="0"
                      step="1"
                      value={editing.creditLimit ?? 0}
                      onChange={(e) => setEditing({ ...editing, creditLimit: e.target.value })}
                    />
                    {isStockist ? (
                    <Input
                      label="Stock allocation %"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={editing.stockAllocationPercent ?? 100}
                      onChange={(e) =>
                        setEditing({ ...editing, stockAllocationPercent: e.target.value })
                      }
                    />
                    ) : null}
                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        <strong>Credit Used:</strong> {formatCurrency(editing.creditUsed || 0)}
                      </p>
                      <p>
                        <strong>Available:</strong>{' '}
                        {formatCurrency(
                          creditAvailable({
                            ...editing,
                            creditLimit: Number(editing.creditLimit) || 0,
                          })
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="sm:col-span-2">
                <Input
                  label="Discount %"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editing.discountPercent ?? 0}
                  onChange={(e) => setEditing({ ...editing, discountPercent: e.target.value })}
                />
                <p className="mt-1 text-xs text-ink/50">
                  Applied off MRP for every product when this customer is logged in.
                </p>
              </div>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full">Save Changes</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete user?"
        message="This will permanently delete the user account."
        onClose={() => setRemoveId(null)}
        onConfirm={async () => {
          await act(() => usersApi.remove(removeId), 'User deleted');
          setRemoveId(null);
        }}
        confirmLabel="Delete"
      />
    </div>
  );
}
