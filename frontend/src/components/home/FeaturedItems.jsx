import { useEffect, useState } from 'react';
import { ChevronDown, ListFilter } from 'lucide-react';
import { productsApi } from '../../api';
import { useAppSelector } from '../../app/hooks';
import ProductCard from './ProductCard';
import { parseInterestResponse, PRODUCT_INTEREST_ROLES } from '../../utils/helpers';

const sortOptions = ['Default', 'Price: Low to High', 'Price: High to Low'];

export default function FeaturedItems() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('Default');
  const [sortOpen, setSortOpen] = useState(false);
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const discountPercent = useAppSelector((s) => s.auth.user?.discountPercent);
  const selectedBuyerId = useAppSelector((s) => s.buyerContext.selectedBuyerId);
  const [interestedIds, setInterestedIds] = useState([]);
  const [interestQuantities, setInterestQuantities] = useState({});

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
    setLoading(true);
    productsApi
      .listPublic({
        limit: 10,
        ...(selectedBuyerId ? { buyerId: selectedBuyerId } : {}),
      })
      .then((res) => {
        if (active) setProducts(res.data?.data || []);
      })
      .catch(() => {
        if (active) setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, discountPercent, selectedBuyerId]);

  const handleInterestSubmitted = (productId, quantity) => {
    const id = String(productId);
    setInterestedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (quantity != null) {
      setInterestQuantities((prev) => ({ ...prev, [id]: quantity }));
    }
  };

  if (!loading && products.length === 0) return null;

  const sorted = [...products].sort((a, b) => {
    if (sort === 'Price: Low to High') return (a.price ?? Infinity) - (b.price ?? Infinity);
    if (sort === 'Price: High to Low') return (b.price ?? -Infinity) - (a.price ?? -Infinity);
    return 0;
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-home-forest sm:text-2xl">
          Featured Items
        </h2>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-home-line bg-white px-3.5 py-2 text-sm font-medium text-home-forest/80"
          >
            <ListFilter className="h-4 w-4 text-home-leaf" />
            Sort by :<span className="font-semibold text-home-forest">{sort}</span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {sortOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-xl border border-home-line bg-white p-1.5 shadow-lg">
              {sortOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setSort(opt);
                    setSortOpen(false);
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                    opt === sort
                      ? 'bg-home-mint/20 font-semibold text-home-forest'
                      : 'text-home-forest/75 hover:bg-home-sand'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl bg-home-mint/25"
              />
            ))
          : sorted.map((p) => (
              <ProductCard
                key={p._id}
                product={p}
                interestedIds={interestedIds}
                interestQuantities={interestQuantities}
                onInterestSubmitted={handleInterestSubmitted}
              />
            ))}
      </div>
    </section>
  );
}
