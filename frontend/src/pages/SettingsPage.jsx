import { PageHeader } from '../components/ui/Form';
import { useAppSelector } from '../app/hooks';
import { roleLabel, formatDate } from '../utils/helpers';

export default function SettingsPage() {
  const { user } = useAppSelector((s) => s.auth);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile and account details" />
      <div className="max-w-2xl rounded-2xl border border-sand bg-white p-6 shadow-sm">
        <h3 className="font-display text-xl text-wine">Profile</h3>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <p><strong>Name:</strong> {user?.name}</p>
          <p><strong>Role:</strong> {roleLabel(user?.role)}</p>
          <p><strong>Mobile:</strong> {user?.mobile}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Status:</strong> {user?.status}</p>
          <p><strong>Member since:</strong> {formatDate(user?.createdAt)}</p>
          {user?.shopName ? <p><strong>Shop:</strong> {user.shopName}</p> : null}
          {user?.shopAddress ? (
            <p className="sm:col-span-2"><strong>Shop address:</strong> {user.shopAddress}</p>
          ) : (
            <p className="sm:col-span-2 text-ink/50">
              <strong>Shop address:</strong> Not set — ask an admin to update your profile.
            </p>
          )}
          {user?.gstNumber ? <p><strong>GST:</strong> {user.gstNumber}</p> : null}
        </div>
        <p className="mt-6 rounded-xl bg-fog p-3 text-xs text-ink/60">
          Password changes and advanced preferences can be extended here. Contact the administrator for account
          updates that require approval.
        </p>
      </div>
    </div>
  );
}
