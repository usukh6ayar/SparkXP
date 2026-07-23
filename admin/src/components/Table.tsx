interface Column<T> {
  key: string;
  header: string | React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  empty?: string;
  /** Show shimmer skeleton rows instead of data/empty state while loading. */
  loading?: boolean;
  /** How many skeleton rows to show while loading (default 8). */
  skeletonRows?: number;
}

/** Deterministic varied widths so skeleton bars don't look like a uniform grid. */
const SKELETON_WIDTHS = ['70%', '45%', '85%', '55%', '60%', '40%'];

export function Table<T>({
  columns,
  rows,
  keyFn,
  empty = 'Өгөгдөл байхгүй',
  loading = false,
  skeletonRows = 8,
}: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, r) => (
              <tr key={`sk-${r}`}>
                {columns.map((col, c) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                    <div
                      className="h-4 animate-pulse rounded bg-gray-200"
                      style={{ width: SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length] }}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={keyFn(row)} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
