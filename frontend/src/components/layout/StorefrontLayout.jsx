import AppShell from './AppShell';

export default function StorefrontLayout({ children }) {
  return <AppShell showFooter mainClassName="flex-1">{children}</AppShell>;
}
