import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchWishlistIds, clearWishlist } from '../features/wishlist/wishlistSlice';

/** Loads wishlist product ids when a session exists; clears them on logout. */
export default function WishlistBootstrap() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);

  useEffect(() => {
    if (token) {
      dispatch(fetchWishlistIds());
    } else {
      dispatch(clearWishlist());
    }
  }, [token, dispatch]);

  return null;
}
