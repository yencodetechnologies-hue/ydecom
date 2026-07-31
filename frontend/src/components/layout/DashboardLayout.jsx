import { Outlet } from 'react-router-dom';
import AppShell from './AppShell';

export default function DashboardLayout() {
  return (
    <AppShell mainClassName="flex-1 p-4 lg:p-6">
      <Outlet />
    </AppShell>
  );
}
