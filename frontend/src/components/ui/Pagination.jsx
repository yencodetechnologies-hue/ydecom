export const PAGE_SIZE_OPTIONS = [10, 50, 75, 100];
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

/** Shop / catalog product grid */
export const SHOP_PAGE_SIZE_OPTIONS = [12, 24, 48];
export const DEFAULT_SHOP_PAGE_SIZE = 24;

export default function Pagination({
  page,
  pages,
  onChange,
  total,
  alwaysShow = false,
  limit,
  onLimitChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) {
  const hasPageControls = alwaysShow || (pages && pages > 1);
  const showLimit = typeof onLimitChange === 'function';
  const options = pageSizeOptions?.length ? pageSizeOptions : PAGE_SIZE_OPTIONS;

  if (!hasPageControls && !showLimit) return null;

  const safePages = Math.max(pages || 1, 1);
  const safePage = Math.min(Math.max(page || 1, 1), safePages);
  const safeLimit = options.includes(limit) ? limit : options[0];

  const handleLimitChange = (e) => {
    const next = Number(e.target.value);
    if (options.includes(next)) onLimitChange(next);
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink/60">
        {typeof total === 'number' ? (
          <>
            Total <strong className="text-ink/80">{total}</strong>
            {hasPageControls ? (
              <>
                {' '}
                · Page <strong className="text-ink/80">{safePage}</strong> of{' '}
                <strong className="text-ink/80">{safePages}</strong>
              </>
            ) : null}
          </>
        ) : hasPageControls ? (
          <>
            Page {safePage} of {safePages}
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {showLimit ? (
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <span>Rows per page</span>
            <select
              value={safeLimit}
              onChange={handleLimitChange}
              className="rounded-lg border border-sand bg-white px-2.5 py-1.5 text-sm outline-none ring-rose/30 focus:ring-2"
            >
              {options.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {hasPageControls ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => onChange(safePage - 1)}
              className="rounded-lg border border-sand bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Prev
            </button>
            <span className="min-w-[4.5rem] text-center text-sm text-ink/70">
              {safePage} / {safePages}
            </span>
            <button
              type="button"
              disabled={safePage >= safePages}
              onClick={() => onChange(safePage + 1)}
              className="rounded-lg border border-sand bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
