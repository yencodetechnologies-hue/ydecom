import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'About', to: '/register' },
  { label: 'Help Center', to: '/register' },
  { label: 'Contact', to: '/register' },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-blush-line bg-white px-5 py-4 sm:px-7">
      <Link to="/login" className="flex items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-rose font-display text-base font-bold text-white">
          Y
        </span>
        <span className="font-display text-[17px] font-semibold text-wine">YDecom</span>
      </Link>

      <nav
        className={`${
          open ? 'flex' : 'hidden'
        } absolute top-16 left-0 right-0 flex-col items-start gap-0 border-b border-blush-line bg-white px-5 py-2 sm:px-7 md:static md:flex md:flex-row md:items-center md:gap-[26px] md:border-0 md:bg-transparent md:p-0`}
      >
        {navLinks.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            onClick={() => setOpen(false)}
            className="w-full py-2.5 text-[13.5px] font-semibold text-mauve transition hover:text-rose-deep md:w-auto md:py-0"
          >
            {item.label}
          </Link>
        ))}
        <Link
          to="/register"
          onClick={() => setOpen(false)}
          className="mt-2 rounded-full bg-plum px-4 py-2 text-[13.5px] font-semibold text-white md:mt-0"
        >
          Create account
        </Link>
      </nav>

      <button
        type="button"
        className="p-1 md:hidden"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <X className="h-[22px] w-[22px] stroke-wine" />
        ) : (
          <Menu className="h-[22px] w-[22px] stroke-wine" />
        )}
      </button>
    </header>
  );
}
