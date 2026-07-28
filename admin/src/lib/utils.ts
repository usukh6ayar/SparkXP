import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format an ISO date string as a short Mongolian date (e.g. 2026.6.24). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('mn-MN');
}

/**
 * Add `id` to the set if absent, remove it if present — the row-selection
 * toggle every list page needs. Mutates in place, so it fits the
 * `setSelected(s => { const n = new Set(s); toggleInSet(n, id); return n; })`
 * pattern the pages already use.
 *
 * Extracted because the same `n.has(id) ? n.delete(id) : n.add(id)` line was
 * copy-pasted across 4 pages (Words / Idioms / Exercises / IELTS) — and as a
 * bare ternary-as-statement it also tripped `no-unused-expressions`.
 */
export function toggleInSet<T>(set: Set<T>, id: T): void {
  if (set.has(id)) set.delete(id);
  else set.add(id);
}
