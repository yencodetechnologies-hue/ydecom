import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logout } from '../../features/auth/authSlice';
import { getNavLinks, groupNavLinks } from '../../config/navLinks';
import { roleLabel } from '../../utils/helpers';

function NavItem({ to, label, icon: Icon, variant, onClose, end = false, nested = false }) {
  const isStorefront = variant === 'storefront';

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      className={({ isActive }) =>
        isStorefront
          ? `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              nested ? 'pl-4' : ''
            } ${
              isActive
                ? 'bg-home-mint/30 text-home-forest shadow-sm ring-1 ring-home-line'
                : 'text-home-forest/70 hover:bg-home-sand hover:text-home-forest'
            }`
          : `relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
              nested ? 'pl-4' : ''
            } ${
              isActive
                ? 'bg-blush text-wine shadow-sm'
                : 'text-mauve hover:bg-blush/60 hover:text-rose-deep'
            }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span
              className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full ${
                isStorefront ? 'bg-home-leaf' : 'bg-rose'
              }`}
            />
          ) : null}
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
              isActive
                ? isStorefront
                  ? 'bg-home-leaf text-white'
                  : 'bg-rose text-white'
                : isStorefront
                  ? 'bg-home-sand/80 text-home-forest/60'
                  : 'bg-transparent text-mauve'
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className={isActive ? 'font-semibold' : ''}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function NavDropdown({ label, icon: Icon, items, variant, onClose }) {
  const location = useLocation();
  const childActive = items.some(
    (child) =>
      location.pathname === child.to || location.pathname.startsWith(`${child.to}/`)
  );
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  const isStorefront = variant === 'storefront';

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={
          isStorefront
            ? `relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                childActive
                  ? 'bg-home-mint/20 text-home-forest'
                  : 'text-home-forest/70 hover:bg-home-sand hover:text-home-forest'
              }`
            : `relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                childActive
                  ? 'bg-blush/70 text-wine'
                  : 'text-mauve hover:bg-blush/60 hover:text-rose-deep'
              }`
        }
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
            childActive
              ? isStorefront
                ? 'bg-home-leaf text-white'
                : 'bg-rose text-white'
              : isStorefront
                ? 'bg-home-sand/80 text-home-forest/60'
                : 'bg-transparent text-mauve'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className={`flex-1 text-left ${childActive ? 'font-semibold' : ''}`}>{label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${
            isStorefront ? 'text-home-forest/50' : 'text-mauve'
          }`}
        />
      </button>
      {open ? (
        <div
          className={`ml-3 space-y-1 border-l pl-2 ${
            isStorefront ? 'border-home-line' : 'border-blush-line'
          }`}
        >
          {items.map(({ to, label: childLabel, icon }) => (
            <NavItem
              key={to + childLabel}
              to={to}
              label={childLabel}
              icon={icon}
              variant={variant}
              onClose={onClose}
              nested
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavSection({ title, links, variant, onClose }) {
  if (!links.length) return null;
  return (
    <div className="space-y-1">
      {title ? (
        <p
          className={`px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider ${
            variant === 'storefront' ? 'text-home-forest/45' : 'text-mauve/80'
          }`}
        >
          {title}
        </p>
      ) : null}
      {links.map((item) =>
        item.children ? (
          <NavDropdown
            key={item.label}
            label={item.label}
            icon={item.icon}
            items={item.children}
            variant={variant}
            onClose={onClose}
          />
        ) : (
          <NavItem
            key={item.to + item.label}
            to={item.to}
            label={item.label}
            icon={item.icon}
            variant={variant}
            onClose={onClose}
            end={item.to === '/'}
          />
        )
      )}
    </div>
  );
}

export default function Sidebar({ open, onClose, variant = 'dashboard' }) {
  const { user } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const isStorefront = variant === 'storefront';
  const links = getNavLinks(user?.role);
  const { store, business } = groupNavLinks(links);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 lg:hidden ${
          isStorefront ? 'bg-home-forest/30 backdrop-blur-sm' : 'bg-wine/40'
        } ${open ? 'block' : 'hidden'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col border-r transition-transform lg:static lg:translate-x-0 ${
          isStorefront
            ? 'border-home-line bg-gradient-to-b from-white via-white to-home-sand/40'
            : 'border-blush-line bg-white'
        } ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`flex items-center justify-between px-5 py-5 ${
            isStorefront ? 'border-b border-home-line/80' : ''
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl font-display text-base font-bold text-white ${
                isStorefront ? 'bg-home-leaf' : 'bg-rose'
              }`}
            >
              Y
            </span>
            <div>
              <p
                className={`font-display text-lg leading-tight ${
                  isStorefront ? 'text-home-forest' : 'text-wine'
                }`}
              >
                YDecom
              </p>
              <p className={`text-[11px] ${isStorefront ? 'text-home-forest/50' : 'text-mauve'}`}>
                {isStorefront ? 'Store & business hub' : 'Distribution Commerce'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={isStorefront ? 'text-home-forest/50 lg:hidden' : 'text-mauve lg:hidden'}
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {user && isStorefront ? (
          <div className="mx-4 mb-2 mt-1 rounded-2xl border border-home-line bg-home-sand/50 px-3.5 py-3">
            <p className="truncate text-sm font-semibold text-home-forest">{user.name}</p>
            {user.shopName ? (
              <p className="truncate text-xs text-home-forest/55">{user.shopName}</p>
            ) : null}
            <span className="mt-2 inline-flex rounded-full bg-home-mint/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-home-forest">
              {roleLabel(user.role)}
            </span>
          </div>
        ) : null}

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-4 pt-2">
          {isStorefront ? (
            <>
              <NavSection title="Store" links={store} variant={variant} onClose={onClose} />
              <NavSection title="Business" links={business} variant={variant} onClose={onClose} />
            </>
          ) : (
            <NavSection links={links} variant={variant} onClose={onClose} />
          )}
        </nav>

        <button
          type="button"
          onClick={() => dispatch(logout())}
          className={`m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
            isStorefront
              ? 'text-home-forest/70 hover:bg-home-sand hover:text-home-forest'
              : 'text-mauve hover:bg-blush/60 hover:text-rose-deep'
          }`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              isStorefront ? 'bg-home-sand text-home-forest/60' : 'text-mauve'
            }`}
          >
            <LogOut className="h-4 w-4" />
          </span>
          Logout
        </button>
      </aside>
    </>
  );
}
