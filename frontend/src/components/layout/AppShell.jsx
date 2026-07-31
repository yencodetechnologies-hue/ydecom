import { useState } from 'react';
import { useAppSelector } from '../../app/hooks';
import HomeNavbar from '../home/HomeNavbar';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import SiteFooter from './SiteFooter';

/** Roles that use the home storefront navbar (Order as, etc.) on authenticated pages. */
const STOREFRONT_NAV_ROLES = ['stockist', 'salesman'];

/** Stockists / salesmen use the home storefront sidebar + navbar on every page. */
export function useStockistStorefrontChrome() {
  const { user, token } = useAppSelector((s) => s.auth);
  const useStorefrontNav = STOREFRONT_NAV_ROLES.includes(user?.role);
  return {
    isStockist: user?.role === 'stockist',
    showSidebar: Boolean(token && user),
    sidebarVariant: useStorefrontNav ? 'storefront' : 'dashboard',
    useHomeNavbar: useStorefrontNav,
    shellClass: useStorefrontNav ? 'home-theme flex min-h-screen bg-white' : 'flex min-h-screen',
  };
}

export default function AppShell({ children, showFooter = false, mainClassName = 'flex-1' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showSidebar, sidebarVariant, useHomeNavbar, shellClass } =
    useStockistStorefrontChrome();

  const showHomeNav = useHomeNavbar || !showSidebar;
  const showTopbar = showSidebar && !useHomeNavbar;

  return (
    <div className={shellClass}>
      {showSidebar ? (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          variant={sidebarVariant}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {showHomeNav ? (
          <HomeNavbar
            compact={showSidebar && useHomeNavbar}
            onMenu={showSidebar && useHomeNavbar ? () => setSidebarOpen(true) : undefined}
          />
        ) : null}
        {showTopbar ? <Topbar onMenu={() => setSidebarOpen(true)} /> : null}
        <main className={mainClassName}>{children}</main>
        {showFooter ? <SiteFooter /> : null}
      </div>
    </div>
  );
}
