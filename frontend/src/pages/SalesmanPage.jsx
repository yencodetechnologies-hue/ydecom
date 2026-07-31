import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink } from 'lucide-react';
import { usersApi } from '../api';
import { PageHeader, Button, Select } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import StatusToggle from '../components/ui/StatusToggle';
import Loader from '../components/ui/Loader';
import { formatDate, roleLabel } from '../utils/helpers';

const PARTNER_TYPES = [
  { value: 'stockist', label: 'Stockist' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'retailer', label: 'Retailer' },
];

function KycLink({ href, label }) {
  if (!href) return <span className="text-xs text-mauve">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-plum hover:underline"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export default function SalesmanPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0, limit: DEFAULT_PAGE_SIZE });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [assignRow, setAssignRow] = useState(null);
  const [partnerType, setPartnerType] = useState('distributor');
  const [partnerOptions, setPartnerOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kycRow, setKycRow] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.list({ role: 'salesman', search, page, limit });
      setRows(data.data);
      setMeta(data.meta);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load salesmen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, page, limit]);

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

  const setStatus = async (id, status) => {
    try {
      await usersApi.setStatus(id, status);
      toast.success(`Salesman ${status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const openAssign = async (row) => {
    setAssignRow(row);
    const type = row.assignmentPartnerType || 'distributor';
    setPartnerType(type);
    const currentIds = (row.assignedPartners || []).map((p) => (typeof p === 'object' ? p._id : p));
    setSelectedIds(currentIds.map(String));
    setPartnersLoading(true);
    try {
      const { data } = await usersApi.list({
        role: type,
        status: 'approved',
        isActive: 'true',
        limit: 200,
      });
      setPartnerOptions(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load partners');
      setPartnerOptions([]);
    } finally {
      setPartnersLoading(false);
    }
  };

  const onPartnerTypeChange = async (type) => {
    setPartnerType(type);
    setSelectedIds([]);
    setPartnersLoading(true);
    try {
      const { data } = await usersApi.list({
        role: type,
        status: 'approved',
        isActive: 'true',
        limit: 200,
      });
      setPartnerOptions(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load partners');
      setPartnerOptions([]);
    } finally {
      setPartnersLoading(false);
    }
  };

  const togglePartner = (id) => {
    const sid = String(id);
    setSelectedIds((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]));
  };

  const saveAssignment = async (e) => {
    e.preventDefault();
    if (!assignRow) return;
    setSaving(true);
    try {
      await usersApi.setAssignment(assignRow._id, {
        assignmentPartnerType: partnerType,
        assignedPartnerIds: selectedIds,
      });
      toast.success('Assignment saved');
      setAssignRow(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const assignmentSummary = (row) => {
    if (!row.assignmentPartnerType) return 'Not assigned';
    const count = Array.isArray(row.assignedPartners) ? row.assignedPartners.length : 0;
    return `${roleLabel(row.assignmentPartnerType)} · ${count}`;
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'assignment',
      label: 'Assignment',
      render: (r) => <span className="text-sm">{assignmentSummary(r)}</span>,
    },
    {
      key: 'kyc',
      label: 'KYC',
      render: (r) => (
        <Button className="!px-2.5 !py-1 text-xs" variant="secondary" onClick={() => setKycRow(r)}>
          View
        </Button>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (r) => (
        <StatusToggle checked={r.isActive} onChange={() => toggleActive(r)} disabled={r.status !== 'approved'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          {r.status === 'pending' ? (
            <>
              <Button className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(r._id, 'approved')}>
                Approve
              </Button>
              <Button
                variant="danger"
                className="!px-2.5 !py-1 text-xs"
                onClick={() => setStatus(r._id, 'rejected')}
              >
                Reject
              </Button>
            </>
          ) : null}
          {r.status === 'approved' ? (
            <Button className="!px-2.5 !py-1 text-xs" variant="secondary" onClick={() => openAssign(r)}>
              Assign
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Salesmen"
        subtitle="Approve KYC registrations and assign partners for order placement"
      />
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
      </div>
      {loading ? <Loader /> : <DataTable columns={columns} rows={rows} empty="No salesmen yet" />}
      <Pagination
        page={meta.page}
        pages={meta.pages}
        total={meta.total}
        limit={limit}
        onChange={setPage}
        onLimitChange={(n) => {
          setLimit(n);
          setPage(1);
        }}
        alwaysShow
      />

      <Modal open={Boolean(assignRow)} onClose={() => setAssignRow(null)} title="Assign partners">
        {assignRow ? (
          <form onSubmit={saveAssignment} className="space-y-4">
            <p className="text-sm text-mauve">
              Assign <span className="font-semibold text-wine">{assignRow.name}</span> to partners of
              one type. They can place orders as those accounts only.
            </p>
            <Select
              label="Partner type"
              value={partnerType}
              onChange={(e) => onPartnerTypeChange(e.target.value)}
            >
              {PARTNER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <div>
              <p className="mb-2 text-sm font-semibold text-wine">Select {roleLabel(partnerType)}s</p>
              {partnersLoading ? (
                <Loader />
              ) : partnerOptions.length ? (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-blush-line p-2">
                  {partnerOptions.map((p) => {
                    const checked = selectedIds.includes(String(p._id));
                    return (
                      <label
                        key={p._id}
                        className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-[#FFFAFB]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePartner(p._id)}
                          className="mt-1"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-wine">{p.name}</span>
                          <span className="block truncate text-xs text-mauve">
                            {[p.shopName, p.mobile, p.email].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-mauve">No approved {roleLabel(partnerType).toLowerCase()}s found.</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAssignRow(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save assignment'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(kycRow)} onClose={() => setKycRow(null)} title="KYC documents">
        {kycRow ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold text-wine">Aadhaar:</span> {kycRow.aadhaarNumber || '—'}
            </p>
            <div className="flex flex-wrap gap-3">
              <KycLink href={kycRow.aadhaarFrontUrl} label="Aadhaar front" />
              <KycLink href={kycRow.aadhaarBackUrl} label="Aadhaar back" />
            </div>
            <p>
              <span className="font-semibold text-wine">PAN:</span> {kycRow.panNumber || '—'}
            </p>
            <KycLink href={kycRow.panFrontUrl} label="PAN front" />
            <p>
              <span className="font-semibold text-wine">Driving license:</span>{' '}
              {kycRow.drivingLicenseNumber || '—'}
            </p>
            <div className="flex flex-wrap gap-3">
              <KycLink href={kycRow.drivingLicenseFrontUrl} label="DL front" />
              <KycLink href={kycRow.drivingLicenseBackUrl} label="DL back" />
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setKycRow(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
