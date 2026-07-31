/**
 * Pill status switch — mint/teal ON, rose OFF.
 */
export default function StatusToggle({
  checked = false,
  onChange,
  onLabel = 'ON',
  offLabel = 'OFF',
  title,
  disabled = false,
  size = 'md',
  showLabel = true,
  className = '',
}) {
  const isSm = size === 'sm';
  const trackClass = isSm ? 'h-6 w-11' : 'h-7 w-[52px]';
  const knobClass = isSm ? 'h-[18px] w-[18px] top-[3px] left-[3px]' : 'h-5 w-5 top-1 left-1';
  const knobOn = isSm ? 'translate-x-[20px]' : 'translate-x-[24px]';
  const labelClass = isSm ? 'text-[11px]' : 'text-xs';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title || (checked ? onLabel : offLabel)}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange?.(!checked);
      }}
      className={`group inline-flex items-center gap-2.5 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-rose/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span className={`relative inline-block shrink-0 ${trackClass}`}>
        <span
          className={`absolute inset-0 rounded-full transition-all duration-300 ease-out ${
            checked
              ? 'bg-gradient-to-r from-[#3dd68c] to-[#12b981] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_3px_10px_rgba(16,185,129,0.35)]'
              : 'bg-gradient-to-r from-[#ff6b8a] to-[#ff3e76] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_3px_10px_rgba(255,62,118,0.32)]'
          }`}
        >
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/40 to-transparent"
            aria-hidden
          />
        </span>
        <span
          className={`pointer-events-none absolute ${knobClass} rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)] ${
            checked ? knobOn : 'translate-x-0'
          }`}
          aria-hidden
        />
      </span>
      {showLabel ? (
        <span
          className={`${labelClass} min-w-[2.4rem] font-semibold tracking-wide transition-colors duration-200 ${
            checked ? 'text-emerald-700' : 'text-rose-deep'
          }`}
        >
          {checked ? onLabel : offLabel}
        </span>
      ) : null}
    </button>
  );
}
