import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../../api';

export default function NotificationDropdown({ tone = 'dashboard' }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const loadNotifications = async () => {
    try {
      const { data } = await notificationsApi.list();
      setNotifications(data.data.notifications || []);
      setUnread(data.data.unread || 0);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 60000);
    return () => clearInterval(id);
  }, []);

  const isHome = tone === 'home';

  return (
    <div className="relative">
      <button
        type="button"
        className={`relative rounded-xl p-2 transition ${
          isHome ? 'text-home-forest/60 hover:bg-home-sand hover:text-home-leaf' : 'hover:bg-blush'
        }`}
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className={`h-5 w-5 ${isHome ? '' : 'text-mauve'}`} />
        {unread > 0 ? (
          <span
            className={`absolute right-1 top-1 h-2 w-2 rounded-full ${
              isHome ? 'bg-home-leaf' : 'bg-rose'
            }`}
          />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border bg-white p-3 shadow-xl border-home-line">
          <div className="mb-2 flex items-center justify-between">
            <p className={`text-sm font-semibold ${isHome ? 'text-home-forest' : 'text-wine'}`}>
              Notifications
            </p>
            <button
              type="button"
              className={`text-xs ${isHome ? 'text-home-leaf' : 'text-rose-deep'}`}
              onClick={async () => {
                await notificationsApi.markAllRead();
                loadNotifications();
              }}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {!notifications.length ? (
              <p className="py-6 text-center text-xs text-ink/50">No notifications</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  className={`w-full rounded-xl p-2 text-left text-xs ${
                    n.read ? 'bg-fog/50' : isHome ? 'bg-home-mint/30' : 'bg-rose-soft/40'
                  }`}
                  onClick={async () => {
                    await notificationsApi.markRead(n._id);
                    loadNotifications();
                  }}
                >
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-ink/60">{n.message}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
