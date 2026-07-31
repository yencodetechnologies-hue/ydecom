import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { categoriesApi, manufacturersApi, productsApi } from '../api';
import { PageHeader, Button, Input, TextArea } from '../components/ui/Form';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/ui/StatusBadge';
import StatusToggle from '../components/ui/StatusToggle';
import Loader from '../components/ui/Loader';
import CategoryFormModal from '../components/ui/CategoryFormModal';
import ManufacturerFormModal from '../components/ui/ManufacturerFormModal';
import ExpressInterestModal from '../components/products/ExpressInterestModal';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addToCart } from '../features/cart/cartSlice';
import { formatCurrency, formatDate, getImageUrl, parseInterestResponse, PRODUCT_INTEREST_ROLES } from '../utils/helpers';

const DESCRIPTION_MAX = 2000;

const empty = {
  name: '',
  sku: '',
  itemCode: '',
  cbm: '',
  category: '',
  manufacturer: '',
  brand: '',
  description: '',
  purchaseTax: '',
  salesTax: '',
  minQuantity: '1',
  moq: '1',
  status: 'active',
  priceVisible: true,
};

const emptyBatchRow = { cost: '', tax: '', mrp: '', qty: '' };
const emptyStockBatches = [emptyBatchRow];

const ADD_CATEGORY = '__add_category__';
const ADD_MANUFACTURER = '__add_manufacturer__';

export default function ProductsPage() {
  const dispatch = useAppDispatch();
  const { user, token } = useAppSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';
  const isB2B = user?.role === 'stockist' || user?.role === 'distributor';
  const canExpressInterest = PRODUCT_INTEREST_ROLES.includes(user?.role);
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [stockBatches, setStockBatches] = useState(emptyStockBatches);
  const [files, setFiles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [manufacturerOpen, setManufacturerOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [removeId, setRemoveId] = useState(null);
  const [cartQty, setCartQty] = useState(1);
  const [interestedIds, setInterestedIds] = useState([]);
  const [interestQuantities, setInterestQuantities] = useState({});
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [submittingInterest, setSubmittingInterest] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data }, cats, mfrs] = await Promise.all([
        productsApi.list({ search, page, limit }),
        isAdmin ? categoriesApi.list({ limit: 100 }) : Promise.resolve(null),
        isAdmin ? manufacturersApi.list({ limit: 100 }) : Promise.resolve(null),
      ]);
      setRows(data.data);
      setMeta(data.meta);
      if (cats) setCategories(cats.data.data || []);
      if (mfrs) setManufacturers(mfrs.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, page, limit]);

  useEffect(() => {
    if (!canExpressInterest || !token) {
      setInterestedIds([]);
      setInterestQuantities({});
      return;
    }
    let active = true;
    productsApi
      .listInterestIds()
      .then((res) => {
        if (active) {
          const parsed = parseInterestResponse(res.data?.data || []);
          setInterestedIds(parsed.ids);
          setInterestQuantities(parsed.quantities);
        }
      })
      .catch(() => {
        if (active) {
          setInterestedIds([]);
          setInterestQuantities({});
        }
      });
    return () => {
      active = false;
    };
  }, [canExpressInterest, token]);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setStockBatches(emptyStockBatches);
    setFiles([]);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name,
      sku: row.sku,
      itemCode: row.itemCode ?? '',
      cbm: row.cbm ?? '',
      category: row.category?._id || row.category,
      manufacturer: row.manufacturer?._id || row.manufacturer || '',
      brand: row.brand ?? '',
      description: row.description ?? '',
      purchaseTax: row.purchaseTax ?? '',
      salesTax: row.salesTax ?? '',
      minQuantity: String(row.minQuantity ?? 1),
      moq: String(row.moq ?? 1),
      status: row.status,
      priceVisible: row.priceVisible,
    });
    setStockBatches(
      row.stockBatches?.length
        ? row.stockBatches.map((b) => ({
            cost: String(b.cost),
            tax: String(b.tax),
            mrp: String(b.mrp),
            qty: String(b.qty),
          }))
        : [{ cost: String(row.cost ?? ''), tax: String(row.tax ?? ''), mrp: String(row.mrp ?? ''), qty: String(row.stock ?? '') }]
    );
    setFiles([]);
    setOpen(true);
  };

  const addStockBatch = () => setStockBatches((prev) => [...prev, { ...emptyBatchRow }]);
  const updateStockBatch = (index, field, value) =>
    setStockBatches((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const removeStockBatch = (index) =>
    setStockBatches((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const buildFormData = () => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append(
      'stockBatches',
      JSON.stringify(
        stockBatches.map((b) => ({
          cost: Number(b.cost) || 0,
          tax: Number(b.tax) || 0,
          mrp: Number(b.mrp) || 0,
          qty: Number(b.qty) || 0,
        }))
      )
    );
    files.forEach((f) => fd.append('images', f));
    return fd;
  };

  const openAddCategory = () => setCategoryOpen(true);

  const onCategoryChange = (e) => {
    const value = e.target.value;
    if (value === ADD_CATEGORY) {
      openAddCategory();
      return;
    }
    setForm({ ...form, category: value });
  };

  const onCategoryCreated = (created) => {
    if (!created?._id) return;
    setCategories((prev) => {
      if (prev.some((c) => c._id === created._id)) return prev;
      return [...prev, created];
    });
    setForm((prev) => ({ ...prev, category: created._id }));
  };

  const openAddManufacturer = () => setManufacturerOpen(true);

  const onManufacturerChange = (e) => {
    const value = e.target.value;
    if (value === ADD_MANUFACTURER) {
      openAddManufacturer();
      return;
    }
    setForm({ ...form, manufacturer: value });
  };

  const onManufacturerCreated = (created) => {
    if (!created?._id) return;
    setManufacturers((prev) => {
      if (prev.some((m) => m._id === created._id)) return prev;
      return [...prev, created];
    });
    setForm((prev) => ({ ...prev, manufacturer: created._id }));
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const fd = buildFormData();
      if (editing) {
        await productsApi.update(editing._id, fd);
        toast.success('Product updated');
      } else {
        await productsApi.create(fd);
        toast.success('Product created');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const toggleStatus = async (id) => {
    const prev = rows.find((r) => r._id === id);
    if (!prev) return;
    const nextStatus = prev.status === 'active' ? 'inactive' : 'active';
    setRows((list) => list.map((r) => (r._id === id ? { ...r, status: nextStatus } : r)));
    try {
      const { data } = await productsApi.update(id, { status: nextStatus });
      if (data?.data) {
        setRows((list) => list.map((r) => (r._id === id ? { ...r, ...data.data } : r)));
      }
      toast.success(`Product ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (err) {
      setRows((list) => list.map((r) => (r._id === id ? { ...r, status: prev.status } : r)));
      toast.error(err.response?.data?.message || 'Toggle failed');
    }
  };

  const remove = async () => {
    try {
      await productsApi.remove(removeId);
      toast.success('Product deleted');
      setRemoveId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const openDetail = async (row) => {
    const minQ = Math.max(1, Number(row.minQuantity) || 1);
    setCartQty(minQ);
    setDetail(row);
    setDetailLoading(true);
    try {
      const { data } = await productsApi.get(row._id);
      const product = data.data;
      setDetail(product);
      setCartQty(Math.max(1, Number(product?.minQuantity) || 1));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load product details');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const addProductToCart = (product) => {
    const price = product.priceHidden
      ? null
      : isAdmin
        ? product.netCost
        : product.displayPrice;
    const minQuantity = Math.max(1, Number(product.minQuantity) || 1);
    const moq = Math.max(1, Number(product.moq) || 1);
    const qty = Math.max(minQuantity, Number(cartQty) || minQuantity);
    dispatch(
      addToCart({
        productId: product._id,
        name: product.name,
        image: product.images?.[0] || '',
        price,
        mrp: product.mrp ?? null,
        discountPercent: product.discountPercent || 0,
        qty,
        minQuantity,
        moq,
        maxStock: Number(product.availableStock ?? product.stock) || null,
      })
    );
    toast.success('Added to cart');
    setDetail(null);
  };

  const detailStock = detail ? Number(detail.availableStock ?? detail.stock ?? 0) : 0;
  const detailOutOfStock = detailStock <= 0;
  const detailAlreadyInterested = detail ? interestedIds.includes(String(detail._id)) : false;
  const detailSavedQty = detail ? interestQuantities[String(detail._id)] : undefined;

  const submitDetailInterest = async (quantity) => {
    if (!detail || submittingInterest) return;
    setSubmittingInterest(true);
    try {
      await productsApi.expressInterest(detail._id, quantity);
      toast.success(detailAlreadyInterested ? 'Interest updated' : 'Interest submitted');
      const id = String(detail._id);
      setInterestedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setInterestQuantities((prev) => ({ ...prev, [id]: quantity }));
      setInterestModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || err?.message || 'Could not submit interest');
    } finally {
      setSubmittingInterest(false);
    }
  };

  const priceCell = (r) => {
    if (r.priceHidden) return <span className="text-ink/40">Hidden</span>;
    if (isAdmin) {
      return (
        <div className="text-xs">
          <div>Cost: {formatCurrency(r.cost)}</div>
          <div>Net Cost: {formatCurrency(r.netCost)}</div>
          <div>MRP: {formatCurrency(r.mrp)}</div>
        </div>
      );
    }
    if (user?.role === 'customer') {
      return formatCurrency(r.mrp);
    }
    return formatCurrency(r.displayPrice);
  };

  const columns = [
    {
      key: 'sno',
      label: 'S.No',
      render: (_r, index) => (page - 1) * limit + index + 1,
    },
    {
      key: 'image',
      label: 'Image',
      render: (r) =>
        r.images?.[0] ? (
          <img src={getImageUrl(r.images[0])} alt="" className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          '—'
        ),
    },
    { key: 'name', label: 'Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'itemCode', label: 'Item Code', render: (r) => r.itemCode || '—' },
    { key: 'category', label: 'Category', render: (r) => r.category?.name || '—' },
    { key: 'manufacturer', label: 'Manufacturer', render: (r) => r.manufacturer?.name || '—' },
    {
      key: 'stock',
      label: isAdmin ? 'Stock' : 'Warehouse stock',
      render: (r) => {
        const stock = r.availableStock ?? r.stock ?? 0;
        if (isAdmin && stock <= 0) {
          return (
            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              0 — Out of stock
            </span>
          );
        }
        return stock;
      },
    },
    { key: 'price', label: 'Price', render: priceCell },
    {
      key: 'status',
      label: 'Status',
      render: (r) =>
        isAdmin ? (
          <StatusToggle
            checked={r.status === 'active'}
            onChange={() => toggleStatus(r._id)}
            onLabel="ON"
            offLabel="OFF"
            title={r.status === 'active' ? 'Deactivate product' : 'Activate product'}
          />
        ) : (
          <StatusBadge status={r.status} />
        ),
    },
  ];

  columns.push({
    key: 'actions',
    label: 'Actions',
    render: (r) => (
      <div className="flex gap-1">
        <button type="button" className="rounded-lg p-1.5 hover:bg-fog" onClick={() => openDetail(r)}>
          <Eye className="h-4 w-4" />
        </button>
        {isAdmin ? (
          <>
            <button type="button" className="rounded-lg p-1.5 hover:bg-fog" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4 text-rose-deep" />
            </button>
            <button type="button" className="rounded-lg p-1.5 hover:bg-fog" onClick={() => setRemoveId(r._id)}>
              <Trash2 className="h-4 w-4 text-danger" />
            </button>
          </>
        ) : null}
      </div>
    ),
  });

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={isAdmin ? 'Manage catalog, pricing and stock' : 'Browse products and place orders'}
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Product
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

      <Modal open={open} title={editing ? 'Edit Product' : 'Add Product'} onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink/80">Category</span>
            <div className="flex gap-2">
              <select
                className="w-full flex-1 rounded-xl border border-blush-line bg-white px-3 py-2.5 text-sm outline-none ring-rose/30 focus:ring-2"
                value={form.category}
                onChange={onCategoryChange}
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
                <option value={ADD_CATEGORY}>+ Add Category</option>
              </select>
              <Button type="button" variant="secondary" className="shrink-0 px-3" onClick={openAddCategory}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink/80">Manufacturer</span>
            <div className="flex gap-2">
              <select
                className="w-full flex-1 rounded-xl border border-blush-line bg-white px-3 py-2.5 text-sm outline-none ring-rose/30 focus:ring-2"
                value={form.manufacturer}
                onChange={onManufacturerChange}
              >
                <option value="">Select manufacturer</option>
                {manufacturers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
                <option value={ADD_MANUFACTURER}>+ Add Manufacturer</option>
              </select>
              <Button type="button" variant="secondary" className="shrink-0 px-3" onClick={openAddManufacturer}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <Input label="Item Code" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} />
          <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <Input label="CBM" value={form.cbm} onChange={(e) => setForm({ ...form, cbm: e.target.value })} />
          <div className="sm:col-span-2">
            <TextArea
              label="Product Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value.slice(0, DESCRIPTION_MAX) })
              }
              rows={5}
              placeholder="Describe the product — key features, specifications, materials, dimensions, usage tips, and anything buyers should know."
            />
            <p className="mt-1 text-right text-xs text-ink/40">
              {form.description.length}/{DESCRIPTION_MAX} characters
            </p>
          </div>
          <Input
            label="Purchase Tax %"
            type="number"
            step="0.01"
            value={form.purchaseTax}
            onChange={(e) => setForm({ ...form, purchaseTax: e.target.value })}
          />
          <Input
            label="Sales Tax %"
            type="number"
            step="0.01"
            value={form.salesTax}
            onChange={(e) => setForm({ ...form, salesTax: e.target.value })}
          />
          <Input
            label="Minimum Quantity"
            type="number"
            min="1"
            step="1"
            value={form.minQuantity}
            onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
            required
          />
          <Input
            label="MOQ"
            type="number"
            min="1"
            step="1"
            value={form.moq}
            onChange={(e) => setForm({ ...form, moq: e.target.value })}
            required
          />
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink/80">
                Cost, Tax, Net Cost, MRP &amp; Stock Qty{' '}
                <span className="font-normal text-ink/40">(oldest row sells first)</span>
              </span>
              <Button type="button" variant="secondary" className="shrink-0 px-3 py-1.5 text-xs" onClick={addStockBatch}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              {stockBatches.map((row, index) => {
                const netCost = row.cost
                  ? (Number(row.cost) * (1 + (Number(row.tax) || 0) / 100)).toFixed(2)
                  : '';
                return (
                  <div key={index} className="flex flex-wrap items-end gap-2 rounded-xl border border-blush-line p-2.5 sm:flex-nowrap">
                    <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[7rem]">
                      <label className="block space-y-1">
                        <span className="text-xs text-ink/50">Cost</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full rounded-xl border border-blush-line bg-white px-3 py-2 text-sm outline-none ring-rose/30 focus:ring-2"
                          value={row.cost}
                          onChange={(e) => updateStockBatch(index, 'cost', e.target.value)}
                          required
                        />
                      </label>
                    </div>
                    <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[6rem]">
                      <label className="block space-y-1">
                        <span className="text-xs text-ink/50">Tax %</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full rounded-xl border border-blush-line bg-white px-3 py-2 text-sm outline-none ring-rose/30 focus:ring-2"
                          value={row.tax}
                          onChange={(e) => updateStockBatch(index, 'tax', e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[7rem]">
                      <label className="block space-y-1">
                        <span className="text-xs text-ink/50">Net Cost</span>
                        <input
                          type="number"
                          readOnly
                          disabled
                          className="w-full rounded-xl border border-blush-line bg-fog px-3 py-2 text-sm text-ink/60 outline-none"
                          value={netCost}
                        />
                      </label>
                    </div>
                    <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[7rem]">
                      <label className="block space-y-1">
                        <span className="text-xs text-ink/50">MRP</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full rounded-xl border border-blush-line bg-white px-3 py-2 text-sm outline-none ring-rose/30 focus:ring-2"
                          value={row.mrp}
                          onChange={(e) => updateStockBatch(index, 'mrp', e.target.value)}
                          required
                        />
                      </label>
                    </div>
                    <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[6rem]">
                      <label className="block space-y-1">
                        <span className="text-xs text-ink/50">Stock Qty</span>
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded-xl border border-blush-line bg-white px-3 py-2 text-sm outline-none ring-rose/30 focus:ring-2"
                          value={row.qty}
                          onChange={(e) => updateStockBatch(index, 'qty', e.target.value)}
                          required
                        />
                      </label>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-leaf hover:bg-fog"
                        onClick={addStockBatch}
                        aria-label="Add another row"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      {stockBatches.length > 1 ? (
                        <button
                          type="button"
                          className="rounded-lg p-2 text-danger hover:bg-fog"
                          onClick={() => removeStockBatch(index)}
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between self-end rounded-xl border border-blush-line bg-blush/40 px-3 py-2.5">
            <span className="text-sm font-medium text-wine">Active product</span>
            <StatusToggle
              checked={form.status === 'active'}
              onChange={(v) => setForm({ ...form, status: v ? 'active' : 'inactive' })}
              onLabel="ON"
              offLabel="OFF"
              size="sm"
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Upload Images"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full">{editing ? 'Update Product' : 'Create Product'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detail)} title="Product Details" onClose={() => setDetail(null)} wide>
        {detailLoading ? (
          <Loader label="Loading product details..." />
        ) : detail ? (
          <div className="space-y-5">
            {(detail.images || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {detail.images.map((img) => (
                  <img key={img} src={getImageUrl(img)} alt="" className="h-24 w-24 rounded-xl object-cover" />
                ))}
              </div>
            ) : null}

            <section>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/50">General</h4>
              <div className="grid gap-2 rounded-xl border border-sand bg-fog/40 p-4 text-sm sm:grid-cols-2">
                <p><strong>Name:</strong> {detail.name}</p>
                <p><strong>SKU:</strong> {detail.sku}</p>
                <p><strong>Item Code:</strong> {detail.itemCode || '—'}</p>
                <p><strong>CBM:</strong> {detail.cbm || '—'}</p>
                <p><strong>Brand:</strong> {detail.brand || '—'}</p>
                <p><strong>Manufacturer:</strong> {detail.manufacturer?.name || '—'}</p>
                <p><strong>Category:</strong> {detail.category?.name || '—'}</p>
                <p><strong>Status:</strong> <StatusBadge status={detail.status} /></p>
                {isAdmin ? (
                  <p>
                    <strong>Price Visible:</strong>{' '}
                    {detail.priceVisible ? 'ON' : 'OFF'}
                  </p>
                ) : null}
                <div className="sm:col-span-2">
                  <p className="mb-1 font-semibold">Description</p>
                  {detail.description ? (
                    <p className="whitespace-pre-wrap rounded-lg border border-sand bg-white px-3 py-2 text-ink/80">
                      {detail.description}
                    </p>
                  ) : (
                    <p className="text-ink/40">No description provided.</p>
                  )}
                </div>
              </div>
            </section>

            {isAdmin ? (
              <>
                <section>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/50">
                    Active pricing (FIFO front batch)
                  </h4>
                  <div className="grid gap-2 rounded-xl border border-sand bg-fog/40 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <p><strong>Cost:</strong> {formatCurrency(detail.cost)}</p>
                    <p><strong>Tax (%):</strong> {detail.tax ?? '—'}</p>
                    <p><strong>Net Cost:</strong> {formatCurrency(detail.netCost)}</p>
                    <p><strong>MRP:</strong> {formatCurrency(detail.mrp)}</p>
                    <p><strong>Purchase Tax:</strong> {detail.purchaseTax ?? 0}%</p>
                    <p><strong>Sales Tax:</strong> {detail.salesTax ?? 0}%</p>
                    <p><strong>Minimum Quantity:</strong> {detail.minQuantity ?? 1}</p>
                    <p><strong>MOQ:</strong> {detail.moq ?? 1}</p>
                    <p><strong>Total Stock:</strong> {detail.stock ?? 0}</p>
                  </div>
                </section>

                {detail.stockBatches?.length ? (
                  <section>
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/50">
                      Stock batches ({detail.stockBatches.length})
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-sand">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-sand/60 text-xs uppercase text-ink/50">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Cost</th>
                            <th className="px-3 py-2">Tax %</th>
                            <th className="px-3 py-2">Net Cost</th>
                            <th className="px-3 py-2">MRP</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">Added</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.stockBatches.map((batch, index) => (
                            <tr key={batch._id || index} className="border-t border-sand">
                              <td className="px-3 py-2">{index + 1}</td>
                              <td className="px-3 py-2">{formatCurrency(batch.cost)}</td>
                              <td className="px-3 py-2">{batch.tax ?? 0}</td>
                              <td className="px-3 py-2">{formatCurrency(batch.netCost)}</td>
                              <td className="px-3 py-2">{formatCurrency(batch.mrp)}</td>
                              <td className="px-3 py-2">{batch.qty}</td>
                              <td className="px-3 py-2">{formatDate(batch.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-sand bg-fog/50 text-sm font-semibold">
                          <tr>
                            <td className="px-3 py-2" colSpan={5}>
                              Total
                            </td>
                            <td className="px-3 py-2">
                              {detail.stockBatches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <section>
                <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/50">Pricing & stock</h4>
                <div className="grid gap-2 rounded-xl border border-sand bg-fog/40 p-4 text-sm sm:grid-cols-2">
                  <p>
                    <strong>{user?.role === 'stockist' ? 'Admin warehouse stock:' : 'Stock:'}</strong>{' '}
                    {detail.availableStock ?? detail.stock ?? '—'}
                  </p>
                  <p><strong>Minimum Quantity:</strong> {detail.minQuantity ?? 1}</p>
                  <p><strong>MOQ:</strong> {detail.moq ?? 1}</p>
                  {detail.priceHidden ? (
                    <p><strong>Price:</strong> <span className="text-ink/40">Hidden</span></p>
                  ) : (
                    <>
                      {user?.role === 'customer' ? (
                        <p><strong>MRP:</strong> {formatCurrency(detail.mrp)}</p>
                      ) : null}
                      <p>
                        <strong>Your price:</strong> {formatCurrency(detail.displayPrice)}
                      </p>
                      {detail.discountPercent > 0 ? (
                        <p>
                          <strong>Discount:</strong> {detail.discountPercent}% (
                          {formatCurrency(detail.discountAmount)} off)
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
            )}

            {!isAdmin && !detail.priceHidden ? (
              <div className="space-y-3 border-t border-sand pt-4">
                {user?.shopAddress ? (
                  <p className="rounded-xl bg-fog px-3 py-2 text-sm">
                    <strong>Shop address:</strong> {user.shopAddress}
                  </p>
                ) : (
                  <p className="rounded-xl bg-amber/10 px-3 py-2 text-sm text-amber">
                    Set your shop address in Settings before placing an order.
                  </p>
                )}
                {canExpressInterest && detailOutOfStock ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <Button onClick={() => setInterestModalOpen(true)}>
                      {detailAlreadyInterested
                        ? detailSavedQty
                          ? `Interest ✓ · Qty ${detailSavedQty} · Edit`
                          : 'Interest ✓ · Edit qty'
                        : 'Express interest'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <Input
                      label="Quantity"
                      type="number"
                      min={detail.minQuantity ?? 1}
                      step={detail.moq ?? 1}
                      value={cartQty}
                      onChange={(e) => setCartQty(Number(e.target.value))}
                    />
                    <Button onClick={() => addProductToCart(detail)}>
                      <ShoppingCart className="h-4 w-4" /> Add to Cart
                    </Button>
                    <Link to="/cart">
                      <Button variant="secondary">Place Order</Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ExpressInterestModal
        open={interestModalOpen}
        productName={detail?.name || ''}
        onClose={() => setInterestModalOpen(false)}
        onSubmit={submitDetailInterest}
        submitting={submittingInterest}
        initialQuantity={detailSavedQty ?? 1}
        isEditing={detailAlreadyInterested}
      />

      <CategoryFormModal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        onSuccess={onCategoryCreated}
        className="z-[60]"
      />

      <ManufacturerFormModal
        open={manufacturerOpen}
        onClose={() => setManufacturerOpen(false)}
        onSuccess={onManufacturerCreated}
        className="z-[60]"
      />

      <ConfirmDialog
        open={Boolean(removeId)}
        title="Delete product?"
        message="This will permanently remove the product."
        onClose={() => setRemoveId(null)}
        onConfirm={remove}
        confirmLabel="Delete"
      />
    </div>
  );
}
