import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Trash2 } from 'lucide-react';
import { wishlistApi } from '../api';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addToCart } from '../features/cart/cartSlice';
import { fetchWishlistIds, toggleWishlist } from '../features/wishlist/wishlistSlice';
import { PageHeader, Button } from '../components/ui/Form';
import Loader from '../components/ui/Loader';
import { formatCurrency, getImageUrl } from '../utils/helpers';

export default function WishlistPage() {
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((s) => s.auth);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await wishlistApi.list();
      setItems(data.data || []);
      dispatch(fetchWishlistIds());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load wishlist');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when session changes
  }, [token]);

  const remove = async (productId) => {
    try {
      await dispatch(toggleWishlist(productId)).unwrap();
      setItems((prev) => prev.filter((i) => String(i.productId || i._id) !== String(productId)));
      toast.success('Removed from wishlist');
    } catch (err) {
      toast.error(err?.message || 'Failed to remove');
    }
  };

  const addCart = (item) => {
    if (item.price == null) {
      toast.error('Price not available');
      return;
    }
    const minQuantity = Math.max(1, Number(item.minQuantity) || 1);
    const moq = Math.max(1, Number(item.moq) || 1);
    dispatch(
      addToCart({
        productId: item.productId || item._id,
        name: item.name,
        image: item.images?.[0] || '',
        price: item.price,
        mrp: item.mrp ?? null,
        discountPercent: item.discountPercent || 0,
        qty: minQuantity,
        minQuantity,
        moq,
      })
    );
    toast.success('Added to cart');
  };

  return (
    <div>
      <PageHeader title="Wishlist" subtitle="Saved products for later" />

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-blush-line bg-blush/40 px-6 py-16 text-center">
          <Heart className="mx-auto h-10 w-10 text-mauve/40" />
          <p className="mt-3 font-display text-lg font-semibold text-wine">Your wishlist is empty</p>
          <Link to="/shop" className="mt-4 inline-block text-sm font-semibold text-rose hover:underline">
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => {
            const id = item.productId || item._id;
            const pct = item.discountPercent > 0 ? Math.round(item.discountPercent) : 0;
            return (
              <li
                key={id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-blush-line bg-white p-4"
              >
                <div className="h-20 w-20 overflow-hidden rounded-xl bg-blush/50">
                  {item.images?.[0] ? (
                    <img
                      src={getImageUrl(item.images[0])}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-wine">{item.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-2 text-sm">
                    {item.price == null ? (
                      <span className="text-mauve">Price on request</span>
                    ) : (
                      <>
                        {item.mrp != null && Number(item.mrp) > Number(item.price) ? (
                          <span className="text-mauve/50 line-through">
                            {formatCurrency(item.mrp)}
                          </span>
                        ) : null}
                        <span className="font-semibold text-wine">{formatCurrency(item.price)}</span>
                        {pct > 0 ? (
                          <span className="text-xs font-medium text-rose">−{pct}%</span>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <Button type="button" onClick={() => addCart(item)}>
                  Add to cart
                </Button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-danger hover:bg-fog"
                  onClick={() => remove(id)}
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
