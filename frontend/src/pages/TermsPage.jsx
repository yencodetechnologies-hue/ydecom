import { Link } from 'react-router-dom';
import HomeNavbar from '../components/home/HomeNavbar';
import SiteFooter from '../components/layout/SiteFooter';

export default function TermsPage() {
  return (
    <div className="home-theme flex min-h-screen flex-col bg-white">
      <HomeNavbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-home-leaf/70">
          <Link to="/" className="hover:underline">
            Home
          </Link>
          {' / '}
          Terms
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-home-forest">Terms &amp; Conditions</h1>
        <div className="mt-8 space-y-5 text-sm leading-relaxed text-home-forest/80">
          <p>
            By placing an order on YDecom, you agree to these Terms &amp; Conditions. Orders are
            subject to product availability, pricing rules for your account role, and admin approval
            where applicable.
          </p>
          <p>
            Prices shown are based on your registered role (customer, retailer, distributor, or
            stockist). Final charges are confirmed when the order is placed. You are responsible for
            providing an accurate shop address for delivery.
          </p>
          <p>
            YDecom may cancel or adjust orders in case of stock errors, pricing mistakes, or
            suspected misuse. Status updates (Ordered, Order Packed, Dispatched, Delivered) will be
            reflected in your Orders page.
          </p>
          <p>
            For questions about these terms, contact us using the details in the site footer.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
