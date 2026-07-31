import { useState } from 'react';
import { LogOut, Menu, UserRound } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logout } from '../../features/auth/authSlice';
import NotificationDropdown from '../ui/NotificationDropdown';
import { roleLabel } from '../../utils/helpers';

export default function Topbar({ onMenu }) {
  const { user } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const [openProfile, setOpenProfile] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-blush-line bg-white/90 px-4 py-3 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <button type="button" className="rounded-lg p-2 hover:bg-blush lg:hidden" onClick={onMenu}>
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden sm:block">
          <p className="font-display text-lg text-wine">YDecom</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationDropdown tone="dashboard" />

        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-blush-line bg-white px-2 py-1.5 hover:bg-blush"
            onClick={() => setOpenProfile((v) => !v)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose text-white">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-tight text-wine">{user?.name}</p>
              <p className="text-[11px] text-mauve">{roleLabel(user?.role)}</p>
            </div>
          </button>
          {openProfile ? (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-blush-line bg-white p-2 shadow-xl">
              <div className="border-b border-blush-line px-3 py-2">
                <p className="text-sm font-semibold text-wine">{user?.name}</p>
                <p className="text-xs text-mauve">{user?.mobile}</p>
                <p className="text-xs text-mauve">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => dispatch(logout())}
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger/5"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
