import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';

const quickLinks = [
  { label: 'About Us', to: '/register' },
  { label: 'Contact Us', to: '/register' },
  { label: 'Create Account', to: '/register' },
  { label: 'Shop', to: '/shop' },
];

const serviceLinks = [
  { label: 'Help Center', to: '/register' },
  { label: 'Shipping Info', to: '/register' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Payment Methods', to: '/register' },
  { label: 'FAQ', to: '/register' },
];

const socialLinks = [
  {
    label: 'Facebook',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
  {
    label: 'Twitter',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M22 4s-.7 2-2 3c1.4 8.5-7 13-14 9 2.5.2 5-1 6-2-3 0-5-2-5.5-4 1 .2 2 0 2.5-.3C6 9 4.5 7 4.5 5c1 .5 2 .8 3 .8C5 3.5 6 1 8 1c2.5 0 4 2 4 4 1.6 0 3-.6 4-1.5-.3 1.2-1 2.2-2 2.8 1-.1 2-.4 2.8-1z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" />
      </svg>
    ),
  },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-footer font-inter text-[rgba(249,237,241,0.68)]">
      <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-[26px] px-5 pb-[34px] pt-11 sm:grid-cols-2 sm:gap-x-[18px] sm:px-7 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-7">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-rose font-display text-sm font-bold text-white">
              Y
            </span>
            <span className="font-display text-[15px] font-semibold text-white">YDecom</span>
          </div>
          <p className="mb-3.5 max-w-xs text-[12.5px] leading-[1.7] text-[rgba(249,237,241,0.55)]">
            Your trusted marketplace for multi-role commerce — stockists, distributors, retailers
            and customers, with admin-controlled pricing.
          </p>
          <div className="flex gap-2.5">
            {socialLinks.map(({ label, href, icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="m-0 flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[rgba(249,237,241,0.16)] text-[rgba(249,237,241,0.7)] transition hover:text-rose"
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3.5 text-[13.5px] font-bold text-white">Quick Links</h4>
          <ul className="space-y-2.5">
            {quickLinks.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className="block text-[12.5px] text-[rgba(249,237,241,0.68)] no-underline transition hover:text-rose"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3.5 text-[13.5px] font-bold text-white">Customer Service</h4>
          <ul className="space-y-2.5">
            {serviceLinks.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className="block text-[12.5px] text-[rgba(249,237,241,0.68)] no-underline transition hover:text-rose"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3.5 text-[13.5px] font-bold text-white">Contact Info</h4>
          <ul className="space-y-3 text-[12.5px] text-[rgba(249,237,241,0.6)]">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose" strokeWidth={2} />
              <span>No 11, Modern Market, Valvettithurai, Jaffna, Sri Lanka</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose" strokeWidth={2} />
              <a href="tel:0094771164071" className="transition hover:text-rose">
                009 4771164071
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose" strokeWidth={2} />
              <a href="mailto:admin@gmail.com" className="transition hover:text-rose">
                admin@gmail.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[rgba(249,237,241,0.1)] py-4 text-center text-[11.5px] text-[rgba(249,237,241,0.4)]">
        © {year} YDecom. All rights reserved.
      </div>
    </footer>
  );
}
