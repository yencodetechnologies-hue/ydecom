import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { categoriesApi, productsApi } from '../api';
import { useAppSelector } from '../app/hooks';
import ProductCard from '../components/home/ProductCard';
import StorefrontLayout from '../components/layout/StorefrontLayout';
import Loader from '../components/ui/Loader';
import Pagination, {
  DEFAULT_SHOP_PAGE_SIZE,
  SHOP_PAGE_SIZE_OPTIONS,
} from '../components/ui/Pagination';
import { parseInterestResponse, PRODUCT_INTEREST_ROLES } from '../utils/helpers';

const B2B_SHOP_ROLES = ['stockist', 'distributor', 'retailer', 'reseller', 'salesman'];

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_SHOP_PAGE_SIZE);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const discountPercent = useAppSelector((s) => s.auth.user?.discountPercent);
  const selectedBuyerId = useAppSelector((s) => s.buyerContext.selectedBuyerId);
  const [interestedIds, setInterestedIds] = useState([]);
  const [interestQuantities, setInterestQuantities] = useState({});
  const isB2BShop = B2B_SHOP_ROLES.includes(user?.role);

  useEffect(() => {
    let active = true;
    categoriesApi
      .listPublic()
      .then((res) => {
        if (active) setCategories(res.data?.data || []);
      })
      .catch(() => {
        if (active) setCategories([]);
      })
      .finally(() => {
        if (active) setLoadingCats(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [categoryId, searchQuery]);

  useEffect(() => {
    if (!PRODUCT_INTEREST_ROLES.includes(user?.role) || !token) {
      setInterestedIds([]);
      setInterestQuantities({});
      return;
    }
    let active = true;
    productsApi
      .listInterestIds(selectedBuyerId || undefined)
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
  }, [user?.role, token, selectedBuyerId]);

  useEffect(() => {
    let active = true;
    setLoadingProducts(true);
    productsApi
      .listPublic({
        category: categoryId || undefined,
        search: searchQuery || undefined,
        page,
        limit,
        ...(selectedBuyerId ? { buyerId: selectedBuyerId } : {}),
      })
      .then((res) => {
        if (!active) return;
        setProducts(res.data?.data || []);
        setMeta(res.data?.meta || { page: 1, pages: 1, total: 0 });
      })
      .catch(() => {
        if (!active) return;
        setProducts([]);
        setMeta({ page: 1, pages: 1, total: 0 });
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });
    return () => {
      active = false;
    };
  }, [categoryId, searchQuery, page, limit, token, discountPercent, selectedBuyerId]);

  const handleInterestSubmitted = (productId, quantity) => {
    const id = String(productId);
    setInterestedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (quantity != null) {
      setInterestQuantities((prev) => ({ ...prev, [id]: quantity }));
    }
  };

  const activeCategory = categories.find((c) => c._id === categoryId);
  const selectCategory = (id) => {
    const next = {};
    if (id) next.category = id;
    if (searchQuery) next.search = searchQuery;
    setSearchParams(next);
  };
  const isSalesman = user?.role === 'salesman';

  return (
    <StorefrontLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-56 lg:self-start">
          <h1 className="mb-4 font-display text-xl font-bold text-home-forest">Categories</h1>
          {loadingCats ? (
            <Loader />
          ) : (
            <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              <button
                type="button"
                onClick={() => selectCategory('')}
                className={`shrink-0 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  !categoryId
                    ? 'bg-home-mint/50 text-home-forest'
                    : 'text-home-forest/70 hover:bg-home-sand'
                }`}
              >
                All products
              </button>
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => selectCategory(cat._id)}
                  className={`shrink-0 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                    categoryId === cat._id
                      ? 'bg-home-mint/50 text-home-forest'
                      : 'text-home-forest/70 hover:bg-home-sand'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </nav>
          )}
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              {!isB2BShop ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-home-leaf/70">
                  <Link to="/" className="hover:underline">
                    Home
                  </Link>
                  {' / '}
                  Shop
                </p>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-wide text-home-leaf/70">Shop</p>
              )}
              <h2 className="mt-1 font-display text-2xl font-bold text-home-forest">
                {searchQuery
                  ? `Results for “${searchQuery}”`
                  : activeCategory?.name || 'All products'}
              </h2>
              {searchQuery && activeCategory ? (
                <p className="mt-1 text-sm text-home-forest/60">in {activeCategory.name}</p>
              ) : null}
            </div>
          </div>

          {isSalesman && !selectedBuyerId ? (
            <div className="mb-4 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-home-forest">
              Select a partner from <strong>Order as</strong> in the header to view prices and place orders.
            </div>
          ) : null}

          {loadingProducts ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl bg-home-mint/25" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-home-line bg-home-sand/40 px-6 py-16 text-center">
              <p className="font-display text-lg font-semibold text-home-forest">No products found</p>
              <p className="mt-2 text-sm text-home-forest/60">
                {searchQuery
                  ? 'Try a different search term or clear filters.'
                  : 'Try another category or check back later.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {products.map((p) => (
                  <ProductCard
                    key={p._id}
                    product={p}
                    interestedIds={interestedIds}
                    interestQuantities={interestQuantities}
                    onInterestSubmitted={handleInterestSubmitted}
                  />
                ))}
              </div>
              <div className="mt-8">
                <Pagination
                  page={meta.page}
                  pages={meta.pages}
                  total={meta.total}
                  limit={limit}
                  pageSizeOptions={SHOP_PAGE_SIZE_OPTIONS}
                  onLimitChange={(next) => {
                    setLimit(next);
                    setPage(1);
                  }}
                  onChange={setPage}
                  alwaysShow
                />
              </div>
            </>
          )}
        </main>
      </div>
    </StorefrontLayout>
  );
}
