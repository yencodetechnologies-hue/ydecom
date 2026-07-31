import { Outlet } from 'react-router-dom';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';
import WhatsAppFab from './WhatsAppFab';

export default function PublicLayout() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background:
          'radial-gradient(ellipse at 15% 0%, rgba(255,62,118,0.08), transparent 45%), #FBEEF1',
      }}
    >
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
