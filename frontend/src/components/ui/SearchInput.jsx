import { Search } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mauve" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-blush-line bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition placeholder:text-mauve/60 focus:border-rose/40 focus:ring-2 focus:ring-rose/20"
      />
    </div>
  );
}
