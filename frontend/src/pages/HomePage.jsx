import { Navigate } from 'react-router-dom';
import FeaturedItems from '../components/home/FeaturedItems';
import HeroCarousel from '../components/home/HeroCarousel';
import PopularCategories from '../components/home/PopularCategories';
import StorefrontLayout from '../components/layout/StorefrontLayout';
import { useAppSelector } from '../app/hooks';

/** B2B roles use Shop as their storefront — no marketing home page. */
const B2B_SHOP_ROLES = ['stockist', 'distributor', 'retailer', 'reseller'];

export default function HomePage() {
  const role = useAppSelector((s) => s.auth.user?.role);

  if (B2B_SHOP_ROLES.includes(role)) {
    return <Navigate to="/shop" replace />;
  }

  return (
    <StorefrontLayout>
      <HeroCarousel />
      <PopularCategories />
      <FeaturedItems />
    </StorefrontLayout>
  );
}
