import { Inbox } from 'lucide-react';

export default function DataTable({ columns, rows, empty = 'No records found' }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-blush-line/80 bg-white shadow-[0_4px_24px_rgba(43,20,32,0.06)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-blush-line/80 bg-gradient-to-r from-blush/80 via-white to-blush/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-wine/70 first:pl-5 last:pr-5 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                  } ${col.headerClassName || ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-blush-line/60">
            {!rows?.length ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center">
                  <div className="mx-auto flex max-w-xs flex-col items-center gap-3 text-ink/45">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blush/60 text-mauve">
                      <Inbox className="h-7 w-7" strokeWidth={1.5} />
                    </span>
                    <p className="text-sm font-medium text-ink/55">{empty}</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id || row._id}
                  className="group transition-colors hover:bg-blush/35"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap px-4 py-3.5 align-middle text-ink/85 first:pl-5 last:pr-5 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                      } ${col.className || ''}`}
                    >
                      {col.render ? col.render(row, index) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
