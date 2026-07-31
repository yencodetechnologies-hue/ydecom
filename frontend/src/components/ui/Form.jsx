import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-wine">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink/60">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const statTones = {
  rose: { chip: 'bg-rose-soft text-rose-deep', circle: 'bg-rose-soft' },
  wine: { chip: 'bg-wine/10 text-wine', circle: 'bg-wine/10' },
  plum: { chip: 'bg-plum/10 text-plum', circle: 'bg-plum/10' },
  mauve: { chip: 'bg-mauve/15 text-mauve', circle: 'bg-mauve/15' },
  amber: { chip: 'bg-amber/15 text-amber', circle: 'bg-amber/15' },
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'rose', trend }) {
  const t = statTones[tone] || statTones.rose;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
      {Icon ? (
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.chip}`}>
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <p className="mt-4 text-sm font-medium text-ink/70">{label}</p>
      <p className="mt-1 font-display text-3xl text-wine">{value}</p>
      {trend ? (
        <p className={`mt-1 text-xs font-semibold ${trend.negative ? 'text-danger' : 'text-emerald-600'}`}>
          {trend.negative ? '▼' : '▲'} {trend.label}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink/45">{hint}</p>
      ) : null}
      <span className={`pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full ${t.circle}`} />
    </div>
  );
}

export function Button({ children, variant = 'primary', className = '', type = 'button', ...props }) {
  const styles = {
    primary: 'bg-rose text-white hover:bg-rose-deep',
    secondary: 'border border-blush-line bg-white text-wine hover:bg-blush',
    danger: 'bg-danger text-white hover:bg-red-700',
    ghost: 'text-rose-deep hover:bg-blush',
  };
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ label, error, icon, className = '', type = 'text', ...props }) {
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-ink/80">{label}</span> : null}
      <span className="relative block">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink/35">
            {icon}
          </span>
        ) : null}
        <input
          type={inputType}
          className={`w-full rounded-xl border border-blush-line bg-white py-2.5 text-sm outline-none ring-rose/30 focus:ring-2 ${
            icon ? 'pl-10' : 'pl-3'
          } ${isPassword ? 'pr-10' : 'pr-3'} ${className}`}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-mauve hover:text-wine"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" strokeWidth={1.8} />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={1.8} />
            )}
          </button>
        ) : null}
      </span>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-ink/80">{label}</span> : null}
      <select
        className={`w-full rounded-xl border border-blush-line bg-white px-3 py-2.5 text-sm outline-none ring-rose/30 focus:ring-2 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function TextArea({ label, error, className = '', ...props }) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-ink/80">{label}</span> : null}
      <textarea
        className={`w-full rounded-xl border border-blush-line bg-white px-3 py-2.5 text-sm outline-none ring-rose/30 focus:ring-2 ${className}`}
        rows={3}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}
